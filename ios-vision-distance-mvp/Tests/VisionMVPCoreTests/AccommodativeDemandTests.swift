import XCTest
@testable import VisionMVPCore

final class AccommodativeDemandTests: XCTestCase {
    func testKnownDistancesFromTheResearchBrief() {
        XCTAssertEqual(AccommodativeDemand.diopters(distanceMeters: 0.25), 4.00, accuracy: 1e-9)
        XCTAssertEqual(AccommodativeDemand.diopters(distanceMeters: 0.40), 2.50, accuracy: 1e-9)
        XCTAssertEqual(AccommodativeDemand.diopters(distanceMeters: 0.50), 2.00, accuracy: 1e-9)
        XCTAssertEqual(AccommodativeDemand.diopters(distanceMeters: 1.00), 1.00, accuracy: 1e-9)
    }

    func testApproximateThirtyThreeCentimeters() {
        XCTAssertEqual(AccommodativeDemand.diopters(distanceMeters: 0.33), 3.0303, accuracy: 1e-3)
    }

    func testZeroDistanceReturnsInfinityRatherThanCrashing() {
        XCTAssertEqual(AccommodativeDemand.diopters(distanceMeters: 0), Double.infinity)
    }
}
