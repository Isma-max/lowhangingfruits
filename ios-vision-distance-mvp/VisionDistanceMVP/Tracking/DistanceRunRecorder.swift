import Foundation
import Combine
import VisionMVPCore

/// Consumes `FaceTrackingSession.latestSample`, applies the quality gate and
/// rolling stats from `VisionMVPCore`, and buffers `DistanceFrameRecord`
/// rows for the currently-running distance-module recording. One instance is
/// reused across milestones/repetitions within a session; the investigator
/// sets `currentMilestoneCentimeters` / `currentRepetition` /
/// `currentReferenceDistanceCentimeters` before each run via the Distance
/// Module screen.
@MainActor
final class DistanceRunRecorder: ObservableObject {
    struct LiveStats {
        var window1s: WindowStats?
        var window2s: WindowStats?
        var window3s: WindowStats?
        var effectiveHz: Double?
        var validFrameCount: Int = 0
        var invalidFrameCount: Int = 0
    }

    @Published private(set) var isRecording = false
    @Published private(set) var liveStats = LiveStats()
    @Published private(set) var frames: [DistanceFrameRecord] = []

    var thresholds: QualityThresholds = .default
    var currentMilestoneCentimeters: Double?
    var currentRepetition: Int?
    var currentReferenceDistanceCentimeters: Double?

    private var cancellable: AnyCancellable?
    private var runStartFrameTimestamp: TimeInterval?
    private var recentDistanceSamples: [TimestampedValue] = []
    private var recentValidityFlags: [(timestamp: TimeInterval, valid: Bool)] = []
    private var runningValidCount = 0
    private var runningInvalidCount = 0
    private let isoFormatter = ISO8601DateFormatter()

    func startRecording(on session: FaceTrackingSession) {
        frames = []
        recentDistanceSamples = []
        recentValidityFlags = []
        runningValidCount = 0
        runningInvalidCount = 0
        runStartFrameTimestamp = nil
        liveStats = LiveStats()
        isRecording = true

        cancellable = session.$latestSample
            .compactMap { $0 }
            .sink { [weak self] sample in
                self?.ingest(sample)
            }
    }

    func stopRecording() {
        isRecording = false
        cancellable?.cancel()
        cancellable = nil
    }

    private func ingest(_ sample: FaceTrackingSession.LiveSample) {
        guard isRecording else { return }
        if runStartFrameTimestamp == nil { runStartFrameTimestamp = sample.frameTimestamp }
        let elapsedSeconds = sample.frameTimestamp - (runStartFrameTimestamp ?? sample.frameTimestamp)
        let elapsedMilliseconds = elapsedSeconds * 1000.0

        let recentWindow1s = RollingStatsAggregator.windowStats(samples: recentDistanceSamples, now: elapsedSeconds, windowSeconds: 1.0)

        let lossWindowStart = elapsedSeconds - thresholds.frameLossWindowSeconds
        let recentFlags = recentValidityFlags.filter { $0.timestamp > lossWindowStart }
        let recentLossRatio = FrameLossCalculator.lossRatio(
            validCount: recentFlags.filter { $0.valid }.count,
            invalidCount: recentFlags.filter { !$0.valid }.count
        )

        let qualityInput = FrameQualityInput(
            isFaceTracked: sample.isFaceTracked,
            worldTrackingState: sample.worldTrackingState,
            yawDegrees: sample.yawDegrees,
            pitchDegrees: sample.pitchDegrees,
            distanceMeters: sample.distanceToFaceMeters ?? .greatestFiniteMagnitude,
            leftEyeInFrame: sample.leftEyeInFrame,
            rightEyeInFrame: sample.rightEyeInFrame,
            recentFrameLossRatio: recentLossRatio,
            recentStandardDeviationMeters: recentWindow1s?.standardDeviation
        )

        let discardReason = TrackingQualityEvaluator.evaluate(qualityInput, thresholds: thresholds)
        let valid = discardReason == nil

        let record = DistanceFrameRecord(
            timestampISO8601: isoFormatter.string(from: Date()),
            elapsedMilliseconds: elapsedMilliseconds,
            milestoneCentimeters: currentMilestoneCentimeters,
            repetition: currentRepetition,
            distanceCameraToFaceMeters: sample.distanceToFaceMeters ?? .nan,
            distanceCameraToLeftEyeMeters: sample.distanceToLeftEyeMeters,
            distanceCameraToRightEyeMeters: sample.distanceToRightEyeMeters,
            distanceMeanEyesMeters: sample.distanceMeanEyesMeters,
            yawDegrees: sample.yawDegrees,
            pitchDegrees: sample.pitchDegrees,
            rollDegrees: sample.rollDegrees,
            faceTracked: sample.isFaceTracked,
            worldTrackingState: sample.worldTrackingState.exportValue,
            faceCentered: sample.faceCentered,
            leftEyeInFrame: sample.leftEyeInFrame,
            rightEyeInFrame: sample.rightEyeInFrame,
            valid: valid,
            discardReason: discardReason?.rawValue,
            referenceDistanceCentimeters: currentReferenceDistanceCentimeters
        )
        frames.append(record)

        if valid, let distance = sample.distanceToFaceMeters {
            recentDistanceSamples.append(TimestampedValue(timestamp: elapsedSeconds, value: distance))
        }
        recentValidityFlags.append((timestamp: elapsedSeconds, valid: valid))
        if valid { runningValidCount += 1 } else { runningInvalidCount += 1 }

        // Bound memory for long recordings; keep a bit more than the longest window in use.
        let retentionWindowSeconds = max(3.0, thresholds.frameLossWindowSeconds) + 1.0
        let cutoff = elapsedSeconds - retentionWindowSeconds
        recentDistanceSamples.removeAll { $0.timestamp < cutoff }
        recentValidityFlags.removeAll { $0.timestamp < cutoff }

        liveStats = LiveStats(
            window1s: recentWindow1s,
            window2s: RollingStatsAggregator.windowStats(samples: recentDistanceSamples, now: elapsedSeconds, windowSeconds: 2.0),
            window3s: RollingStatsAggregator.windowStats(samples: recentDistanceSamples, now: elapsedSeconds, windowSeconds: 3.0),
            effectiveHz: RollingStatsAggregator.effectiveHz(samples: recentDistanceSamples, now: elapsedSeconds, windowSeconds: 3.0),
            validFrameCount: runningValidCount,
            invalidFrameCount: runningInvalidCount
        )
    }
}
