import Foundation

/// One Landolt-C forced-choice trial — the row schema for `vision_trials.csv`.
///
/// Schema v2 (see `InstrumentVersions`): adds the total-height/critical-detail
/// split (`geometry`, a `StimulusScaler.measurement(...)` result — never
/// assume total angular size equals MAR, see `VisualAcuityMath`), on-screen
/// size in points/pixels, accommodative demand, pose/tracking-quality at the
/// moment of response, and explicit `valid`/`discardReason` so a
/// quality-gated trial is recorded (not silently dropped or silently scored)
/// even when it shouldn't count toward the staircase.
public struct VisionTrialRecord: Sendable {
    public var taskPhase: TaskPhase
    public var eyeCondition: EyeCondition
    public var correctionUsed: Bool
    public var trialIndex: Int
    public var timestampISO8601: String
    public var distanceMeters: Double
    public var accommodativeDemandDiopters: Double
    public var geometry: OptotypeMeasurement
    public var totalHeightPoints: Double
    public var totalHeightPixels: Double
    public var gapOrientationTruth: GapOrientation
    public var response: GapOrientation?
    public var correct: Bool
    public var reactionTimeMilliseconds: Double
    public var isReversal: Bool
    public var stepSize: Double
    public var yawDegrees: Double
    public var pitchDegrees: Double
    public var rollDegrees: Double
    public var faceTracked: Bool
    public var worldTrackingState: String
    /// Whether this trial passed the tracking-quality gate at the moment of
    /// response. Invalid trials are still recorded (never silently dropped)
    /// but must not be fed into the staircase.
    public var valid: Bool
    public var discardReason: String?
    public var protocolVersion: String
    public var geometryVersion: String
    /// e.g. "2down1up" — from `StaircaseConfiguration.algorithmIdentifier`,
    /// or a fixed string like "none" for non-staircase (dynamic) trials.
    public var staircaseAlgorithm: String

    public init(
        taskPhase: TaskPhase,
        eyeCondition: EyeCondition,
        correctionUsed: Bool,
        trialIndex: Int,
        timestampISO8601: String,
        distanceMeters: Double,
        accommodativeDemandDiopters: Double,
        geometry: OptotypeMeasurement,
        totalHeightPoints: Double,
        totalHeightPixels: Double,
        gapOrientationTruth: GapOrientation,
        response: GapOrientation?,
        correct: Bool,
        reactionTimeMilliseconds: Double,
        isReversal: Bool,
        stepSize: Double,
        yawDegrees: Double,
        pitchDegrees: Double,
        rollDegrees: Double,
        faceTracked: Bool,
        worldTrackingState: String,
        valid: Bool,
        discardReason: String?,
        protocolVersion: String = InstrumentVersions.protocolVersion,
        geometryVersion: String = InstrumentVersions.geometryVersion,
        staircaseAlgorithm: String
    ) {
        self.taskPhase = taskPhase
        self.eyeCondition = eyeCondition
        self.correctionUsed = correctionUsed
        self.trialIndex = trialIndex
        self.timestampISO8601 = timestampISO8601
        self.distanceMeters = distanceMeters
        self.accommodativeDemandDiopters = accommodativeDemandDiopters
        self.geometry = geometry
        self.totalHeightPoints = totalHeightPoints
        self.totalHeightPixels = totalHeightPixels
        self.gapOrientationTruth = gapOrientationTruth
        self.response = response
        self.correct = correct
        self.reactionTimeMilliseconds = reactionTimeMilliseconds
        self.isReversal = isReversal
        self.stepSize = stepSize
        self.yawDegrees = yawDegrees
        self.pitchDegrees = pitchDegrees
        self.rollDegrees = rollDegrees
        self.faceTracked = faceTracked
        self.worldTrackingState = worldTrackingState
        self.valid = valid
        self.discardReason = discardReason
        self.protocolVersion = protocolVersion
        self.geometryVersion = geometryVersion
        self.staircaseAlgorithm = staircaseAlgorithm
    }
}

extension VisionTrialRecord: CSVRepresentable {
    public static let csvHeader: [String] = [
        "task_phase", "eye_condition", "correction_used", "trial_index", "timestamp_iso8601",
        "distance_m", "accommodative_demand_d",
        "total_height_mm", "critical_detail_mm", "total_angular_size_arcmin", "mar_arcmin", "log_mar",
        "total_height_pt", "total_height_px",
        "gap_orientation_truth", "response", "correct", "reaction_time_ms",
        "is_reversal", "step_size",
        "yaw_deg", "pitch_deg", "roll_deg", "face_tracked", "world_tracking_state",
        "valid", "discard_reason",
        "protocol_version", "geometry_version", "staircase_algorithm",
    ]

    public func csvFields() -> [String] {
        [
            CSVFormatting.field(taskPhase.rawValue),
            CSVFormatting.field(eyeCondition.rawValue),
            CSVFormatting.field(correctionUsed),
            CSVFormatting.field(trialIndex),
            CSVFormatting.field(timestampISO8601),
            CSVFormatting.field(distanceMeters),
            CSVFormatting.field(accommodativeDemandDiopters),
            CSVFormatting.field(geometry.totalHeightMillimeters),
            CSVFormatting.field(geometry.criticalDetailMillimeters),
            CSVFormatting.field(geometry.totalAngularSizeArcMinutes),
            CSVFormatting.field(geometry.marArcMinutes),
            CSVFormatting.field(geometry.logMAR),
            CSVFormatting.field(totalHeightPoints),
            CSVFormatting.field(totalHeightPixels),
            CSVFormatting.field(gapOrientationTruth.rawValue),
            CSVFormatting.optionalField(response?.rawValue),
            CSVFormatting.field(correct),
            CSVFormatting.field(reactionTimeMilliseconds),
            CSVFormatting.field(isReversal),
            CSVFormatting.field(stepSize),
            CSVFormatting.field(yawDegrees),
            CSVFormatting.field(pitchDegrees),
            CSVFormatting.field(rollDegrees),
            CSVFormatting.field(faceTracked),
            CSVFormatting.field(worldTrackingState),
            CSVFormatting.field(valid),
            CSVFormatting.optionalField(discardReason),
            CSVFormatting.field(protocolVersion),
            CSVFormatting.field(geometryVersion),
            CSVFormatting.field(staircaseAlgorithm),
        ]
    }
}
