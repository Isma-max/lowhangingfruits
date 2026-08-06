import Foundation

/// Standard optotype grid geometry: total height = 5 units, critical detail
/// (Landolt-C gap / stroke width) = 1 unit = totalHeight / 5. Centralized
/// here so every place that needs the critical detail (MAR calculations,
/// rendering) derives it the same way instead of re-deriving the /5 locally.
public enum OptotypeGeometry {
    public static func criticalDetail(totalHeight: Double) -> Double {
        totalHeight / 5.0
    }

    public static func totalHeight(criticalDetail: Double) -> Double {
        criticalDetail * 5.0
    }
}

/// MAR/logMAR conversions. MAR (minimum angle of resolution) is the angular
/// size, in arcminutes, of an optotype's *critical detail* — not its total
/// height. Do not pass a total-height angular size in here; convert to the
/// critical-detail angle first (see `StimulusScaler.measurement`).
public enum VisualAcuityMath {
    public static func logMAR(marArcMinutes: Double) -> Double {
        log10(marArcMinutes)
    }

    public static func marArcMinutes(logMAR: Double) -> Double {
        pow(10, logMAR)
    }
}
