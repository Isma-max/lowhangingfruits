import SwiftUI
import UIKit
import VisionMVPCore

/// Static baseline sub-test (encargo Fase 2, Test A): fixed viewing
/// distance, 2-down/1-up staircase on the optotype's total height — the
/// "simpler variable" near-VA measurement other modules are compared
/// against. Unlike the previous version of this screen, distance is now
/// actively enforced (38-42cm, held ≥500ms before each trial; drifting out
/// mid-trial pauses and discards it, never silently scores it), the whole
/// run is logged frame-by-frame via `DistanceRunRecorder` (not just a point
/// sample per response), and only quality-gated frames feed the staircase.
private enum StaticBaselinePhase: Equatable {
    case settling
    case trial
    case finished
}

struct StaticBaselineTrialView: View {
    var eyeCondition: EyeCondition
    var correctionUsed: Bool
    var sessionID: UUID?
    @ObservedObject var testSession: VisionTestSession
    var onFinish: () -> Void

    @EnvironmentObject private var faceTrackingSession: FaceTrackingSession
    @StateObject private var recorder = DistanceRunRecorder()

    private static let targetDistanceMeters = 0.40
    private static let toleranceMeters = 0.02 // 38-42cm
    private static let requiredStableSeconds = 0.5

    @State private var staircase = StaircaseController(configuration: .init(
        startingValue: 12, // mm, total optotype height
        initialStepSize: 3,
        minimumStepSize: 0.25,
        minimumValue: 0.5,
        maximumValue: 30,
        reversalsToStop: 8,
        maxTrials: 40,
        reversalsUsedForThreshold: 4
        // correctsRequiredToDecrease / incorrectsRequiredToIncrease default to 2 / 1 (2-down/1-up)
    ))
    @State private var phase: StaticBaselinePhase = .settling
    @State private var stableSince: Date?
    @State private var trialIndex = 0
    @State private var currentTruth: GapOrientation = GapOrientation.cardinalDirections.randomElement()!
    @State private var presentedAt = Date()
    @State private var exportMessage: String?

    var body: some View {
        VStack(spacing: 20) {
            Text("Prueba basal a distancia fija").font(.headline)

            distanceStatusView

            Spacer()

            switch phase {
            case .settling: settlingView
            case .trial: trialView
            case .finished: finishedView
            }

            Spacer()
        }
        .padding()
        .navigationBarTitleDisplayMode(.inline)
        .onAppear { recorder.startRecording(on: faceTrackingSession) }
        .onDisappear {
            recorder.stopRecording()
            exportDistanceFrames()
        }
        .onReceive(faceTrackingSession.$latestSample) { sample in
            handle(sample)
        }
    }

    @ViewBuilder
    private var distanceStatusView: some View {
        if let distance = faceTrackingSession.latestSample?.distanceToFaceMeters {
            let inRange = abs(distance - Self.targetDistanceMeters) <= Self.toleranceMeters
            Text(String(format: "Distancia actual: %.1f cm (objetivo: 38–42 cm)", distance * 100))
                .font(.subheadline.monospacedDigit())
                .foregroundStyle(inRange ? .green : .secondary)
        }
    }

    private var settlingView: some View {
        VStack(spacing: 12) {
            Image(systemName: "arrow.left.and.right")
                .font(.largeTitle)
                .foregroundStyle(.secondary)
            Text("Acerca o aleja el teléfono hasta unos 40 cm de tu rostro y mantente quieto un momento.")
                .multilineTextAlignment(.center)
                .font(.subheadline)
            if let stableSince {
                ProgressView(value: min(1, Date().timeIntervalSince(stableSince) / Self.requiredStableSeconds))
                    .frame(width: 160)
            }
        }
        .padding(.horizontal)
    }

    private var trialView: some View {
        VStack(spacing: 16) {
            StimulusView(
                gapOrientation: currentTruth,
                sizePoints: ScreenGeometryHelper.pointsForMillimeters(staircase.currentValue)
            )
            .frame(height: 160)

            Text("¿Hacia dónde apunta la abertura del anillo? Toca la flecha correspondiente.")
                .font(.subheadline.weight(.semibold))
                .multilineTextAlignment(.center)
                .padding(.horizontal)

            GapDirectionResponsePad(orientations: GapOrientation.cardinalDirections) { response in
                respond(response)
            }
        }
    }

    private var finishedView: some View {
        VStack(spacing: 12) {
            Text("Prueba completa").font(.title3.bold())
            if let threshold = staircase.thresholdEstimate {
                let logMAR = StimulusScaler.measurement(
                    totalHeightMillimeters: threshold,
                    distanceMeters: Self.targetDistanceMeters
                ).logMAR
                Text(String(format: "Altura umbral estimada: %.2f mm (logMAR ≈ %.2f a 40cm)", threshold, logMAR))
                    .multilineTextAlignment(.center)
            }
            Text("Ensayos: \(trialIndex)").font(.footnote).foregroundStyle(.secondary)
            if let exportMessage {
                Text(exportMessage).font(.footnote).foregroundStyle(.orange)
            }
            Button("Volver") { onFinish() }
                .buttonStyle(.borderedProminent)
        }
    }

