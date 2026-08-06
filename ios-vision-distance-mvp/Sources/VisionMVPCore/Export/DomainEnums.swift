import Foundation

/// Which eye(s) were being tested (brief section 6: "prueba binocular, ojo
/// derecho u ojo izquierdo").
public enum EyeCondition: String, Codable, Sendable, CaseIterable {
    case oculusDexter = "OD" // right eye only
    case oculusSinister = "OS" // left eye only
    case oculusUterque = "OU" // both eyes (binocular)
}

/// Which sub-test produced a given trial (brief section 2: static baseline as
/// the "simpler variable" comparison arm; the two dynamic scaling modes so
/// objective #3 — "qué ocurre si el estímulo cambia de tamaño" — can be
/// answered by comparing them; blur-crossing for objective #2).
public enum TaskPhase: String, Codable, Sendable, CaseIterable {
    case staticBaseline = "static_baseline"
    case dynamicConstantAngularSize = "dynamic_constant_angular_size"
    case dynamicFixedPhysicalSize = "dynamic_fixed_physical_size"
    case blurCrossing = "blur_crossing"
}

/// Landolt C gap orientation: 8-alternative forced choice, standard for this
/// optotype. `rotationDegrees` is clockwise from "gap at top" (0°).
public enum GapOrientation: String, Codable, Sendable, CaseIterable {
    case up
    case upRight = "up_right"
    case right
    case downRight = "down_right"
    case down
    case downLeft = "down_left"
    case left
    case upLeft = "up_left"

    public static let allDirectionsClockwise: [GapOrientation] = [
        .up, .upRight, .right, .downRight, .down, .downLeft, .left, .upLeft,
    ]

    /// The 4 cardinal directions only (no diagonals) — the default
    /// orientation set for the stabilization-phase acuity tests (encargo
    /// §1.1: less perceptually ambiguous, the conventional choice for
    /// Landolt C / Tumbling E acuity testing).
    public static let cardinalDirections: [GapOrientation] = [.up, .down, .left, .right]

    public var rotationDegrees: Double {
        switch self {
        case .up: return 0
        case .upRight: return 45
        case .right: return 90
        case .downRight: return 135
        case .down: return 180
        case .downLeft: return 225
        case .left: return 270
        case .upLeft: return 315
        }
    }
}

/// Direction of travel at the moment the participant marked a clear/blurry
/// crossing (brief objective #2).
public enum CrossingDirection: String, Codable, Sendable {
    case approaching
    case receding
}

extension WorldTrackingState {
    /// Flattened string for CSV/JSON export — `.limited`'s reason is kept as
    /// free text after a colon so it stays human-readable without needing a
    /// second column.
    public var exportValue: String {
        switch self {
        case .normal: return "normal"
        case .notAvailable: return "not_available"
        case .limited(let reason): return "limited:\(reason)"
        }
    }
}
