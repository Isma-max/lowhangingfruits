import SwiftUI
import VisionMVPCore

/// Four large practice figures, one per orientation (encargo §7): teaches
/// the response gesture with correct/incorrect feedback, repeatable, and
/// never recorded anywhere — no engine, no staircase, no clock, no export.
struct PracticeView: View {
    @Binding var path: [AppRoute]

    @State private var sequence: [GapOrientation] = GapOrientation.cardinalDirections.shuffled()
    @State private var index = 0
    @State private var mistakes = 0
    @State private var feedback: (correct: Bool, truth: GapOrientation)?
    @State private var finished = false

    var body: some View {
        VStack(spacing: 24) {
            Text("Práctica")
                .font(.title2.bold())

            if finished {
                Spacer()
                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 56))
                    .foregroundStyle(.green)
                Text("¡Listo! Ahora comienza el test de un minuto.")
                    .font(.title3)
                    .multilineTextAlignment(.center)
                if mistakes > 0 {
                    Button("Repetir práctica") { reset() }
                        .buttonStyle(.bordered)
                }
                Spacer()
                Button {
                    path.append(.visionTest)
                } label: {
                    Text("Comenzar test")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 6)
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
            } else {
                Text("¿Hacia dónde apunta la abertura?")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)

                Spacer()

                ZStack {
                    StimulusView(gapOrientation: sequence[index], sizePoints: 110)
                    if let feedback {
                        VStack(spacing: 8) {
                            Image(systemName: feedback.correct ? "checkmark.circle.fill" : "xmark.circle.fill")
                                .font(.system(size: 44))
                                .foregroundStyle(feedback.correct ? .green : .red)
                            if !feedback.correct {
                                Text("La abertura apuntaba \(label(for: feedback.truth))")
                                    .font(.subheadline)
                            }
                        }
                        .padding(16)
                        .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 14))
                    }
                }
                .frame(height: 150)

                Spacer()

                GapDirectionResponsePad(orientations: GapOrientation.cardinalDirections) { response in
                    respond(response)
                }
                .disabled(feedback != nil)

                Text("Figura \(index + 1) de 4 · esto es práctica, no se guarda")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(24)
        .navigationBarTitleDisplayMode(.inline)
    }

    private func respond(_ response: GapOrientation) {
        let truth = sequence[index]
        let correct = response == truth
        if !correct { mistakes += 1 }
        feedback = (correct, truth)
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) {
            feedback = nil
            if index + 1 < sequence.count {
                index += 1
            } else {
                finished = true
            }
        }
    }

    private func reset() {
        sequence = GapOrientation.cardinalDirections.shuffled()
        index = 0
        mistakes = 0
        feedback = nil
        finished = false
    }

    private func label(for orientation: GapOrientation) -> String {
        switch orientation {
        case .up: return "arriba"
        case .down: return "abajo"
        case .left: return "a la izquierda"
        case .right: return "a la derecha"
        default: return orientation.rawValue
        }
    }
}
