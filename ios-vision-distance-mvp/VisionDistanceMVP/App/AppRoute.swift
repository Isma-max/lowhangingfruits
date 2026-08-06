import Foundation

enum AppRoute: Hashable {
    case testIntro
    case practice
    case visionTest
    case savedSessions
    case sessionDetail(UUID)
    case export
    case privacy
}
