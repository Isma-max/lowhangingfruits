import SwiftUI
import SwiftData

@main
struct VisionDistanceMVPApp: App {
    @StateObject private var faceTrackingSession = FaceTrackingSession()
    @StateObject private var sessionRepository = SessionRepository(modelContext: SwiftDataStack.shared.mainContext)

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(faceTrackingSession)
                .environmentObject(sessionRepository)
        }
        .modelContainer(SwiftDataStack.shared)
    }
}
