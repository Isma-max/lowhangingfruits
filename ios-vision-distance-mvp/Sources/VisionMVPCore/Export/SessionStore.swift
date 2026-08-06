import Foundation

/// Reliable local persistence for finished test sessions (encargo §3).
///
/// Layout under `baseDirectory` (the app passes Application Support):
/// ```
/// Sessions/{session_id}/
///   session_summary.json
///   vision_trials.csv
///   distance_frames.csv
///   README.txt
///   session_complete.json   (manifest, written LAST -> marks a complete save)
/// Exports/
///   vision_test_<date>_<short_id>.zip   (created on demand, kept afterwards)
/// ```
///
/// Every file is written atomically (temp file -> validate -> replace) and
/// verified to exist and be non-empty before the save is reported as
/// successful. Failures THROW — they are never silenced; the UI shows them
/// and offers a retry (the fix for the empty-catch bug this iteration
/// diagnosed). Each session lives in its own UUID directory, so saving a new
/// session can never overwrite an earlier one.
public final class SessionStore {
    public enum StoreError: LocalizedError {
        case validationFailed(String)
        case writeFailed(String)
        case zipFailed(String)
        case sessionNotFound(String)

        public var errorDescription: String? {
            switch self {
            case .validationFailed(let detail): return "Validación fallida: \(detail)"
            case .writeFailed(let detail): return "Escritura fallida: \(detail)"
            case .zipFailed(let detail): return "No se pudo generar el ZIP: \(detail)"
            case .sessionNotFound(let id): return "Sesión no encontrada: \(id)"
            }
        }
    }

    public struct StoredFiles: Sendable {
        public var directory: URL
        public var summaryURL: URL
        public var trialsURL: URL
        public var framesURL: URL
        public var readmeURL: URL

        /// The files worth sharing (excludes the internal manifest).
        public var shareableURLs: [URL] { [summaryURL, trialsURL, framesURL, readmeURL] }
    }

    public let sessionsDirectory: URL
    public let exportsDirectory: URL
    private let fileManager = FileManager.default
    private let jsonEncoder: JSONEncoder
    private let jsonDecoder: JSONDecoder

    public init(baseDirectory: URL) throws {
        sessionsDirectory = baseDirectory.appendingPathComponent("Sessions", isDirectory: true)
        exportsDirectory = baseDirectory.appendingPathComponent("Exports", isDirectory: true)
        jsonEncoder = JSONEncoder()
        jsonEncoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        jsonEncoder.dateEncodingStrategy = .iso8601
        jsonDecoder = JSONDecoder()
        jsonDecoder.dateDecodingStrategy = .iso8601
        do {
            try fileManager.createDirectory(at: sessionsDirectory, withIntermediateDirectories: true)
            try fileManager.createDirectory(at: exportsDirectory, withIntermediateDirectories: true)
        } catch {
            throw StoreError.writeFailed("no se pudo crear el directorio base: \(error.localizedDescription)")
        }
    }

    // MARK: Save (encargo §2 order: write -> verify -> only then report saved)

