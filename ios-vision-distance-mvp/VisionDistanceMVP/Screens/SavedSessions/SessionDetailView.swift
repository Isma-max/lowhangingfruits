import SwiftUI

struct SessionDetailView: View {
    var sessionID: UUID
    @EnvironmentObject private var sessionRepository: SessionRepository

    private var session: SessionRecord? {
        sessionRepository.allSessions().first { $0.id == sessionID }
    }

    private var files: [URL] { ExportManager.fileURLs(forSessionID: sessionID) }

    var body: some View {
        List {
            if let session {
                Section("Sesión") {
                    LabeledContent("Fecha", value: session.createdAt.formatted(date: .abbreviated, time: .shortened))
                    LabeledContent("Dispositivo", value: session.deviceModelIdentifier)
                    LabeledContent("iOS", value: session.iosVersion)
                }
            }

            Section("Archivos (\(files.count))") {
                if files.isEmpty {
                    Text("Sin archivos exportados todavía.")
                        .foregroundStyle(.secondary)
                } else {
                    ForEach(files, id: \.self) { url in
                        Text(url.lastPathComponent).font(.footnote.monospaced())
                    }
                    ShareLink(items: files) {
                        Label("Compartir todos", systemImage: "square.and.arrow.up")
                    }
                }
            }
        }
        .navigationTitle("Detalle de sesión")
        .navigationBarTitleDisplayMode(.inline)
    }
}
