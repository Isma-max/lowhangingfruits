import SwiftUI

struct SavedSessionsView: View {
    @Binding var path: [AppRoute]
    @EnvironmentObject private var sessionRepository: SessionRepository

    var body: some View {
        List {
            let sessions = sessionRepository.allSessions()
            if sessions.isEmpty {
                Text("Aún no hay sesiones guardadas.")
                    .foregroundStyle(.secondary)
            } else {
                ForEach(sessions) { session in
                    Button {
                        path.append(.sessionDetail(session.id))
                    } label: {
                        VStack(alignment: .leading, spacing: 4) {
                            HStack {
                                Text(session.participant?.pseudonymousID ?? "Sin participante")
                                    .font(.subheadline.weight(.semibold))
                                Spacer()
                                if session.excluded {
                                    Label("Excluida", systemImage: "exclamationmark.triangle.fill")
                                        .font(.caption)
                                        .foregroundStyle(.orange)
                                }
                            }
                            Text(session.createdAt.formatted(date: .abbreviated, time: .shortened))
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                    .foregroundStyle(.primary)
                }
            }
        }
        .navigationTitle("Sesiones guardadas")
        .navigationBarTitleDisplayMode(.inline)
    }
}
