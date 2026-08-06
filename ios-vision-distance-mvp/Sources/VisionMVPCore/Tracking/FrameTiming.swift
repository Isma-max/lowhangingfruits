import Foundation

/// Detects REAL dropped frames — timestamp discontinuities and low effective
/// fps over a short rolling window — as opposed to frames that arrived fine
/// but were merely out of range or unstable. This distinction is the fix for
/// the permanent `too_many_dropped_frames` trap found in the last session's
/// export: quality-invalid frames were being fed back into a "frame loss"
/// ratio, which then invalidated every subsequent frame forever, even though
/// the stream was running continuously at ~60fps with normal tracking.
public struct FrameTiming: Sendable {
    /// Interval since the previous frame, or `nil` for the first frame.
    public var intervalMs: Double?
    /// Effective delivery rate over the rolling window; `nil` until 2 frames.
    public var effectiveFps: Double?
    /// True only when the gap since the previous frame exceeds the
    /// real-drop threshold (i.e. callbacks actually went missing).
    public var isRealDrop: Bool
}

public struct FrameTimingTracker: Sendable {
    public var windowSeconds: Double
    /// A gap larger than this means frames were actually lost (at 60fps the
    /// nominal interval is ~16.7ms; 100ms means ~5+ consecutive frames
    /// missing).
    public var dropGapSeconds: Double

    private var lastTimestamp: TimeInterval?
    private var recentTimestamps: [TimeInterval] = []

    public init(windowSeconds: Double = 2.0, dropGapSeconds: Double = 0.1) {
        self.windowSeconds = windowSeconds
        self.dropGapSeconds = dropGapSeconds
    }

    public mutating func ingest(timestamp: TimeInterval) -> FrameTiming {
        let interval = lastTimestamp.map { timestamp - $0 }
        lastTimestamp = timestamp
        recentTimestamps.append(timestamp)
        recentTimestamps.removeAll { timestamp - $0 > windowSeconds }

        var effectiveFps: Double?
        if recentTimestamps.count >= 2, let first = recentTimestamps.first, let last = recentTimestamps.last, last > first {
            effectiveFps = Double(recentTimestamps.count - 1) / (last - first)
        }

        return FrameTiming(
            intervalMs: interval.map { $0 * 1000.0 },
            effectiveFps: effectiveFps,
            isRealDrop: (interval ?? 0) > dropGapSeconds
        )
    }
}