    private func handle(_ sample: FaceTrackingSession.LiveSample?) {
        guard phase != .finished else { return }
        guard let sample, let distance = sample.distanceToFaceMeters else {
            stableSince = nil
            if phase == .trial { phase = .settling }
            return
        }

        let inRange = abs(distance - Self.targetDistanceMeters) <= Self.toleranceMeters
        let now = Date()

        if inRange {
            if stableSince == nil { stableSince = now }
            if phase == .settling, now.timeIntervalSince(stableSince!) >= Self.requiredStableSeconds {
                presentTrial()
            }
        } else {
            stableSince = nil
            if phase == .trial {
                // Drifted out of range mid-trial: pause and hide the
                // stimulus. The trial in progress is simply abandoned
                // (never scored) — the participant sees a fresh trial once
                // they're stable again.
                phase = .settling
            }
        }
    }

    private func presentTrial() {
        currentTruth = GapOrientation.cardinalDirections.randomElement()!
        presentedAt = Date()
        phase = .trial
    }

    private func respond(_ response: GapOrientation) {
        guard phase == .trial else { return }
        let reactionTimeMs = Date().timeIntervalSince(presentedAt) * 1000
        let sample = faceTrackingSession.latestSample
        let distance = sample?.distanceToFaceMeters ?? .nan
        let correct = response == currentTruth
        let totalHeightMm = staircase.currentValue
        let measurementDistance = (distance.isFinite && distance > 0) ? distance : Self.targetDistanceMeters
        let geometry = StimulusScaler.measurement(totalHeightMillimeters: totalHeightMm, distanceMeters: measurementDistance)
        let totalHeightPoints = ScreenGeometryHelper.pointsForMillimeters(totalHeightMm)

        // Only a frame the quality gate accepted right now may feed the
        // staircase — an out-of-range/lost-tracking response is still
        // recorded (never silently dropped) but doesn't move the threshold.
        let frameValid = recorder.latestFrame?.valid ?? false
        let discardReason = recorder.latestFrame?.discardReason

        let previousStepSize = staircase.currentStepSize
        let reversalsBefore = staircase.reversalValues.count
        var wasReversal = false
        if frameValid {
            staircase.recordResponse(correct: correct)
            wasReversal = staircase.reversalValues.count > reversalsBefore
        }

        testSession.record(VisionTrialRecord(
            taskPhase: .staticBaseline,
            eyeCondition: eyeCondition,
            correctionUsed: correctionUsed,
            trialIndex: trialIndex,
            timestampISO8601: ISO8601DateFormatter().string(from: Date()),
            distanceMeters: distance,
            accommodativeDemandDiopters: distance.isFinite && distance > 0
                ? AccommodativeDemand.diopters(distanceMeters: distance) : .nan,
            geometry: geometry,
            totalHeightPoints: totalHeightPoints,
            totalHeightPixels: totalHeightPoints * Double(UIScreen.main.scale),
            gapOrientationTruth: currentTruth,
            response: response,
            correct: correct,
            reactionTimeMilliseconds: reactionTimeMs,
            isReversal: wasReversal,
            stepSize: previousStepSize,
            yawDegrees: sample?.yawDegrees ?? .nan,
            pitchDegrees: sample?.pitchDegrees ?? .nan,
            rollDegrees: sample?.rollDegrees ?? .nan,
            faceTracked: sample?.isFaceTracked ?? false,
            worldTrackingState: sample?.worldTrackingState.exportValue ?? "not_available",
            valid: frameValid,
            discardReason: discardReason,
            staircaseAlgorithm: staircase.configuration.algorithmIdentifier
        ))

        trialIndex += 1

        if frameValid && staircase.isComplete {
            phase = .finished
            recorder.stopRecording()
            exportDistanceFrames()
            return
        }

        // Stay on the trial screen without a settling flicker if the
        // participant never actually left range.
        if let distance = sample?.distanceToFaceMeters,
           abs(distance - Self.targetDistanceMeters) <= Self.toleranceMeters,
           stableSince != nil {
            presentTrial()
        } else {
            phase = .settling
        }
    }

    private func exportDistanceFrames() {
        guard let sessionID else { return }
        do {
            try FileStore.writeCSV(recorder.frames, filename: "distance_frames_static_baseline.csv", sessionID: sessionID)
        } catch {
            exportMessage = "Error al guardar trayectoria: \(error.localizedDescription)"
        }
    }
}
