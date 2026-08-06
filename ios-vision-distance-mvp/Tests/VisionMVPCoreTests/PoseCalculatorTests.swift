import XCTest
@testable import VisionMVPCore

/// Builds Rz(roll) * Ry(yaw) * Rx(pitch) from elementary rotation matrices,
/// independently of `PoseCalculator`'s closed-form extraction, so the round
/// trip (build from known angles -> extract -> compare) is a real check of
/// the extraction formula rather than a tautology.
private func degToRad(_ d: Double) -> Double { d * .pi / 180.0 }

private func rotationX(_ degrees: Double) -> Matrix4x4 {
    let a = degToRad(degrees)
    return Matrix4x4(columns: [
        [1, 0, 0, 0],
        [0, cos(a), sin(a), 0],
        [0, -sin(a), cos(a), 0],
        [0, 0, 0, 1],
    ])
}

private func rotationY(_ degrees: Double) -> Matrix4x4 {
    let a = degToRad(degrees)
    return Matrix4x4(columns: [
        [cos(a), 0, -sin(a), 0],
        [0, 1, 0, 0],
        [sin(a), 0, cos(a), 0],
        [0, 0, 0, 1],
    ])
}

private func rotationZ(_ degrees: Double) -> Matrix4x4 {
    let a = degToRad(degrees)
    return Matrix4x4(columns: [
        [cos(a), sin(a), 0, 0],
        [-sin(a), cos(a), 0, 0],
        [0, 0, 1, 0],
        [0, 0, 0, 1],
    ])
}

final class PoseCalculatorTests: XCTestCase {
    func testIdentityHasZeroPose() {
        let euler = PoseCalculator.eulerAngles(from: .identity)
        XCTAssertEqual(euler.yawDegrees, 0, accuracy: 1e-6)
        XCTAssertEqual(euler.pitchDegrees, 0, accuracy: 1e-6)
        XCTAssertEqual(euler.rollDegrees, 0, accuracy: 1e-6)
    }

    func testPureYawRoundTrip() {
        let matrix = rotationY(25)
        let euler = PoseCalculator.eulerAngles(from: matrix)
        XCTAssertEqual(euler.yawDegrees, 25, accuracy: 1e-6)
        XCTAssertEqual(euler.pitchDegrees, 0, accuracy: 1e-6)
        XCTAssertEqual(euler.rollDegrees, 0, accuracy: 1e-6)
    }

    func testPurePitchRoundTrip() {
        let matrix = rotationX(-18)
        let euler = PoseCalculator.eulerAngles(from: matrix)
        XCTAssertEqual(euler.pitchDegrees, -18, accuracy: 1e-6)
        XCTAssertEqual(euler.yawDegrees, 0, accuracy: 1e-6)
        XCTAssertEqual(euler.rollDegrees, 0, accuracy: 1e-6)
    }

    func testPureRollRoundTrip() {
        let matrix = rotationZ(12)
        let euler = PoseCalculator.eulerAngles(from: matrix)
        XCTAssertEqual(euler.rollDegrees, 12, accuracy: 1e-6)
        XCTAssertEqual(euler.yawDegrees, 0, accuracy: 1e-6)
        XCTAssertEqual(euler.pitchDegrees, 0, accuracy: 1e-6)
    }

    func testCombinedAngleRoundTripAwayFromGimbalLock() {
        let yaw = 20.0, pitch = 15.0, roll = 10.0
        let matrix = rotationZ(roll) * rotationY(yaw) * rotationX(pitch)

        let euler = PoseCalculator.eulerAngles(from: matrix)

        XCTAssertEqual(euler.yawDegrees, yaw, accuracy: 1e-6)
        XCTAssertEqual(euler.pitchDegrees, pitch, accuracy: 1e-6)
        XCTAssertEqual(euler.rollDegrees, roll, accuracy: 1e-6)
    }
}
