import XCTest
@testable import VisionMVPCore

/// Encargo §27: simulaciones deterministas de usuarios completos. Cada una
/// debe demostrar que el test TERMINA y con qué motivo — la garantía central
/// de esta iteración ("nunca continuar indefinidamente").
final class EngineSimulationTests: XCTestCase {
    /// Runs a whole session with an answer policy; returns the result.
    /// `answerPolicy` receives the stimulus and the valid-trial index and
    /// returns the response (nil = let it time out).
    private func simulate(
        seed: UInt64 = 7,
        thinkSeconds: Double = 0.4,
        maxWallSeconds: Double = 300,
        distanceProfile: ((TimeInterval) -> Double?)? = nil,
        answerPolicy: (PresentedStimulus, Int) -> GapOrientation?
    ) -> TestResult {
        let harness = EngineHarness(seed: seed)
        var answered = 0

        harness.startTestWithProfile(distanceProfile)

        var guardTime = 0.0
        while !harness.engine.isFinished && guardTime < maxWallSeconds {
            harness.advanceWithProfile(seconds: harness.frameInterval * 6, profile: distanceProfile)
            guardTime += harness.frameInterval * 6
            if harness.engine.phase == .stimulus, let stimulus = harness.engine.currentStimulus {
                harness.advanceWithProfile(seconds: thinkSeconds, profile: distanceProfile)
                guardTime += thinkSeconds
                if harness.engine.phase == .stimulus, let current = harness.engine.currentStimulus, current == stimulus {
                    if let response = answerPolicy(current, answered) {
                        harness.engine.respond(response)
                        answered += 1
                    }
                }
            }
        }

        XCTAssertTrue(harness.engine.isFinished, "simulation must terminate (guard: \(guardTime)s) — \(harness.engine.notFinishedBecause)")
        return harness.engine.result!
    }

    private func wrongAnswer(for stimulus: PresentedStimulus) -> GapOrientation {
        GapOrientation.cardinalDirections.first { $0 != stimulus.orientation }!
    }

    // Usuario que responde todo correctamente.
    func testAllCorrectUserTerminates() {
        let result = simulate { stimulus, _ in stimulus.orientation }
        XCTAssertEqual(result.terminationReason, .maxTrialsReached) // no reversals ever
        XCTAssertEqual(result.validTrialCount, 20)
    }

    // Usuario que converge en un umbral (ve bien hasta 0.3 logMAR, falla más abajo).
    func testThresholdUserConvergesAndCompletes() {
        let result = simulate { stimulus, _ in
            stimulus.logMAR >= 0.3 ? stimulus.orientation : self.wrongAnswer(for: stimulus)
        }
        XCTAssertEqual(result.terminationReason, .reversalsReached)
        XCTAssertEqual(result.outcome, .completed)
        // Threshold should land near the 0.3/0.4 boundary.
        XCTAssertNotNil(result.thresholdLogMAR)
        XCTAssertEqual(result.thresholdLogMAR!, 0.35, accuracy: 0.15)
    }

    // Usuario con respuestas inconsistentes.
    func testInconsistentUserStillTerminates() {
        var flip = false
        let result = simulate { _, _ in
            flip.toggle()
            return flip ? GapOrientation.up : GapOrientation.down
        }
        // Must end by one of the explicit criteria, never run forever.
        XCTAssertTrue([.reversalsReached, .maxTrialsReached, .effectiveTimeLimit].contains(result.terminationReason))
    }

    // Usuario que responde al azar (con RNG sembrado).
    func testRandomUserTerminates() {
        var rng = SplitMix64(seed: 99)
        let result = simulate { _, _ in
            GapOrientation.cardinalDirections.randomElement(using: &rng)
        }
        XCTAssertTrue([.reversalsReached, .maxTrialsReached, .effectiveTimeLimit].contains(result.terminationReason))
    }

