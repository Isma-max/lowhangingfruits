import SwiftUI

struct SessionSummaryView: View {
    @Binding var path: [AppRoute]
    @ObservedObject var draft: NewSessionDraft

    private var files: [URL] {
        guard let id = draft.persistedSessionID else { return [] }
        return ExportManager.fileURLs(forSessionID: id)
    }

    var body: some View {
        VStack(spacing: 20) {
            Image(systemName: "checkmark.seal.fill")
                .font(.system(size: 56))
                .foregroundStyle(.green)

            Text("Sesión finalizada").font(.title2.bold())

            if let id = draft.persistedSessionID {
                Text("ID de sesión: \(id.uuidString.prefix(8))")
                    .font(.footnote.monospaced())
                    .foregroundStyle(.secondary)
            }

            Text("\(files.count) archivo(s) guardados localmente para esta sesión.")
                .font(.subheadline)

            if !files.isEmpty {
                ShareLink(items: files) {
                    Label("Compartir archivos de esta sesión", systemImage: "square.and.arrow.up")
                }
                .buttonStyle(.bordered)
            }

            Button("Volver al inicio") {
                path.removeAll()
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)

            Spacer()
        }
        .padding()
        .navigationBarTitleDisplayMode(.inline)
        .navigationBarBackButtonHidden(true)
    }
}
