import SwiftUI
import VisionMVPCore

/// Static baseline sub-test: fixed viewing distance, 1-up/1-down staircase
/// on physical stimulus size — the "simpler variable" near-VA measurement
/// the dynamic modules are compared against (brief objective #4).
struct StaticBaselineTrialView: View {
    var eyeCondition: EyeCondition
    var correctionUsed: Bool
    @ObservedObject var testSession: VisionTestSession
    var onFinish: () -> Void

    @EnvironmentObject private var faceTrackingSession: FaceTrackingSession

    @State private var staircase = StaircaseController(configuration: .init(
        startingValue: 12, // mm
        initialStepSize: 3,
        minimumStepSize: 0.25,
        minimumValue: 0.5,
        maximumValue: 30,
        reversalsToStop: 8,
        maxTrials: 40,
        reversalsUsedForThreshold: 4
    ))
    @State private var trialIndex = 0
    @State private var currentTruth: GapOrientation = GapOrientation.allDirectionsClockwise.randomElement()!
    @State private var presentedAt = Date()
    @State private var finished = false

    var body: some View {
        VStack(spacing: 20) {
            Text("Prueba basal a distancia fija").font(.headline)

            Text("Sostén el teléfono a una distancia cómoda y estable de lectura, y mantenla durante toda la prueba.")
                .font(.footnote)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal)

            if let distance = faceTrackingSession.latestSample?.distanceToFaceMeters {
                Text(String(format: "Distancia actual: %.1f cm", distance * 100))
                    .font(.subheadline.monospacedDigit())
            }

            Spacer()

            if finished {
                VStack(spacing: 12) {
                    Text("Prueba completa").font(.title3.bold())
                    if let threshold = staircase.thresholdEstimate {
                        Text(String(format: "Tamaño umbral estimado: %.2f mm", threshold))
                    }
                    Text("Ensayos: \(trialIndex)")
                        .font(.footnote).foregroundStyle(.secondary)
                    Button("Volver") { onFinish() }
                        .buttonStyle(.borderedProminent)
                }
            } else {
                StimulusView(gapOrientation: currentTruth, sizePoints: ScreenGeometryHelper.pointsForMillimeters(staircase.currentValue))
                    .frame(height: 160)

                Text("¿Hacia dónde apunta la abertura del anillo? Toca la flecha correspondiente.")
                    .font(.subheadline.weight(.semibold))
                    .multilineTextAlignment(.center)
                    .padding(.horizontal)

                GapDirectionResponsePad { response in
                    respond(response)
                }
            }

            Spacer()
        }
        .padding()
        .navigationBarTitleDisplayMode(.inline)
        .onAppear { presentedAt = Date() }
    }

    private func respond(_ response: GapOrientation) {
        guard !finished else { return }
        let reactionTimeMs = Date().timeIntervalSince(presentedAt) * 1000
        let distance = faceTrackingSession.latestSample?.distanceToFaceMeters ?? .nan
        let correct = response == currentTruth
        let sizeMm = staircase.currentValue
        let angularSize = distance.isFinite && distance > 0
            ? StimulusScaler.angularSizeArcMinutes(physicalSizeMillimeters: sizeMm, distanceMeters: distance)
            : .nan

        let previousStepSize = staircase.currentStepSize
        let reversalsBefore = staircase.reversalValues.count
        staircase.recordResponse(correct: correct)
        let wasReversal = staircase.reversalValues.count > reversalsBefore

        testSession.record(VisionTrialRecord(
            taskPhase: .staticBaseline,
            eyeCondition: eyeCondition,
            correctionUsed: correctionUsed,
            trialIndex: trialIndex,
            timestampISO8601: ISO8601DateFormatter().string(from: Date()),
            distanceMeters: distance,
            physicalSizeMillimeters: sizeMm,
            angularSizeArcMinutes: angularSize,
            gapOrientationTruth: currentTruth,
            response: response,
            correct: correct,
            reactionTimeMilliseconds: reactionTimeMs,
            isReversal: wasReversal,
            stepSize: previousStepSize
        ))

        trialIndex += 1
        if staircase.isComplete {
            finished = true
        } else {
            currentTruth = GapOrientation.allDirectionsClockwise.randomElement()!
            presentedAt = Date()
        }
    }
}
