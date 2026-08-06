import SwiftUI

/// Interstitial after Preparation: the investigator picks which experimental
/// module to run next, and can run both before finishing the session.
struct TestChoiceView: View {
    @Binding var path: [AppRoute]
    @ObservedObject var draft: NewSessionDraft

    var body: some View {
        VStack(spacing: 20) {
            Text("¿Qué módulo quieres ejecutar?")
                .font(.title2.bold())
                .multilineTextAlignment(.center)

            if let capabilities = draft.capabilities, !capabilities.isCompatible {
                Text("El dispositivo no es compatible con el módulo de distancia; solo estará disponible si se resuelve la compatibilidad.")
                    .font(.footnote)
                    .foregroundStyle(.red)
            }

            Button {
                path.append(.distanceModule)
            } label: {
                Label("Módulo de caracterización de distancia", systemImage: "ruler")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
            .disabled(draft.capabilities?.isCompatible != true)

            Button {
                path.append(.visionTest)
            } label: {
                Label("Módulo de test visual", systemImage: "eye")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)

            Button("Finalizar sesión") {
                path.append(.sessionSummary)
            }
            .buttonStyle(.bordered)
            .padding(.top, 12)

            Spacer()
        }
        .padding()
        .navigationBarTitleDisplayMode(.inline)
    }
}
