import XCTest
@testable import VisionMVPCore

/// Encargo §17.6/§17.7 (el resumen coincide con los ensayos, la exactitud se
/// calcula bien) + reglas deterministas de explanation_codes (§5).
final class SummaryBuilderTests: XCTestCase {
    private let metadata = SummaryMetadata(appVersion: "0.1.0", buildNumber: "1", deviceModel: "iPhone16,2", systemVersion: "18.0")

    private func makeResult(
        outcome: TestOutcome = .approximate,
        reason: TerminationReason = .maxTrialsReached,
        reversals: Int = 3,
        spread: Double? = 0.05,
        validTrials: Int = 12,
        threshold: Double? = 0.3
    ) -> TestResult {
        TestResult(
            outcome: outcome,
            terminationReason: reason,
            thresholdLogMAR: threshold,
            confidence: "low",
            reversalCount: reversals,
            reversalSpreadLogMAR: spread,
            validTrialCount: validTrials,
            effectiveSeconds: 48,
            pausedSeconds: 2,
            realSeconds: 50
        )
    }

    private func makeTrial(sessionID: String, index: Int, correct: Bool, timeout: Bool = false, valid: Bool = true, logMAR: Double = 0.4) -> TrialRecord {
        TrialRecord(
            sessionID: sessionID, trialID: "\(sessionID)-\(index)", trialIndex: index,
            timestampPresentedISO8601: "t", timestampAnsweredISO8601: timeout ? nil : "t",
            effectiveElapsedMs: 0, stimulusType: "landolt_c",
            orientationTruth: .up, response: timeout ? nil : (correct ? .up : .down),
            correct: correct, timeout: timeout, reactionTimeMs: timeout ? nil : 700,
            logMARLevel: logMAR, stimulusHeightPoints: 20, stimulusHeightPixels: 60,
            stimulusHeightMillimeters: 3.0, totalVisualAngleArcMinutes: 12.5,
            criticalDetailArcMinutes: 2.5, viewingDistanceMeters: 0.40,
            accommodativeDemandDiopters: 2.5,
            consecutiveCorrectBefore: 0, consecutiveCorrectAfter: 0,
            staircaseDirectionBefore: "", staircaseDirectionAfter: "",
            isReversal: false, reversalCount: 0,
            validTrial: valid, invalidReason: valid ? nil : "interrupted_by_pause",
            repeatedAfterPause: false, terminationReason: "max_trials_reached"
        )
    }

    private func makeFrame(sessionID: String, inRange: Bool = true, state: String = "stimulus") -> TestFrameRecord {
        TestFrameRecord(
            sessionID: sessionID, timestampISO8601: "t", elapsedMs: 0, effectiveTestTimeMs: 0,
            viewingDistanceMeters: inRange ? 0.40 : 0.55,
            distanceCameraToFaceMeters: nil, distanceCameraToLeftEyeMeters: nil, distanceCameraToRightEyeMeters: nil,
            yawDegrees: 0, pitchDegrees: 0, rollDegrees: 0,
            faceTracked: true, worldTrackingState: "normal", faceCentered: true,
            leftEyeInFrame: true, rightEyeInFrame: true,
            insideDistanceRange: inRange, measurementStable: true,
            valid: true, discardReason: nil,
            actualFrameIntervalMs: 16.7, effectiveFps: 60, testState: state
        )
    }

    func testSummaryCountsMatchTrials() {
        let id = "S1"
        // 12 valid trials: 8 correct, 2 incorrect, 2 timeouts; plus 1 invalid.
        var trials: [TrialRecord] = []
        for index in 0..<8 { trials.append(makeTrial(sessionID: id, index: index, correct: true)) }
        for index in 8..<10 { trials.append(makeTrial(sessionID: id, index: index, correct: false)) }
        for index in 10..<12 { trials.append(makeTrial(sessionID: id, index: index, correct: false, timeout: true)) }
        trials.append(makeTrial(sessionID: id, index: 12, correct: false, valid: false))

        let summary = SummaryBuilder.build(
            sessionID: id, participantID: "P1",
            result: makeResult(),
            trials: trials, frames: [makeFrame(sessionID: id)],
            startedAt: Date(timeIntervalSince1970: 0), completedAt: Date(timeIntervalSince1970: 60),
            metadata: metadata
        )

        XCTAssertEqual(summary.validTrialCount, 12)
        XCTAssertEqual(summary.invalidTrialCount, 1)
        XCTAssertEqual(summary.correctCount, 8)
        XCTAssertEqual(summary.incorrectCount, 2)
        XCTAssertEqual(summary.timeoutCount, 2)
        XCTAssertEqual(summary.accuracy!, 8.0 / 12.0, accuracy: 1e-9) // §17.7
        XCTAssertEqual(summary.wallDurationMs, 60000, accuracy: 1e-6)
        XCTAssertEqual(summary.effectiveDurationMs, 48000, accuracy: 1e-6)
    }

    func testBestCorrectLevelComesFromSmallestCorrectTrial() {
        let id = "S1"
        let trials = [
            makeTrial(sessionID: id, index: 0, correct: true, logMAR: 0.5),
            makeTrial(sessionID: id, index: 1, correct: true, logMAR: 0.2),
            makeTrial(sessionID: id, index: 2, correct: false, logMAR: 0.1), // incorrect: doesn't count
        ]
        let summary = SummaryBuilder.build(
            sessionID: id, participantID: "P1", result: makeResult(validTrials: 3),
            trials: trials, frames: [], startedAt: Date(), completedAt: Date(), metadata: metadata
        )
        XCTAssertEqual(summary.bestCorrectLogmar!, 0.2, accuracy: 1e-9)
    }

