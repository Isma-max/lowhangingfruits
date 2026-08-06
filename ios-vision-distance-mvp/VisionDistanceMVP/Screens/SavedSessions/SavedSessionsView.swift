import SwiftUI

/// "Resultados anteriores": lists finished test sessions by date; detail
/// screen shares the per-session files. The bulk exporter is tucked into the
/// toolbar — useful for development, invisible on the main path.
struct SavedSessionsView: View {
    @Binding var path: [AppRoute]
    @EnvironmentObject private var sessionRepository: SessionRepository

    var body: some View {
        List {
            let sessions = sessionRepository.allSessions()
            if sessions.isEmpty {
                Text("Aún no hay resultados guardados.")
                    .foregroundStyle(.secondary)
            } else {
                ForEach(sessions) { session in
                    Button {
                        path.append(.sessionDetail(session.id))
                    } label: {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Test visual")
                                .font(.subheadline.weight(.semibold))
                            Text(session.createdAt.formatted(date: .abbreviated, time: .shortened))
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                    .foregroundStyle(.primary)
                }
            }
        }
        .navigationTitle("Resultados anteriores")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    path.append(.export)
                } label: {
                    Image(systemName: "square.and.arrow.up")
                }
            }
        }
    }
}
