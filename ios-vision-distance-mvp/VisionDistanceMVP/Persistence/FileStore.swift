import Foundation
import VisionMVPCore

/// Writes/reads the per-session CSV/JSON files backing frame-level and
/// trial-level data (brief section 3: "Persistencia local. Exportación CSV y
/// JSON."). Never writes photos, video, or raw camera frames — only the
/// derived numeric records built elsewhere in the app. Files are buffered in
/// memory for the duration of a single run (at most a few thousand rows for
/// this experiment's short calibration/trial runs) and written out once the
/// run stops, rather than streamed incrementally — simpler, and adequate at
/// this scale; see DECISIONS.md.
enum FileStore {
    enum FileStoreError: Error {
        case couldNotLocateDocumentsDirectory
    }

    private static func sessionsRootURL() throws -> URL {
        guard let documents = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first else {
            throw FileStoreError.couldNotLocateDocumentsDirectory
        }
        let root = documents.appendingPathComponent("Sessions", isDirectory: true)
        if !FileManager.default.fileExists(atPath: root.path) {
            try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        }
        return root
    }

    static func directory(forSessionID id: UUID) throws -> URL {
        let root = try sessionsRootURL()
        let dir = root.appendingPathComponent(id.uuidString, isDirectory: true)
        if !FileManager.default.fileExists(atPath: dir.path) {
            try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        }
        return dir
    }

    static func allSessionDirectories() -> [URL] {
        guard let root = try? sessionsRootURL() else { return [] }
        let contents = (try? FileManager.default.contentsOfDirectory(at: root, includingPropertiesForKeys: nil)) ?? []
        return contents.filter { $0.hasDirectoryPath }
    }

    static func files(inSessionDirectory sessionID: UUID) -> [URL] {
        guard let dir = try? directory(forSessionID: sessionID) else { return [] }
        return (try? FileManager.default.contentsOfDirectory(at: dir, includingPropertiesForKeys: nil)) ?? []
    }

    @discardableResult
    static func writeCSV<T: CSVRepresentable>(_ records: [T], filename: String, sessionID: UUID) throws -> URL {
        let text = CSVEncoder.encode(records)
        let dir = try directory(forSessionID: sessionID)
        let url = dir.appendingPathComponent(filename)
        try text.write(to: url, atomically: true, encoding: .utf8)
        return url
    }

    @discardableResult
    static func writeJSON<T: Encodable>(_ value: T, filename: String, sessionID: UUID) throws -> URL {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        encoder.dateEncodingStrategy = .iso8601
        let data = try encoder.encode(value)
        let dir = try directory(forSessionID: sessionID)
        let url = dir.appendingPathComponent(filename)
        try data.write(to: url, options: .atomic)
        return url
    }
}
