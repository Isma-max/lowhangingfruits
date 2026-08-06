import XCTest
@testable import VisionMVPCore

final class StimulusScalerTests: XCTestCase {
    func testPhysicalSizeAngleRoundTrip() {
        let targetAngle = 30.0 // arcmin
        let distance = 0.5 // meters

        let sizeMm = StimulusScaler.physicalSizeMillimeters(targetAngularSizeArcMinutes: targetAngle, distanceMeters: distance)
        let recoveredAngle = StimulusScaler.angularSizeArcMinutes(physicalSizeMillimeters: sizeMm, distanceMeters: distance)

        XCTAssertEqual(recoveredAngle, targetAngle, accuracy: 1e-9)
    }

    func testConstantAngularSizeMeansPhysicalSizeGrowsWithDistance() {
        let angle = 20.0
        let sizeAt25cm = StimulusScaler.physicalSizeMillimeters(targetAngularSizeArcMinutes: angle, distanceMeters: 0.25)
        let sizeAt50cm = StimulusScaler.physicalSizeMillimeters(targetAngularSizeArcMinutes: angle, distanceMeters: 0.50)

        // Small-angle regime: doubling distance should ~double physical size
        // for the same angular size.
        XCTAssertEqual(sizeAt50cm / sizeAt25cm, 2.0, accuracy: 1e-3)
    }

    func testSmallAngleApproximationMatchesExactFormulaClosely() {
        // At 5 arcmin / 40cm, size ~= distance * angleRadians (small-angle).
        let angleArcMin = 5.0
        let distance = 0.40
        let sizeMm = StimulusScaler.physicalSizeMillimeters(targetAngularSizeArcMinutes: angleArcMin, distanceMeters: distance)

        let angleRadians = (angleArcMin / 60.0) * Double.pi / 180.0
        let approxSizeMm = distance * angleRadians * 1000.0

        XCTAssertEqual(sizeMm, approxSizeMm, accuracy: 1e-4)
    }

    func testMillimetersToPoints() {
        let points = StimulusScaler.millimetersToPoints(10, screenWidthPoints: 390, screenPhysicalWidthMillimeters: 64.59)
        let expected = 10 * (390.0 / 64.59)
        XCTAssertEqual(points, expected, accuracy: 1e-9)
    }

    func testMillimetersToPointsGuardsAgainstZeroPhysicalWidth() {
        XCTAssertEqual(StimulusScaler.millimetersToPoints(10, screenWidthPoints: 390, screenPhysicalWidthMillimeters: 0), 0)
    }

    func testDeviceScreenGeometryLookupKnownModel() {
        let size = DeviceScreenGeometry.physicalSize(forModelIdentifier: "iPhone15,2")
        XCTAssertNotNil(size)
        XCTAssertEqual(size!.widthMillimeters, 65.09, accuracy: 1e-6)
    }

    func testDeviceScreenGeometryLookupUnknownModelReturnsNil() {
        XCTAssertNil(DeviceScreenGeometry.physicalSize(forModelIdentifier: "iPhone99,99"))
    }
}
