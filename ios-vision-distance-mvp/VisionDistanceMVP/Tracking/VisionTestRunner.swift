import Foundation
import Combine
import UIKit
import VisionMVPCore

/// Bridges `FaceTrackingSession` (ARKit) to the pure `VisionTestEngine`,
/// builds the frame-by-frame CSV rows, and writes all three exports when the
/// test ends. All UI state SwiftUI needs is published here, updated at a
/// throttled rate so 60Hz ingestion never means 60Hz re-render.
///
/// Optical distance definition (encargo §9, single definition everywhere):
/// `viewing_distance_m` = Euclidean distance from the TrueDepth camera origin
/// (`ARFrame.camera.transform` translation) to the midpoint plane of both eye
/// transforms (`faceAnchor.transform * left/rightEyeTransform`), i.e.
/// `FaceTrackingSession.LiveSample.distanceMeanEyesMeters`. No camera-to-
/// screen-plane correction is applied in this version (the camera sits a few
/// millimeters above the display; documented limitation in DECISIONS.md).
/// This same value drives the range gate, the stimulus angular sizing, and
/// every export column.
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

    @Published private(set) var uiState = UIState()
    @Published private(set) var finalResult: TestResult?

    private(set) var sessionID: UUID
    private(set) var engine: VisionTestEngine
    private var frameRows: [TestFrameRecord] = []
    private var timingTracker = FrameTimingTracker()
    private var recentDistances: [TimestampedValue] = []
    private var firstFrameTimestamp: TimeInterval?
    private var lastUIUpdateTimestamp: TimeInterval = 0
    private var exported = false
    private let startedAt = Date()
    private let isoFormatter = ISO8601DateFormatter()
    private var repository: SessionRepository?

    init() {
        // One session id shared by the engine's trial rows, the frame rows,
        // the summary, and the on-disk session directory (encargo §26.37).
        let id = UUID()
        sessionID = id
        var configuration = VisionTestConfiguration()
        configuration.pointsPerMillimeter = ScreenGeometryHelper.pointsForMillimeters(1.0)
        configuration.pixelsPerPoint = Double(UIScreen.main.scale)
        engine = VisionTestEngine(configuration: configuration, sessionID: id.uuidString, referenceDate: Date())
    }

    func attach(repository: SessionRepository) {
        self.repository = repository
    }

    /// Fresh session for "Repetir test" — new engine, new session id, empty
    /// buffers. Done in place (not by recreating the SwiftUI view) so the
    /// camera session keeps running without lifecycle races.
    func restart() {
        sessionID = UUID()
        var configuration = VisionTestConfiguration()
        configuration.pointsPerMillimeter = ScreenGeometryHelper.pointsForMillimeters(1.0)
        configuration.pixelsPerPoint = Double(UIScreen.main.scale)
        engine = VisionTestEngine(configuration: configuration, sessionID: sessionID.uuidString, referenceDate: Date())
        frameRows = []
        timingTracker = FrameTimingTracker()
        recentDistances = []
        firstFrameTimestamp = nil
        lastUIUpdateTimestamp = 0
        exported = false
        finalResult = nil
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
            finishAndExport()
            publishUIState(force: true)
            return
        }

        // Throttle UI publishing to ~10Hz; phase/stimulus changes force through.
        let phaseOrStimulusChanged = uiState.phaseName != currentPhaseName
            || uiState.stimulusOrientation != engine.currentStimulus?.orientation
        publishUIState(force: phaseOrStimulusChanged, at: sample.frameTimestamp)
    }

    func respond(_ orientation: GapOrientation) {
        engine.respond(orientation)
        if engine.isFinished {
            finishAndExport()
        }
        publishUIState(force: true)
    }

    func abandon() {
        engine.abandon()
        finishAndExport()
        publishUIState(force: true)
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
        if engine.isFinished, finalResult == nil {
            finalResult = engine.result
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

    // MARK: Export (encargo §22-§24)

    private func finishAndExport() {
        guard !exported, let result = engine.result else { return }
        exported = true

        do {
            try FileStore.writeCSV(frameRows, filename: "test_frames.csv", sessionID: sessionID)
            try FileStore.writeCSV(engine.trials, filename: "vision_trials.csv", sessionID: sessionID)
            try FileStore.writeJSON(buildSummary(result: result), filename: "session_summary.json", sessionID: sessionID)
        } catch {
            // Export failure must never crash the test UI; the session
            // directory simply stays partial and visible as such.
        }

        if let repository {
            let capabilities = CompatibilityChecker.currentCapabilities()
            let record = SessionRecord(
                id: sessionID,
                appVersion: Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "0.1",
                deviceModelIdentifier: capabilities.deviceModelIdentifier,
                iosVersion: capabilities.iosVersion,
                hasTrueDepth: capabilities.hasARFaceTrackingConfiguration,
                hasKnownScreenGeometry: capabilities.hasKnownScreenGeometry,
                cameraAuthorizationStatusRaw: capabilities.cameraAuthorizationStatusRaw,
                wasPortraitOrientation: capabilities.isPortraitOrientation
            )
            repository.insert(record)
            repository.save()
        }
    }

    private func buildSummary(result: TestResult) -> SessionSummary {
        let validTrials = engine.trials.filter { $0.validTrial }
        let corrects = validTrials.filter { $0.correct }.count
        let timeouts = validTrials.filter { $0.timeout }.count
        let errors = validTrials.count - corrects - timeouts
        let reactionTimes = validTrials.compactMap { $0.reactionTimeMs }
        let stimulusFrames = frameRows.filter { $0.testState == "stimulus" }
        let distances = stimulusFrames.compactMap { $0.viewingDistanceMeters }
        let inRangeCount = stimulusFrames.filter { $0.insideDistanceRange }.count
        let validFrames = frameRows.filter { $0.valid }.count

        return SessionSummary(
            sessionID: sessionID.uuidString,
            startedAt: startedAt,
            endedAt: Date(),
            effectiveDurationSeconds: result.effectiveSeconds,
            realDurationSeconds: result.realSeconds,
            validTrials: validTrials.count,
            invalidTrials: engine.trials.count - validTrials.count,
            corrects: corrects,
            errors: errors,
            timeouts: timeouts,
            accuracy: validTrials.isEmpty ? nil : Double(corrects) / Double(validTrials.count),
            medianReactionTimeMs: StatMath.median(reactionTimes),
            medianViewingDistanceMeters: StatMath.median(distances),
            viewingDistanceStandardDeviationMeters: StatMath.standardDeviation(distances),
            percentFramesInsideRange: stimulusFrames.isEmpty ? nil : Double(inRangeCount) / Double(stimulusFrames.count) * 100,
            validFrames: validFrames,
            discardedFrames: frameRows.count - validFrames,
            reversals: result.reversalCount,
            thresholdLogMAR: result.thresholdLogMAR,
            confidence: result.confidence,
            terminationReason: result.terminationReason.rawValue,
            outcome: result.outcome.rawValue
        )
    }
}
