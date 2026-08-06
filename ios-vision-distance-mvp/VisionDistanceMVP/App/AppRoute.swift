import Foundation

enum AppRoute: Hashable {
    case testIntro
    case practice(participantID: String)
    case visionTest(participantID: String)
    case savedSessions
    case storedResult(sessionID: String)
    case privacy
}
