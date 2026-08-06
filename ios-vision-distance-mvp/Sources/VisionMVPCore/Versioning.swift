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
    /// what triggers a valid trial. v3 = the single 60-second test
    /// (VisionTestEngine): discrete logMAR levels, 2-down/1-up over levels,
    /// grace/pause recovery, per-figure 5s timeout, explicit termination
    /// criteria. v2 was the Fase 1 stabilization pass; v1 the original MVP.
    public static let protocolVersion = "3"

    /// Optotype physical/angular geometry definition (5x5 Landolt-C grid,
    /// critical-detail = totalHeight / 5).
    public static let geometryVersion = "landoltc-5x5-v1"

    /// Adaptive algorithm: 2-down/1-up over a fixed logMAR level ladder,
    /// one level per move.
    public static let algorithmVersion = "levels-2down1up-v1"

    /// Export file-format version: shared by session_summary.json and both
    /// CSVs (every file self-describes its schema, encargo §15). v2 = the
    /// SessionStore iteration (participant id, explanation codes, forced
    /// nulls for missing values, schema_version column in the CSVs).
    public static let exportSchemaVersion = "2"
}
