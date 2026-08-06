import Foundation

// MARK: - Configuration

public struct VisionTestConfiguration: Sendable {
    public var minDistanceMeters: Double = 0.37
    public var maxDistanceMeters: Double = 0.43
    /// Continuous in-range time required before starting, before the
    /// countdown, and to recover from a pause.
    public var requiredStabilitySeconds: Double = 0.5
    /// How long the stimulus stays visible after tracking/range goes bad
    /// before the test actually pauses (encargo §11).
    public var graceSeconds: Double = 1.0
    /// Accumulated technical-pause budget; exceeding it ends the test as
    /// inconclusive (encargo §11).
    public var maxTotalPauseSeconds: Double = 15.0
    /// Effective (stimulus-visible) test time limit (encargo §13/§19).
    public var effectiveLimitSeconds: Double = 60.0
    /// Hard cap on wall-clock time from the first stimulus (encargo §11).
    public var realLimitSeconds: Double = 75.0
    /// Max visible time per figure before it scores as a timeout (§15).
    public var stimulusTimeoutSeconds: Double = 5.0
    public var countdownSeconds: Double = 3.0
    public var maxValidTrials: Int = 20
    public var reversalsToStop: Int = 6
    public var minValidTrialsForResult: Int = 10
    public var reversalsUsedForThreshold: Int = 4
    /// Reversal-spread (SD, logMAR) at or below which a finished test counts
    /// as "completed" rather than "approximate".
    public var maxReversalSpreadForCompleted: Double = 0.15
    /// A frame gap larger than this is treated as technical downtime (goes
    /// to the pause budget) rather than effective test time.
    public var frameGapPauseThresholdSeconds: Double = 0.3
    public var levelsLogMAR: [Double] = StimulusLevels.defaultLogMARLevels
    public var startLevelIndex: Int = StimulusLevels.defaultStartIndex
    /// Screen conversion factors, injected by the app (tests use fixed values).
    public var pointsPerMillimeter: Double = 6.0
    public var pixelsPerPoint: Double = 3.0

    public init() {}
}

// MARK: - Inputs / outputs

/// Everything the engine needs from one tracking frame. Built by the app
/// from ARKit data; synthetic in tests/simulations.
public struct EngineFrameInput: Sendable {
    /// Monotonic seconds (ARFrame.timestamp). Never wall-clock.
    public var timestamp: TimeInterval
    /// Mid-eyes viewing distance in meters, `nil` when not measurable.
    public var viewingDistanceMeters: Double?
    public var faceTracked: Bool
    public var trackingNormal: Bool
    public var eyesVisible: Bool

    public init(timestamp: TimeInterval, viewingDistanceMeters: Double?, faceTracked: Bool, trackingNormal: Bool, eyesVisible: Bool) {
        self.timestamp = timestamp
        self.viewingDistanceMeters = viewingDistanceMeters
        self.faceTracked = faceTracked
        self.trackingNormal = trackingNormal
        self.eyesVisible = eyesVisible
    }
}

public enum PositioningHint: String, Sendable {
    case faceNotDetected = "face_not_detected"
    case moveCloser = "move_closer"   // too far -> "Acércate un poco"
    case moveBack = "move_back"       // too close -> "Aléjate un poco"
    case hold = "hold"                // in range, accumulating stability
    case correct = "correct"          // stable and in range
}

public struct PresentedStimulus: Equatable, Sendable {
    public var trialIndex: Int
    public var orientation: GapOrientation
    public var levelIndex: Int
    public var logMAR: Double
    public var totalHeightMillimeters: Double
    public var viewingDistanceAtPresentation: Double
    public var repeatedAfterPause: Bool
}

public enum TerminationReason: String, Sendable {
    case reversalsReached = "reversals_reached"
    case maxTrialsReached = "max_trials_reached"
    case effectiveTimeLimit = "effective_time_limit"
    case realTimeLimit = "real_time_limit"
    case pauseBudgetExceeded = "pause_budget_exceeded"
    case abandoned = "abandoned"
}

public enum TestOutcome: String, Sendable {
    case completed
    case approximate
    case inconclusive
}

public struct TestResult: Sendable {
    public var outcome: TestOutcome
    public var terminationReason: TerminationReason
    public var thresholdLogMAR: Double?
    public var confidence: String
    public var reversalCount: Int
    /// SD (logMAR) of the reversals used for the threshold — the
    /// "variabilidad entre reversiones" surfaced in the experimental result.
    public var reversalSpreadLogMAR: Double?
    public var validTrialCount: Int
    public var effectiveSeconds: Double
    public var pausedSeconds: Double
    public var realSeconds: Double
}

