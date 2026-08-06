import Foundation

/// Parameters for an N-down/M-up staircase: `correctsRequiredToDecrease`
/// consecutive correct responses are required before the value decreases
/// (harder), and `incorrectsRequiredToIncrease` consecutive incorrect
/// responses before it increases (easier). The classic "2-down/1-up" design
/// (2, 1) converges near 70.7% correct; "1-down/1-up" (1, 1) converges near
/// 50% and is kept available as a simple special case, not the default.
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
    /// Consecutive correct responses required before the value decreases.
    public var correctsRequiredToDecrease: Int
    /// Consecutive incorrect responses required before the value increases.
    public var incorrectsRequiredToIncrease: Int

    public init(
        startingValue: Double,
        initialStepSize: Double,
        minimumStepSize: Double,
        minimumValue: Double,
        maximumValue: Double,
        reversalsToStop: Int,
        maxTrials: Int,
        reversalsUsedForThreshold: Int,
        correctsRequiredToDecrease: Int = 2,
        incorrectsRequiredToIncrease: Int = 1
    ) {
        self.startingValue = startingValue
        self.initialStepSize = initialStepSize
        self.minimumStepSize = minimumStepSize
        self.minimumValue = minimumValue
        self.maximumValue = maximumValue
        self.reversalsToStop = reversalsToStop
        self.maxTrials = maxTrials
        self.reversalsUsedForThreshold = reversalsUsedForThreshold
        self.correctsRequiredToDecrease = correctsRequiredToDecrease
        self.incorrectsRequiredToIncrease = incorrectsRequiredToIncrease
    }

    /// A short identifier for what ran, for traceability
    /// (`VisionTrialRecord.staircaseAlgorithm`) — e.g. "2down1up".
    public var algorithmIdentifier: String {
        "\(correctsRequiredToDecrease)down\(incorrectsRequiredToIncrease)up"
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
    private var consecutiveCorrect = 0
    private var consecutiveIncorrect = 0

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

    /// Records whether the response at `currentValue` was correct and, once
    /// enough consecutive same-direction responses have accumulated (per
    /// `correctsRequiredToDecrease`/`incorrectsRequiredToIncrease`), advances
    /// the staircase — halving the step size (down to `minimumStepSize`) on
    /// every reversal. Returns the new `currentValue` to present next (equal
    /// to the previous value if this response didn't yet trigger a step).
    /// Undefined if called after `isComplete` is true.
    @discardableResult
    public mutating func recordResponse(correct: Bool) -> Double {
        trialCount += 1

        if correct {
            consecutiveCorrect += 1
            consecutiveIncorrect = 0
        } else {
            consecutiveIncorrect += 1
            consecutiveCorrect = 0
        }

        let move: LastMove?
        if correct && consecutiveCorrect >= configuration.correctsRequiredToDecrease {
            move = .decreased
            consecutiveCorrect = 0
        } else if !correct && consecutiveIncorrect >= configuration.incorrectsRequiredToIncrease {
            move = .increased
            consecutiveIncorrect = 0
        } else {
            move = nil
        }

        guard let move else { return currentValue }

        if lastMove != .none && move != lastMove {
            reversalValues.append(currentValue)
            currentStepSize = max(configuration.minimumStepSize, currentStepSize / 2)
        }
        lastMove = move

        let delta = (move == .decreased ? -1.0 : 1.0) * currentStepSize
        currentValue = min(configuration.maximumValue, max(configuration.minimumValue, currentValue + delta))
        return currentValue
    }
}