    func testStatusMappingForAbandonedAndTechnical() {
        let id = "S1"
        let trials = [makeTrial(sessionID: id, index: 0, correct: true)]
        let abandoned = SummaryBuilder.build(
            sessionID: id, participantID: "P1",
            result: makeResult(outcome: .inconclusive, reason: .abandoned, validTrials: 1),
            trials: trials, frames: [], startedAt: Date(), completedAt: Date(), metadata: metadata
        )
        XCTAssertEqual(abandoned.sessionStatus, "abandoned")

        let technical = SummaryBuilder.build(
            sessionID: id, participantID: "P1",
            result: makeResult(outcome: .inconclusive, reason: .pauseBudgetExceeded, validTrials: 1),
            trials: trials, frames: [], startedAt: Date(), completedAt: Date(), metadata: metadata
        )
        XCTAssertEqual(technical.sessionStatus, "technical_interruption")
    }

    // MARK: Explanation codes — deterministas (§5)

    func testCompletedYieldsConsistentCode() {
        let codes = ExplanationCodeEngine.codes(
            result: makeResult(outcome: .completed, reason: .reversalsReached, reversals: 6, spread: 0.05),
            timeoutCount: 0, medianReactionTimeMs: 700, percentFramesInsideRange: 99
        )
        XCTAssertEqual(codes, [.consistentMeasurement])
    }

    func testFewReversalsCode() {
        let codes = ExplanationCodeEngine.codes(
            result: makeResult(outcome: .approximate, reason: .maxTrialsReached, reversals: 2),
            timeoutCount: 0, medianReactionTimeMs: 700, percentFramesInsideRange: 99
        )
        XCTAssertTrue(codes.contains(.fewReversals))
        XCTAssertFalse(codes.contains(.responseVariability))
    }

    func testHighSpreadCode() {
        let codes = ExplanationCodeEngine.codes(
            result: makeResult(outcome: .approximate, reason: .reversalsReached, reversals: 6, spread: 0.3),
            timeoutCount: 0, medianReactionTimeMs: 700, percentFramesInsideRange: 99
        )
        XCTAssertTrue(codes.contains(.highReversalSpread))
    }

    func testDistanceVariabilityCode() {
        let codes = ExplanationCodeEngine.codes(
            result: makeResult(outcome: .approximate, reason: .reversalsReached, reversals: 6, spread: 0.05),
            timeoutCount: 0, medianReactionTimeMs: 700, percentFramesInsideRange: 70
        )
        XCTAssertTrue(codes.contains(.distanceVariability))
    }

    func testSlowResponsesCode() {
        let codes = ExplanationCodeEngine.codes(
            result: makeResult(outcome: .approximate, reason: .maxTrialsReached, reversals: 6, spread: 0.05),
            timeoutCount: 4, medianReactionTimeMs: 900, percentFramesInsideRange: 99
        )
        XCTAssertTrue(codes.contains(.slowResponses))
    }

    func testTimeLimitCode() {
        let codes = ExplanationCodeEngine.codes(
            result: makeResult(outcome: .approximate, reason: .effectiveTimeLimit, reversals: 6, spread: 0.05),
            timeoutCount: 0, medianReactionTimeMs: 700, percentFramesInsideRange: 99
        )
        XCTAssertTrue(codes.contains(.timeLimitBeforeConvergence))
    }

    func testResponseVariabilityFallback() {
        // Approximate with no other detectable cause -> the generic code.
        let codes = ExplanationCodeEngine.codes(
            result: makeResult(outcome: .approximate, reason: .reversalsReached, reversals: 6, spread: 0.05),
            timeoutCount: 0, medianReactionTimeMs: 700, percentFramesInsideRange: 99
        )
        XCTAssertEqual(codes, [.responseVariability])
    }

    func testAbandonedAndPauseCodes() {
        XCTAssertEqual(
            ExplanationCodeEngine.codes(
                result: makeResult(outcome: .inconclusive, reason: .abandoned),
                timeoutCount: 0, medianReactionTimeMs: nil, percentFramesInsideRange: nil
            ),
            [.abandonedByUser]
        )
        XCTAssertTrue(
            ExplanationCodeEngine.codes(
                result: makeResult(outcome: .inconclusive, reason: .pauseBudgetExceeded),
                timeoutCount: 0, medianReactionTimeMs: nil, percentFramesInsideRange: 60
            ).contains(.pauseBudgetExceeded)
        )
    }

    func testDeterminism() {
        // Same inputs -> identical codes, always.
        let result = makeResult(outcome: .approximate, reason: .effectiveTimeLimit, reversals: 2, spread: 0.2)
        let a = ExplanationCodeEngine.codes(result: result, timeoutCount: 3, medianReactionTimeMs: 3000, percentFramesInsideRange: 80)
        let b = ExplanationCodeEngine.codes(result: result, timeoutCount: 3, medianReactionTimeMs: 3000, percentFramesInsideRange: 80)
        XCTAssertEqual(a, b)
    }
}