/// Per-frame context handed back to the caller so it can build the frame CSV
/// row; `nil` once the test has finished (recording must stop, §22).
public struct EngineFrameContext: Sendable {
    public var testState: String
    public var effectiveTestTimeMs: Double
    public var insideDistanceRange: Bool
    public var valid: Bool
    public var discardReason: String?
    public var positioningHint: PositioningHint
}

/// Deterministic seedable RNG so simulations reproduce exactly.
public struct SplitMix64: RandomNumberGenerator, Sendable {
    private var state: UInt64
    public init(seed: UInt64) { state = seed }
    public mutating func next() -> UInt64 {
        state &+= 0x9E37_79B9_7F4A_7C15
        var z = state
        z = (z ^ (z >> 30)) &* 0xBF58_476D_1CE4_E5B9
        z = (z ^ (z >> 27)) &* 0x94D0_49BB_1331_11EB
        return z ^ (z >> 31)
    }
}

// MARK: - Engine

/// Deterministic state machine for the single 60-second vision test.
/// Consumes tracking frames and responses; produces phase transitions,
/// trial records, and a final result. Contains no SwiftUI/ARKit/Date()
/// dependencies — all time comes from injected frame timestamps, so every
/// path (pauses, timeouts, termination) is unit-testable and simulatable.
public final class VisionTestEngine {
    public enum Phase: Equatable, Sendable {
        case positioning
        case countdown(startedAt: TimeInterval)
        case stimulus
        case paused
        case finished
    }

    public let configuration: VisionTestConfiguration
    public let sessionID: String

    public private(set) var phase: Phase = .positioning
    public private(set) var staircase: LevelStaircase
    public private(set) var trials: [TrialRecord] = []
    public private(set) var validTrialCount = 0
    public private(set) var currentStimulus: PresentedStimulus?
    public private(set) var effectiveSeconds: Double = 0
    public private(set) var pausedSeconds: Double = 0
    public private(set) var result: TestResult?
    public private(set) var positioningHint: PositioningHint = .faceNotDetected

    private var rng: SplitMix64
    private let referenceDate: Date
    private var firstFrameTimestamp: TimeInterval?
    private var lastTimestamp: TimeInterval?
    private var realStartTimestamp: TimeInterval?
    private var stableInRangeSince: TimeInterval?
    private var badSince: TimeInterval?
    private var stimulusVisibleSeconds: Double = 0
    private var nextTrialIndex = 0
    private var lastGoodDistance: Double?
    private let isoFormatter = ISO8601DateFormatter()

    public init(
        configuration: VisionTestConfiguration = VisionTestConfiguration(),
        sessionID: String,
        referenceDate: Date = Date(),
        seed: UInt64 = UInt64.random(in: UInt64.min...UInt64.max)
    ) {
        self.configuration = configuration
        self.sessionID = sessionID
        self.referenceDate = referenceDate
        self.rng = SplitMix64(seed: seed)
        self.staircase = LevelStaircase(levels: configuration.levelsLogMAR, startIndex: configuration.startLevelIndex)
    }

    public var isFinished: Bool { result != nil }

    /// True once the first stimulus was presented — the boundary between
    /// "backing out of positioning" (nothing to save) and "abandoning a
    /// started test" (session must be persisted).
    public var hasStarted: Bool { realStartTimestamp != nil }

    /// Debug panel: why hasn't the test ended yet (encargo §25).
    public var notFinishedBecause: String {
        guard result == nil else { return "finished" }
        let c = configuration
        return "reversiones \(staircase.reversalCount)/\(c.reversalsToStop) · ensayos \(validTrialCount)/\(c.maxValidTrials) · efectivo \(Int(effectiveSeconds))/\(Int(c.effectiveLimitSeconds))s · pausa \(Int(pausedSeconds))/\(Int(c.maxTotalPauseSeconds))s"
    }

    public var countdownSecondsRemaining: Double? {
        guard case .countdown(let startedAt) = phase, let last = lastTimestamp else { return nil }
        return max(0, configuration.countdownSeconds - (last - startedAt))
    }

    // MARK: Frame ingestion

