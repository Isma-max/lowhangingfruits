import XCTest
@testable import VisionMVPCore

/// Encargo §26.5-§26.7: dropped frames se detectan por discontinuidades
/// reales de timestamps, nunca por frames "inválidos" que sí llegaron.
final class FrameTimingTests: XCTestCase {
    func testSteadySixtyFpsProducesNoDrops() {
        var tracker = FrameTimingTracker()
        var lastTiming: FrameTiming?
        for index in 0..<120 {
            lastTiming = tracker.ingest(timestamp: Double(index) / 60.0)
            XCTAssertFalse(lastTiming!.isRealDrop)
        }
        XCTAssertEqual(lastTiming!.effectiveFps!, 60.0, accuracy: 0.5)
        XCTAssertEqual(lastTiming!.intervalMs!, 1000.0 / 60.0, accuracy: 0.1)
    }

    // §26.6 — un gap real de timestamps sí es un drop.
    func testRealTimestampGapIsDetectedAsDrop() {
        var tracker = FrameTimingTracker()
        _ = tracker.ingest(timestamp: 0.0)
        _ = tracker.ingest(timestamp: 1.0 / 60.0)
        let afterGap = tracker.ingest(timestamp: 1.0 / 60.0 + 0.5) // half a second missing
        XCTAssertTrue(afterGap.isRealDrop)
        XCTAssertEqual(afterGap.intervalMs!, 500 + 1000.0 / 60.0 - 1000.0 / 60.0, accuracy: 1.0)
    }

    // §26.5 — un frame que llegó (aunque su medición sea inestable o esté
    // fuera de rango) nunca cuenta como dropped frame: el tracker sólo mira
    // timestamps, no contenido.
    func testArrivedFramesAreNeverDropsRegardlessOfContent() {
        var tracker = FrameTimingTracker()
        _ = tracker.ingest(timestamp: 0.0)
        // These frames "exist" — timing sees normal cadence.
        for index in 1..<30 {
            let timing = tracker.ingest(timestamp: Double(index) / 60.0)
            XCTAssertFalse(timing.isRealDrop)
        }
    }

    // §26.7 — la ventana móvil descarta datos antiguos.
    func testRollingWindowDiscardsOldTimestamps() {
        var tracker = FrameTimingTracker(windowSeconds: 1.0)
        // 1 second at 60fps, then 1 second at 10fps: the fps estimate must
        // reflect the recent 10fps, not the whole-session average.
        var t = 0.0
        for _ in 0..<60 { _ = tracker.ingest(timestamp: t); t += 1.0 / 60.0 }
        var lastTiming: FrameTiming?
        for _ in 0..<12 { lastTiming = tracker.ingest(timestamp: t); t += 0.1 }
        XCTAssertEqual(lastTiming!.effectiveFps!, 10.0, accuracy: 1.5)
    }

    // §26.2/§26.3 — la inestabilidad se mide con la SD de una ventana móvil
    // y se recupera sola cuando la medición vuelve a ser estable.
    func testInstabilityDetectionRecoversWithRollingWindow() {
        let stable = (0..<60).map { TimestampedValue(timestamp: Double($0) / 60.0, value: 0.40) }
        let stableSD = RollingStatsAggregator.windowStats(samples: stable, now: 1.0, windowSeconds: 1.0)!.standardDeviation
        XCTAssertLessThan(stableSD, 0.001)

        // Brief shake: 0.5s oscillating ±3cm.
        var samples = stable
        for index in 0..<30 {
            let t = 1.0 + Double(index) / 60.0
            samples.append(TimestampedValue(timestamp: t, value: 0.40 + (index % 2 == 0 ? 0.03 : -0.03)))
        }
        let shakySD = RollingStatsAggregator.windowStats(samples: samples, now: 1.5, windowSeconds: 1.0)!.standardDeviation
        XCTAssertGreaterThan(shakySD, 0.01)

        // 1.5s later, back to stable: the window no longer sees the shake.
        for index in 0..<90 {
            let t = 1.5 + Double(index) / 60.0
            samples.append(TimestampedValue(timestamp: t, value: 0.40))
        }
        let recoveredSD = RollingStatsAggregator.windowStats(samples: samples, now: 3.0, windowSeconds: 1.0)!.standardDeviation
        XCTAssertLessThan(recoveredSD, 0.001)
    }
}
