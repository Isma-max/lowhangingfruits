import XCTest
@testable import VisionMVPCore

final class DistanceSummaryBuilderTests: XCTestCase {
    private func validFrame(elapsedMs: Double, distance: Double) -> DistanceFrameRecord {
        DistanceFrameRecord(
            timestampISO8601: "t",
            elapsedMilliseconds: elapsedMs,
            milestoneCentimeters: 40,
            repetition: 1,
            distanceCameraToFaceMeters: distance,
            distanceCameraToLeftEyeMeters: distance,
            distanceCameraToRightEyeMeters: distance,
            distanceMeanEyesMeters: distance,
            yawDegrees: 0, pitchDegrees: 0, rollDegrees: 0,
            faceTracked: true, worldTrackingState: "normal", faceCentered: true,
            leftEyeInFrame: true, rightEyeInFrame: true,
            valid: true, discardReason: nil, referenceDistanceCentimeters: 40
        )
    }

    private func invalidFrame(elapsedMs: Double, reason: String) -> DistanceFrameRecord {
        DistanceFrameRecord(
            timestampISO8601: "t",
            elapsedMilliseconds: elapsedMs,
            milestoneCentimeters: 40,
            repetition: 1,
            distanceCameraToFaceMeters: 0.9,
            distanceCameraToLeftEyeMeters: nil,
            distanceCameraToRightEyeMeters: nil,
            distanceMeanEyesMeters: nil,
            yawDegrees: 0, pitchDegrees: 0, rollDegrees: 0,
            faceTracked: true, worldTrackingState: "normal", faceCentered: true,
            leftEyeInFrame: true, rightEyeInFrame: true,
            valid: false, discardReason: reason, referenceDistanceCentimeters: 40
        )
    }

    func testSummaryOverKnownFrameSet() {
        let frames: [DistanceFrameRecord] = [
            validFrame(elapsedMs: 0, distance: 0.38),
            validFrame(elapsedMs: 500, distance: 0.40),
            validFrame(elapsedMs: 1000, distance: 0.42),
            validFrame(elapsedMs: 1500, distance: 0.40),
            validFrame(elapsedMs: 2000, distance: 0.40),
            invalidFrame(elapsedMs: 700, reason: "distance_out_of_range"),
            invalidFrame(elapsedMs: 1200, reason: "excessive_yaw_or_pitch"),
        ]

        let summary = DistanceSummaryBuilder.buildSummary(
            frames: frames,
            milestoneCentimeters: 40,
            repetition: 1,
            referenceDistanceCentimeters: 40
        )

        XCTAssertEqual(summary.validFrameCount, 5)
        XCTAssertEqual(summary.discardedFrameCount, 2)
        XCTAssertEqual(summary.discardReasonCounts, ["distance_out_of_range": 1, "excessive_yaw_or_pitch": 1])

        XCTAssertEqual(summary.overall?.sampleCount, 5)
        XCTAssertEqual(summary.overall?.meanMeters ?? -1, 0.40, accuracy: 1e-9)

        let window1s = summary.recentWindows.first { $0.windowSeconds == 1 }
        XCTAssertEqual(window1s?.sampleCount, 2) // t=1.5, 2.0
        XCTAssertEqual(window1s?.meanMeters ?? -1, 0.40, accuracy: 1e-9)

        let window2s = summary.recentWindows.first { $0.windowSeconds == 2 }
        XCTAssertEqual(window2s?.sampleCount, 4) // t=0.5,1.0,1.5,2.0 (t=0 excluded, exclusive lower bound)
        XCTAssertEqual(window2s?.meanMeters ?? -1, 0.405, accuracy: 1e-9)

        XCTAssertEqual(summary.effectiveHz ?? -1, 2.0, accuracy: 1e-9)
        XCTAssertEqual(summary.errorVersusReferenceCentimeters ?? -1, 0.0, accuracy: 1e-6)
    }

    func testNoReferenceMeansNoErrorComputed() {
        let frames = [validFrame(elapsedMs: 0, distance: 0.40), validFrame(elapsedMs: 100, distance: 0.40)]
        let summary = DistanceSummaryBuilder.buildSummary(
            frames: frames, milestoneCentimeters: nil, repetition: nil, referenceDistanceCentimeters: nil
        )
        XCTAssertNil(summary.errorVersusReferenceCentimeters)
    }

    func testEmptyFrameSetProducesNilOverallAndZeroCounts() {
        let summary = DistanceSummaryBuilder.buildSummary(
            frames: [], milestoneCentimeters: nil, repetition: nil, referenceDistanceCentimeters: nil
        )
        XCTAssertEqual(summary.validFrameCount, 0)
        XCTAssertEqual(summary.discardedFrameCount, 0)
        XCTAssertNil(summary.overall)
        XCTAssertNil(summary.effectiveHz)
    }
}
