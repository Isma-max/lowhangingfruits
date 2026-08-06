import Foundation
import simd
import VisionMVPCore

/// The only place `simd`/ARKit numeric types cross into `VisionMVPCore`'s
/// plain-Swift `Matrix4x4`/`Vector3` — keeps the pure package buildable
/// without any Apple-only frameworks (see DECISIONS.md).
extension Matrix4x4 {
    init(fromSIMD m: simd_float4x4) {
        self.init(columns: [
            [Double(m.columns.0.x), Double(m.columns.0.y), Double(m.columns.0.z), Double(m.columns.0.w)],
            [Double(m.columns.1.x), Double(m.columns.1.y), Double(m.columns.1.z), Double(m.columns.1.w)],
            [Double(m.columns.2.x), Double(m.columns.2.y), Double(m.columns.2.z), Double(m.columns.2.w)],
            [Double(m.columns.3.x), Double(m.columns.3.y), Double(m.columns.3.z), Double(m.columns.3.w)],
        ])
    }
}

extension Vector3 {
    var simd: SIMD3<Float> {
        SIMD3<Float>(Float(x), Float(y), Float(z))
    }
}
