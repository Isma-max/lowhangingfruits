import Foundation
import ARKit
import UIKit
import VisionMVPCore

/// Wraps `ARSession` + `ARFaceTrackingConfiguration` (TrueDepth) and publishes
/// derived, per-frame measurements. Deliberately never attached to any
/// `ARSCNView`/`ARView` and never touches `frame.capturedImage` — the camera
/// feed itself is processed transiently by ARKit and immediately discarded;
/// only the numeric anchors/pose below ever leave this object (brief section
/// 4: no photo/video storage; section 3: "Procesamiento de cámara
/// completamente local").
///
/// Distance formula (see DECISIONS.md for the full writeup): Euclidean
/// distance between `ARFrame.camera.transform`'s translation (camera pose in
/// ARKit's metric world space) and `ARFaceAnchor.transform`'s translation
/// (face pose, same space) — both real metric transforms from ARKit, not
/// normalized/relative landmarks. Per-eye distances compose
/// `faceAnchor.transform * faceAnchor.leftEyeTransform` (resp. right) before
/// the same subtraction, since the eye transforms are documented by Apple as
/// relative to the face anchor, not world space.
final class FaceTrackingSession: NSObject, ObservableObject {
    struct LiveSample {
        /// `ARFrame.timestamp`: seconds, monotonic within this run, NOT wall-clock.
        var frameTimestamp: TimeInterval
        var distanceToFaceMeters: Double?
        var distanceToLeftEyeMeters: Double?
        var distanceToRightEyeMeters: Double?
        var distanceMeanEyesMeters: Double?
        var yawDegrees: Double
        var pitchDegrees: Double
        var rollDegrees: Double
        var isFaceTracked: Bool
        var worldTrackingState: WorldTrackingState
        var faceCentered: Bool
        var leftEyeInFrame: Bool
        var rightEyeInFrame: Bool
    }

    @Published private(set) var latestSample: LiveSample?
    @Published private(set) var isRunning = false
    @Published private(set) var startupErrorMessage: String?
    /// ARKit's own approximate ambient light estimate (lumens) — an Apple
    /// rendering-quality estimate, not a calibrated lux meter. Sampled
    /// opportunistically, not treated as a precise measurement (see
    /// DECISIONS.md / brief: "no inferir iluminación con falsa precisión").
    @Published private(set) var latestAmbientLightLumens: Double?

    private let session = ARSession()

    override init() {
        super.init()
        session.delegate = self
    }

    static var isSupported: Bool { ARFaceTrackingConfiguration.isSupported }

    func start() {
        guard ARFaceTrackingConfiguration.isSupported else {
            startupErrorMessage = "Este dispositivo no admite seguimiento facial TrueDepth."
            return
        }
        let configuration = ARFaceTrackingConfiguration()
        configuration.isLightEstimationEnabled = true
        configuration.maximumNumberOfTrackedFaces = 1
        startupErrorMessage = nil
        session.run(configuration, options: [.resetTracking, .removeExistingAnchors])
        isRunning = true
    }

    func stop() {
        session.pause()
        isRunning = false
    }

    private static func worldTrackingState(from state: ARCamera.TrackingState) -> WorldTrackingState {
        switch state {
        case .normal:
            return .normal
        case .notAvailable:
            return .notAvailable
        case .limited(let reason):
            let reasonText: String
            switch reason {
            case .initializing: reasonText = "initializing"
            case .excessiveMotion: reasonText = "excessive_motion"
            case .insufficientFeatures: reasonText = "insufficient_features"
            case .relocalizing: reasonText = "relocalizing"
            @unknown default: reasonText = "unknown"
            }
            return .limited(reasonText)
        }
    }

    private static func isPointWithinViewport(_ point: CGPoint, viewportSize: CGSize, marginFraction: CGFloat) -> Bool {
        guard point.x.isFinite, point.y.isFinite else { return false }
        let marginX = viewportSize.width * marginFraction
        let marginY = viewportSize.height * marginFraction
        return point.x > marginX && point.x < viewportSize.width - marginX
            && point.y > marginY && point.y < viewportSize.height - marginY
    }

