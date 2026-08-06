import Foundation

/// One ARKit frame's worth of derived distance/pose/quality data — the row
/// schema for `distance_frames.csv` (brief section 7: "Exportar valores
/// frame a frame"). Invalid frames are still recorded, with `valid = false`
/// and a non-nil `discardReason` — never silently dropped.
public struct DistanceFrameRecord: Sendable {
    public var timestampISO8601: String
    public var elapsedMilliseconds: Double
    public var milestoneCentimeters: Double?
    public var repetition: Int?
    public var distanceCameraToFaceMeters: Double
    public var distanceCameraToLeftEyeMeters: Double?
    public var distanceCameraToRightEyeMeters: Double?
    public var distanceMeanEyesMeters: Double?
    public var yawDegrees: Double
    public var pitchDegrees: Double
    public var rollDegrees: Double
    public var faceTracked: Bool
    public var worldTrackingState: String
    public var faceCentered: Bool
    public var leftEyeInFrame: Bool
    public var rightEyeInFrame: Bool
    public var valid: Bool
    public var discardReason: String?
    public var referenceDistanceCentimeters: Double?

    public init(
        timestampISO8601: String,
        elapsedMilliseconds: Double,
        milestoneCentimeters: Double?,
        repetition: Int?,
        distanceCameraToFaceMeters: Double,
        distanceCameraToLeftEyeMeters: Double?,
        distanceCameraToRightEyeMeters: Double?,
        distanceMeanEyesMeters: Double?,
        yawDegrees: Double,
        pitchDegrees: Double,
        rollDegrees: Double,
        faceTracked: Bool,
        worldTrackingState: String,
        faceCentered: Bool,
        leftEyeInFrame: Bool,
        rightEyeInFrame: Bool,
        valid: Bool,
        discardReason: String?,
        referenceDistanceCentimeters: Double?
    ) {
        self.timestampISO8601 = timestampISO8601
        self.elapsedMilliseconds = elapsedMilliseconds
        self.milestoneCentimeters = milestoneCentimeters
        self.repetition = repetition
        self.distanceCameraToFaceMeters = distanceCameraToFaceMeters
        self.distanceCameraToLeftEyeMeters = distanceCameraToLeftEyeMeters
        self.distanceCameraToRightEyeMeters = distanceCameraToRightEyeMeters
        self.distanceMeanEyesMeters = distanceMeanEyesMeters
        self.yawDegrees = yawDegrees
        self.pitchDegrees = pitchDegrees
        self.rollDegrees = rollDegrees
        self.faceTracked = faceTracked
        self.worldTrackingState = worldTrackingState
        self.faceCentered = faceCentered
        self.leftEyeInFrame = leftEyeInFrame
        self.rightEyeInFrame = rightEyeInFrame
        self.valid = valid
        self.discardReason = discardReason
        self.referenceDistanceCentimeters = referenceDistanceCentimeters
    }
}

extension DistanceFrameRecord: CSVRepresentable {
    public static let csvHeader: [String] = [
        "timestamp_iso8601", "elapsed_ms", "milestone_cm", "repetition",
        "distance_camera_to_face_m", "distance_camera_to_left_eye_m", "distance_camera_to_right_eye_m",
        "distance_mean_eyes_m", "yaw_deg", "pitch_deg", "roll_deg",
        "face_tracked", "world_tracking_state", "face_centered",
        "left_eye_in_frame", "right_eye_in_frame", "valid", "discard_reason",
        "reference_distance_cm",
    ]

    public func csvFields() -> [String] {
        [
            CSVFormatting.field(timestampISO8601),
            CSVFormatting.field(elapsedMilliseconds),
            CSVFormatting.optionalField(milestoneCentimeters),
            CSVFormatting.optionalField(repetition),
            CSVFormatting.field(distanceCameraToFaceMeters),
            CSVFormatting.optionalField(distanceCameraToLeftEyeMeters),
            CSVFormatting.optionalField(distanceCameraToRightEyeMeters),
            CSVFormatting.optionalField(distanceMeanEyesMeters),
            CSVFormatting.field(yawDegrees),
            CSVFormatting.field(pitchDegrees),
            CSVFormatting.field(rollDegrees),
            CSVFormatting.field(faceTracked),
            CSVFormatting.field(worldTrackingState),
            CSVFormatting.field(faceCentered),
            CSVFormatting.field(leftEyeInFrame),
            CSVFormatting.field(rightEyeInFrame),
            CSVFormatting.field(valid),
            CSVFormatting.optionalField(discardReason),
            CSVFormatting.optionalField(referenceDistanceCentimeters),
        ]
    }
}
