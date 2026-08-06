import SwiftUI

struct RootView: View {
    @State private var path: [AppRoute] = []

    var body: some View {
        NavigationStack(path: $path) {
            HomeView(path: $path)
                .navigationDestination(for: AppRoute.self) { route in
                    switch route {
                    case .testIntro:
                        TestIntroView(path: $path)
                    case .practice:
                        PracticeView(path: $path)
                    case .visionTest:
                        VisionTestView(path: $path)
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