    @discardableResult
    public func ingest(_ frame: EngineFrameInput) -> EngineFrameContext? {
        guard result == nil else { return nil }
        if firstFrameTimestamp == nil { firstFrameTimestamp = frame.timestamp }
        let dt = lastTimestamp.map { max(0, frame.timestamp - $0) } ?? 0
        lastTimestamp = frame.timestamp
        let t = frame.timestamp
        let technicalGap = dt > configuration.frameGapPauseThresholdSeconds

        let trackable = frame.faceTracked && frame.trackingNormal && frame.eyesVisible && frame.viewingDistanceMeters != nil
        let distance = frame.viewingDistanceMeters
        let inRange = trackable && distance! >= configuration.minDistanceMeters && distance! <= configuration.maxDistanceMeters
        if inRange { lastGoodDistance = distance }
        updatePositioningHint(trackable: trackable, distance: distance, inRange: inRange)

        switch phase {
        case .positioning:
            updateStability(inRange: inRange, at: t)
            if isStable(at: t) {
                phase = .countdown(startedAt: t)
            }

        case .countdown(let startedAt):
            if !inRange {
                stableInRangeSince = nil
                phase = .positioning
            } else if t - startedAt >= configuration.countdownSeconds {
                startTest(at: t)
            }

        case .stimulus:
            if technicalGap {
                // Real dropped-callback gap: bill it to the pause budget, not
                // to effective test time (the participant saw nothing move).
                pausedSeconds += dt
            } else {
                effectiveSeconds += dt
                stimulusVisibleSeconds += dt
            }

            if inRange {
                badSince = nil
            } else if badSince == nil {
                badSince = t
            } else if t - badSince! >= configuration.graceSeconds {
                enterPause(at: t)
            }

            if phase == .stimulus {
                checkTimeouts(at: t)
            }

        case .paused:
            pausedSeconds += dt
            if pausedSeconds > configuration.maxTotalPauseSeconds {
                finish(.pauseBudgetExceeded, at: t)
                break
            }
            updateStability(inRange: inRange, at: t)
            if isStable(at: t) {
                resumeFromPause(at: t)
            }

        case .finished:
            break
        }

        // Real-time hard cap, applies from the first stimulus onward.
        if result == nil, let start = realStartTimestamp, t - start >= configuration.realLimitSeconds {
            finish(.realTimeLimit, at: t)
        }

        return EngineFrameContext(
            testState: stateName,
            effectiveTestTimeMs: effectiveSeconds * 1000.0,
            insideDistanceRange: inRange,
            valid: trackable,
            discardReason: discardReason(for: frame),
            positioningHint: positioningHint
        )
    }

    // MARK: Responses

    public func respond(_ response: GapOrientation) {
        guard result == nil, phase == .stimulus, let stimulus = currentStimulus else { return }
        let t = lastTimestamp ?? 0
        let correct = response == stimulus.orientation
        recordScoredTrial(stimulus: stimulus, response: response, correct: correct, timeout: false, at: t)
    }

    public func abandon() {
        guard result == nil else { return }
        finish(.abandoned, at: lastTimestamp ?? 0)
    }

    // MARK: Internals

    private var stateName: String {
        switch phase {
        case .positioning: return "positioning"
        case .countdown: return "countdown"
        case .stimulus: return "stimulus"
        case .paused: return "paused"
        case .finished: return "finished"
        }
    }

    private func discardReason(for frame: EngineFrameInput) -> String? {
        if !frame.faceTracked { return "face_not_detected" }
        if !frame.trackingNormal { return "tracking_limited" }
        if !frame.eyesVisible { return "eyes_out_of_frame" }
        if frame.viewingDistanceMeters == nil { return "no_distance" }
        return nil
    }

    private func updatePositioningHint(trackable: Bool, distance: Double?, inRange: Bool) {
        guard trackable, let distance else {
            positioningHint = .faceNotDetected
            return
        }
        if distance < configuration.minDistanceMeters {
            positioningHint = .moveBack
        } else if distance > configuration.maxDistanceMeters {
            positioningHint = .moveCloser
        } else if let since = stableInRangeSince, let last = lastTimestamp,
                  last - since >= configuration.requiredStabilitySeconds {
            positioningHint = .correct
        } else {
            positioningHint = .hold
        }
        _ = inRange
    }

    private func updateStability(inRange: Bool, at t: TimeInterval) {
        if inRange {
            if stableInRangeSince == nil { stableInRangeSince = t }
        } else {
            stableInRangeSince = nil
        }
    }

    private func isStable(at t: TimeInterval) -> Bool {
        guard let since = stableInRangeSince else { return false }
        return t - since >= configuration.requiredStabilitySeconds
    }

    private func startTest(at t: TimeInterval) {
        realStartTimestamp = t
        presentStimulus(at: t, repeatedAfterPause: false, keepVisibleTime: false)
    }

