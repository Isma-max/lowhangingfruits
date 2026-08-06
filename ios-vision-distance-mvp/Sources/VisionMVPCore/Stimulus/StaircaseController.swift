import Foundation

/// Parameters for a simple 1-up/1-down staircase (value decreases — harder —
/// after a correct response, increases — easier — after an incorrect one).
/// This converges near the ~50% correct point, not a clinical threshold
/// criterion; documented as an MVP-appropriate simplification in
/// DECISIONS.md, not a validated psychophysical protocol.
public struct StaircaseConfiguration: Sendable {
    public var startingValue: Double
    public var initialStepSize: Double
    public var minimumStepSize: Double
    public var minimumValue: Double
    public var maximumValue: Double
    public var reversalsToStop: Int
    public var maxTrials: Int
    /// How many of the most recent reversal values are averaged for the
    /// threshold estimate (typically the last few, to skip the initial
    /// coarse-step reversals).
    public var reversalsUsedForThreshold: Int

    public init(
        startingValue: Double,
        initialStepSize: Double,
        minimumStepSize: Double,
        minimumValue: Double,
        maximumValue: Double,
        reversalsToStop: Int,
        maxTrials: Int,
        reversalsUsedForThreshold: Int
    ) {
        self.startingValue = startingValue
        self.initialStepSize = initialStepSize
        self.minimumStepSize = minimumStepSize
        self.minimumValue = minimumValue
        self.maximumValue = maximumValue
        self.reversalsToStop = reversalsToStop
        self.maxTrials = maxTrials
        self.reversalsUsedForThreshold = reversalsUsedForThreshold
    }
}

private enum LastMove: Equatable {
    case none
    case increased
    case decreased
}

/// Value-type state machine so the whole staircase history is trivially
/// testable and serializable (no hidden reference-type state).
public struct StaircaseController: Sendable {
    public let configuration: StaircaseConfiguration
    public private(set) var currentValue: Double
    public private(set) var currentStepSize: Double
    public private(set) var reversalValues: [Double] = []
    public private(set) var trialCount: Int = 0
    private var lastMove: LastMove = .none

    public init(configuration: StaircaseConfiguration) {
        self.configuration = configuration
        self.currentValue = configuration.startingValue
        self.currentStepSize = configuration.initialStepSize
    }

    public var isComplete: Bool {
        reversalValues.count >= configuration.reversalsToStop || trialCount >= configuration.maxTrials
    }

    /// Mean of the last `reversalsUsedForThreshold` reversal values, or `nil`
    /// if no reversal has happened yet.
    public var thresholdEstimate: Double? {
        guard !reversalValues.isEmpty else { return nil }
        let used = reversalValues.suffix(configuration.reversalsUsedForThreshold)
        return used.reduce(0, +) / Double(used.count)
    }

    /// Records whether the response at `currentValue` was correct and
    /// advances the staircase, halving the step size (down to
    /// `minimumStepSize`) on every reversal. Returns the new `currentValue`
    /// to present next. Undefined if called after `isComplete` is true.
    @discardableResult
    public mutating func recordResponse(correct: Bool) -> Double {
        trialCount += 1
        let move: LastMove = correct ? .decreased : .increased

        if lastMove != .none && move != lastMove {
            reversalValues.append(currentValue)
            currentStepSize = max(configuration.minimumStepSize, currentStepSize / 2)
        }
        lastMove = move

        let delta = (correct ? -1.0 : 1.0) * currentStepSize
        currentValue = min(configuration.maximumValue, max(configuration.minimumValue, currentValue + delta))
        return currentValue
    }
}