    @discardableResult
    public func save(summary: SessionSummary, trials: [TrialRecord], frames: [TestFrameRecord]) throws -> StoredFiles {
        // Cross-file consistency (encargo §15) before anything touches disk.
        guard trials.allSatisfy({ $0.sessionID == summary.sessionID }) else {
            throw StoreError.validationFailed("vision_trials contiene session_id distinto al del resumen")
        }
        guard frames.allSatisfy({ $0.sessionID == summary.sessionID }) else {
            throw StoreError.validationFailed("distance_frames contiene session_id distinto al del resumen")
        }
        guard trials.count == summary.validTrialCount + summary.invalidTrialCount else {
            throw StoreError.validationFailed("el resumen no coincide con el número de ensayos (\(trials.count) vs \(summary.validTrialCount + summary.invalidTrialCount))")
        }
        guard !trials.isEmpty else {
            throw StoreError.validationFailed("la sesión no contiene ningún ensayo")
        }

        let directory = sessionsDirectory.appendingPathComponent(summary.sessionID, isDirectory: true)
        do {
            try fileManager.createDirectory(at: directory, withIntermediateDirectories: true)
        } catch {
            throw StoreError.writeFailed("no se pudo crear la carpeta de la sesión: \(error.localizedDescription)")
        }

        let summaryData = try encodeSummary(summary)
        let trialsData = Data(CSVEncoder.encode(trials).utf8)
        let framesData = Data(CSVEncoder.encode(frames).utf8)
        let readmeData = Data(ExportReadme.text(summary: summary).utf8)

        let files = StoredFiles(
            directory: directory,
            summaryURL: directory.appendingPathComponent("session_summary.json"),
            trialsURL: directory.appendingPathComponent("vision_trials.csv"),
            framesURL: directory.appendingPathComponent("distance_frames.csv"),
            readmeURL: directory.appendingPathComponent("README.txt")
        )

        try atomicWrite(summaryData, to: files.summaryURL)
        try atomicWrite(trialsData, to: files.trialsURL)
        try atomicWrite(framesData, to: files.framesURL)
        try atomicWrite(readmeData, to: files.readmeURL)

        // Re-verify everything exists and is non-empty, then round-trip the
        // summary so a corrupted write can never be reported as success.
        for url in files.shareableURLs {
            try verifyNonEmpty(url)
        }
        let reread = try Data(contentsOf: files.summaryURL)
        guard (try? jsonDecoder.decode(SessionSummary.self, from: reread)) != nil else {
            throw StoreError.validationFailed("el resumen guardado no se puede releer")
        }

        // Manifest LAST: its presence marks a fully completed save.
        let manifest: [String: String] = [
            "schema_version": InstrumentVersions.exportSchemaVersion,
            "session_id": summary.sessionID,
            "saved_at": ISO8601DateFormatter().string(from: Date()),
            "files": "session_summary.json,vision_trials.csv,distance_frames.csv,README.txt",
        ]
        let manifestData = try JSONSerialization.data(withJSONObject: manifest, options: [.prettyPrinted, .sortedKeys])
        try atomicWrite(manifestData, to: directory.appendingPathComponent("session_complete.json"))

        return files
    }

    private func encodeSummary(_ summary: SessionSummary) throws -> Data {
        do {
            return try jsonEncoder.encode(summary)
        } catch {
            throw StoreError.writeFailed("no se pudo codificar el resumen: \(error.localizedDescription)")
        }
    }

    private func atomicWrite(_ data: Data, to url: URL) throws {
        guard !data.isEmpty else {
            throw StoreError.validationFailed("intento de escribir un archivo vacío: \(url.lastPathComponent)")
        }
        let temporary = url.deletingLastPathComponent()
            .appendingPathComponent(".tmp-\(url.lastPathComponent)")
        do {
            try data.write(to: temporary, options: .atomic)
            if fileManager.fileExists(atPath: url.path) {
                try fileManager.removeItem(at: url)
            }
            try fileManager.moveItem(at: temporary, to: url)
        } catch let error as StoreError {
            throw error
        } catch {
            try? fileManager.removeItem(at: temporary)
            throw StoreError.writeFailed("\(url.lastPathComponent): \(error.localizedDescription)")
        }
        try verifyNonEmpty(url)
    }

    private func verifyNonEmpty(_ url: URL) throws {
        guard let size = try? fileManager.attributesOfItem(atPath: url.path)[.size] as? NSNumber,
              size.intValue > 0 else {
            throw StoreError.writeFailed("\(url.lastPathComponent) no existe o está vacío tras escribir")
        }
    }

    // MARK: Reading / history (encargo §12)

    /// All completely saved sessions (manifest present), newest first.
    public func listSummaries() -> [SessionSummary] {
        guard let contents = try? fileManager.contentsOfDirectory(at: sessionsDirectory, includingPropertiesForKeys: nil) else {
            return []
        }
        var summaries: [SessionSummary] = []
        for directory in contents where directory.hasDirectoryPath {
            let manifest = directory.appendingPathComponent("session_complete.json")
            guard fileManager.fileExists(atPath: manifest.path),
                  let data = try? Data(contentsOf: directory.appendingPathComponent("session_summary.json")),
                  let summary = try? jsonDecoder.decode(SessionSummary.self, from: data) else {
                continue
            }
            summaries.append(summary)
        }
        return summaries.sorted { $0.startedAt > $1.startedAt }
    }

