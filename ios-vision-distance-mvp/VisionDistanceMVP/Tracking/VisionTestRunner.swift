import Foundation
import Combine
import UIKit
import VisionMVPCore

/// Bridges `FaceTrackingSession` (ARKit) to the pure `VisionTestEngine`,
/// builds the frame-by-frame CSV rows, and persists the whole session
/// through `SessionStore` the moment the engine finishes — synchronously,
/// before the result screen is shown, never from `onDisappear` or a
/// cancellable async task (encargo §2). Save failures surface as
/// `saveState = .failed` with a retry; they are never silenced.
///
/// Optical distance definition (encargo §9, single definition everywhere):
/// `viewing_distance_m` = Euclidean distance from the TrueDepth camera origin
/// (`ARFrame.camera.transform` translation) to the midpoint of both eye
/// transforms (`faceAnchor.transform * left/rightEyeTransform`), i.e.
/// `FaceTrackingSession.LiveSample.distanceMeanEyesMeters`. No camera-to-
/// screen-plane correction is applied in this version (documented in
/// DECISIONS.md). This same value drives the range gate, the stimulus
/// angular sizing, and every export column.
@MainActor
final class VisionTestRunner: ObservableObject {
    struct UIState: Equatable {
        var phaseName: String = "positioning"
        var hint: PositioningHint = .faceNotDetected
        var countdownText: String?
        var effectiveSecondsRemaining: Int = 60
        var validTrials: Int = 0
        var maxTrials: Int = 20
        var progress: Double = 0
        var stimulusOrientation: GapOrientation?
        var stimulusSizePoints: Double = 0
        var isFinished: Bool = false
        var pacingMessage: String?
    }

    enum SaveState: Equatable {
        case idle
        case saving
        case saved
        case failed(String)
    }

    @Published private(set) var uiState = UIState()
    @Published private(set) var saveState: SaveState = .idle
    @Published private(set) var summary: SessionSummary?

    private(set) var sessionID: UUID
    private(set) var engine: VisionTestEngine
    var participantID: String = ""

    private var frameRows: [TestFrameRecord] = []
    private var timingTracker = FrameTimingTracker()
    private var recentDistances: [TimestampedValue] = []
    private var firstFrameTimestamp: TimeInterval?
    private var lastUIUpdateTimestamp: TimeInterval = 0
    private var startedAt = Date()
    private let isoFormatter = ISO8601DateFormatter()

    var hasStarted: Bool { engine.hasStarted }

    init() {
        // One session id shared by the engine's trial rows, the frame rows,
        // the summary, and the on-disk session directory (encargo §15).
        let id = UUID()
        sessionID = id
        engine = Self.makeEngine(sessionID: id)
    }

    private static func makeEngine(sessionID: UUID) -> VisionTestEngine {
        var configuration = VisionTestConfiguration()
        configuration.pointsPerMillimeter = ScreenGeometryHelper.pointsForMillimeters(1.0)
        configuration.pixelsPerPoint = Double(UIScreen.main.scale)
        return VisionTestEngine(configuration: configuration, sessionID: sessionID.uuidString, referenceDate: Date())
    }

    /// Fresh session for "Repetir test" — new engine, new session id, empty
    /// buffers; the participant identifier carries over.
    func restart() {
        sessionID = UUID()
        engine = Self.makeEngine(sessionID: sessionID)
        frameRows = []
        timingTracker = FrameTimingTracker()
        recentDistances = []
        firstFrameTimestamp = nil
        lastUIUpdateTimestamp = 0
        startedAt = Date()
        summary = nil
        saveState = .idle
        uiState = UIState()
    }

    // MARK: Frame ingestion

    func ingest(_ sample: FaceTrackingSession.LiveSample) {
        guard !engine.isFinished else { return }

        let timing = timingTracker.ingest(timestamp: sample.frameTimestamp)
        if firstFrameTimestamp == nil { firstFrameTimestamp = sample.frameTimestamp }
        let elapsedMs = (sample.frameTimestamp - (firstFrameTimestamp ?? sample.frameTimestamp)) * 1000

        let viewingDistance = sample.distanceMeanEyesMeters
        if let viewingDistance {
            let t = sample.frameTimestamp
            recentDistances.append(TimestampedValue(timestamp: t, value: viewingDistance))
            recentDistances.removeAll { t - $0.timestamp > 1.5 }
        }
        let stability = RollingStatsAggregator.windowStats(
            samples: recentDistances,
            now: sample.frameTimestamp,
            windowSeconds: 1.0
        )
        let measurementStable = (stability?.standardDeviation).map { $0 < 0.01 } ?? false

        let frameInput = EngineFrameInput(
            timestamp: sample.frameTimestamp,
            viewingDistanceMeters: viewingDistance,
            faceTracked: sample.isFaceTracked,
            trackingNormal: sample.worldTrackingState == .normal,
            eyesVisible: sample.leftEyeInFrame && sample.rightEyeInFrame
        )

        guard let context = engine.ingest(frameInput) else { return }

        frameRows.append(TestFrameRecord(
            sessionID: sessionID.uuidString,
            timestampISO8601: isoFormatter.string(from: Date()),
            elapsedMs: elapsedMs,
            effectiveTestTimeMs: context.effectiveTestTimeMs,
            viewingDistanceMeters: viewingDistance,
            distanceCameraToFaceMeters: sample.distanceToFaceMeters,
            distanceCameraToLeftEyeMeters: sample.distanceToLeftEyeMeters,
            distanceCameraToRightEyeMeters: sample.distanceToRightEyeMeters,
            yawDegrees: sample.yawDegrees,
            pitchDegrees: sample.pitchDegrees,
            rollDegrees: sample.rollDegrees,
            faceTracked: sample.isFaceTracked,
            worldTrackingState: sample.worldTrackingState.exportValue,
            faceCentered: sample.faceCentered,
            leftEyeInFrame: sample.leftEyeInFrame,
            rightEyeInFrame: sample.rightEyeInFrame,
            insideDistanceRange: context.insideDistanceRange,
            measurementStable: measurementStable,
            valid: context.valid,
            discardReason: context.discardReason,
            actualFrameIntervalMs: timing.intervalMs,
            effectiveFps: timing.effectiveFps,
            testState: context.testState
        ))

        if engine.isFinished {
            persistNow()
            publishUIState(force: true)
            return
        }

        let phaseOrStimulusChanged = uiState.phaseName != currentPhaseName
            || uiState.stimulusOrientation != engine.currentStimulus?.orientation
        publishUIState(force: phaseOrStimulusChanged, at: sample.frameTimestamp)
    }

