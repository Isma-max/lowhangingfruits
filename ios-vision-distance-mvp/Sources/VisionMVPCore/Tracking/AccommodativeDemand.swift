import Foundation

/// D = 1 / distance_m — the standard optical accommodative-demand formula
/// (encargo §2: "demanda_acomodativa_D = 1 / distancia_m"). Deliberately not
/// adjusted for working-distance vergence or any other refinement — this is
/// the same simple approximation the research brief itself specifies.
public enum AccommodativeDemand {
    public static func diopters(distanceMeters: Double) -> Double {
        guard distanceMeters > 0 else { return .infinity }
        return 1.0 / distanceMeters
    }
}
