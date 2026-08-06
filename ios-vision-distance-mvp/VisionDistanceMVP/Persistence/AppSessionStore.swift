import Foundation
import VisionMVPCore

/// The app's single `SessionStore` instance, rooted in Application Support
/// (encargo §3) — survives app restarts, is excluded from user-visible
/// Documents, and every screen (runner, history, result) reads and writes
/// through this same instance.
enum AppSessionStore {
    static let shared: SessionStore? = {
        guard let base = try? FileManager.default.url(
            for: .applicationSupportDirectory,
            in: .userDomainMask,
            appropriateFor: nil,
            create: true
        ) else { return nil }
        return try? SessionStore(baseDirectory: base)
    }()
}