    private static func deriveSample(from frame: ARFrame) -> LiveSample {
        let cameraTransform = Matrix4x4(fromSIMD: frame.camera.transform)
        let worldTracking = worldTrackingState(from: frame.camera.trackingState)
        let viewportSize = UIScreen.main.bounds.size

        guard let faceAnchor = frame.anchors.compactMap({ $0 as? ARFaceAnchor }).first else {
            return LiveSample(
                frameTimestamp: frame.timestamp,
                distanceToFaceMeters: nil,
                distanceToLeftEyeMeters: nil,
                distanceToRightEyeMeters: nil,
                distanceMeanEyesMeters: nil,
                yawDegrees: 0, pitchDegrees: 0, rollDegrees: 0,
                isFaceTracked: false,
                worldTrackingState: worldTracking,
                faceCentered: false,
                leftEyeInFrame: false,
                rightEyeInFrame: false
            )
        }

        let faceTransform = Matrix4x4(fromSIMD: faceAnchor.transform)
        let leftEyeWorld = DistanceCalculator.worldTransform(
            localOffset: Matrix4x4(fromSIMD: faceAnchor.leftEyeTransform), in: faceTransform
        )
        let rightEyeWorld = DistanceCalculator.worldTransform(
            localOffset: Matrix4x4(fromSIMD: faceAnchor.rightEyeTransform), in: faceTransform
        )

        let distanceToFace = DistanceCalculator.distance(from: cameraTransform, to: faceTransform)
        let distanceToLeftEye = DistanceCalculator.distance(from: cameraTransform, to: leftEyeWorld)
        let distanceToRightEye = DistanceCalculator.distance(from: cameraTransform, to: rightEyeWorld)
        let pose = PoseCalculator.eulerAngles(from: faceTransform)

        let faceProjected = frame.camera.projectPoint(faceTransform.translation.simd, orientation: .portrait, viewportSize: viewportSize)
        let leftEyeProjected = frame.camera.projectPoint(leftEyeWorld.translation.simd, orientation: .portrait, viewportSize: viewportSize)
        let rightEyeProjected = frame.camera.projectPoint(rightEyeWorld.translation.simd, orientation: .portrait, viewportSize: viewportSize)

        let centerDX = abs(faceProjected.x - viewportSize.width / 2) / (viewportSize.width / 2)
        let centerDY = abs(faceProjected.y - viewportSize.height / 2) / (viewportSize.height / 2)
        let faceCentered = faceProjected.x.isFinite && faceProjected.y.isFinite && centerDX < 0.3 && centerDY < 0.3

        return LiveSample(
            frameTimestamp: frame.timestamp,
            distanceToFaceMeters: distanceToFace,
            distanceToLeftEyeMeters: distanceToLeftEye,
            distanceToRightEyeMeters: distanceToRightEye,
            distanceMeanEyesMeters: (distanceToLeftEye + distanceToRightEye) / 2,
            yawDegrees: pose.yawDegrees,
            pitchDegrees: pose.pitchDegrees,
            rollDegrees: pose.rollDegrees,
            isFaceTracked: faceAnchor.isTracked,
            worldTrackingState: worldTracking,
            faceCentered: faceCentered,
            leftEyeInFrame: isPointWithinViewport(leftEyeProjected, viewportSize: viewportSize, marginFraction: 0.05),
            rightEyeInFrame: isPointWithinViewport(rightEyeProjected, viewportSize: viewportSize, marginFraction: 0.05)
        )
    }
}

extension FaceTrackingSession: ARSessionDelegate {
    // ARKit calls delegate methods on an internal queue, not necessarily the
    // main thread — hop to main explicitly before touching @Published state.
    func session(_ session: ARSession, didUpdate frame: ARFrame) {
        let sample = Self.deriveSample(from: frame)
        let ambientLumens = frame.lightEstimate?.ambientIntensity
        DispatchQueue.main.async { [weak self] in
            self?.latestSample = sample
            if let ambientLumens {
                self?.latestAmbientLightLumens = Double(ambientLumens)
            }
        }
    }

    func session(_ session: ARSession, didFailWithError error: Error) {
        DispatchQueue.main.async { [weak self] in
            self?.startupErrorMessage = error.localizedDescription
            self?.isRunning = false
        }
    }

    func sessionWasInterrupted(_ session: ARSession) {
        DispatchQueue.main.async { [weak self] in
            self?.isRunning = false
        }
    }

    func sessionInterruptionEnded(_ session: ARSession) {
        DispatchQueue.main.async { [weak self] in
            self?.start()
        }
    }
}
