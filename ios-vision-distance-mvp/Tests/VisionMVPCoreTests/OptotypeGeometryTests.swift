import XCTest
@testable import VisionMVPCore

final class OptotypeGeometryTests: XCTestCase {
    func testCriticalDetailIsOneFifthOfTotalHeight() {
        XCTAssertEqual(OptotypeGeometry.criticalDetail(totalHeight: 25), 5, accuracy: 1e-9)
    }

    func testTotalHeightRoundTrip() {
        let critical = OptotypeGeometry.criticalDetail(totalHeight: 30)
        XCTAssertEqual(OptotypeGeometry.totalHeight(criticalDetail: critical), 30, accuracy: 1e-9)
    }

    func testLogMARRoundTrip() {
        let mar = 3.5
        let logMAR = VisualAcuityMath.logMAR(marArcMinutes: mar)
        XCTAssertEqual(VisualAcuityMath.marArcMinutes(logMAR: logMAR), mar, accuracy: 1e-9)
    }

    func testLogMARKnownReferenceValues() {
        // MAR = 1 arcmin (nominal 20/20) -> logMAR 0.
        XCTAssertEqual(VisualAcuityMath.logMAR(marArcMinutes: 1.0), 0.0, accuracy: 1e-9)
        // MAR = 10 arcmin (nominal 20/200) -> logMAR 1.0.
        XCTAssertEqual(VisualAcuityMath.logMAR(marArcMinutes: 10.0), 1.0, accuracy: 1e-9)
    }

    func testMeasurementSeparatesTotalHeightFromCriticalDetail() {
        let measurement = StimulusScaler.measurement(totalHeightMillimeters: 25, distanceMeters: 0.4)
        XCTAssertEqual(measurement.totalHeightMillimeters, 25, accuracy: 1e-9)
        XCTAssertEqual(measurement.criticalDetailMillimeters, 5, accuracy: 1e-9)
        // The total angular size must NOT equal MAR: it's approximately 5x
        // larger, since total height = 5 x critical detail. This is exactly
        // the assumption the encargo warns against making implicitly.
        XCTAssertEqual(measurement.totalAngularSizeArcMinutes / measurement.marArcMinutes, 5.0, accuracy: 1e-2)
        XCTAssertGreaterThan(measurement.totalAngularSizeArcMinutes, measurement.marArcMinutes)
    }

    func testMeasurementLogMARMatchesDirectConversion() {
        let measurement = StimulusScaler.measurement(totalHeightMillimeters: 25, distanceMeters: 0.4)
        XCTAssertEqual(
            measurement.logMAR,
            VisualAcuityMath.logMAR(marArcMinutes: measurement.marArcMinutes),
            accuracy: 1e-9
        )
    }
}
