import Foundation

enum AppRoute: Hashable {
    case compatibility
    case consent
    case participantInfo
    case preparation
    case testChoice
    case distanceModule
    case visionTest
    case sessionSummary
    case savedSessions
    case sessionDetail(UUID)
    case export
    case privacy
}
