import Foundation

/// One presentation of the optotype during the single vision test — the row
/// schema for `vision_trials.csv` (schema v3, encargo §23). Interrupted or
/// otherwise invalid presentations are still recorded with
/// `validTrial = false` and an `invalidReason`, never silently dropped, but
/// only valid trials feed the staircase or count toward termination.
public struct TrialRecord: Sendable {
    public var sessionID: String
    public var trialID: String
    public var trialIndex: Int
    public var timestampPresentedISO8601: String
    public var timestampAnsweredISO8601: String?
    public var effectiveElapsedMs: Double
    public var stimulusType: String
    public var orientationTruth: GapOrientation
    public var response: GapOrientation?
    public var correct: Bool
    public var timeout: Bool
    public var reactionTimeMs: Double?
    public var logMARLevel: Double
    public var stimulusHeightPoints: Double
    public var stimulusHeightPixels: Double
    public var stimulusHeightMillimeters: Double
    public var totalVisualAngleArcMinutes: Double
    public var criticalDetailArcMinutes: Double
    public var viewingDistanceMeters: Double
    public var accommodativeDemandDiopters: Double
    public var consecutiveCorrectBefore: Int
    public var consecutiveCorrectAfter: Int
    public var staircaseDirectionBefore: String
    public var staircaseDirectionAfter: String
    public var isReversal: Bool
    public var reversalCount: Int
    public var validTrial: Bool
    public var invalidReason: String?
    public var repeatedAfterPause: Bool
    /// Session-level termination reason, patched onto every row once the
    /// test finishes so each exported file is self-describing.
    public var terminationReason: String
    public var algorithmVersion: String
    public var protocolVersion: String
    public var schemaVersion: String

    public init(
        sessionID: String,
        trialID: String,
        trialIndex: Int,
        timestampPresentedISO8601: String,
        timestampAnsweredISO8601: String?,
        effectiveElapsedMs: Double,
        stimulusType: String,
        orientationTruth: GapOrientation,
        response: GapOrientation?,
        correct: Bool,
        timeout: Bool,
        reactionTimeMs: Double?,
        logMARLevel: Double,
        stimulusHeightPoints: Double,
        stimulusHeightPixels: Double,
        stimulusHeightMillimeters: Double,
        totalVisualAngleArcMinutes: Double,
        criticalDetailArcMinutes: Double,
        viewingDistanceMeters: Double,
        accommodativeDemandDiopters: Double,
        consecutiveCorrectBefore: Int,
        consecutiveCorrectAfter: Int,
        staircaseDirectionBefore: String,
        staircaseDirectionAfter: String,
        isReversal: Bool,
        reversalCount: Int,
        validTrial: Bool,
        invalidReason: String?,
        repeatedAfterPause: Bool,
        terminationReason: String,
        algorithmVersion: String = InstrumentVersions.algorithmVersion,
        protocolVersion: String = InstrumentVersions.protocolVersion,
        schemaVersion: String = InstrumentVersions.exportSchemaVersion
    ) {
        self.sessionID = sessionID
        self.trialID = trialID
        self.trialIndex = trialIndex
        self.timestampPresentedISO8601 = timestampPresentedISO8601
        self.timestampAnsweredISO8601 = timestampAnsweredISO8601
        self.effectiveElapsedMs = effectiveElapsedMs
        self.stimulusType = stimulusType
        self.orientationTruth = orientationTruth
        self.response = response
        self.correct = correct
        self.timeout = timeout
        self.reactionTimeMs = reactionTimeMs
        self.logMARLevel = logMARLevel
        self.stimulusHeightPoints = stimulusHeightPoints
        self.stimulusHeightPixels = stimulusHeightPixels
        self.stimulusHeightMillimeters = stimulusHeightMillimeters
        self.totalVisualAngleArcMinutes = totalVisualAngleArcMinutes
        self.criticalDetailArcMinutes = criticalDetailArcMinutes
        self.viewingDistanceMeters = viewingDistanceMeters
        self.accommodativeDemandDiopters = accommodativeDemandDiopters
        self.consecutiveCorrectBefore = consecutiveCorrectBefore
        self.consecutiveCorrectAfter = consecutiveCorrectAfter
        self.staircaseDirectionBefore = staircaseDirectionBefore
        self.staircaseDirectionAfter = staircaseDirectionAfter
        self.isReversal = isReversal
        self.reversalCount = reversalCount
        self.validTrial = validTrial
        self.invalidReason = invalidReason
        self.repeatedAfterPause = repeatedAfterPause
        self.terminationReason = terminationReason
        self.algorithmVersion = algorithmVersion
        self.protocolVersion = protocolVersion
        self.schemaVersion = schemaVersion
    }
}

extension TrialRecord: CSVRepresentable {
    public static let csvHeader: [String] = [
        "session_id", "trial_id", "trial_index",
        "timestamp_presented", "timestamp_answered", "effective_elapsed_ms",
        "stimulus_type", "orientation_truth", "response", "correct", "timeout", "reaction_time_ms",
        "logmar_level", "stimulus_height_points", "stimulus_height_pixels", "stimulus_height_mm",
        "total_visual_angle_arcmin", "critical_detail_arcmin",
        "viewing_distance_m", "accommodative_demand_d",
        "consecutive_correct_before", "consecutive_correct_after",
        "staircase_direction_before", "staircase_direction_after",
        "is_reversal", "reversal_count",
        "valid_trial", "invalid_reason", "repeated_after_pause",
        "termination_reason", "algorithm_version", "protocol_version", "schema_version",
    ]

    public func csvFields() -> [String] {
        [
            CSVFormatting.field(sessionID),
            CSVFormatting.field(trialID),
            CSVFormatting.field(trialIndex),
            CSVFormatting.field(timestampPresentedISO8601),
            CSVFormatting.optionalField(timestampAnsweredISO8601),
            CSVFormatting.field(effectiveElapsedMs),
            CSVFormatting.field(stimulusType),
            CSVFormatting.field(orientationTruth.rawValue),
            CSVFormatting.optionalField(response?.rawValue),
            CSVFormatting.field(correct),
            CSVFormatting.field(timeout),
            CSVFormatting.optionalField(reactionTimeMs),
            CSVFormatting.field(logMARLevel),
            CSVFormatting.field(stimulusHeightPoints),
            CSVFormatting.field(stimulusHeightPixels),
            CSVFormatting.field(stimulusHeightMillimeters),
            CSVFormatting.field(totalVisualAngleArcMinutes),
            CSVFormatting.field(criticalDetailArcMinutes),
            CSVFormatting.field(viewingDistanceMeters),
            CSVFormatting.field(accommodativeDemandDiopters),
            CSVFormatting.field(consecutiveCorrectBefore),
            CSVFormatting.field(consecutiveCorrectAfter),
            CSVFormatting.field(staircaseDirectionBefore),
            CSVFormatting.field(staircaseDirectionAfter),
            CSVFormatting.field(isReversal),
            CSVFormatting.field(reversalCount),
            CSVFormatting.field(validTrial),
            CSVFormatting.optionalField(invalidReason),
            CSVFormatting.field(repeatedAfterPause),
            CSVFormatting.field(terminationReason),
            CSVFormatting.field(algorithmVersion),
            CSVFormatting.field(protocolVersion),
            CSVFormatting.field(schemaVersion),
        ]
    }
}
