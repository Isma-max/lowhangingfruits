import Foundation

/// One tracking frame during the vision test — row schema for
/// `test_frames.csv` (encargo §22). Replaces the characterization-era
/// `DistanceFrameRecord` for the normal test flow: the legacy
/// `milestone_cm` / `repetition` / `reference_distance_cm` columns are gone,
/// and out-of-range / unstable are separate booleans rather than reasons to
/// mark the frame invalid — a frame that measured an out-of-range position
/// is still a valid measurement.
public struct TestFrameRecord: Sendable {
    public var sessionID: String
    public var timestampISO8601: String
    public var elapsedMs: Double
    public var effectiveTestTimeMs: Double
    /// The single optical distance definition: mid-plane of both eyes to the
    /// TrueDepth camera (see DECISIONS.md). Empty when eyes aren't tracked.
    public var viewingDistanceMeters: Double?
    public var distanceCameraToFaceMeters: Double?
    public var distanceCameraToLeftEyeMeters: Double?
    public var distanceCameraToRightEyeMeters: Double?
    public var yawDegrees: Double
    public var pitchDegrees: Double
    public var rollDegrees: Double
    public var faceTracked: Bool
    public var worldTrackingState: String
    public var faceCentered: Bool
    public var leftEyeInFrame: Bool
    public var rightEyeInFrame: Bool
    public var insideDistanceRange: Bool
    public var measurementStable: Bool
    /// Trackability only (face + tracking + eyes + distance present) —
    /// range/stability never make a frame "invalid".
    public var valid: Bool
    public var discardReason: String?
    public var actualFrameIntervalMs: Double?
    public var effectiveFps: Double?
    public var testState: String

    public init(
        sessionID: String,
        timestampISO8601: String,
        elapsedMs: Double,
        effectiveTestTimeMs: Double,
        viewingDistanceMeters: Double?,
        distanceCameraToFaceMeters: Double?,
        distanceCameraToLeftEyeMeters: Double?,
        distanceCameraToRightEyeMeters: Double?,
        yawDegrees: Double,
        pitchDegrees: Double,
        rollDegrees: Double,
        faceTracked: Bool,
        worldTrackingState: String,
        faceCentered: Bool,
        leftEyeInFrame: Bool,
        rightEyeInFrame: Bool,
        insideDistanceRange: Bool,
        measurementStable: Bool,
        valid: Bool,
        discardReason: String?,
        actualFrameIntervalMs: Double?,
        effectiveFps: Double?,
        testState: String
    ) {
        self.sessionID = sessionID
        self.timestampISO8601 = timestampISO8601
        self.elapsedMs = elapsedMs
        self.effectiveTestTimeMs = effectiveTestTimeMs
        self.viewingDistanceMeters = viewingDistanceMeters
        self.distanceCameraToFaceMeters = distanceCameraToFaceMeters
        self.distanceCameraToLeftEyeMeters = distanceCameraToLeftEyeMeters
        self.distanceCameraToRightEyeMeters = distanceCameraToRightEyeMeters
        self.yawDegrees = yawDegrees
        self.pitchDegrees = pitchDegrees
        self.rollDegrees = rollDegrees
        self.faceTracked = faceTracked
        self.worldTrackingState = worldTrackingState
        self.faceCentered = faceCentered
        self.leftEyeInFrame = leftEyeInFrame
        self.rightEyeInFrame = rightEyeInFrame
        self.insideDistanceRange = insideDistanceRange
        self.measurementStable = measurementStable
        self.valid = valid
        self.discardReason = discardReason
        self.actualFrameIntervalMs = actualFrameIntervalMs
        self.effectiveFps = effectiveFps
        self.testState = testState
    }
}

extension TestFrameRecord: CSVRepresentable {
    public static let csvHeader: [String] = [
        "session_id", "timestamp_iso8601", "elapsed_ms", "effective_test_time_ms",
        "viewing_distance_m", "distance_camera_to_face_m",
        "distance_camera_to_left_eye_m", "distance_camera_to_right_eye_m",
        "yaw_deg", "pitch_deg", "roll_deg",
        "face_tracked", "world_tracking_state", "face_centered",
        "left_eye_in_frame", "right_eye_in_frame",
        "inside_distance_range", "measurement_stable",
        "valid", "discard_reason",
        "actual_frame_interval_ms", "effective_fps", "test_state",
    ]

