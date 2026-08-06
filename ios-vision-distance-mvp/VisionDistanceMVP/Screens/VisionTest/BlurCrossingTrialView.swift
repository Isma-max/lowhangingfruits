import SwiftUI
import VisionMVPCore

/// Free-movement clear/blurry boundary task (brief objective #2). A single
/// fixed-size stimulus stays on screen; the participant moves the phone and
/// taps the moment their perception crosses between clear and blurry. Also
/// logs the full distance trajectory for each repetition via
/// `DistanceRunRecorder`, reusing the same quality-gated pipeline as the
/// Distance Module, so the marked instants can be checked against the raw
/// trajectory later.
struct BlurCrossingTrialView: View {
    var eyeCondition: EyeCondition
    var correctionUsed: Bool
    var fixedPhysicalSizeMillimeters: Double
    var sessionID: UUID?
    @ObservedObject var testSession: VisionTestSession
    var onFinish: () -> Void

    @EnvironmentObject private var faceTrackingSession: FaceTrackingSession
    @StateObject private var recorder = DistanceRunRecorder()

    @State private var repetition = 1
    @State private var recentDistances: [(timestamp: Date, distanceMeters: Double)] = []
    @State private var isRunningRepetition = false
    @State private var finished = false

    var body: some View {
        VStack(spacing: 20) {
            Text("Cruce claro / borroso").font(.headline)

            Text(
                "Acerca y aleja el teléfono lentamente. Toca \"Marcar aquí\" en el instante " +
                "exacto en que el estímulo cambia entre verse claro y verse borroso, en " +
                "cualquiera de los dos sentidos."
            )
            .font(.footnote)
            .foregroundStyle(.secondary)
            .multilineTextAlignment(.center)
            .padding(.horizontal)

            if let distance = faceTrackingSession.latestSample?.distanceToFaceMeters {
                Text(String(format: "Distancia actual: %.1f cm · repetición %d / 3", distance * 100, repetition))
                    .font(.subheadline.monospacedDigit())
            }

            Spacer()

            if finished {
                VStack(spacing: 12) {
                    Text("Prueba completa").font(.title3.bold())
                    Text("Cruces registrados: \(testSession.crossings.count)").font(.footnote).foregroundStyle(.secondary)
                    Button("Volver") { onFinish() }
                        .buttonStyle(.borderedProminent)
                }
            } else {
                StimulusView(gapOrientation: .up, sizePoints: ScreenGeometryHelper.pointsForMillimeters(fixedPhysicalSizeMillimeters))
                    .frame(height: 160)

                if isRunningRepetition {
                    Button("Marcar aquí") { markCrossing() }
                        .buttonStyle(.borderedProminent)
                        .controlSize(.large)
                        .frame(maxWidth: .infinity)

                    Button("Terminar repetición") { finishRepetition() }
                        .buttonStyle(.bordered)
                } else {
                    Button("Iniciar repetición \(repetition)") { startRepetition() }
                        .buttonStyle(.borderedProminent)
                        .controlSize(.large)
                        .frame(maxWidth: .infinity)
                }
            }

            Spacer()
        }
        .padding()
        .navigationBarTitleDisplayMode(.inline)
        .onReceive(faceTrackingSession.$latestSample) { sample in
            guard let distance = sample?.distanceToFaceMeters else { return }
            let now = Date()
            recentDistances.append((timestamp: now, distanceMeters: distance))
            recentDistances.removeAll { now.timeIntervalSince($0.timestamp) > 1.0 }
        }
    }

    private func startRepetition() {
        isRunningRepetition = true
        recorder.currentMilestoneCentimeters = nil
        recorder.currentRepetition = repetition
        recorder.startRecording(on: faceTrackingSession)
    }

    private func markCrossing() {
        guard let distance = faceTrackingSession.latestSample?.distanceToFaceMeters else { return }
        let direction: CrossingDirection
        if let earliest = recentDistances.first, earliest.distanceMeters < distance {
            direction = .receding
        } else {
            direction = .approaching
        }

        testSession.record(BlurCrossingRecord(
            eyeCondition: eyeCondition,
            correctionUsed: correctionUsed,
            repetition: repetition,
            crossingTimestampISO8601: ISO8601DateFormatter().string(from: Date()),
            distanceAtCrossingMeters: distance,
            direction: direction
        ))
    }

    private func finishRepetition() {
        recorder.stopRecording()
        isRunningRepetition = false
        if let sessionID {
            try? FileStore.writeCSV(
                recorder.frames,
                filename: "distance_frames_blur_crossing_rep\(repetition).csv",
                sessionID: sessionID
            )
        }
        if repetition < 3 {
            repetition += 1
        } else {
            finished = true
        }
    }
}