    // Usuario que demora más de cinco segundos: puros timeouts.
    func testSlowUserTimesOutAndTerminates() {
        let result = simulate(thinkSeconds: 0.1) { _, _ in nil } // never answers
        // Timeouts count as errors; staircase climbs to the top and stays ->
        // no reversals -> ends by trials or effective time.
        XCTAssertTrue([.maxTrialsReached, .effectiveTimeLimit].contains(result.terminationReason))
    }

    // Usuario que sale momentáneamente del rango una vez.
    func testBriefRangeExitRecoversAndTerminates() {
        // Out of range between t=+8s and t=+10s after start, otherwise 40cm.
        let profile: (TimeInterval) -> Double? = { t in (t > 108 && t < 110) ? 0.60 : 0.40 }
        let result = simulate(distanceProfile: profile) { stimulus, _ in stimulus.orientation }
        XCTAssertTrue(result.pausedSeconds < 15)
        XCTAssertEqual(result.terminationReason, .maxTrialsReached)
    }

    // Usuario que sale repetidamente del rango: agota el presupuesto de pausa.
    func testRepeatedRangeExitsEndInconclusiveByPauseBudget() {
        // Starts fine (test begins), then cycles 4s out / 1s in from t=+8s —
        // pauses pile up ~3.5-4s per cycle until the 15s budget runs out.
        let profile: (TimeInterval) -> Double? = { t in
            guard t > 108 else { return 0.40 }
            let cycle = (t - 108).truncatingRemainder(dividingBy: 5.0)
            return cycle < 4.0 ? 0.60 : 0.40
        }
        let result = simulate(distanceProfile: profile) { stimulus, _ in stimulus.orientation }
        XCTAssertEqual(result.terminationReason, .pauseBudgetExceeded)
        XCTAssertEqual(result.outcome, .inconclusive)
    }

    // Pérdida breve del rostro.
    func testBriefFaceLossRecovers() {
        let profile: (TimeInterval) -> Double? = { t in (t > 106 && t < 107) ? nil : 0.40 }
        let result = simulate(distanceProfile: profile) { stimulus, _ in stimulus.orientation }
        XCTAssertEqual(result.terminationReason, .maxTrialsReached)
    }

    // Pérdida persistente del rostro: termina por presupuesto de pausa.
    func testPersistentFaceLossEndsInconclusive() {
        let profile: (TimeInterval) -> Double? = { t in t > 106 ? nil : 0.40 }
        let result = simulate(distanceProfile: profile) { stimulus, _ in stimulus.orientation }
        XCTAssertEqual(result.terminationReason, .pauseBudgetExceeded)
        XCTAssertEqual(result.outcome, .inconclusive)
    }

    // Movimiento rápido seguido de recuperación.
    func testFastMovementThenRecoveryTerminatesNormally() {
        let profile: (TimeInterval) -> Double? = { t in
            if t > 105 && t < 105.7 { return 0.40 + 0.08 * sin((t - 105) * 40) } // violent shake
            return 0.40
        }
        let result = simulate(distanceProfile: profile) { stimulus, _ in stimulus.orientation }
        XCTAssertTrue([.maxTrialsReached, .reversalsReached].contains(result.terminationReason))
    }
}

// MARK: - Harness extensions for distance profiles

extension EngineHarness {
    func advanceWithProfile(seconds: Double, profile: ((TimeInterval) -> Double?)?) {
        guard let profile else {
            advance(seconds: seconds)
            return
        }
        let frames = Int((seconds / frameInterval).rounded())
        for _ in 0..<frames {
            let distance = profile(nowValue + frameInterval)
            step(distance: distance)
            if engine.isFinished { return }
        }
    }

    func startTestWithProfile(_ profile: ((TimeInterval) -> Double?)?) {
        // Position + countdown under the profile (profiles are all in-range
        // at the start by construction).
        advanceWithProfile(seconds: 0.6, profile: profile)
        advanceWithProfile(seconds: 3.1, profile: profile)
    }

    var nowValue: TimeInterval { now }

    func step(distance: Double?) {
        advance(seconds: frameInterval, distance: distance, faceTracked: distance != nil, trackingNormal: true, eyesVisible: distance != nil)
    }
}