    private func presentStimulus(at t: TimeInterval, repeatedAfterPause: Bool, keepVisibleTime: Bool) {
        let distance = lastGoodDistance ?? 0.40
        let logMAR = staircase.currentLogMAR
        let heightMm = StimulusLevels.totalHeightMillimeters(logMAR: logMAR, viewingDistanceMeters: distance)
        let orientation = GapOrientation.cardinalDirections.randomElement(using: &rng) ?? .up
        if !keepVisibleTime { stimulusVisibleSeconds = 0 }
        currentStimulus = PresentedStimulus(
            trialIndex: nextTrialIndex,
            orientation: orientation,
            levelIndex: staircase.currentIndex,
            logMAR: logMAR,
            totalHeightMillimeters: heightMm,
            viewingDistanceAtPresentation: distance,
            repeatedAfterPause: repeatedAfterPause
        )
        badSince = nil
        phase = .stimulus
    }

    private func enterPause(at t: TimeInterval) {
        // The in-progress trial is interrupted: it will be re-presented (same
        // level, new orientation, visible-time carried over) after recovery,
        // and it is never scored or fed to the staircase (§10/§15/§18).
        phase = .paused
        stableInRangeSince = nil
        badSince = nil
    }

    private func resumeFromPause(at t: TimeInterval) {
        presentStimulus(at: t, repeatedAfterPause: true, keepVisibleTime: true)
    }

    private func checkTimeouts(at t: TimeInterval) {
        // Per-figure timeout: 5s of *visible* time (paused time never counts).
        if let stimulus = currentStimulus, stimulusVisibleSeconds >= configuration.stimulusTimeoutSeconds {
            recordScoredTrial(stimulus: stimulus, response: nil, correct: false, timeout: true, at: t)
            return
        }
        if effectiveSeconds >= configuration.effectiveLimitSeconds {
            finish(.effectiveTimeLimit, at: t)
        }
    }

    private func recordScoredTrial(stimulus: PresentedStimulus, response: GapOrientation?, correct: Bool, timeout: Bool, at t: TimeInterval) {
        let consecutiveBefore = staircase.consecutiveCorrect
        let directionBefore = staircase.lastMoveDirection?.rawValue ?? ""
        let update = staircase.record(correct: correct)
        let geometry = StimulusScaler.measurement(
            totalHeightMillimeters: stimulus.totalHeightMillimeters,
            distanceMeters: stimulus.viewingDistanceAtPresentation
        )
        let heightPoints = stimulus.totalHeightMillimeters * configuration.pointsPerMillimeter

        trials.append(TrialRecord(
            sessionID: sessionID,
            trialID: "\(sessionID)-\(stimulus.trialIndex)",
            trialIndex: stimulus.trialIndex,
            timestampPresentedISO8601: isoString(forMonotonic: t - stimulusVisibleSeconds),
            timestampAnsweredISO8601: isoString(forMonotonic: t),
            effectiveElapsedMs: effectiveSeconds * 1000.0,
            stimulusType: "landolt_c",
            orientationTruth: stimulus.orientation,
            response: response,
            correct: correct,
            timeout: timeout,
            reactionTimeMs: stimulusVisibleSeconds * 1000.0,
            logMARLevel: stimulus.logMAR,
            stimulusHeightPoints: heightPoints,
            stimulusHeightPixels: heightPoints * configuration.pixelsPerPoint,
            stimulusHeightMillimeters: stimulus.totalHeightMillimeters,
            totalVisualAngleArcMinutes: geometry.totalAngularSizeArcMinutes,
            criticalDetailArcMinutes: geometry.marArcMinutes,
            viewingDistanceMeters: stimulus.viewingDistanceAtPresentation,
            accommodativeDemandDiopters: AccommodativeDemand.diopters(distanceMeters: stimulus.viewingDistanceAtPresentation),
            consecutiveCorrectBefore: consecutiveBefore,
            consecutiveCorrectAfter: staircase.consecutiveCorrect,
            staircaseDirectionBefore: directionBefore,
            staircaseDirectionAfter: staircase.lastMoveDirection?.rawValue ?? "",
            isReversal: update.wasReversal,
            reversalCount: staircase.reversalCount,
            validTrial: true,
            invalidReason: nil,
            repeatedAfterPause: stimulus.repeatedAfterPause,
            terminationReason: ""
        ))
        validTrialCount += 1
        nextTrialIndex += 1
        currentStimulus = nil

        if staircase.reversalCount >= configuration.reversalsToStop {
            finish(.reversalsReached, at: t)
        } else if validTrialCount >= configuration.maxValidTrials {
            finish(.maxTrialsReached, at: t)
        } else if effectiveSeconds >= configuration.effectiveLimitSeconds {
            finish(.effectiveTimeLimit, at: t)
        } else {
            presentStimulus(at: t, repeatedAfterPause: false, keepVisibleTime: false)
        }
    }

