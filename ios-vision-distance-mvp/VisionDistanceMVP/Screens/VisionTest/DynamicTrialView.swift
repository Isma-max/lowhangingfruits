import SwiftUI
import UIKit
import VisionMVPCore

/// Dynamic sub-tests: the participant freely moves the phone through the
/// 20-80cm range while repeatedly responding to a Landolt C. Unlike the
/// static baseline, there's no staircase here — the app doesn't control
/// distance, the participant's own hand does — so this just logs a stream
/// of (distance, size, angle, correct, RT) trials at whatever distance the
/// participant happens to be at each time (brief objective #3: comparing
/// `.dynamicConstantAngularSize` vs `.dynamicFixedPhysicalSize` runs is what
/// answers "does rescaling matter"). The whole run is also logged
/// frame-by-frame via `DistanceRunRecorder`, and a trial is only scored
/// toward the exported data as `valid` when the quality gate accepted the
/// frame it was answered on.
struct DynamicTrialView: View {
    var taskPhase: TaskPhase
    var eyeCondition: EyeCondition
    var correctionUsed: Bool
    var targetAngularSizeArcMinutes: Double
    var fixedPhysicalSizeMillimeters: Double
    var trialCount: Int
    var sessionID: UUID?
    @ObservedObject var testSession: VisionTestSession
    var onFinish: () -> Void

    @EnvironmentObject private var faceTrackingSession: FaceTrackingSession
    @StateObject private var recorder = DistanceRunRecorder()

    @State private var trialIndex = 0
    @State private var currentTruth: GapOrientation = GapOrientation.cardinalDirections.randomElement()!
    @State private var currentTotalHeightMm: Double = 5
    @State private var currentDistanceMeters: Double = .nan
    @State private var presentedAt = Date()
    @State private var finished = false
    @State private var exportMessage: String?

    var body: some View {
        VStack(spacing: 20) {
            Text(taskPhase == .dynamicConstantAngularSize ? "Dinámica: ángulo constante" : "Dinámica: tamaño fijo")
                .font(.headline)

            Text("Acerca y aleja el teléfono lentamente, entre 20 y 80 cm, mientras respondes cada estímulo lo más rápido posible.")
                .font(.footnote)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal)

            if let distance = faceTrackingSession.latestSample?.distanceToFaceMeters {
                Text(String(format: "Distancia actual: %.1f cm · ensayo %d / %d", distance * 100, trialIndex, trialCount))
                    .font(.subheadline.monospacedDigit())
            }

            Spacer()

            if finished {
                VStack(spacing: 12) {
                    Text("Prueba completa").font(.title3.bold())
                    Text("Ensayos registrados: \(trialIndex)").font(.footnote).foregroundStyle(.secondary)
                    if let exportMessage {
                        Text(exportMessage).font(.footnote).foregroundStyle(.orange)
                    }
                    Button("Volver") { onFinish() }
                        .buttonStyle(.borderedProminent)
                }
            } else {
                StimulusView(
                    gapOrientation: currentTruth,
                    sizePoints: ScreenGeometryHelper.pointsForMillimeters(currentTotalHeightMm)
                )
                .frame(height: 160)

                Text("¿Hacia dónde apunta la abertura del anillo? Toca la flecha correspondiente.")
                    .font(.subheadline.weight(.semibold))
                    .multilineTextAlignment(.center)
                    .padding(.horizontal)

                GapDirectionResponsePad(orientations: GapOrientation.cardinalDirections) { response in
                    respond(response)
                }

                Button("Detener") { finish() }
                    .buttonStyle(.bordered)
                    .tint(.red)
            }

            Spacer()
        }
        .padding()
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            recorder.startRecording(on: faceTrackingSession)
            presentTrial()
        }
        .onDisappear {
            recorder.stopRecording()
            exportDistanceFrames()
        }
    }

    private func presentTrial() {
        let distance = faceTrackingSession.latestSample?.distanceToFaceMeters ?? .nan
        currentDistanceMeters = distance
        if taskPhase == .dynamicConstantAngularSize, distance.isFinite, distance > 0 {
            currentTotalHeightMm = StimulusScaler.physicalSizeMillimeters(
                targetAngularSizeArcMinutes: targetAngularSizeArcMinutes, distanceMeters: distance
            )
        } else {
            currentTotalHeightMm = fixedPhysicalSizeMillimeters
        }
        currentTruth = GapOrientation.cardinalDirections.randomElement()!
        presentedAt = Date()
    }

    private func respond(_ response: GapOrientation) {
        guard !finished else { return }
        let reactionTimeMs = Date().timeIntervalSince(presentedAt) * 1000
        let correct = response == currentTruth
        let sample = faceTrackingSession.latestSample
        let measurementDistance = (currentDistanceMeters.isFinite && currentDistanceMeters > 0) ? currentDistanceMeters : 0.4
        let geometry = StimulusScaler.measurement(totalHeightMillimeters: currentTotalHeightMm, distanceMeters: measurementDistance)
        let totalHeightPoints = ScreenGeometryHelper.pointsForMillimeters(currentTotalHeightMm)

        let frameValid = recorder.latestFrame?.valid ?? false
        let discardReason = recorder.latestFrame?.discardReason

        testSession.record(VisionTrialRecord(
            taskPhase: taskPhase,
            eyeCondition: eyeCondition,
            correctionUsed: correctionUsed,
            trialIndex: trialIndex,
            timestampISO8601: ISO8601DateFormatter().string(from: Date()),
            distanceMeters: currentDistanceMeters,
            accommodativeDemandDiopters: currentDistanceMeters.isFinite && currentDistanceMeters > 0
                ? AccommodativeDemand.diopters(distanceMeters: currentDistanceMeters) : .nan,
            geometry: geometry,
            totalHeightPoints: totalHeightPoints,
            totalHeightPixels: totalHeightPoints * Double(UIScreen.main.scale),
            gapOrientationTruth: currentTruth,
            response: response,
            correct: correct,
            reactionTimeMilliseconds: reactionTimeMs,
            isReversal: false,
            stepSize: 0,
            yawDegrees: sample?.yawDegrees ?? .nan,
            pitchDegrees: sample?.pitchDegrees ?? .nan,
            rollDegrees: sample?.rollDegrees ?? .nan,
            faceTracked: sample?.isFaceTracked ?? false,
            worldTrackingState: sample?.worldTrackingState.exportValue ?? "not_available",
            valid: frameValid,
            discardReason: discardReason,
            staircaseAlgorithm: "none"
        ))

        trialIndex += 1
        if trialIndex >= trialCount {
            finish()
        } else {
            presentTrial()
        }
    }

    private func finish() {
        guard !finished else { return }
        finished = true
        recorder.stopRecording()
        exportDistanceFrames()
    }

    private func exportDistanceFrames() {
        guard let sessionID else { return }
        let filename = taskPhase == .dynamicConstantAngularSize
            ? "distance_frames_dynamic_constant_angular.csv"
            : "distance_frames_dynamic_fixed_physical.csv"
        do {
            try FileStore.writeCSV(recorder.frames, filename: filename, sessionID: sessionID)
        } catch {
            exportMessage = "Error al guardar trayectoria: \(error.localizedDescription)"
        }
    }
}
