import SwiftUI

/// Extremely simple home (encargo §5): one main path, no research tooling,
/// no technical terminology.
struct HomeView: View {
    @Binding var path: [AppRoute]

    var body: some View {
        VStack(spacing: 24) {
            Spacer()

            Image(systemName: "eye")
                .font(.system(size: 56))
                .foregroundStyle(.tint)

            Text("Test de Visión Cercana")
                .font(.largeTitle.bold())
                .multilineTextAlignment(.center)

            Text("Evalúa tu visión cercana en sólo un minuto.")
                .font(.title3)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)

            Spacer()

            Button {
                path.append(.testIntro)
            } label: {
                Text("Comenzar test visual")
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 8)
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)

            Button {
                path.append(.savedSessions)
            } label: {
                Text("Resultados anteriores")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.bordered)
            .controlSize(.large)

            Text("Este test entrega una estimación orientativa y no reemplaza un examen profesional.")
                .font(.footnote)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.top, 8)

            Button("Privacidad") {
                path.append(.privacy)
            }
            .font(.footnote)
            .foregroundStyle(.secondary)
        }
        .padding(24)
        .navigationBarTitleDisplayMode(.inline)
    }
}
