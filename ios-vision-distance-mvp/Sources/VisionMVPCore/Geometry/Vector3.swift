import Foundation

/// A plain 3D vector with no dependency on Apple's `simd` module, so this whole
/// package can be built and tested with a stock Swift toolchain (including on
/// Linux) instead of requiring Xcode. The app target converts ARKit's
/// `simd_float4x4` values into `Matrix4x4`/`Vector3` at the boundary.
public struct Vector3: Equatable, Sendable {
    public var x: Double
    public var y: Double
    public var z: Double

    public init(x: Double, y: Double, z: Double) {
        self.x = x
        self.y = y
        self.z = z
    }

    public static let zero = Vector3(x: 0, y: 0, z: 0)

    public static func - (lhs: Vector3, rhs: Vector3) -> Vector3 {
        Vector3(x: lhs.x - rhs.x, y: lhs.y - rhs.y, z: lhs.z - rhs.z)
    }

    public static func + (lhs: Vector3, rhs: Vector3) -> Vector3 {
        Vector3(x: lhs.x + rhs.x, y: lhs.y + rhs.y, z: lhs.z + rhs.z)
    }

    /// Euclidean norm, in the same linear unit as the components (meters, for ARKit transforms).
    public var length: Double {
        (x * x + y * y + z * z).squareRoot()
    }
}
