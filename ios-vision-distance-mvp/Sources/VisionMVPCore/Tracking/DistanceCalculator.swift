import Foundation

/// Pure math for turning ARKit transforms into distances. See DECISIONS.md for
/// exactly which ARKit values feed this at the app-target boundary
/// (`ARFrame.camera.transform` and `ARFaceAnchor.transform` /
/// `.leftEyeTransform` / `.rightEyeTransform`).
public enum DistanceCalculator {
    /// Euclidean distance between the origins of two world-space transforms, in
    /// whatever linear unit the transforms use (meters, for ARKit).
    public static func distance(from a: Matrix4x4, to b: Matrix4x4) -> Double {
        (b.translation - a.translation).length
    }

    /// Composes a transform expressed in `parent`'s local space (e.g. ARKit's
    /// `leftEyeTransform`, which is relative to the face anchor) into world
    /// space: `parent * localOffset`.
    public static func worldTransform(localOffset: Matrix4x4, in parent: Matrix4x4) -> Matrix4x4 {
        parent * localOffset
    }
}
