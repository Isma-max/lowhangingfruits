import Foundation

public struct DistanceRunSummaryWindow: Codable, Sendable, Equatable {
    public var windowSeconds: Double
    public var sampleCount: Int
    public var meanMeters: Double
    public var medianMeters: Double
    public var standardDeviationMeters: Double
    public var minimumMeters: Double
    public var maximumMeters: Double

    public init(windowSeconds: Double, sampleCount: Int, meanMeters: Double, medianMeters: Double, standardDeviationMeters: Double, minimumMeters: Double, maximumMeters: Double) {
        self.windowSeconds = windowSeconds
        self.sampleCount = sampleCount
        self.meanMeters = meanMeters
        self.medianMeters = medianMeters
        self.standardDeviationMeters = standardDeviationMeters
        self.minimumMeters = minimumMeters
        self.maximumMeters = maximumMeters
    }
}

/// Per-milestone/repetition summary — `distance_summary.json` (brief section
/// 7: "resúmenes"). `recentWindows` covers the trailing 1/2/3 seconds of the
/// run exactly as specified; `overall` covers the full run, which is what
/// `errorVersusReferenceCentimeters` is computed against.
public struct DistanceRunSummary: Codable, Sendable, Equatable {
    public var milestoneCentimeters: Double?
    public var repetition: Int?
    public var validFrameCount: Int
    public var discardedFrameCount: Int
    public var discardReasonCounts: [String: Int]
    public var effectiveHz: Double?
    public var recentWindows: [DistanceRunSummaryWindow]
    public var overall: DistanceRunSummaryWindow?
    public var referenceDistanceCentimeters: Double?
    /// `overall.meanMeters * 100 - referenceDistanceCentimeters`, i.e.
    /// positive means the app over-estimated distance. `nil` unless the
    /// investigator entered a reference distance for this run.
    public var errorVersusReferenceCentimeters: Double?

    public init(
        milestoneCentimeters: Double?,
        repetition: Int?,
        validFrameCount: Int,
        discardedFrameCount: Int,
        discardReasonCounts: [String: Int],
        effectiveHz: Double?,
        recentWindows: [DistanceRunSummaryWindow],
        overall: DistanceRunSummaryWindow?,
        referenceDistanceCentimeters: Double?,
        errorVersusReferenceCentimeters: Double?
    ) {
        self.milestoneCentimeters = milestoneCentimeters
        self.repetition = repetition
        self.validFrameCount = validFrameCount
        self.discardedFrameCount = discardedFrameCount
        self.discardReasonCounts = discardReasonCounts
        self.effectiveHz = effectiveHz
        self.recentWindows = recentWindows
        self.overall = overall
        self.referenceDistanceCentimeters = referenceDistanceCentimeters
        self.errorVersusReferenceCentimeters = errorVersusReferenceCentimeters
    }
}

/// Builds a `DistanceRunSummary` from a run's raw frame records, reusing
/// `RollingStatsAggregator` so the summary numbers are computed the same way
/// as the live on-screen overlay (brief section 7: mean/median/sd/min/max
/// over 1/2/3s + effective Hz).
public enum DistanceSummaryBuilder {
    public static func buildSummary(
        frames: [DistanceFrameRecord],
        milestoneCentimeters: Double?,
        repetition: Int?,
        referenceDistanceCentimeters: Double?,
        trailingWindowSeconds: [Double] = [1, 2, 3]
    ) -> DistanceRunSummary {
        let validFrames = frames.filter { $0.valid }
        let discardedFrames = frames.filter { !$0.valid }

        var discardCounts: [String: Int] = [:]
        for frame in discardedFrames {
            let reason = frame.discardReason ?? "unknown"
            discardCounts[reason, default: 0] += 1
        }

        let samples = validFrames.map {
            TimestampedValue(timestamp: $0.elapsedMilliseconds / 1000.0, value: $0.distanceCameraToFaceMeters)
        }
        let timestamps = samples.map(\.timestamp)
        let now = timestamps.max() ?? 0
        let earliest = timestamps.min() ?? 0
        // +1ms so the earliest sample itself falls inside the "overall" window
        // (windowStats uses an exclusive lower bound).
        let overallWindowSeconds = max(now - earliest, 0) + 0.001

        let recentWindows: [DistanceRunSummaryWindow] = trailingWindowSeconds.compactMap { seconds in
            guard let stats = RollingStatsAggregator.windowStats(samples: samples, now: now, windowSeconds: seconds) else {
                return nil
            }
            return DistanceRunSummaryWindow(
                windowSeconds: seconds,
                sampleCount: stats.sampleCount,
                meanMeters: stats.mean,
                medianMeters: stats.median,
                standardDeviationMeters: stats.standardDeviation,
                minimumMeters: stats.minimum,
                maximumMeters: stats.maximum
            )
        }

        let overall: DistanceRunSummaryWindow? = RollingStatsAggregator
            .windowStats(samples: samples, now: now, windowSeconds: overallWindowSeconds)
            .map {
                DistanceRunSummaryWindow(
                    windowSeconds: overallWindowSeconds,
                    sampleCount: $0.sampleCount,
                    meanMeters: $0.mean,
                    medianMeters: $0.median,
                    standardDeviationMeters: $0.standardDeviation,
                    minimumMeters: $0.minimum,
                    maximumMeters: $0.maximum
                )
            }

        let effectiveHz = RollingStatsAggregator.effectiveHz(samples: samples, now: now, windowSeconds: overallWindowSeconds)

        var error: Double?
        if let reference = referenceDistanceCentimeters, let overall {
            error = overall.meanMeters * 100.0 - reference
        }

        return DistanceRunSummary(
            milestoneCentimeters: milestoneCentimeters,
            repetition: repetition,
            validFrameCount: validFrames.count,
            discardedFrameCount: discardedFrames.count,
            discardReasonCounts: discardCounts,
            effectiveHz: effectiveHz,
            recentWindows: recentWindows,
            overall: overall,
            referenceDistanceCentimeters: referenceDistanceCentimeters,
            errorVersusReferenceCentimeters: error
        )
    }
}
