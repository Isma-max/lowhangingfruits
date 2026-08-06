import XCTest
@testable import VisionMVPCore

final class RollingStatsAggregatorTests: XCTestCase {
    func testWindowStatsKnownValues() {
        // 0.38, 0.40, 0.42 -> mean 0.40, median 0.40, population sd = sqrt(0.02^2*2/3)
        let samples = [
            TimestampedValue(timestamp: 0.0, value: 0.38),
            TimestampedValue(timestamp: 0.5, value: 0.40),
            TimestampedValue(timestamp: 1.0, value: 0.42),
        ]

        let stats = RollingStatsAggregator.windowStats(samples: samples, now: 1.0, windowSeconds: 3.0)

        XCTAssertNotNil(stats)
        XCTAssertEqual(stats!.sampleCount, 3)
        XCTAssertEqual(stats!.mean, 0.40, accuracy: 1e-9)
        XCTAssertEqual(stats!.median, 0.40, accuracy: 1e-9)
        XCTAssertEqual(stats!.minimum, 0.38, accuracy: 1e-9)
        XCTAssertEqual(stats!.maximum, 0.42, accuracy: 1e-9)
        let expectedSD = ((0.02 * 0.02) * 2 / 3).squareRoot()
        XCTAssertEqual(stats!.standardDeviation, expectedSD, accuracy: 1e-9)
    }

    func testWindowExcludesSamplesOutsideRange() {
        let samples = [
            TimestampedValue(timestamp: -5.0, value: 100), // way outside window
            TimestampedValue(timestamp: 0.0, value: 0.40),
            TimestampedValue(timestamp: 1.0, value: 0.42),
        ]

        let stats = RollingStatsAggregator.windowStats(samples: samples, now: 1.0, windowSeconds: 1.0)

        XCTAssertEqual(stats?.sampleCount, 2)
        XCTAssertEqual(stats?.mean, 0.41, accuracy: 1e-9)
    }

    func testWindowStatsNilWhenNoSamplesInRange() {
        let samples = [TimestampedValue(timestamp: 0.0, value: 0.4)]
        let stats = RollingStatsAggregator.windowStats(samples: samples, now: 10.0, windowSeconds: 1.0)
        XCTAssertNil(stats)
    }

    func testEvenCountMedianAverages() {
        let samples = [
            TimestampedValue(timestamp: 0.0, value: 0.30),
            TimestampedValue(timestamp: 0.1, value: 0.50),
        ]
        let stats = RollingStatsAggregator.windowStats(samples: samples, now: 0.1, windowSeconds: 1.0)
        XCTAssertEqual(stats?.median, 0.40, accuracy: 1e-9)
    }

    func testEffectiveHzForRegularSamples() {
        // 30 Hz-ish: 30 samples spaced 1/30s apart, spanning ~0.967s.
        let samples = (0..<30).map { TimestampedValue(timestamp: Double($0) / 30.0, value: 0.4) }
        let hz = RollingStatsAggregator.effectiveHz(samples: samples, now: samples.last!.timestamp, windowSeconds: 3.0)
        XCTAssertNotNil(hz)
        XCTAssertEqual(hz!, 30.0, accuracy: 1e-6)
    }

    func testEffectiveHzNilWithFewerThanTwoSamples() {
        let samples = [TimestampedValue(timestamp: 0.0, value: 0.4)]
        XCTAssertNil(RollingStatsAggregator.effectiveHz(samples: samples, now: 0.0, windowSeconds: 1.0))
    }

    func testFrameLossRatio() {
        XCTAssertEqual(FrameLossCalculator.lossRatio(validCount: 27, invalidCount: 3), 0.1, accuracy: 1e-9)
        XCTAssertEqual(FrameLossCalculator.lossRatio(validCount: 0, invalidCount: 0), 0.0, accuracy: 1e-9)
    }
}
