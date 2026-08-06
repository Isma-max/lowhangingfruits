import XCTest
@testable import VisionMVPCore

final class CSVExportTests: XCTestCase {
    func testDistanceFrameRecordRoundTripsThroughCSVFields() {
        let record = DistanceFrameRecord(
            timestampISO8601: "2026-08-06T10:00:00Z",
            elapsedMilliseconds: 1234.5,
            milestoneCentimeters: 40,
            repetition: 2,
            distanceCameraToFaceMeters: 0.402,
            distanceCameraToLeftEyeMeters: 0.405,
            distanceCameraToRightEyeMeters: 0.399,
            distanceMeanEyesMeters: 0.402,
            yawDegrees: 1.2,
            pitchDegrees: -0.5,
            rollDegrees: 0.1,
            faceTracked: true,
            worldTrackingState: "normal",
            faceCentered: true,
            leftEyeInFrame: true,
            rightEyeInFrame: true,
            valid: true,
            discardReason: nil,
            referenceDistanceCentimeters: 40
        )

        let csv = CSVEncoder.encode([record])
        let lines = csv.components(separatedBy: "\r\n").filter { !$0.isEmpty }

        let expectedRow = [
            "2026-08-06T10:00:00Z", "1234.5", "40.0", "2",
            "0.402", "0.405", "0.399", "0.402",
            "1.2", "-0.5", "0.1",
            "true", "normal", "true", "true", "true", "true", "", "40.0",
        ].joined(separator: ",")

        XCTAssertEqual(lines.count, 2) // header + 1 row
        XCTAssertEqual(lines[0], DistanceFrameRecord.csvHeader.joined(separator: ","))
        XCTAssertEqual(lines[1], expectedRow) // discardReason nil -> empty field between the two "true"s
    }

    func testInvalidFrameKeepsDiscardReason() {
        let record = DistanceFrameRecord(
            timestampISO8601: "2026-08-06T10:00:01Z",
            elapsedMilliseconds: 1267.0,
            milestoneCentimeters: nil,
            repetition: nil,
            distanceCameraToFaceMeters: 1.5,
            distanceCameraToLeftEyeMeters: nil,
            distanceCameraToRightEyeMeters: nil,
            distanceMeanEyesMeters: nil,
            yawDegrees: 0,
            pitchDegrees: 0,
            rollDegrees: 0,
            faceTracked: true,
            worldTrackingState: "normal",
            faceCentered: false,
            leftEyeInFrame: true,
            rightEyeInFrame: true,
            valid: false,
            discardReason: "distance_out_of_range",
            referenceDistanceCentimeters: nil
        )

        let fields = record.csvFields()
        XCTAssertEqual(fields[DistanceFrameRecord.csvHeader.firstIndex(of: "valid")!], "false")
        XCTAssertEqual(fields[DistanceFrameRecord.csvHeader.firstIndex(of: "discard_reason")!], "distance_out_of_range")
        XCTAssertEqual(fields[DistanceFrameRecord.csvHeader.firstIndex(of: "milestone_cm")!], "")
    }

    func testCSVFieldEscapesCommasQuotesAndNewlines() {
        XCTAssertEqual(CSVFormatting.field("plain"), "plain")
        XCTAssertEqual(CSVFormatting.field("a,b"), "\"a,b\"")
        XCTAssertEqual(CSVFormatting.field("a\"b"), "\"a\"\"b\"")
        XCTAssertEqual(CSVFormatting.field("a\nb"), "\"a\nb\"")
    }

    private func makeTrialRecord(
        distanceMeters: Double = 0.35,
        totalHeightMillimeters: Double = 4.2,
        response: GapOrientation?,
        correct: Bool = false
    ) -> VisionTrialRecord {
        let geometry = StimulusScaler.measurement(totalHeightMillimeters: totalHeightMillimeters, distanceMeters: distanceMeters)
        return VisionTrialRecord(
            taskPhase: .dynamicConstantAngularSize,
            eyeCondition: .oculusDexter,
            correctionUsed: true,
            trialIndex: 3,
            timestampISO8601: "2026-08-06T10:05:00Z",
            distanceMeters: distanceMeters,
            accommodativeDemandDiopters: AccommodativeDemand.diopters(distanceMeters: distanceMeters),
            geometry: geometry,
            totalHeightPoints: 30.0,
            totalHeightPixels: 90.0,
            gapOrientationTruth: .right,
            response: response,
            correct: correct,
            reactionTimeMilliseconds: 812,
            isReversal: true,
            stepSize: 1.5,
            yawDegrees: 2.0,
            pitchDegrees: -1.0,
            rollDegrees: 0.5,
            faceTracked: true,
            worldTrackingState: "normal",
            valid: true,
            discardReason: nil,
            staircaseAlgorithm: "2down1up"
        )
    }

    func testVisionTrialRecordHeaderMatchesFieldCount() {
        let record = makeTrialRecord(response: .down)
        XCTAssertEqual(record.csvFields().count, VisionTrialRecord.csvHeader.count)
        XCTAssertEqual(record.csvFields()[VisionTrialRecord.csvHeader.firstIndex(of: "response")!], "down")
    }

    func testVisionTrialRecordWithNilResponseLeavesEmptyField() {
        let record = makeTrialRecord(response: nil)
        XCTAssertEqual(record.csvFields()[VisionTrialRecord.csvHeader.firstIndex(of: "response")!], "")
    }

    func testVisionTrialRecordSeparatesTotalHeightFromCriticalDetailInCSV() {
        let record = makeTrialRecord(totalHeightMillimeters: 25, response: .up)
        let totalHeightField = record.csvFields()[VisionTrialRecord.csvHeader.firstIndex(of: "total_height_mm")!]
        let criticalDetailField = record.csvFields()[VisionTrialRecord.csvHeader.firstIndex(of: "critical_detail_mm")!]
        XCTAssertEqual(totalHeightField, "25.0")
        XCTAssertEqual(criticalDetailField, "5.0")
    }

    func testVisionTrialRecordDefaultsToCurrentVersions() {
        let record = makeTrialRecord(response: .up)
        XCTAssertEqual(record.protocolVersion, InstrumentVersions.protocolVersion)
        XCTAssertEqual(record.geometryVersion, InstrumentVersions.geometryVersion)
    }

    func testBlurCrossingRecordFields() {
        let record = BlurCrossingRecord(
            eyeCondition: .oculusSinister, correctionUsed: true, repetition: 1,
            crossingTimestampISO8601: "t", distanceAtCrossingMeters: 0.33, direction: .approaching
        )
        XCTAssertEqual(record.csvFields().count, BlurCrossingRecord.csvHeader.count)
        XCTAssertEqual(record.csvFields()[BlurCrossingRecord.csvHeader.firstIndex(of: "direction")!], "approaching")
    }
}
