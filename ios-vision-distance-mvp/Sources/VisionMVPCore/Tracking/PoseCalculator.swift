import Foundation

public struct EulerAngles: Equatable, Sendable {
    public var yawDegrees: Double
    public var pitchDegrees: Double
    public var rollDegrees: Double

    public init(yawDegrees: Double, pitchDegrees: Double, rollDegrees: Double) {
        self.yawDegrees = yawDegrees
        self.pitchDegrees = pitchDegrees
        self.rollDegrees = rollDegrees
    }
}

public enum PoseCalculator {
    /// Extracts Tait-Bryan yaw (Y axis), pitch (X axis), roll (Z axis) angles
    /// from the rotation part of `matrix`, assuming the rotation was composed
    /// as `Rz(roll) * Ry(yaw) * Rx(pitch)`. This is the standard ZYX
    /// decomposition; see `VisionMVPCoreTests/PoseCalculatorTests.swift` for a
    /// round-trip check against independently-built elementary rotations.
    ///
    /// IMPORTANT: this has not been validated against a physical device — the
    /// exact sign/axis mapping to "yaw = turning head left/right" etc. must be
    /// confirmed empirically on an iPhone (turn head right, check the sign
    /// printed by the app matches "positive = right") before trusting the sign
    /// in analysis. See DECISIONS.md.
    ///
    /// Degenerate near yaw = ±90°(gimbal lock): pitch and roll become coupled
    /// and unreliable. Callers should treat `|yaw| > ~80°` as low-quality pose
    /// regardless of the individual pitch/roll values.
    public static func eulerAngles(from matrix: Matrix4x4) -> EulerAngles {
        let r20 = matrix.m[0][2]
        let r21 = matrix.m[1][2]
        let r22 = matrix.m[2][2]
        let r10 = matrix.m[0][1]
        let r00 = matrix.m[0][0]

        let clamped = max(-1.0, min(1.0, -r20))
        let yaw = asin(clamped)
        let pitch = atan2(r21, r22)
        let roll = atan2(r10, r00)

        return EulerAngles(
            yawDegrees: yaw * 180.0 / .pi,
            pitchDegrees: pitch * 180.0 / .pi,
            rollDegrees: roll * 180.0 / .pi
        )
    }
}
