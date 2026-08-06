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
                    case .practice(let participantID):
                        PracticeView(path: $path, participantID: participantID)
                    case .visionTest(let participantID):
                        VisionTestView(path: $path, participantID: participantID)
                    case .savedSessions:
                        SavedSessionsView(path: $path)
                    case .storedResult(let sessionID):
                        StoredResultView(path: $path, sessionID: sessionID)
                    case .privacy:
                        PrivacyInfoView()
                    }
                }
        }
    }
}