    func respond(_ orientation: GapOrientation) {
        engine.respond(orientation)
        if engine.isFinished {
            persistNow()
        }
        publishUIState(force: true)
    }

    func abandon() {
        guard !engine.isFinished else { return }
        engine.abandon()
        persistNow()
        publishUIState(force: true)
    }

    func retrySave() {
        persistNow(force: true)
        publishUIState(force: true)
    }

    // MARK: Persistence (encargo §2: synchronous, verified, before result UI)

    private func persistNow(force: Bool = false) {
        guard let result = engine.result else { return }
        guard engine.hasStarted else { return } // backed out of positioning: nothing to save
        if case .saved = saveState, !force { return }

        saveState = .saving

        let resolvedParticipant = participantID.trimmingCharacters(in: .whitespaces).isEmpty
            ? "AUTO-\(sessionID.uuidString.prefix(6))"
            : participantID.trimmingCharacters(in: .whitespaces)

        let info = Bundle.main.infoDictionary
        let builtSummary = SummaryBuilder.build(
            sessionID: sessionID.uuidString,
            participantID: resolvedParticipant,
            result: result,
            trials: engine.trials,
            frames: frameRows,
            startedAt: startedAt,
            completedAt: Date(),
            metadata: SummaryMetadata(
                appVersion: info?["CFBundleShortVersionString"] as? String ?? "0.1",
                buildNumber: info?["CFBundleVersion"] as? String ?? "1",
                deviceModel: CompatibilityChecker.currentDeviceModelIdentifier(),
                systemVersion: UIDevice.current.systemVersion
            )
        )
        summary = builtSummary // kept in memory even if the write fails (§2)

        guard let store = AppSessionStore.shared else {
            saveState = .failed("No se pudo acceder al almacenamiento local.")
            return
        }
        do {
            try store.save(summary: builtSummary, trials: engine.trials, frames: frameRows)
            saveState = .saved
        } catch {
            saveState = .failed(error.localizedDescription)
        }
    }

    // MARK: UI state

    private var currentPhaseName: String {
        switch engine.phase {
        case .positioning: return "positioning"
        case .countdown: return "countdown"
        case .stimulus: return "stimulus"
        case .paused: return "paused"
        case .finished: return "finished"
        }
    }

    private func publishUIState(force: Bool, at timestamp: TimeInterval = 0) {
        if !force {
            guard timestamp - lastUIUpdateTimestamp >= 0.1 else { return }
        }
        lastUIUpdateTimestamp = timestamp

        var state = UIState()
        state.phaseName = currentPhaseName
        state.hint = engine.positioningHint
        if let remaining = engine.countdownSecondsRemaining {
            let value = Int(remaining.rounded(.up))
            state.countdownText = value > 0 ? "\(value)" : "¡Ahora!"
        }
        let config = engine.configuration
        state.effectiveSecondsRemaining = max(0, Int((config.effectiveLimitSeconds - engine.effectiveSeconds).rounded(.up)))
        state.validTrials = engine.validTrialCount
        state.maxTrials = config.maxValidTrials
        state.progress = min(1, max(
            engine.effectiveSeconds / config.effectiveLimitSeconds,
            Double(engine.validTrialCount) / Double(config.maxValidTrials)
        ))
        if let stimulus = engine.currentStimulus, engine.phase == .stimulus {
            state.stimulusOrientation = stimulus.orientation
            state.stimulusSizePoints = ScreenGeometryHelper.pointsForMillimeters(stimulus.totalHeightMillimeters)
        }
        state.isFinished = engine.isFinished
        state.pacingMessage = pacingMessage(for: state)
        if state != uiState {
            uiState = state
        }
    }

    private func pacingMessage(for state: UIState) -> String? {
        guard state.phaseName == "stimulus" else { return nil }
        if state.effectiveSecondsRemaining <= 10 { return "Últimos segundos" }
        if state.effectiveSecondsRemaining <= 15 { return "Ya falta poco" }
        switch state.validTrials {
        case 6...8: return "Buen ritmo"
        case 12...14: return "Sigue así"
        default: return nil
        }
    }
}
