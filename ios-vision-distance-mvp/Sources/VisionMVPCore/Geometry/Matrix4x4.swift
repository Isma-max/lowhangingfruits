import Foundation

/// A column-major 4x4 matrix, matching the memory layout convention of ARKit's
/// `simd_float4x4` (`m.columns.0`, `.1`, `.2`, `.3`), so values can be copied
/// column-by-column from an ARKit transform without any reinterpretation.
///
/// `m[column][row]` — e.g. `m[3]` is the translation column, `m[3][0]`/`[1]`/`[2]`
/// are its x/y/z.
public struct Matrix4x4: Equatable, Sendable {
    public var m: [[Double]]

    /// `columns[c][r]`, 4 columns of 4 rows each.
    public init(columns: [[Double]]) {
        precondition(columns.count == 4 && columns.allSatisfy { $0.count == 4 },
                     "Matrix4x4 requires exactly 4 columns of 4 rows")
        self.m = columns
    }

    public static let identity = Matrix4x4(columns: [
        [1, 0, 0, 0],
        [0, 1, 0, 0],
        [0, 0, 1, 0],
        [0, 0, 0, 1],
    ])

    /// Builds a pure-translation transform.
    public static func translation(_ t: Vector3) -> Matrix4x4 {
        var identity = Matrix4x4.identity
        identity.m[3] = [t.x, t.y, t.z, 1]
        return identity
    }

    public var translation: Vector3 {
        Vector3(x: m[3][0], y: m[3][1], z: m[3][2])
    }

    /// Standard matrix product `lhs * rhs` (column-major storage).
    public static func * (lhs: Matrix4x4, rhs: Matrix4x4) -> Matrix4x4 {
        var result = [[Double]](repeating: [Double](repeating: 0, count: 4), count: 4)
        for col in 0..<4 {
            for row in 0..<4 {
                var sum = 0.0
                for k in 0..<4 {
                    sum += lhs.m[k][row] * rhs.m[col][k]
                }
                result[col][row] = sum
            }
        }
        return Matrix4x4(columns: result)
    }
}
