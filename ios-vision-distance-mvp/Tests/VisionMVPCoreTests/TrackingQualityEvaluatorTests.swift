import XCTest
@testable import VisionMVPCore

final class TrackingQualityEvaluatorTests: XCTestCase {
    private func validInput() -> FrameQualityInput {
        FrameQualityInput(
            isFaceTracked: true,
            worldTrackingState: .normal,
            yawDegrees: 2,
            pitchDegrees: 3,
            distanceMeters: 0.40,
            leftEyeInFrame: true,
            rightEyeInFrame: true,
            recentFrameLossRatio: 0.0,
            recentStandardDeviationMeters: 0.001
        )
    }

    func testValidFrameHasNoDiscardReason() {
        XCTAssertNil(TrackingQualityEvaluator.evaluate(validInput(), thresholds: .default))
    }

    func testFaceNotDetectedTakesPriorityOverEverythingElse() {
        var input = validInput()
        input.isFaceTracked = false
        input.yawDegrees = 90 // also violates yaw, but face-not-detected must win
        XCTAssertEqual(TrackingQualityEvaluator.evaluate(input, thresholds: .default), .faceNotDetected)
    }

    func testWorldTrackingNotAvailable() {
        var input = validInput()
        input.worldTrackingState = .notAvailable
        XCTAssertEqual(TrackingQualityEvaluator.evaluate(input, thresholds: .default), .worldTrackingLimited)
    }

    func testWorldTrackingLimited() {
        var input = validInput()
        input.worldTrackingState = .limited("excessiveMotion")
        XCTAssertEqual(TrackingQualityEvaluator.evaluate(input, thresholds: .default), .worldTrackingLimited)
    }

    func testExcessiveYaw() {
        var input = validInput()
        input.yawDegrees = 25
        XCTAssertEqual(TrackingQualityEvaluator.evaluate(input, thresholds: .default), .excessiveYawOrPitch)
    }

    func testExcessivePitch() {
        var input = validInput()
        input.pitchDegrees = -30
        XCTAssertEqual(TrackingQualityEvaluator.evaluate(input, thresholds: .default), .excessiveYawOrPitch)
    }

    func testUnstableMeasurement() {
        var input = validInput()
        input.recentStandardDeviationMeters = 0.05
        XCTAssertEqual(TrackingQualityEvaluator.evaluate(input, thresholds: .default), .unstableMeasurement)
    }

    func testNilStandardDeviationNeverFlagsUnstable() {
        var input = validInput()
        input.recentStandardDeviationMeters = nil
        XCTAssertNil(TrackingQualityEvaluator.evaluate(input, thresholds: .default))
    }

    func testTooManyDroppedFrames() {
        var input = validInput()
        input.recentFrameLossRatio = 0.5
        XCTAssertEqual(TrackingQualityEvaluator.evaluate(input, thresholds: .default), .tooManyDroppedFrames)
    }

    func testDistanceOutOfRangeTooClose() {
        var input = validInput()
        input.distanceMeters = 0.05
        XCTAssertEqual(TrackingQualityEvaluator.evaluate(input, thresholds: .default), .distanceOutOfRange)
    }

    func testDistanceOutOfRangeTooFar() {
        var input = validInput()
        input.distanceMeters = 1.50
        XCTAssertEqual(TrackingQualityEvaluator.evaluate(input, thresholds: .default), .distanceOutOfRange)
    }

    func testEyesPartiallyOutOfFrame() {
        var input = validInput()
        input.rightEyeInFrame = false
        XCTAssertEqual(TrackingQualityEvaluator.evaluate(input, thresholds: .default), .eyesPartiallyOutOfFrame)
    }

    func testCheckOrderMatchesBriefOrdering() {
        // Violates both "unstable" and "too many dropped frames" and "distance out of range":
        // unstable must win, per the brief's listed order.
        var input = validInput()
        input.recentStandardDeviationMeters = 0.05
        input.recentFrameLossRatio = 0.9
        input.distanceMeters = 5.0
        XCTAssertEqual(TrackingQualityEvaluator.evaluate(input, thresholds: .default), .unstableMeasurement)
    }
}
