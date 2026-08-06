import SwiftUI
import VisionMVPCore

/// Dynamic sub-tests: the participant freely moves the phone through the
/// 20-80cm range while repeatedly responding to a Landolt C. Unlike the
/// static baseline, there's no staircase here — the app doesn't control
/// distance, the participant's own hand does — so this just logs a stream
/// of (distance, size, angle, correct, RT) trials at whatever distance the
/// participant happens to be at each time (brief objective #3: comparing
/// `.dynamicConstantAngularSize` vs `.dynamicFixedPhysicalSize` runs is what
/// answers "does rescaling matter").
struct DynamicTrialView: View {
    var taskPhase: TaskPhase
    var eyeCondition: EyeCondition
    var correctionUsed: Bool
    var targetAngularSizeArcMinutes: Double
    var fixedPhysicalSizeMillimeters: Double
    var trialCount: Int
    @ObservedObject var testSession: VisionTestSession
    var onFinish: () -> Void

    @EnvironmentObject private var faceTrackingSession: FaceTrackingSession

    @State private var trialIndex = 0
    @State private var currentTruth: GapOrientation = GapOrientation.allDirectionsClockwise.randomElement()!
    @State private var currentSizeMm: Double = 5
    @State private var currentDistanceMeters: Double = .nan
    @State private var presentedAt = Date()
    @State private var finished = false

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
                    Button("Volver") { onFinish() }
                        .buttonStyle(.borderedProminent)
                }
            } else {
                StimulusView(gapOrientation: currentTruth, sizePoints: ScreenGeometryHelper.pointsForMillimeters(currentSizeMm))
                    .frame(height: 160)

                Text("¿Hacia dónde apunta la abertura del anillo? Toca la flecha correspondiente.")
                    .font(.subheadline.weight(.semibold))
                    .multilineTextAlignment(.center)
                    .padding(.horizontal)

                GapDirectionResponsePad { response in
                    respond(response)
                }

                Button("Detener") { finished = true }
                    .buttonStyle(.bordered)
                    .tint(.red)
            }

            Spacer()
        }
        .padding()
        .navigationBarTitleDisplayMode(.inline)
        .onAppear { presentTrial() }
    }

    private func presentTrial() {
        let distance = faceTrackingSession.latestSample?.distanceToFaceMeters ?? .nan
        currentDistanceMeters = distance
        if taskPhase == .dynamicConstantAngularSize, distance.isFinite, distance > 0 {
            currentSizeMm = StimulusScaler.physicalSizeMillimeters(targetAngularSizeArcMinutes: targetAngularSizeArcMinutes, distanceMeters: distance)
        } else {
            currentSizeMm = fixedPhysicalSizeMillimeters
        }
        currentTruth = GapOrientation.allDirectionsClockwise.randomElement()!
        presentedAt = Date()
    }

    private func respond(_ response: GapOrientation) {
        guard !finished else { return }
        let reactionTimeMs = Date().timeIntervalSince(presentedAt) * 1000
        let correct = response == currentTruth
        let angularSize = currentDistanceMeters.isFinite && currentDistanceMeters > 0
            ? StimulusScaler.angularSizeArcMinutes(physicalSizeMillimeters: currentSizeMm, distanceMeters: currentDistanceMeters)
            : .nan

        testSession.record(VisionTrialRecord(
            taskPhase: taskPhase,
            eyeCondition: eyeCondition,
            correctionUsed: correctionUsed,
            trialIndex: trialIndex,
            timestampISO8601: ISO8601DateFormatter().string(from: Date()),
            distanceMeters: currentDistanceMeters,
            physicalSizeMillimeters: currentSizeMm,
            angularSizeArcMinutes: angularSize,
            gapOrientationTruth: currentTruth,
            response: response,
            correct: correct,
            reactionTimeMilliseconds: reactionTimeMs,
            isReversal: false,
            stepSize: 0
        ))

        trialIndex += 1
        if trialIndex >= trialCount {
            finished = true
        } else {
            presentTrial()
        }
    }
}