    public func csvFields() -> [String] {
        [
            CSVFormatting.field(sessionID),
            CSVFormatting.field(timestampISO8601),
            CSVFormatting.field(elapsedMs),
            CSVFormatting.field(effectiveTestTimeMs),
            CSVFormatting.optionalField(viewingDistanceMeters),
            CSVFormatting.optionalField(distanceCameraToFaceMeters),
            CSVFormatting.optionalField(distanceCameraToLeftEyeMeters),
            CSVFormatting.optionalField(distanceCameraToRightEyeMeters),
            CSVFormatting.field(yawDegrees),
            CSVFormatting.field(pitchDegrees),
            CSVFormatting.field(rollDegrees),
            CSVFormatting.field(faceTracked),
            CSVFormatting.field(worldTrackingState),
            CSVFormatting.field(faceCentered),
            CSVFormatting.field(leftEyeInFrame),
            CSVFormatting.field(rightEyeInFrame),
            CSVFormatting.field(insideDistanceRange),
            CSVFormatting.field(measurementStable),
            CSVFormatting.field(valid),
            CSVFormatting.optionalField(discardReason),
            CSVFormatting.optionalField(actualFrameIntervalMs),
            CSVFormatting.optionalField(effectiveFps),
            CSVFormatting.field(testState),
        ]
    }
}

/// Session-level summary — `session_summary.json` (encargo §24).
public struct SessionSummary: Codable, Sendable {
    public var sessionID: String
    public var startedAt: Date
    public var endedAt: Date
    public var effectiveDurationSeconds: Double
    public var realDurationSeconds: Double
    public var validTrials: Int
    public var invalidTrials: Int
    public var corrects: Int
    public var errors: Int
    public var timeouts: Int
    public var accuracy: Double?
    public var medianReactionTimeMs: Double?
    public var medianViewingDistanceMeters: Double?
    public var viewingDistanceStandardDeviationMeters: Double?
    public var percentFramesInsideRange: Double?
    public var validFrames: Int
    public var discardedFrames: Int
    public var reversals: Int
    public var thresholdLogMAR: Double?
    public var confidence: String
    public var terminationReason: String
    public var outcome: String
    public var protocolVersion: String
    public var algorithmVersion: String

    public init(
        sessionID: String, startedAt: Date, endedAt: Date,
        effectiveDurationSeconds: Double, realDurationSeconds: Double,
        validTrials: Int, invalidTrials: Int,
        corrects: Int, errors: Int, timeouts: Int,
        accuracy: Double?, medianReactionTimeMs: Double?,
        medianViewingDistanceMeters: Double?, viewingDistanceStandardDeviationMeters: Double?,
        percentFramesInsideRange: Double?, validFrames: Int, discardedFrames: Int,
        reversals: Int, thresholdLogMAR: Double?, confidence: String,
        terminationReason: String, outcome: String,
        protocolVersion: String = InstrumentVersions.protocolVersion,
        algorithmVersion: String = InstrumentVersions.algorithmVersion
    ) {
        self.sessionID = sessionID
        self.startedAt = startedAt
        self.endedAt = endedAt
        self.effectiveDurationSeconds = effectiveDurationSeconds
        self.realDurationSeconds = realDurationSeconds
        self.validTrials = validTrials
        self.invalidTrials = invalidTrials
        self.corrects = corrects
        self.errors = errors
        self.timeouts = timeouts
        self.accuracy = accuracy
        self.medianReactionTimeMs = medianReactionTimeMs
        self.medianViewingDistanceMeters = medianViewingDistanceMeters
        self.viewingDistanceStandardDeviationMeters = viewingDistanceStandardDeviationMeters
        self.percentFramesInsideRange = percentFramesInsideRange
        self.validFrames = validFrames
        self.discardedFrames = discardedFrames
        self.reversals = reversals
        self.thresholdLogMAR = thresholdLogMAR
        self.confidence = confidence
        self.terminationReason = terminationReason
        self.outcome = outcome
        self.protocolVersion = protocolVersion
        self.algorithmVersion = algorithmVersion
    }
}

public enum StatMath {
    public static func median(_ values: [Double]) -> Double? {
        guard !values.isEmpty else { return nil }
        let sorted = values.sorted()
        let mid = sorted.count / 2
        if sorted.count % 2 == 0 {
            return (sorted[mid - 1] + sorted[mid]) / 2
        }
        return sorted[mid]
    }

    public static func standardDeviation(_ values: [Double]) -> Double? {
        guard values.count >= 2 else { return nil }
        let mean = values.reduce(0, +) / Double(values.count)
        let variance = values.reduce(0) { $0 + ($1 - mean) * ($1 - mean) } / Double(values.count)
        return variance.squareRoot()
    }
}
