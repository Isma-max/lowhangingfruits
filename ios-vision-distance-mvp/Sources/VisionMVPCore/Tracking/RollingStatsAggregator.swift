import Foundation

/// A single sample with a monotonic timestamp (seconds since the run started),
/// used for windowed statistics.
public struct TimestampedValue: Sendable {
    public var timestamp: TimeInterval
    public var value: Double

    public init(timestamp: TimeInterval, value: Double) {
        self.timestamp = timestamp
        self.value = value
    }
}

public struct WindowStats: Equatable, Sendable {
    public var windowSeconds: Double
    public var sampleCount: Int
    public var mean: Double
    public var median: Double
    public var standardDeviation: Double
    public var minimum: Double
    public var maximum: Double
}

/// Computes mean/median/sd/min/max and effective sampling rate over trailing
/// time windows (brief section 7: "Media, mediana, desviación estándar,
/// mínimo y máximo de los últimos 1, 2 y 3 segundos" + "Frecuencia efectiva de
/// medición"). Pure functions over an explicit sample list rather than a
/// stateful class, so callers own the buffering strategy and the logic stays
/// trivially testable.
public enum RollingStatsAggregator {
    /// Stats over samples with `now - windowSeconds < timestamp <= now`.
    /// Population standard deviation (divides by n, not n-1) since this
    /// describes the observed window itself, not an estimate from a larger
    /// population.
    public static func windowStats(samples: [TimestampedValue], now: TimeInterval, windowSeconds: Double) -> WindowStats? {
        let windowStart = now - windowSeconds
        let values = samples
            .filter { $0.timestamp > windowStart && $0.timestamp <= now }
            .map { $0.value }
            .sorted()

        guard !values.isEmpty else { return nil }

        let count = Double(values.count)
        let mean = values.reduce(0, +) / count
        let variance = values.reduce(0) { $0 + ($1 - mean) * ($1 - mean) } / count
        let standardDeviation = variance.squareRoot()

        let median: Double
        let mid = values.count / 2
        if values.count % 2 == 0 {
            median = (values[mid - 1] + values[mid]) / 2
        } else {
            median = values[mid]
        }

        return WindowStats(
            windowSeconds: windowSeconds,
            sampleCount: values.count,
            mean: mean,
            median: median,
            standardDeviation: standardDeviation,
            minimum: values.first!,
            maximum: values.last!
        )
    }

    /// (n - 1) / observed timespan within the window; `nil` when fewer than 2
    /// samples fall in the window (an instantaneous rate is undefined then).
    public static func effectiveHz(samples: [TimestampedValue], now: TimeInterval, windowSeconds: Double) -> Double? {
        let windowStart = now - windowSeconds
        let inWindow = samples
            .filter { $0.timestamp > windowStart && $0.timestamp <= now }
            .sorted { $0.timestamp < $1.timestamp }

        guard inWindow.count >= 2, let first = inWindow.first, let last = inWindow.last else { return nil }
        let span = last.timestamp - first.timestamp
        guard span > 0 else { return nil }
        return Double(inWindow.count - 1) / span
    }
}

/// Fraction of frames discarded by the quality gate over a trailing window —
/// feeds back into `FrameQualityInput.recentFrameLossRatio` for the *next*
/// frame's evaluation (a frame's own validity never depends on itself).
public enum FrameLossCalculator {
    public static func lossRatio(validCount: Int, invalidCount: Int) -> Double {
        let total = validCount + invalidCount
        guard total > 0 else { return 0 }
        return Double(invalidCount) / Double(total)
    }
}
