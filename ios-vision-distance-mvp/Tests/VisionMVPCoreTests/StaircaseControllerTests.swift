import XCTest
@testable import VisionMVPCore

final class StaircaseControllerTests: XCTestCase {
    /// 1-down/1-up (every single correct/incorrect moves the staircase) —
    /// the simplest special case, used here so the original hand-traced
    /// sequences stay valid and easy to follow.
    private func makeConfig(reversalsToStop: Int = 4, maxTrials: Int = 20) -> StaircaseConfiguration {
        StaircaseConfiguration(
            startingValue: 10,
            initialStepSize: 4,
            minimumStepSize: 0.5,
            minimumValue: 0,
            maximumValue: 100,
            reversalsToStop: reversalsToStop,
            maxTrials: maxTrials,
            reversalsUsedForThreshold: 2,
            correctsRequiredToDecrease: 1,
            incorrectsRequiredToIncrease: 1
        )
    }

    func testThresholdEstimateNilBeforeFirstReversal() {
        var staircase = StaircaseController(configuration: makeConfig())
        XCTAssertNil(staircase.thresholdEstimate)
        staircase.recordResponse(correct: true)
        XCTAssertNil(staircase.thresholdEstimate) // still no reversal yet
    }

    /// Hand-traced sequence (1-down/1-up): correct, correct, incorrect,
    /// incorrect, correct, correct, incorrect, incorrect, correct. See
    /// inline comments for the expected value/step/reversal after each
    /// response.
    func testKnownResponseSequenceProducesExpectedTrajectory() {
        var staircase = StaircaseController(configuration: makeConfig())

        staircase.recordResponse(correct: true) // 10 -> 6, step 4, no reversal
        XCTAssertEqual(staircase.currentValue, 6, accuracy: 1e-9)

        staircase.recordResponse(correct: true) // 6 -> 2, step 4, no reversal
        XCTAssertEqual(staircase.currentValue, 2, accuracy: 1e-9)

        staircase.recordResponse(correct: false) // reversal @2, step -> 2, then 2 -> 4
        XCTAssertEqual(staircase.reversalValues, [2])
        XCTAssertEqual(staircase.currentStepSize, 2, accuracy: 1e-9)
        XCTAssertEqual(staircase.currentValue, 4, accuracy: 1e-9)

        staircase.recordResponse(correct: false) // 4 -> 6, no reversal
        XCTAssertEqual(staircase.currentValue, 6, accuracy: 1e-9)

        staircase.recordResponse(correct: true) // reversal @6, step -> 1, then 6 -> 5
        XCTAssertEqual(staircase.reversalValues, [2, 6])
        XCTAssertEqual(staircase.currentStepSize, 1, accuracy: 1e-9)
        XCTAssertEqual(staircase.currentValue, 5, accuracy: 1e-9)

        staircase.recordResponse(correct: true) // 5 -> 4, no reversal
        XCTAssertEqual(staircase.currentValue, 4, accuracy: 1e-9)

        staircase.recordResponse(correct: false) // reversal @4, step -> 0.5, then 4 -> 4.5
        XCTAssertEqual(staircase.reversalValues, [2, 6, 4])
        XCTAssertEqual(staircase.currentStepSize, 0.5, accuracy: 1e-9)
        XCTAssertEqual(staircase.currentValue, 4.5, accuracy: 1e-9)

        staircase.recordResponse(correct: false) // 4.5 -> 5.0, no reversal
        XCTAssertEqual(staircase.currentValue, 5.0, accuracy: 1e-9)
        XCTAssertFalse(staircase.isComplete)

        staircase.recordResponse(correct: true) // reversal @5.0 -> 4th reversal, stop; step clamps at 0.5; 5.0 -> 4.5
        XCTAssertEqual(staircase.reversalValues, [2, 6, 4, 5.0])
        XCTAssertEqual(staircase.currentStepSize, 0.5, accuracy: 1e-9) // clamped to minimumStepSize
        XCTAssertEqual(staircase.currentValue, 4.5, accuracy: 1e-9)
        XCTAssertEqual(staircase.trialCount, 9)

        XCTAssertTrue(staircase.isComplete)
        XCTAssertEqual(staircase.thresholdEstimate!, 4.5, accuracy: 1e-9) // mean of last 2 reversals: (4 + 5.0) / 2
    }

    func testValueClampedToMinimum() {
        let config = StaircaseConfiguration(
            startingValue: 1, initialStepSize: 5, minimumStepSize: 0.5,
            minimumValue: 0, maximumValue: 100,
            reversalsToStop: 10, maxTrials: 10, reversalsUsedForThreshold: 2,
            correctsRequiredToDecrease: 1, incorrectsRequiredToIncrease: 1
        )
        var staircase = StaircaseController(configuration: config)
        staircase.recordResponse(correct: true) // would go to -4, clamped to 0
        XCTAssertEqual(staircase.currentValue, 0, accuracy: 1e-9)
    }

    func testValueClampedToMaximum() {
        let config = StaircaseConfiguration(
            startingValue: 99, initialStepSize: 5, minimumStepSize: 0.5,
            minimumValue: 0, maximumValue: 100,
            reversalsToStop: 10, maxTrials: 10, reversalsUsedForThreshold: 2,
            correctsRequiredToDecrease: 1, incorrectsRequiredToIncrease: 1
        )
        var staircase = StaircaseController(configuration: config)
        staircase.recordResponse(correct: false) // would go to 104, clamped to 100
        XCTAssertEqual(staircase.currentValue, 100, accuracy: 1e-9)
    }

