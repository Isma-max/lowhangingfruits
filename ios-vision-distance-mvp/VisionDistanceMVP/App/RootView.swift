import SwiftUI

struct RootView: View {
    @State private var path: [AppRoute] = []
    @State private var draft = NewSessionDraft()

    var body: some View {
        NavigationStack(path: $path) {
            HomeView(path: $path, startNewSession: { draft = NewSessionDraft() })
                .navigationDestination(for: AppRoute.self) { route in
                    switch route {
                    case .compatibility:
                        CompatibilityView(path: $path, draft: draft)
                    case .consent:
                        ConsentAndAlarmsView(path: $path, draft: draft)
                    case .participantInfo:
                        ParticipantInfoView(path: $path, draft: draft)
                    case .preparation:
                        PreparationView(path: $path, draft: draft)
                    case .testChoice:
                        TestChoiceView(path: $path, draft: draft)
                    case .distanceModule:
                        DistanceModuleView(draft: draft)
                    case .visionTest:
                        VisionTestSetupView(draft: draft)
                    case .sessionSummary:
                        SessionSummaryView(path: $path, draft: draft)
                    case .savedSessions:
                        SavedSessionsView(path: $path)
                    case .sessionDetail(let id):
                        SessionDetailView(sessionID: id)
                    case .export:
                        ExportView()
                    case .privacy:
                        PrivacyInfoView()
                    }
                }
        }
    }
}
