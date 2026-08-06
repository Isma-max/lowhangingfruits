import Foundation

/// Investigator-configurable tolerance for what counts as a valid distance
/// measurement (brief section 7: "Definir una tolerancia configurable de pose
/// y calidad").
public struct QualityThresholds: Equatable, Sendable {
    public var maxYawDegrees: Double
    public var maxPitchDegrees: Double
    public var minDistanceMeters: Double
    public var maxDistanceMeters: Double
    /// Standard deviation, in meters, of the shortest rolling window (see
    /// `RollingStatsAggregator`) above which a measurement is flagged unstable.
    public var maxStandardDeviationMeters: Double
    /// Fraction of recent frames (over `frameLossWindowSeconds`) that may be
    /// invalid/dropped before flagging "too many dropped frames".
    public var maxFrameLossRatio: Double
    public var frameLossWindowSeconds: Double

    public init(
        maxYawDegrees: Double,
        maxPitchDegrees: Double,
        minDistanceMeters: Double,
        maxDistanceMeters: Double,
        maxStandardDeviationMeters: Double,
        maxFrameLossRatio: Double,
        frameLossWindowSeconds: Double
    ) {
        self.maxYawDegrees = maxYawDegrees
        self.maxPitchDegrees = maxPitchDegrees
        self.minDistanceMeters = minDistanceMeters
        self.maxDistanceMeters = maxDistanceMeters
        self.maxStandardDeviationMeters = maxStandardDeviationMeters
        self.maxFrameLossRatio = maxFrameLossRatio
        self.frameLossWindowSeconds = frameLossWindowSeconds
    }

    /// Starting point for the experiment; the investigator can adjust these
    /// before a session (brief: "tolerancia configurable"). Range covers the
    /// 20-80cm milestone band with margin.
    public static let `default` = QualityThresholds(
        maxYawDegrees: 20,
        maxPitchDegrees: 20,
        minDistanceMeters: 0.15,
        maxDistanceMeters: 1.00,
        maxStandardDeviationMeters: 0.01,
        maxFrameLossRatio: 0.30,
        frameLossWindowSeconds: 2.0
    )
}

/// Mirrors ARKit's `ARCamera.trackingState` without depending on ARKit, so
/// this package stays platform-agnostic. `.limited`'s associated value is a
/// human-readable reason (from `ARCamera.TrackingState.Reason`) kept only for
/// logging.
public enum WorldTrackingState: Equatable, Sendable {
    case normal
    case limited(String)
    case notAvailable
}

public enum DiscardReason: String, Codable, Sendable, CaseIterable {
    case faceNotDetected = "face_not_detected"
    case worldTrackingLimited = "world_tracking_limited"
    case excessiveYawOrPitch = "excessive_yaw_or_pitch"
    case unstableMeasurement = "unstable_measurement"
    case tooManyDroppedFrames = "too_many_dropped_frames"
    case distanceOutOfRange = "distance_out_of_range"
    case eyesPartiallyOutOfFrame = "eyes_partially_out_of_frame"
}

/// Everything the quality gate needs to judge a single frame. Constructed by
/// the app target from ARKit callbacks; contains no ARKit types itself.
public struct FrameQualityInput: Sendable {
    public var isFaceTracked: Bool
    public var worldTrackingState: WorldTrackingState
    public var yawDegrees: Double
    public var pitchDegrees: Double
    public var distanceMeters: Double
    public var leftEyeInFrame: Bool
    public var rightEyeInFrame: Bool
    /// Fraction of frames discarded over the trailing `frameLossWindowSeconds`,
    /// computed by the caller from its own valid/invalid frame counters.
    public var recentFrameLossRatio: Double
    /// Standard deviation (meters) of distance over the shortest rolling
    /// window currently available, or `nil` before enough samples exist to
    /// compute one (never treated as unstable while `nil`).
    public var recentStandardDeviationMeters: Double?

    public init(
        isFaceTracked: Bool,
        worldTrackingState: WorldTrackingState,
        yawDegrees: Double,
        pitchDegrees: Double,
        distanceMeters: Double,
        leftEyeInFrame: Bool,
        rightEyeInFrame: Bool,
        recentFrameLossRatio: Double,
        recentStandardDeviationMeters: Double?
    ) {
        self.isFaceTracked = isFaceTracked
        self.worldTrackingState = worldTrackingState
        self.yawDegrees = yawDegrees
        self.pitchDegrees = pitchDegrees
        self.distanceMeters = distanceMeters
        self.leftEyeInFrame = leftEyeInFrame
        self.rightEyeInFrame = rightEyeInFrame
        self.recentFrameLossRatio = recentFrameLossRatio
        self.recentStandardDeviationMeters = recentStandardDeviationMeters
    }
}

/// Applies `QualityThresholds` to a frame and returns the discard reason, if
/// any. Check order follows the brief's own listing in section 7 verbatim:
/// rostro no detectado -> yaw/pitch excesivos -> medición inestable ->
/// demasiados frames perdidos -> distancia fuera de rango -> ojos
/// parcialmente fuera de cuadro. A frame can only ever have one recorded
/// reason (the first that applies), so summaries stay simple to read.
public enum TrackingQualityEvaluator {
    public static func evaluate(_ input: FrameQualityInput, thresholds: QualityThresholds) -> DiscardReason? {
        guard input.isFaceTracked else { return .faceNotDetected }

        if case .notAvailable = input.worldTrackingState { return .worldTrackingLimited }
        if case .limited = input.worldTrackingState { return .worldTrackingLimited }

        if abs(input.yawDegrees) > thresholds.maxYawDegrees || abs(input.pitchDegrees) > thresholds.maxPitchDegrees {
            return .excessiveYawOrPitch
        }

        if let sd = input.recentStandardDeviationMeters, sd > thresholds.maxStandardDeviationMeters {
            return .unstableMeasurement
        }

        if input.recentFrameLossRatio > thresholds.maxFrameLossRatio {
            return .tooManyDroppedFrames
        }

        if input.distanceMeters < thresholds.minDistanceMeters || input.distanceMeters > thresholds.maxDistanceMeters {
            return .distanceOutOfRange
        }

        if !input.leftEyeInFrame || !input.rightEyeInFrame {
            return .eyesPartiallyOutOfFrame
        }

        return nil
    }
}
