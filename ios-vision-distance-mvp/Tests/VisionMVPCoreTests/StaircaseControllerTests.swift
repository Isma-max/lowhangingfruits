import XCTest
@testable import VisionMVPCore

final class StaircaseControllerTests: XCTestCase {
    private func makeConfig(reversalsToStop: Int = 4, maxTrials: Int = 20) -> StaircaseConfiguration {
        StaircaseConfiguration(
            startingValue: 10,
            initialStepSize: 4,
            minimumStepSize: 0.5,
            minimumValue: 0,
            maximumValue: 100,
            reversalsToStop: reversalsToStop,
            maxTrials: maxTrials,
            reversalsUsedForThreshold: 2
        )
    }

    func testThresholdEstimateNilBeforeFirstReversal() {
        var staircase = StaircaseController(configuration: makeConfig())
        XCTAssertNil(staircase.thresholdEstimate)
        staircase.recordResponse(correct: true)
        XCTAssertNil(staircase.thresholdEstimate) // still no reversal yet
    }

    /// Hand-traced sequence: correct, correct, incorrect, incorrect, correct,
    /// correct, incorrect, incorrect, correct. See inline comments for the
    /// expected value/step/reversal after each response.
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
            reversalsToStop: 10, maxTrials: 10, reversalsUsedForThreshold: 2
        )
        var staircase = StaircaseController(configuration: config)
        staircase.recordResponse(correct: true) // would go to -4, clamped to 0
        XCTAssertEqual(staircase.currentValue, 0, accuracy: 1e-9)
    }

    func testValueClampedToMaximum() {
        let config = StaircaseConfiguration(
            startingValue: 99, initialStepSize: 5, minimumStepSize: 0.5,
            minimumValue: 0, maximumValue: 100,
            reversalsToStop: 10, maxTrials: 10, reversalsUsedForThreshold: 2
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
}
