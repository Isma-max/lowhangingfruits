import SwiftUI
import SwiftData

@main
struct VisionDistanceMVPApp: App {
    @StateObject private var faceTrackingSession = FaceTrackingSession()
    @StateObject private var deviceMotionMonitor = DeviceMotionMonitor()
    @StateObject private var sessionRepository = SessionRepository(modelContext: SwiftDataStack.shared.mainContext)

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(faceTrackingSession)
                .environmentObject(deviceMotionMonitor)
                .environmentObject(sessionRepository)
                .preferredColorScheme(nil) // follow system; brief priority #7 (appearance) is deliberately last
        }
        .modelContainer(SwiftDataStack.shared)
    }
}
