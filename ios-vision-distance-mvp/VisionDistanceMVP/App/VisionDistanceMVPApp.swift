import SwiftUI

@main
struct VisionDistanceMVPApp: App {
    @StateObject private var faceTrackingSession = FaceTrackingSession()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(faceTrackingSession)
        }
    }
}