    private func recordInterruptedTrial(_ stimulus: PresentedStimulus, reason: String, at t: TimeInterval) {
        trials.append(TrialRecord(
            sessionID: sessionID,
            trialID: "\(sessionID)-\(stimulus.trialIndex)-interrupted",
            trialIndex: stimulus.trialIndex,
            timestampPresentedISO8601: isoString(forMonotonic: t - stimulusVisibleSeconds),
            timestampAnsweredISO8601: nil,
            effectiveElapsedMs: effectiveSeconds * 1000.0,
            stimulusType: "landolt_c",
            orientationTruth: stimulus.orientation,
            response: nil,
            correct: false,
            timeout: false,
            reactionTimeMs: nil,
            logMARLevel: stimulus.logMAR,
            stimulusHeightPoints: stimulus.totalHeightMillimeters * configuration.pointsPerMillimeter,
            stimulusHeightPixels: stimulus.totalHeightMillimeters * configuration.pointsPerMillimeter * configuration.pixelsPerPoint,
            stimulusHeightMillimeters: stimulus.totalHeightMillimeters,
            totalVisualAngleArcMinutes: StimulusScaler.measurement(totalHeightMillimeters: stimulus.totalHeightMillimeters, distanceMeters: stimulus.viewingDistanceAtPresentation).totalAngularSizeArcMinutes,
            criticalDetailArcMinutes: StimulusScaler.measurement(totalHeightMillimeters: stimulus.totalHeightMillimeters, distanceMeters: stimulus.viewingDistanceAtPresentation).marArcMinutes,
            viewingDistanceMeters: stimulus.viewingDistanceAtPresentation,
            accommodativeDemandDiopters: AccommodativeDemand.diopters(distanceMeters: stimulus.viewingDistanceAtPresentation),
            consecutiveCorrectBefore: staircase.consecutiveCorrect,
            consecutiveCorrectAfter: staircase.consecutiveCorrect,
            staircaseDirectionBefore: staircase.lastMoveDirection?.rawValue ?? "",
            staircaseDirectionAfter: staircase.lastMoveDirection?.rawValue ?? "",
            isReversal: false,
            reversalCount: staircase.reversalCount,
            validTrial: false,
            invalidReason: reason,
            repeatedAfterPause: stimulus.repeatedAfterPause,
            terminationReason: ""
        ))
    }

    private func finish(_ reason: TerminationReason, at t: TimeInterval) {
        if let pending = currentStimulus {
            recordInterruptedTrial(pending, reason: "interrupted_by_\(reason.rawValue)", at: t)
            currentStimulus = nil
        }

        let spread = staircase.reversalSpread(usingLastReversals: configuration.reversalsUsedForThreshold)
        let outcome: TestOutcome
        let confidence: String
        if validTrialCount < configuration.minValidTrialsForResult
            || reason == .pauseBudgetExceeded || reason == .abandoned {
            outcome = .inconclusive
            confidence = "none"
        } else if staircase.reversalCount >= configuration.reversalsToStop,
                  let spread, spread <= configuration.maxReversalSpreadForCompleted {
            outcome = .completed
            confidence = "high"
        } else if staircase.reversalCount >= configuration.reversalsToStop {
            outcome = .approximate
            confidence = "medium"
        } else {
            outcome = .approximate
            confidence = "low"
        }

        var threshold: Double?
        if outcome != .inconclusive {
            threshold = staircase.thresholdEstimate(usingLastReversals: configuration.reversalsUsedForThreshold)
                ?? staircase.currentLogMAR
        }

        let realSeconds = realStartTimestamp.map { max(0, t - $0) } ?? 0
        result = TestResult(
            outcome: outcome,
            terminationReason: reason,
            thresholdLogMAR: threshold,
            confidence: confidence,
            reversalCount: staircase.reversalCount,
            reversalSpreadLogMAR: spread,
            validTrialCount: validTrialCount,
            effectiveSeconds: effectiveSeconds,
            pausedSeconds: pausedSeconds,
            realSeconds: realSeconds
        )
        for index in trials.indices {
            trials[index].terminationReason = reason.rawValue
        }
        phase = .finished
    }

    private func isoString(forMonotonic t: TimeInterval) -> String {
        let offset = t - (firstFrameTimestamp ?? t)
        return isoFormatter.string(from: referenceDate.addingTimeInterval(offset))
    }
}
