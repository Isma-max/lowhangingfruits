import SwiftUI

/// Pantalla 1 (brief section 6).
struct HomeView: View {
    @Binding var path: [AppRoute]
    var onStartNewSession: () -> Void
    var onStartQuickTestSession: () -> Void

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Estudio de Distancia Visual")
                        .font(.largeTitle.bold())
                    Text("Nombre provisional del experimento — prototipo de investigación")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }

                Label("Prototipo de investigación", systemImage: "flask")
                    .font(.headline)
                    .padding(10)
                    .background(.yellow.opacity(0.2), in: RoundedRectangle(cornerRadius: 10))

                Text(
                    "Esta app explora si un iPhone con cámara TrueDepth puede medir, de forma " +
                    "orientativa, la distancia entre los ojos de una persona y la pantalla, y cómo " +
                    "esa distancia se relaciona con la dificultad para ver de cerca. Se usa en " +
                    "sesiones supervisadas por un investigador, comparando los resultados con un " +
                    "examen optométrico real."
                )
                .font(.body)

                Text(
                    "Este prototipo es una herramienta de investigación. No diagnostica " +
                    "presbicia, no genera recetas y no reemplaza una evaluación oftalmológica " +
                    "u optométrica."
                )
                .font(.callout.weight(.semibold))
                .padding(12)
                .background(.orange.opacity(0.15), in: RoundedRectangle(cornerRadius: 10))

                VStack(spacing: 12) {
                    Button {
                        onStartNewSession()
                    } label: {
                        Label("Nueva sesión", systemImage: "plus.circle.fill")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.large)

                    #if DEBUG
                    Button {
                        onStartQuickTestSession()
                    } label: {
                        Label("Sesión rápida de prueba (dev)", systemImage: "hare.fill")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)
                    .controlSize(.large)
                    #endif

                    Button {
                        path.append(.savedSessions)
                    } label: {
                        Label("Sesiones guardadas", systemImage: "tray.full")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)
                    .controlSize(.large)

                    Button {
                        path.append(.export)
                    } label: {
                        Label("Exportar datos", systemImage: "square.and.arrow.up")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)
                    .controlSize(.large)

                    Button {
                        path.append(.privacy)
                    } label: {
                        Label("Información de privacidad", systemImage: "hand.raised")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.plain)
                    .foregroundStyle(.secondary)
                    .padding(.top, 4)
                }
                .padding(.top, 8)
            }
            .padding()
        }
        .navigationBarTitleDisplayMode(.inline)
    }
}
