import Foundation

/// Converts between visual angle, physical stimulus size, and on-screen
/// points. This is the mechanism behind brief section 2's central
/// manipulation: rescaling the optotype so it keeps ~constant angular size
/// as distance changes.
public enum StimulusScaler {
    /// Physical size (mm) so that a stimulus subtends `targetAngularSizeArcMinutes`
    /// of visual angle at `distanceMeters`. Exact formula (not small-angle
    /// approximated, since distances go down to 20cm where the approximation
    /// error is no longer negligible): size = 2 * distance * tan(angle / 2).
    public static func physicalSizeMillimeters(targetAngularSizeArcMinutes: Double, distanceMeters: Double) -> Double {
        let angleRadians = arcMinutesToRadians(targetAngularSizeArcMinutes)
        let sizeMeters = 2 * distanceMeters * tan(angleRadians / 2)
        return sizeMeters * 1000.0
    }

    /// Inverse of the above: the angular size (arcmin) actually subtended by a
    /// stimulus of `physicalSizeMillimeters` at `distanceMeters`. Used to log
    /// the true angular size actually presented on every trial, even in the
    /// "fixed physical size" control condition where it is not held constant
    /// by construction.
    public static func angularSizeArcMinutes(physicalSizeMillimeters: Double, distanceMeters: Double) -> Double {
        let sizeMeters = physicalSizeMillimeters / 1000.0
        let angleRadians = 2 * atan((sizeMeters / 2) / distanceMeters)
        return radiansToArcMinutes(angleRadians)
    }

    /// Converts a physical size in millimeters to SwiftUI points for a given
    /// device, using the *current* live screen width in points (so Display
    /// Zoom / accessibility text size settings, which change points-per-mm,
    /// are handled correctly) divided by the device's known physical width.
    public static func millimetersToPoints(
        _ millimeters: Double,
        screenWidthPoints: Double,
        screenPhysicalWidthMillimeters: Double
    ) -> Double {
        guard screenPhysicalWidthMillimeters > 0 else { return 0 }
        let pointsPerMillimeter = screenWidthPoints / screenPhysicalWidthMillimeters
        return millimeters * pointsPerMillimeter
    }

    private static func arcMinutesToRadians(_ arcMinutes: Double) -> Double {
        (arcMinutes / 60.0) * .pi / 180.0
    }

    private static func radiansToArcMinutes(_ radians: Double) -> Double {
        radians * 180.0 / .pi * 60.0
    }
}

/// Full optotype measurement for one presentation: total height and its
/// critical detail (the 1/5-scale gap/stroke), each converted to an angular
/// size at the viewing distance, plus MAR/logMAR — computed from the
/// critical-detail angle, never the total-height angle (see
/// `VisualAcuityMath`'s warning). This is the single place trial views
/// should go to avoid re-deriving the total-vs-critical distinction ad hoc.
public struct OptotypeMeasurement: Sendable {
    public var totalHeightMillimeters: Double
    public var criticalDetailMillimeters: Double
    public var totalAngularSizeArcMinutes: Double
    public var marArcMinutes: Double
    public var logMAR: Double

    public init(
        totalHeightMillimeters: Double,
        criticalDetailMillimeters: Double,
        totalAngularSizeArcMinutes: Double,
        marArcMinutes: Double,
        logMAR: Double
    ) {
        self.totalHeightMillimeters = totalHeightMillimeters
        self.criticalDetailMillimeters = criticalDetailMillimeters
        self.totalAngularSizeArcMinutes = totalAngularSizeArcMinutes
        self.marArcMinutes = marArcMinutes
        self.logMAR = logMAR
    }
}

extension StimulusScaler {
    public static func measurement(totalHeightMillimeters: Double, distanceMeters: Double) -> OptotypeMeasurement {
        let criticalDetail = OptotypeGeometry.criticalDetail(totalHeight: totalHeightMillimeters)
        let totalAngle = angularSizeArcMinutes(physicalSizeMillimeters: totalHeightMillimeters, distanceMeters: distanceMeters)
        let marAngle = angularSizeArcMinutes(physicalSizeMillimeters: criticalDetail, distanceMeters: distanceMeters)
        return OptotypeMeasurement(
            totalHeightMillimeters: totalHeightMillimeters,
            criticalDetailMillimeters: criticalDetail,
            totalAngularSizeArcMinutes: totalAngle,
            marArcMinutes: marAngle,
            logMAR: VisualAcuityMath.logMAR(marArcMinutes: marAngle)
        )
    }
}
