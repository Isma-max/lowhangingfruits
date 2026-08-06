import SwiftUI
import VisionMVPCore

/// "Resultados anteriores" (encargo §12): every completely saved session,
/// newest first, read straight from `SessionStore` on disk — so nothing can
/// disappear when the app closes. Tapping a row opens its full result
/// screen with share/repeat.
struct SavedSessionsView: View {
    @Binding var path: [AppRoute]

    @State private var summaries: [SessionSummary] = []

    var body: some View {
        List {
            if summaries.isEmpty {
                Text("Aún no hay resultados guardados.")
                    .foregroundStyle(.secondary)
            } else {
                ForEach(summaries, id: \.sessionID) { summary in
                    Button {
                        path.append(.storedResult(sessionID: summary.sessionID))
                    } label: {
                        row(summary)
                    }
                    .foregroundStyle(.primary)
                }
            }
        }
        .navigationTitle("Resultados anteriores")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            summaries = AppSessionStore.shared?.listSummaries() ?? []
        }
    }

    private func row(_ summary: SessionSummary) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(summary.startedAt.formatted(date: .abbreviated, time: .shortened))
                    .font(.subheadline.weight(.semibold))
                Spacer()
                Text(statusLabel(summary))
                    .font(.caption.weight(.semibold))
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(statusColor(summary).opacity(0.15), in: Capsule())
                    .foregroundStyle(statusColor(summary))
            }
            HStack(spacing: 8) {
                Text("\(Int((summary.effectiveDurationMs / 1000).rounded())) s")
                Text("· \(summary.validTrialCount) figuras")
                if let accuracy = summary.accuracy {
                    Text("· \(Int((accuracy * 100).rounded()))%")
                }
                Text("· \(summary.participantID)")
            }
            .font(.caption)
            .foregroundStyle(.secondary)
            Text(terminationLabel(summary))
                .font(.caption2)
                .foregroundStyle(.tertiary)
        }
    }

    private func statusLabel(_ summary: SessionSummary) -> String {
        switch summary.sessionStatus {
        case "completed": return "Consistente"
        case "approximate": return "Aproximada"
        case "inconclusive": return "No concluyente"
        case "abandoned": return "Abandonada"
        case "technical_interruption": return "Interrumpida"
        default: return summary.sessionStatus
        }
    }

    private func statusColor(_ summary: SessionSummary) -> Color {
        switch summary.sessionStatus {
        case "completed": return .green
        case "approximate": return .orange
        default: return .secondary
        }
    }

    private func terminationLabel(_ summary: SessionSummary) -> String {
        switch summary.terminationReason {
        case "reversals_reached": return "Terminó por umbral encontrado"
        case "max_trials_reached": return "Terminó por máximo de figuras"
        case "effective_time_limit", "real_time_limit": return "Terminó por límite de tiempo"
        case "pause_budget_exceeded": return "Terminó por demasiadas pausas"
        case "abandoned": return "Abandonado por el usuario"
        default: return summary.terminationReason
        }
    }
}

/// Result screen for a stored session (opened from history): same
/// `TestResultScreen`, with "Repetir test" starting a fresh session that
/// reuses the stored participant identifier.
struct StoredResultView: View {
    @Binding var path: [AppRoute]
    var sessionID: String

    var body: some View {
        if let summary = AppSessionStore.shared?.summary(forSessionID: sessionID) {
            TestResultScreen(
                summary: summary,
                saveConfirmed: true,
                onRepeat: {
                    let participant = summary.participantID.hasPrefix("AUTO-") ? "" : summary.participantID
                    path.append(.visionTest(participantID: participant))
                },
                onHome: { path.removeAll() }
            )
        } else {
            VStack(spacing: 12) {
                Image(systemName: "questionmark.folder")
                    .font(.system(size: 44))
                    .foregroundStyle(.secondary)
                Text("No se encontró esta sesión.")
                    .font(.headline)
            }
        }
    }
}
