import Foundation

/// One participant-marked clear/blurry crossing during the free-movement task
/// (brief objective #2) — the row schema for `blur_crossings.csv`. The full
/// distance trajectory around each crossing lives in that run's
/// `distance_frames.csv` (same session/run id), tagged with `taskPhase =
/// .blurCrossing`; this record is just the marked instants.
public struct BlurCrossingRecord: Sendable {
    public var eyeCondition: EyeCondition
    public var correctionUsed: Bool
    public var repetition: Int
    public var crossingTimestampISO8601: String
    public var distanceAtCrossingMeters: Double
    public var direction: CrossingDirection

    public init(
        eyeCondition: EyeCondition,
        correctionUsed: Bool,
        repetition: Int,
        crossingTimestampISO8601: String,
        distanceAtCrossingMeters: Double,
        direction: CrossingDirection
    ) {
        self.eyeCondition = eyeCondition
        self.correctionUsed = correctionUsed
        self.repetition = repetition
        self.crossingTimestampISO8601 = crossingTimestampISO8601
        self.distanceAtCrossingMeters = distanceAtCrossingMeters
        self.direction = direction
    }
}

extension BlurCrossingRecord: CSVRepresentable {
    public static let csvHeader: [String] = [
        "eye_condition", "correction_used", "repetition",
        "crossing_timestamp_iso8601", "distance_at_crossing_m", "direction",
    ]

    public func csvFields() -> [String] {
        [
            CSVFormatting.field(eyeCondition.rawValue),
            CSVFormatting.field(correctionUsed),
            CSVFormatting.field(repetition),
            CSVFormatting.field(crossingTimestampISO8601),
            CSVFormatting.field(distanceAtCrossingMeters),
            CSVFormatting.field(direction.rawValue),
        ]
    }
}
