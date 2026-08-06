import XCTest
@testable import VisionMVPCore

/// Encargo §17: persistencia, consistencia y exportación.
final class SessionStoreTests: XCTestCase {
    private var baseDirectory: URL!

    override func setUpWithError() throws {
        baseDirectory = FileManager.default.temporaryDirectory
            .appendingPathComponent("SessionStoreTests-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: baseDirectory, withIntermediateDirectories: true)
    }

    override func tearDownWithError() throws {
        try? FileManager.default.removeItem(at: baseDirectory)
    }

    // MARK: Fixtures

    private func makeTrial(sessionID: String, index: Int, correct: Bool, timeout: Bool = false, valid: Bool = true) -> TrialRecord {
        TrialRecord(
            sessionID: sessionID,
            trialID: "\(sessionID)-\(index)",
            trialIndex: index,
            timestampPresentedISO8601: "2026-08-07T10:00:0\(index % 10)Z",
            timestampAnsweredISO8601: timeout ? nil : "2026-08-07T10:00:0\(index % 10)Z",
            effectiveElapsedMs: Double(index) * 1000,
            stimulusType: "landolt_c",
            orientationTruth: .up,
            response: timeout ? nil : (correct ? .up : .down),
            correct: correct,
            timeout: timeout,
            reactionTimeMs: timeout ? nil : 800,
            logMARLevel: 0.5 - Double(index) * 0.05,
            stimulusHeightPoints: 20,
            stimulusHeightPixels: 60,
            stimulusHeightMillimeters: 3.5 - Double(index) * 0.1,
            totalVisualAngleArcMinutes: 15,
            criticalDetailArcMinutes: 3.0 - Double(index) * 0.05,
            viewingDistanceMeters: 0.40,
            accommodativeDemandDiopters: 2.5,
            consecutiveCorrectBefore: 0,
            consecutiveCorrectAfter: correct ? 1 : 0,
            staircaseDirectionBefore: "down",
            staircaseDirectionAfter: "down",
            isReversal: false,
            reversalCount: 0,
            validTrial: valid,
            invalidReason: valid ? nil : "interrupted_by_pause",
            repeatedAfterPause: false,
            terminationReason: "max_trials_reached"
        )
    }

    private func makeFrame(sessionID: String, index: Int) -> TestFrameRecord {
        TestFrameRecord(
            sessionID: sessionID,
            timestampISO8601: "2026-08-07T10:00:00Z",
            elapsedMs: Double(index) * 16.7,
            effectiveTestTimeMs: Double(index) * 16.7,
            viewingDistanceMeters: 0.40,
            distanceCameraToFaceMeters: 0.39,
            distanceCameraToLeftEyeMeters: 0.40,
            distanceCameraToRightEyeMeters: 0.40,
            yawDegrees: 0, pitchDegrees: 0, rollDegrees: 0,
            faceTracked: true, worldTrackingState: "normal", faceCentered: true,
            leftEyeInFrame: true, rightEyeInFrame: true,
            insideDistanceRange: true, measurementStable: true,
            valid: true, discardReason: nil,
            actualFrameIntervalMs: 16.7, effectiveFps: 60,
            testState: "stimulus"
        )
    }

    private func makeSummary(sessionID: String, participantID: String = "TEST-01", trials: [TrialRecord], startedAt: Date = Date(), status: String = "approximate") -> SessionSummary {
        let valid = trials.filter { $0.validTrial }
        let corrects = valid.filter { $0.correct }.count
        let timeouts = valid.filter { $0.timeout }.count
        return SessionSummary(
            sessionID: sessionID,
            participantID: participantID,
            startedAt: startedAt,
            completedAt: startedAt.addingTimeInterval(60),
            wallDurationMs: 60000,
            effectiveDurationMs: 48000,
            sessionStatus: status,
            qualityClassification: status == "completed" ? "consistent" : status,
            terminationReason: "max_trials_reached",
            explanationCodes: ["few_reversals"],
            validTrialCount: valid.count,
            invalidTrialCount: trials.count - valid.count,
            correctCount: corrects,
            incorrectCount: valid.count - corrects - timeouts,
            timeoutCount: timeouts,
            accuracy: valid.isEmpty ? nil : Double(corrects) / Double(valid.count),
            medianReactionTimeMs: 800,
            medianViewingDistanceM: 0.398,
            distanceStandardDeviationM: 0.004,
            percentFramesInsideRange: 97.0,
            validFrameRatio: 0.99,
            reversalCount: 3,
            reversalSpreadLogmar: 0.08,
            estimatedThresholdLogmar: 0.25,
            thresholdConfidence: "low",
            bestCorrectLogmar: 0.3,
            bestCorrectHeightMm: 2.9,
            bestCorrectDetailArcmin: 2.0,
            appVersion: "0.1.0",
            buildNumber: "1",
            deviceModel: "iPhone16,2",
            systemVersion: "18.0"
        )
    }

    private func makeStore() throws -> SessionStore {
        try SessionStore(baseDirectory: baseDirectory)
    }

    private func saveSampleSession(store: SessionStore, sessionID: String = UUID().uuidString, startedAt: Date = Date(), status: String = "approximate") throws -> SessionSummary {
        let trials = (0..<12).map { makeTrial(sessionID: sessionID, index: $0, correct: $0 % 3 != 0) }
        let frames = (0..<100).map { makeFrame(sessionID: sessionID, index: $0) }
        let summary = makeSummary(sessionID: sessionID, trials: trials, startedAt: startedAt, status: status)
        try store.save(summary: summary, trials: trials, frames: frames)
        return summary
    }

    // MARK: §17.1/§17.12/§17.13 — el guardado es síncrono, verificado, y
    // cubre también sesiones aproximadas y no concluyentes.

    func testSaveCreatesAllFilesNonEmptyForEveryStatus() throws {
        let store = try makeStore()
        for status in ["completed", "approximate", "inconclusive", "abandoned", "technical_interruption"] {
            let summary = try saveSampleSession(store: store, status: status)
            let files = try store.files(forSessionID: summary.sessionID)
            for url in files.shareableURLs {
                let size = try FileManager.default.attributesOfItem(atPath: url.path)[.size] as? NSNumber
                XCTAssertGreaterThan(size?.intValue ?? 0, 0, "\(url.lastPathComponent) vacío para status \(status)")
            }
        }
    }

    // §17.2/§17.3 — la sesión sigue disponible desde una NUEVA instancia del
    // store (equivale a volver al inicio / reabrir la app).

    func testSessionSurvivesNewStoreInstance() throws {
        let summary = try saveSampleSession(store: try makeStore())
        let freshStore = try makeStore() // "app relaunch"
        let listed = freshStore.listSummaries()
        XCTAssertEqual(listed.count, 1)
        XCTAssertEqual(listed.first?.sessionID, summary.sessionID)
        XCTAssertEqual(listed.first, summary) // full decode round-trip
    }

    // §17.4 — dos sesiones no se sobrescriben.

    func testTwoSessionsDoNotOverwrite() throws {
        let store = try makeStore()
        let first = try saveSampleSession(store: store)
        let second = try saveSampleSession(store: store)
        XCTAssertNotEqual(first.sessionID, second.sessionID)
        XCTAssertEqual(store.listSummaries().count, 2)
        XCTAssertNotNil(store.summary(forSessionID: first.sessionID))
        XCTAssertNotNil(store.summary(forSessionID: second.sessionID))
    }

    // §17.5 — el historial se ordena de más reciente a más antigua.

    func testHistoryOrderedMostRecentFirst() throws {
        let store = try makeStore()
        let older = try saveSampleSession(store: store, startedAt: Date(timeIntervalSince1970: 1_000))
        let newer = try saveSampleSession(store: store, startedAt: Date(timeIntervalSince1970: 2_000))
        let listed = store.listSummaries()
        XCTAssertEqual(listed.map(\.sessionID), [newer.sessionID, older.sessionID])
    }

    // §17.8 — un session_id ajeno en los archivos aborta el guardado.

    func testMismatchedSessionIDFailsValidation() throws {
        let store = try makeStore()
        let sessionID = UUID().uuidString
        var trials = (0..<12).map { makeTrial(sessionID: sessionID, index: $0, correct: true) }
        trials[3].sessionID = "OTRA-SESION"
        let summary = makeSummary(sessionID: sessionID, trials: trials)
        XCTAssertThrowsError(try store.save(summary: summary, trials: trials, frames: [makeFrame(sessionID: sessionID, index: 0)]))
    }

    func testSummaryTrialCountMismatchFailsValidation() throws {
        let store = try makeStore()
        let sessionID = UUID().uuidString
        let trials = (0..<12).map { makeTrial(sessionID: sessionID, index: $0, correct: true) }
        var summary = makeSummary(sessionID: sessionID, trials: trials)
        summary.validTrialCount = 99 // desincronizado a propósito
        XCTAssertThrowsError(try store.save(summary: summary, trials: trials, frames: [makeFrame(sessionID: sessionID, index: 0)]))
    }

    // §17.9/§17.10 — el ZIP existe, no está vacío y es un ZIP real.

    func testExportZipProducesRealNonEmptyZip() throws {
        let store = try makeStore()
        let summary = try saveSampleSession(store: store)
        let zipURL = try store.exportZip(forSessionID: summary.sessionID)
        XCTAssertTrue(FileManager.default.fileExists(atPath: zipURL.path))
        let size = try FileManager.default.attributesOfItem(atPath: zipURL.path)[.size] as? NSNumber
        XCTAssertGreaterThan(size?.intValue ?? 0, 100)
        let handle = try FileHandle(forReadingFrom: zipURL)
        XCTAssertEqual(try handle.read(upToCount: 2), Data([0x50, 0x4B])) // "PK"
        XCTAssertTrue(zipURL.lastPathComponent.hasPrefix("vision_test_"))
    }

    // §17.11 — una exportación puede repetirse.

    func testExportCanBeRepeated() throws {
        let store = try makeStore()
        let summary = try saveSampleSession(store: store)
        let first = try store.exportZip(forSessionID: summary.sessionID)
        let second = try store.exportZip(forSessionID: summary.sessionID)
        XCTAssertEqual(first, second)
        XCTAssertTrue(FileManager.default.fileExists(atPath: second.path))
    }

    // §17.14 — un error de escritura se propaga (la UI lo muestra y permite
    // reintentar; nunca más un catch vacío).

    func testWriteErrorIsThrownNotSilenced() throws {
        // A *file* where the base directory should be makes every write fail.
        let blockedBase = baseDirectory.appendingPathComponent("blocked")
        try Data("x".utf8).write(to: blockedBase)
        XCTAssertThrowsError(try SessionStore(baseDirectory: blockedBase))
    }

    // §17.15 — leer/listar/exportar nunca elimina datos.

    func testReadingNeverDeletesData() throws {
        let store = try makeStore()
        let summary = try saveSampleSession(store: store)
        _ = store.listSummaries()
        _ = store.summary(forSessionID: summary.sessionID)
        _ = try store.files(forSessionID: summary.sessionID)
        _ = try store.exportZip(forSessionID: summary.sessionID)
        // Everything still there afterwards:
        XCTAssertEqual(store.listSummaries().count, 1)
        let files = try store.files(forSessionID: summary.sessionID)
        for url in files.shareableURLs {
            XCTAssertTrue(FileManager.default.fileExists(atPath: url.path))
        }
    }

    func testEmptyTrialsRejected() throws {
        let store = try makeStore()
        let sessionID = UUID().uuidString
        let summary = makeSummary(sessionID: sessionID, trials: [])
        XCTAssertThrowsError(try store.save(summary: summary, trials: [], frames: [makeFrame(sessionID: sessionID, index: 0)]))
    }

    // Nulls explícitos en el JSON (encargo §14: nunca cero para faltantes).

    func testMissingValuesEncodeAsExplicitNull() throws {
        let sessionID = UUID().uuidString
        let trials = (0..<12).map { makeTrial(sessionID: sessionID, index: $0, correct: true) }
        var summary = makeSummary(sessionID: sessionID, trials: trials)
        summary.accuracy = nil
        summary.estimatedThresholdLogmar = nil
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        let json = String(data: try encoder.encode(summary), encoding: .utf8)!
        XCTAssertTrue(json.contains("\"accuracy\":null"))
        XCTAssertTrue(json.contains("\"estimated_threshold_logmar\":null"))
    }
}
