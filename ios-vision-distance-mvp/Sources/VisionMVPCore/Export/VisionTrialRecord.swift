import Foundation

/// One Landolt-C forced-choice trial — the row schema for `vision_trials.csv`.
/// Captures every variable the brief requires to be logged simultaneously
/// (section 2): distance, physical/angular stimulus size, correctness,
/// reaction time, plus which sub-test/eye/correction condition it belongs to.
public struct VisionTrialRecord: Sendable {
    public var taskPhase: TaskPhase
    public var eyeCondition: EyeCondition
    public var correctionUsed: Bool
    public var trialIndex: Int
    public var timestampISO8601: String
    public var distanceMeters: Double
    public var physicalSizeMillimeters: Double
    public var angularSizeArcMinutes: Double
    public var gapOrientationTruth: GapOrientation
    public var response: GapOrientation?
    public var correct: Bool
    public var reactionTimeMilliseconds: Double
    public var isReversal: Bool
    public var stepSize: Double

    public init(
        taskPhase: TaskPhase,
        eyeCondition: EyeCondition,
        correctionUsed: Bool,
        trialIndex: Int,
        timestampISO8601: String,
        distanceMeters: Double,
        physicalSizeMillimeters: Double,
        angularSizeArcMinutes: Double,
        gapOrientationTruth: GapOrientation,
        response: GapOrientation?,
        correct: Bool,
        reactionTimeMilliseconds: Double,
        isReversal: Bool,
        stepSize: Double
    ) {
        self.taskPhase = taskPhase
        self.eyeCondition = eyeCondition
        self.correctionUsed = correctionUsed
        self.trialIndex = trialIndex
        self.timestampISO8601 = timestampISO8601
        self.distanceMeters = distanceMeters
        self.physicalSizeMillimeters = physicalSizeMillimeters
        self.angularSizeArcMinutes = angularSizeArcMinutes
        self.gapOrientationTruth = gapOrientationTruth
        self.response = response
        self.correct = correct
        self.reactionTimeMilliseconds = reactionTimeMilliseconds
        self.isReversal = isReversal
        self.stepSize = stepSize
    }
}

extension VisionTrialRecord: CSVRepresentable {
    public static let csvHeader: [String] = [
        "task_phase", "eye_condition", "correction_used", "trial_index", "timestamp_iso8601",
        "distance_m", "physical_size_mm", "angular_size_arcmin",
        "gap_orientation_truth", "response", "correct", "reaction_time_ms",
        "is_reversal", "step_size",
    ]

    public func csvFields() -> [String] {
        [
            CSVFormatting.field(taskPhase.rawValue),
            CSVFormatting.field(eyeCondition.rawValue),
            CSVFormatting.field(correctionUsed),
            CSVFormatting.field(trialIndex),
            CSVFormatting.field(timestampISO8601),
            CSVFormatting.field(distanceMeters),
            CSVFormatting.field(physicalSizeMillimeters),
            CSVFormatting.field(angularSizeArcMinutes),
            CSVFormatting.field(gapOrientationTruth.rawValue),
            CSVFormatting.optionalField(response?.rawValue),
            CSVFormatting.field(correct),
            CSVFormatting.field(reactionTimeMilliseconds),
            CSVFormatting.field(isReversal),
            CSVFormatting.field(stepSize),
        ]
    }
}
