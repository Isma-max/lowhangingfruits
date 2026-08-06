import SwiftUI

/// Brief section 6 Pantalla 1: "Exportar datos" — shares every session's
/// files at once via the system share sheet. No backend, no accounts; files
/// stay local until the investigator explicitly shares them (brief section
/// 3, privacy priority #6).
struct ExportView: View {
    @EnvironmentObject private var sessionRepository: SessionRepository
    @State private var selectedSessionIDs: Set<UUID> = []

    private var sessions: [SessionRecord] { sessionRepository.allSessions() }

    private var selectedFiles: [URL] {
        let ids = selectedSessionIDs.isEmpty ? Set(sessions.map(\.id)) : selectedSessionIDs
        return ExportManager.fileURLs(forAllSessions: Array(ids))
    }

    var body: some View {
        List {
            if sessions.isEmpty {
                Text("No hay sesiones para exportar todavía.")
                    .foregroundStyle(.secondary)
            } else {
                Section("Selecciona sesiones (vacío = todas)") {
                    ForEach(sessions) { session in
                        Button {
                            toggle(session.id)
                        } label: {
                            HStack {
                                Image(systemName: selectedSessionIDs.contains(session.id) ? "checkmark.circle.fill" : "circle")
                                Text(session.participant?.pseudonymousID ?? session.id.uuidString.prefix(8).description)
                                Spacer()
                                Text(session.createdAt.formatted(date: .abbreviated, time: .omitted))
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                        .foregroundStyle(.primary)
                    }
                }

                Section {
                    Text("\(selectedFiles.count) archivo(s) se compartirán.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                    if !selectedFiles.isEmpty {
                        ShareLink(items: selectedFiles) {
                            Label("Compartir", systemImage: "square.and.arrow.up")
                        }
                    }
                }
            }
        }
        .navigationTitle("Exportar datos")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func toggle(_ id: UUID) {
        if selectedSessionIDs.contains(id) {
            selectedSessionIDs.remove(id)
        } else {
            selectedSessionIDs.insert(id)
        }
    }
}
