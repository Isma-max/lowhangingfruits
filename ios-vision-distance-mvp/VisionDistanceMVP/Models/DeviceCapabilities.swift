import Foundation
import ARKit
import AVFoundation
import UIKit
import VisionMVPCore

/// Result of the runtime compatibility check (brief Pantalla 2). Built once
/// by `CompatibilityChecker` and then copied into a `SessionRecord` — kept as
/// a plain struct (not persisted directly) so the detection logic has a
/// single, easily-testable-by-inspection entry point.
struct DeviceCapabilities: Codable, Equatable {
    var deviceModelIdentifier: String
    var iosVersion: String
    var hasARFaceTrackingConfiguration: Bool
    var hasKnownScreenGeometry: Bool
    var cameraAuthorizationStatusRaw: String
    var isPortraitOrientation: Bool

    /// Everything the distance module actually needs is present: face
    /// tracking hardware/API support and camera access granted. Screen
    /// geometry and orientation are surfaced separately since they affect
    /// specific features (stimulus sizing, UI layout) without blocking the
    /// core distance measurement.
    var isCompatible: Bool {
        hasARFaceTrackingConfiguration && cameraAuthorizationStatusRaw == "authorized"
    }
}

enum CompatibilityChecker {
    static func currentDeviceModelIdentifier() -> String {
        var systemInfo = utsname()
        uname(&systemInfo)
        let machineMirror = Mirror(reflecting: systemInfo.machine)
        let identifier = machineMirror.children.reduce(into: "") { result, element in
            guard let value = element.value as? Int8, value != 0 else { return }
            result.append(Character(UnicodeScalar(UInt8(value))))
        }
        return identifier
    }

    /// Does not request camera permission itself — only reports the current
    /// `AVCaptureDevice.authorizationStatus`; the Preparation screen is
    /// responsible for requesting access explicitly and re-running this check.
    static func currentCapabilities() -> DeviceCapabilities {
        let modelIdentifier = currentDeviceModelIdentifier()
        let authStatus = AVCaptureDevice.authorizationStatus(for: .video)
        let authStatusRaw: String
        switch authStatus {
        case .authorized: authStatusRaw = "authorized"
        case .denied: authStatusRaw = "denied"
        case .restricted: authStatusRaw = "restricted"
        case .notDetermined: authStatusRaw = "not_determined"
        @unknown default: authStatusRaw = "unknown"
        }

        return DeviceCapabilities(
            deviceModelIdentifier: modelIdentifier,
            iosVersion: UIDevice.current.systemVersion,
            hasARFaceTrackingConfiguration: ARFaceTrackingConfiguration.isSupported,
            hasKnownScreenGeometry: VisionMVPCore.DeviceScreenGeometry.physicalSize(forModelIdentifier: modelIdentifier) != nil,
            cameraAuthorizationStatusRaw: authStatusRaw,
            isPortraitOrientation: UIDevice.current.orientation.isPortrait || UIDevice.current.orientation == .unknown
        )
    }
}
