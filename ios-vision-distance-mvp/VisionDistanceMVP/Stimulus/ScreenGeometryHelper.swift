import UIKit
import VisionMVPCore

/// Bridges `VisionMVPCore.StimulusScaler`/`DeviceScreenGeometry` to the
/// current device's live `UIScreen` bounds — the one place the app target
/// converts a stimulus size in millimeters to on-screen points.
enum ScreenGeometryHelper {
    /// Falls back to a fixed, clearly-approximate ratio when the device
    /// model isn't in `DeviceScreenGeometry`'s table — never present a guess
    /// as if it were calibrated. On such a device the exported millimeter
    /// and arcminute values are approximate; the model identifier in
    /// `session_summary.json` is what tells the analyst which case applies.
    static func pointsForMillimeters(_ millimeters: Double) -> Double {
        let modelIdentifier = CompatibilityChecker.currentDeviceModelIdentifier()
        let screenWidthPoints = UIScreen.main.bounds.width
        guard let physicalSize = DeviceScreenGeometry.physicalSize(forModelIdentifier: modelIdentifier) else {
            let approximatePointsPerMillimeter = 6.0 // ballpark for modern iPhones, NOT calibrated
            return millimeters * approximatePointsPerMillimeter
        }
        return StimulusScaler.millimetersToPoints(
            millimeters,
            screenWidthPoints: screenWidthPoints,
            screenPhysicalWidthMillimeters: physicalSize.widthMillimeters
        )
    }
}
