import Foundation

/// Discrete-level 2-down/1-up staircase over an ordered list of logMAR
/// levels (easiest/largest first). Replaces the old continuous-millimeter
/// `StaircaseController`: every move is exactly one level, so the size
/// change between consecutive presentations is always a fixed, perceptible
/// logarithmic step — never an arbitrary millimeter jump.
public struct LevelStaircase: Sendable {
    public enum Direction: String, Sendable {
        /// Toward smaller/harder stimuli.
        case down
        /// Toward larger/easier stimuli.
        case up
    }

    public struct Update: Sendable {
        public var moved: Bool
        public var direction: Direction?
        public var wasReversal: Bool
    }

    /// logMAR values ordered easiest -> hardest (descending), e.g. 0.8 ... -0.2.
    public let levels: [Double]
    public private(set) var currentIndex: Int
    public private(set) var consecutiveCorrect: Int = 0
    /// logMAR value at each reversal (value at the moment direction changed).
    public private(set) var reversalValues: [Double] = []
    public private(set) var lastMoveDirection: Direction?

    public init(levels: [Double], startIndex: Int) {
        precondition(!levels.isEmpty, "LevelStaircase requires at least one level")
        self.levels = levels
        self.currentIndex = min(max(0, startIndex), levels.count - 1)
    }

    public var currentLogMAR: Double { levels[currentIndex] }
    public var reversalCount: Int { reversalValues.count }

    /// 2-down/1-up: two consecutive corrects move one level harder; a single
    /// error moves one level easier and resets the consecutive-correct
    /// counter. A single correct never moves the staircase.
    @discardableResult
    public mutating func record(correct: Bool) -> Update {
        if correct {
            consecutiveCorrect += 1
            guard consecutiveCorrect >= 2 else {
                return Update(moved: false, direction: nil, wasReversal: false)
            }
            consecutiveCorrect = 0
            return move(.down)
        } else {
            consecutiveCorrect = 0
            return move(.up)
        }
    }

    private mutating func move(_ direction: Direction) -> Update {
        var wasReversal = false
        if let last = lastMoveDirection, last != direction {
            wasReversal = true
            reversalValues.append(levels[currentIndex])
        }
        lastMoveDirection = direction
        switch direction {
        case .down: currentIndex = min(levels.count - 1, currentIndex + 1)
        case .up: currentIndex = max(0, currentIndex - 1)
        }
        return Update(moved: true, direction: direction, wasReversal: wasReversal)
    }

    /// Mean logMAR of the last `n` reversals; `nil` before the first reversal.
    public func thresholdEstimate(usingLastReversals n: Int) -> Double? {
        guard !reversalValues.isEmpty else { return nil }
        let used = reversalValues.suffix(n)
        return used.reduce(0, +) / Double(used.count)
    }

    /// Population SD of the last `n` reversal values — the "is the threshold
    /// stable" signal used to pick completed vs. approximate outcomes.
    public func reversalSpread(usingLastReversals n: Int) -> Double? {
        let used = Array(reversalValues.suffix(n))
        guard used.count >= 2 else { return nil }
        let mean = used.reduce(0, +) / Double(used.count)
        let variance = used.reduce(0) { $0 + ($1 - mean) * ($1 - mean) } / Double(used.count)
        return variance.squareRoot()
    }
}

/// The configurable difficulty ladder (encargo §17) and the level -> physical
/// size mapping. `totalHeightMillimeters` is what a 5x5 optotype must measure
/// on screen so its critical detail subtends exactly `10^logMAR` arcmin at
/// the given viewing distance.
public enum StimulusLevels {
    public static let defaultLogMARLevels: [Double] = [0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 0.0, -0.1, -0.2]

    /// Index of 0.6 logMAR in `defaultLogMARLevels` — the "easy, obviously
    /// visible" starting level the encargo asks for.
    public static let defaultStartIndex = 2

    public static func totalHeightMillimeters(logMAR: Double, viewingDistanceMeters: Double) -> Double {
        let marArcMinutes = VisualAcuityMath.marArcMinutes(logMAR: logMAR)
        let totalAngleArcMinutes = marArcMinutes * 5.0
        return StimulusScaler.physicalSizeMillimeters(
            targetAngularSizeArcMinutes: totalAngleArcMinutes,
            distanceMeters: viewingDistanceMeters
        )
    }
}