    func testMaxTrialsStopsStaircaseEvenWithoutEnoughReversals() {
        var staircase = StaircaseController(configuration: makeConfig(reversalsToStop: 100, maxTrials: 3))
        staircase.recordResponse(correct: true)
        staircase.recordResponse(correct: true)
        XCTAssertFalse(staircase.isComplete)
        staircase.recordResponse(correct: true)
        XCTAssertTrue(staircase.isComplete)
    }

    // MARK: - 2-down/1-up (the new default, per the near-vision-exam protocol)

    private func makeTwoDownOneUpConfig(reversalsToStop: Int = 4, maxTrials: Int = 20) -> StaircaseConfiguration {
        StaircaseConfiguration(
            startingValue: 10,
            initialStepSize: 4,
            minimumStepSize: 0.5,
            minimumValue: 0,
            maximumValue: 100,
            reversalsToStop: reversalsToStop,
            maxTrials: maxTrials,
            reversalsUsedForThreshold: 2
            // correctsRequiredToDecrease / incorrectsRequiredToIncrease default to 2 / 1
        )
    }

    func testDefaultConfigurationIsTwoDownOneUp() {
        let config = makeTwoDownOneUpConfig()
        XCTAssertEqual(config.correctsRequiredToDecrease, 2)
        XCTAssertEqual(config.incorrectsRequiredToIncrease, 1)
        XCTAssertEqual(config.algorithmIdentifier, "2down1up")
    }

    func testSingleCorrectDoesNotDecreaseUnderTwoDownOneUp() {
        var staircase = StaircaseController(configuration: makeTwoDownOneUpConfig())
        staircase.recordResponse(correct: true)
        XCTAssertEqual(staircase.currentValue, 10, accuracy: 1e-9) // unchanged: only 1 of 2 required corrects
        XCTAssertEqual(staircase.trialCount, 1) // the trial still counts even though no step happened
    }

    func testTwoConsecutiveCorrectsDecreaseUnderTwoDownOneUp() {
        var staircase = StaircaseController(configuration: makeTwoDownOneUpConfig())
        staircase.recordResponse(correct: true)
        staircase.recordResponse(correct: true)
        XCTAssertEqual(staircase.currentValue, 6, accuracy: 1e-9) // 10 - step(4)
    }

    func testSingleIncorrectStillIncreasesUnderTwoDownOneUp() {
        var staircase = StaircaseController(configuration: makeTwoDownOneUpConfig())
        staircase.recordResponse(correct: false)
        XCTAssertEqual(staircase.currentValue, 14, accuracy: 1e-9) // 10 + step(4): only 1 required
    }

    /// Hand-traced sequence: correct, correct, incorrect, correct, correct,
    /// incorrect, correct, correct. See inline comments for the expected
    /// value/step/reversal after each response.
    func testTwoDownOneUpKnownResponseSequence() {
        var staircase = StaircaseController(configuration: makeTwoDownOneUpConfig())

        staircase.recordResponse(correct: true) // 1st correct: no step yet
        XCTAssertEqual(staircase.currentValue, 10, accuracy: 1e-9)

        staircase.recordResponse(correct: true) // 2nd consecutive correct: 10 -> 6, first move ever, no reversal
        XCTAssertEqual(staircase.currentValue, 6, accuracy: 1e-9)
        XCTAssertTrue(staircase.reversalValues.isEmpty)

        staircase.recordResponse(correct: false) // reversal @6 (down -> up), step -> 2, then 6 -> 8
        XCTAssertEqual(staircase.reversalValues, [6])
        XCTAssertEqual(staircase.currentStepSize, 2, accuracy: 1e-9)
        XCTAssertEqual(staircase.currentValue, 8, accuracy: 1e-9)

        staircase.recordResponse(correct: true) // 1st correct after the up-move: no step yet
        XCTAssertEqual(staircase.currentValue, 8, accuracy: 1e-9)

        staircase.recordResponse(correct: true) // 2nd consecutive correct: reversal @8 (up -> down), step -> 1, then 8 -> 7
        XCTAssertEqual(staircase.reversalValues, [6, 8])
        XCTAssertEqual(staircase.currentStepSize, 1, accuracy: 1e-9)
        XCTAssertEqual(staircase.currentValue, 7, accuracy: 1e-9)

        staircase.recordResponse(correct: false) // reversal @7 (down -> up), step -> 0.5, then 7 -> 7.5
        XCTAssertEqual(staircase.reversalValues, [6, 8, 7])
        XCTAssertEqual(staircase.currentStepSize, 0.5, accuracy: 1e-9)
        XCTAssertEqual(staircase.currentValue, 7.5, accuracy: 1e-9)

        staircase.recordResponse(correct: true) // 1st correct: no step yet
        XCTAssertEqual(staircase.currentValue, 7.5, accuracy: 1e-9)
        XCTAssertEqual(staircase.trialCount, 7)

        staircase.recordResponse(correct: true) // 2nd consecutive correct: reversal @7.5 -> 4th reversal, stop; 7.5 -> 7.0
        XCTAssertEqual(staircase.reversalValues, [6, 8, 7, 7.5])
        XCTAssertEqual(staircase.currentValue, 7.0, accuracy: 1e-9)
        XCTAssertEqual(staircase.trialCount, 8)

        XCTAssertTrue(staircase.isComplete)
        XCTAssertEqual(staircase.thresholdEstimate!, 7.25, accuracy: 1e-9) // mean of last 2 reversals: (7 + 7.5) / 2
    }
}
