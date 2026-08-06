import Foundation

/// No backend, no accounts (brief section 4) — export is purely local file
/// sharing via iOS's system share sheet (AirDrop, Files, Mail, etc.), driven
/// from the UI with SwiftUI's `ShareLink(items:)` over the URLs this returns.
/// Files are shared individually (not zipped): zip compression has no simple,
/// dependency-free public API in Foundation, and for this experiment's file
/// counts/sizes plain multi-file sharing is adequate — documented as a
/// deliberate simplification in DECISIONS.md, not an oversight.
enum ExportManager {
    static func fileURLs(forSessionID sessionID: UUID) -> [URL] {
        FileStore.files(inSessionDirectory: sessionID)
    }

    static func fileURLs(forAllSessions sessionIDs: [UUID]) -> [URL] {
        sessionIDs.flatMap { FileStore.files(inSessionDirectory: $0) }
    }
}
