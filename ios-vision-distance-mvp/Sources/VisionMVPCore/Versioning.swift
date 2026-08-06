import Foundation

/// Every session/record should be traceable to exactly which version of the
/// measurement protocol and stimulus geometry produced it (encargo §7), so
/// that changing either later never silently mixes non-comparable data.
/// Bump these whenever the corresponding definition changes in a way that
/// makes new sessions non-comparable to earlier ones. The staircase
/// algorithm's own identifier (e.g. "2down1up") comes from
/// `StaircaseConfiguration.algorithmIdentifier` instead of living here,
/// since it already varies per run configuration.
public enum InstrumentVersions {
    /// Vision-test trial protocol: what's measured, how a trial is gated,
    /// what triggers a valid trial. Bump 1 -> 2 reflects this Fase 1
    /// stabilization pass (distance-stability gating, quality gating,
    /// continuous trajectory logging, 2-down/1-up default).
    public static let protocolVersion = "2"

    /// Optotype physical/angular geometry definition (5x5 Landolt-C grid,
    /// critical-detail = totalHeight / 5).
    public static let geometryVersion = "landoltc-5x5-v1"
}
