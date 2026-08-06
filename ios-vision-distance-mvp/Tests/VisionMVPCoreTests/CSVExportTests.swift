import XCTest
@testable import VisionMVPCore

final class CSVExportTests: XCTestCase {
    func testCSVFieldEscapesCommasQuotesAndNewlines() {
        XCTAssertEqual(CSVFormatting.field("plain"), "plain")
        XCTAssertEqual(CSVFormatting.field("a,b"), "\"a,b\"")
        XCTAssertEqual(CSVFormatting.field("a\"b"), "\"a\"\"b\"")
        XCTAssertEqual(CSVFormatting.field("a\nb"), "\"a\nb\"")
    }

    // MARK: - TrialRecord (schema v3)

    private func makeTrialRecord(response: GapOrientation? = .up, valid: Bool = true) -> TrialRecord {
        TrialRecord(
            sessionID: "S1",
            trialID: "S1-0",
            trialIndex: 0,
            timestampPresentedISO8601: "2026-08-07T10:00:00Z",
            timestampAnsweredISO8601: response == nil ? nil : "2026-08-07T10:00:01Z",
            effectiveElapsedMs: 1200,
            stimulusType: "landolt_c",
            orientationTruth: .up,
            response: response,
            correct: response == .up,
            timeout: false,
            reactionTimeMs: response == nil ? nil : 950,
            logMARLevel: 0.5,
            stimulusHeightPoints: 22.1,
            stimulusHeightPixels: 66.3,
            stimulusHeightMillimeters: 3.68,
            totalVisualAngleArcMinutes: 15.8,
            criticalDetailArcMinutes: 3.16,
            viewingDistanceMeters: 0.40,
            accommodativeDemandDiopters: 2.5,
            consecutiveCorrectBefore: 1,
            consecutiveCorrectAfter: 0,
            staircaseDirectionBefore: "down",
            staircaseDirectionAfter: "down",
            isReversal: false,
            reversalCount: 2,
            validTrial: valid,
            invalidReason: valid ? nil : "interrupted_by_pause",
            repeatedAfterPause: false,
            terminationReason: "reversals_reached"
        )
    }

    func testTrialRecordHeaderMatchesFieldCount() {
        let record = makeTrialRecord()
        XCTAssertEqual(record.csvFields().count, TrialRecord.csvHeader.count)
    }

    func testTrialRecordDefaultsToCurrentVersions() {
        let record = makeTrialRecord()
        XCTAssertEqual(record.protocolVersion, InstrumentVersions.protocolVersion)
        XCTAssertEqual(record.algorithmVersion, InstrumentVersions.algorithmVersion)
    }

    func testTrialRecordNilResponseLeavesEmptyFields() {
        let record = makeTrialRecord(response: nil)
        let fields = record.csvFields()
        XCTAssertEqual(fields[TrialRecord.csvHeader.firstIndex(of: "response")!], "")
        XCTAssertEqual(fields[TrialRecord.csvHeader.firstIndex(of: "reaction_time_ms")!], "")
        XCTAssertEqual(fields[TrialRecord.csvHeader.firstIndex(of: "timestamp_answered")!], "")
    }

    // MARK: - TestFrameRecord (schema per encargo §22)

    private func makeFrameRecord() -> TestFrameRecord {
        TestFrameRecord(
            sessionID: "S1",
            timestampISO8601: "2026-08-07T10:00:00Z",
            elapsedMs: 500,
            effectiveTestTimeMs: 200,
            viewingDistanceMeters: 0.401,
            distanceCameraToFaceMeters: 0.395,
            distanceCameraToLeftEyeMeters: 0.402,
            distanceCameraToRightEyeMeters: 0.400,
            yawDegrees: 1.5,
            pitchDegrees: -0.4,
            rollDegrees: 0.2,
            faceTracked: true,
            worldTrackingState: "normal",
            faceCentered: true,
            leftEyeInFrame: true,
            rightEyeInFrame: true,
            insideDistanceRange: true,
            measurementStable: true,
            valid: true,
            discardReason: nil,
            actualFrameIntervalMs: 16.6,
            effectiveFps: 59.9,
            testState: "stimulus"
        )
    }

    func testFrameRecordHeaderMatchesFieldCount() {
        let record = makeFrameRecord()
        XCTAssertEqual(record.csvFields().count, TestFrameRecord.csvHeader.count)
    }

    /// Encargo §4/§26.36: the legacy characterization columns must be gone
    /// from the normal exports.
    func testExportsDoNotContainLegacyCharacterizationColumns() {
        for legacy in ["milestone_cm", "repetition", "reference_distance_cm"] {
            XCTAssertFalse(TestFrameRecord.csvHeader.contains(legacy), "\(legacy) should not be in test_frames.csv")
            XCTAssertFalse(TrialRecord.csvHeader.contains(legacy), "\(legacy) should not be in vision_trials.csv")
        }
    }

    /// Encargo §26.37: every export carries the same session id column.
    func testAllExportsCarrySessionID() {
        XCTAssertEqual(TestFrameRecord.csvHeader.first, "session_id")
        XCTAssertEqual(TrialRecord.csvHeader.first, "session_id")
        XCTAssertEqual(makeFrameRecord().csvFields().first, "S1")
        XCTAssertEqual(makeTrialRecord().csvFields().first, "S1")
    }

    func testOutOfRangeIsNotADiscardReasonInFrameSchema() {
        // Range/stability are separate boolean columns, not invalidity.
        XCTAssertTrue(TestFrameRecord.csvHeader.contains("inside_distance_range"))
        XCTAssertTrue(TestFrameRecord.csvHeader.contains("measurement_stable"))
        XCTAssertTrue(TestFrameRecord.csvHeader.contains("valid"))
    }
}