    public func summary(forSessionID id: String) -> SessionSummary? {
        let url = sessionsDirectory.appendingPathComponent(id, isDirectory: true)
            .appendingPathComponent("session_summary.json")
        guard let data = try? Data(contentsOf: url) else { return nil }
        return try? jsonDecoder.decode(SessionSummary.self, from: data)
    }

    /// The session's files, verified to exist and be non-empty.
    public func files(forSessionID id: String) throws -> StoredFiles {
        let directory = sessionsDirectory.appendingPathComponent(id, isDirectory: true)
        let files = StoredFiles(
            directory: directory,
            summaryURL: directory.appendingPathComponent("session_summary.json"),
            trialsURL: directory.appendingPathComponent("vision_trials.csv"),
            framesURL: directory.appendingPathComponent("distance_frames.csv"),
            readmeURL: directory.appendingPathComponent("README.txt")
        )
        guard fileManager.fileExists(atPath: directory.path) else {
            throw StoreError.sessionNotFound(id)
        }
        for url in files.shareableURLs {
            try verifyNonEmpty(url)
        }
        return files
    }

    // MARK: Export ZIP (encargo §10)

    /// Builds (or rebuilds) the export ZIP for a session and returns its URL.
    /// Verifies the inputs first (headers, ≥1 trial row, shared session_id)
    /// and the output afterwards (exists, non-empty, ZIP magic bytes). The
    /// ZIP is kept in `Exports/` until a later cleanup — never deleted right
    /// after sharing (encargo §10). Uses `NSFileCoordinator`'s `.forUploading`
    /// directory zipping, which needs no third-party dependency.
    public func exportZip(forSessionID id: String) throws -> URL {
        let stored = try files(forSessionID: id)
        guard let summary = summary(forSessionID: id) else {
            throw StoreError.sessionNotFound(id)
        }

        // Input validation (encargo §10 pasos 1-4).
        let trialsText = (try? String(contentsOf: stored.trialsURL, encoding: .utf8)) ?? ""
        let trialLines = trialsText.components(separatedBy: "\r\n").filter { !$0.isEmpty }
        guard trialLines.first == TrialRecord.csvHeader.joined(separator: ",") else {
            throw StoreError.validationFailed("vision_trials.csv no tiene el encabezado esperado")
        }
        guard trialLines.count >= 2 else {
            throw StoreError.validationFailed("vision_trials.csv no contiene ensayos")
        }
        guard trialLines.dropFirst().allSatisfy({ $0.hasPrefix(summary.sessionID) }) else {
            throw StoreError.validationFailed("vision_trials.csv contiene session_id distinto")
        }

        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd_HH-mm-ss"
        let shortID = String(summary.sessionID.prefix(8)).lowercased()
        let zipName = "vision_test_\(formatter.string(from: summary.startedAt))_\(shortID).zip"
        let destination = exportsDirectory.appendingPathComponent(zipName)

        if fileManager.fileExists(atPath: destination.path) {
            try? fileManager.removeItem(at: destination)
        }

        var coordinatorError: NSError?
        var copyError: Error?
        let coordinator = NSFileCoordinator()
        coordinator.coordinate(readingItemAt: stored.directory, options: .forUploading, error: &coordinatorError) { zippedURL in
            do {
                try fileManager.copyItem(at: zippedURL, to: destination)
            } catch {
                copyError = error
            }
        }
        if let coordinatorError {
            throw StoreError.zipFailed(coordinatorError.localizedDescription)
        }
        if let copyError {
            throw StoreError.zipFailed(copyError.localizedDescription)
        }

        // Output validation: exists, non-empty, real ZIP ("PK" magic bytes).
        try verifyNonEmpty(destination)
        guard let handle = try? FileHandle(forReadingFrom: destination),
              let magic = try? handle.read(upToCount: 2),
              magic == Data([0x50, 0x4B]) else {
            throw StoreError.zipFailed("el archivo generado no es un ZIP válido")
        }

        return destination
    }
}
