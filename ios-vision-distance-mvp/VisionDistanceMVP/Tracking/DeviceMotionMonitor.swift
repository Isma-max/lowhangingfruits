import Foundation
import CoreMotion

/// Device inclination (brief Pantalla 5: "Inclinación del dispositivo") —
/// the phone's own attitude in space via CoreMotion, distinct from ARKit's
/// face-relative yaw/pitch/roll in `FaceTrackingSession`, which describes the
/// participant's head pose, not the device's.
final class DeviceMotionMonitor: ObservableObject {
    /// Combined pitch+roll magnitude in degrees, `nil` until the first
    /// reading arrives or if device motion isn't available on this hardware.
    @Published private(set) var tiltDegrees: Double?

    private let motionManager = CMMotionManager()

    func start() {
        guard motionManager.isDeviceMotionAvailable else { return }
        motionManager.deviceMotionUpdateInterval = 0.2
        motionManager.startDeviceMotionUpdates(to: .main) { [weak self] motion, _ in
            guard let motion else { return }
            let pitch = motion.attitude.pitch
            let roll = motion.attitude.roll
            let combinedRadians = (pitch * pitch + roll * roll).squareRoot()
            self?.tiltDegrees = combinedRadians * 180.0 / .pi
        }
    }

    func stop() {
        motionManager.stopDeviceMotionUpdates()
    }
}
