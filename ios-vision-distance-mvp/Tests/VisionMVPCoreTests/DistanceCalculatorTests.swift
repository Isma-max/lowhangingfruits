import XCTest
@testable import VisionMVPCore

final class DistanceCalculatorTests: XCTestCase {
    func testDistanceBetweenOriginAndTranslatedPoint() {
        let camera = Matrix4x4.identity
        let face = Matrix4x4.translation(Vector3(x: 0, y: 0, z: -0.40))

        let distance = DistanceCalculator.distance(from: camera, to: face)

        XCTAssertEqual(distance, 0.40, accuracy: 1e-9)
    }

    func testDistanceIsSymmetric() {
        let a = Matrix4x4.translation(Vector3(x: 0.1, y: -0.2, z: 0.3))
        let b = Matrix4x4.translation(Vector3(x: -0.4, y: 0.5, z: -0.1))

        XCTAssertEqual(
            DistanceCalculator.distance(from: a, to: b),
            DistanceCalculator.distance(from: b, to: a),
            accuracy: 1e-9
        )
    }

    func testEyeWorldTransformComposesParentAndLocalOffset() {
        // Face anchor 40cm in front of the camera; left eye offset 3cm along x
        // in the face's local space (mirrors ARKit's leftEyeTransform being
        // relative to the face anchor, not world space).
        let camera = Matrix4x4.identity
        let faceAnchor = Matrix4x4.translation(Vector3(x: 0, y: 0, z: -0.40))
        let leftEyeLocalOffset = Matrix4x4.translation(Vector3(x: 0.03, y: 0, z: 0))

        let leftEyeWorld = DistanceCalculator.worldTransform(localOffset: leftEyeLocalOffset, in: faceAnchor)
        let distanceToLeftEye = DistanceCalculator.distance(from: camera, to: leftEyeWorld)

        let expected = (0.03 * 0.03 + 0.40 * 0.40).squareRoot()
        XCTAssertEqual(leftEyeWorld.translation, Vector3(x: 0.03, y: 0, z: -0.40))
        XCTAssertEqual(distanceToLeftEye, expected, accuracy: 1e-9)
    }

    func testDistanceAtEachRequiredMilestone() {
        let camera = Matrix4x4.identity
        let milestonesCm: [Double] = [20, 25, 30, 35, 40, 50, 60, 70, 80]

        for cm in milestonesCm {
            let face = Matrix4x4.translation(Vector3(x: 0, y: 0, z: -cm / 100.0))
            let distanceM = DistanceCalculator.distance(from: camera, to: face)
            XCTAssertEqual(distanceM * 100.0, cm, accuracy: 1e-6, "mismatch at \(cm)cm milestone")
        }
    }
}
