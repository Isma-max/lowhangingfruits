import UIKit
import VisionMVPCore

/// Bridges `VisionMVPCore.StimulusScaler`/`DeviceScreenGeometry` to the
/// current device's live `UIScreen` bounds — the one place the app target
/// converts a stimulus size in millimeters to on-screen points.
enum ScreenGeometryHelper {
    /// Falls back to a fixed, clearly-approximate ratio when the device
    /// model isn't in `DeviceScreenGeometry`'s table (brief: never present a
    /// guess as if it were calibrated) — callers should also surface
    /// `SessionRecord.hasKnownScreenGeometry` to the investigator so
    /// angular-size numbers from that session are flagged as approximate.
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
