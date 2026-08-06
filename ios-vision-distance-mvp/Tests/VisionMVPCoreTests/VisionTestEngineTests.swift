import XCTest
@testable import VisionMVPCore

/// Drives a `VisionTestEngine` with synthetic 60fps frames. All engine tests
/// and simulations share this harness so scenarios stay deterministic.
final class EngineHarness {
    let engine: VisionTestEngine
    private(set) var now: TimeInterval = 100.0 // arbitrary monotonic origin
    let frameInterval: TimeInterval = 1.0 / 60.0

    init(configuration: VisionTestConfiguration = VisionTestConfiguration(), seed: UInt64 = 42) {
        engine = VisionTestEngine(
            configuration: configuration,
            sessionID: "TEST",
            referenceDate: Date(timeIntervalSince1970: 1_700_000_000),
            seed: seed
        )
    }

    /// Feeds frames for `seconds` at 60fps with the given tracking state.
    func advance(seconds: Double, distance: Double? = 0.40, faceTracked: Bool = true, trackingNormal: Bool = true, eyesVisible: Bool = true) {
        let frames = Int((seconds / frameInterval).rounded())
        for _ in 0..<frames {
            now += frameInterval
            engine.ingest(EngineFrameInput(
                timestamp: now,
                viewingDistanceMeters: distance,
                faceTracked: faceTracked,
                trackingNormal: trackingNormal,
                eyesVisible: eyesVisible
            ))
            if engine.isFinished { return }
        }
    }

    /// Skips frame delivery entirely for `seconds` (simulates real dropped
    /// callbacks), then delivers one frame.
    func gap(seconds: Double, distance: Double? = 0.40) {
        now += seconds
        engine.ingest(EngineFrameInput(
            timestamp: now, viewingDistanceMeters: distance,
            faceTracked: true, trackingNormal: true, eyesVisible: true
        ))
    }

    /// Positions stably and waits through the countdown until the first
    /// stimulus appears.
    func startTest() {
        advance(seconds: 0.6) // stability (0.5s) -> countdown
        advance(seconds: 3.1) // countdown (3s) -> first stimulus
        precondition(engine.phase == .stimulus, "test did not start: \(engine.phase)")
    }

    /// Answers the current stimulus after `thinkSeconds` of visible time.
    func answer(correct: Bool, thinkSeconds: Double = 0.3) {
        advance(seconds: thinkSeconds)
        guard engine.phase == .stimulus, let stimulus = engine.currentStimulus else { return }
        if correct {
            engine.respond(stimulus.orientation)
        } else {
            let wrong = GapOrientation.cardinalDirections.first { $0 != stimulus.orientation }!
            engine.respond(wrong)
        }
    }
}

final class VisionTestEngineTests: XCTestCase {
    // §26.1 — tracking válido produce estado/frames válidos y el test arranca.
    func testValidTrackingStartsTestAndMarksFramesValid() {
        let harness = EngineHarness()
        harness.advance(seconds: 0.2)
        XCTAssertEqual(harness.engine.phase, .positioning)
        harness.advance(seconds: 0.4) // total 0.6 > 0.5 stability
        if case .countdown = harness.engine.phase {} else {
            XCTFail("expected countdown, got \(harness.engine.phase)")
        }
        harness.advance(seconds: 3.1)
        XCTAssertEqual(harness.engine.phase, .stimulus)
        XCTAssertNotNil(harness.engine.currentStimulus)
    }

    // §26.19 — el reloj efectivo comienza con el primer estímulo, no antes.
    func testEffectiveClockStartsAtFirstStimulus() {
        let harness = EngineHarness()
        harness.advance(seconds: 0.6)
        harness.advance(seconds: 3.1)
        XCTAssertEqual(harness.engine.phase, .stimulus)
        XCTAssertLessThan(harness.engine.effectiveSeconds, 0.2) // countdown/positioning didn't count
        harness.advance(seconds: 2.0)
        XCTAssertEqual(harness.engine.effectiveSeconds, 2.0, accuracy: 0.1)
    }

    // §26.8/§26.9 — salir del rango pausa sin reiniciar; recuperar conserva
    // nivel, aciertos y reversiones.
    func testLeavingRangePausesAndRecoveryPreservesStaircase() {
        let harness = EngineHarness()
        harness.startTest()
        harness.answer(correct: true)
        harness.answer(correct: true) // level moved down once
        let levelBefore = harness.engine.staircase.currentIndex
        let reversalsBefore = harness.engine.staircase.reversalCount
        let validBefore = harness.engine.validTrialCount

        harness.advance(seconds: 2.0, distance: 0.60) // out of range beyond 1s grace
        XCTAssertEqual(harness.engine.phase, .paused)

        harness.advance(seconds: 0.8, distance: 0.40) // recover: 0.5s stable
        XCTAssertEqual(harness.engine.phase, .stimulus)
        XCTAssertEqual(harness.engine.staircase.currentIndex, levelBefore)
        XCTAssertEqual(harness.engine.staircase.reversalCount, reversalsBefore)
        XCTAssertEqual(harness.engine.validTrialCount, validBefore)
        XCTAssertEqual(harness.engine.currentStimulus?.repeatedAfterPause, true)
    }

    // §26.16 — una pausa no registra una reversión.
    func testPauseDoesNotRegisterReversal() {
        let harness = EngineHarness()
        harness.startTest()
        let before = harness.engine.staircase.reversalCount
        harness.advance(seconds: 2.0, distance: 0.60)
        harness.advance(seconds: 0.8, distance: 0.40)
        XCTAssertEqual(harness.engine.staircase.reversalCount, before)
    }

    // §26.4 — un movimiento no deja el sistema atrapado (el bug original).
    func testSystemNeverGetsPermanentlyStuckAfterMovement() {
        let harness = EngineHarness()
        harness.startTest()
        // Rapid oscillation out and back several times.
        for _ in 0..<3 {
            harness.advance(seconds: 1.5, distance: 0.55)
            harness.advance(seconds: 0.8, distance: 0.40)
        }
        XCTAssertEqual(harness.engine.phase, .stimulus, "engine must recover to stimulus, not stay paused")
        // And trials still work after all that:
        harness.answer(correct: true)
        XCTAssertEqual(harness.engine.validTrialCount, 1)
    }

    // §26.10 — más de 15 segundos acumulados de pausa termina el test.
    func testExceedingPauseBudgetEndsInconclusive() {
        let harness = EngineHarness()
        harness.startTest()
        harness.answer(correct: true)
        harness.advance(seconds: 20.0, distance: 0.60) // stays out of range
        XCTAssertTrue(harness.engine.isFinished)
        XCTAssertEqual(harness.engine.result?.terminationReason, .pauseBudgetExceeded)
        XCTAssertEqual(harness.engine.result?.outcome, .inconclusive)
    }

    // §26.21/§26.22 — timeout a los 5s efectivos de visibilidad; la pausa no
    // consume ese tiempo.
    func testStimulusTimesOutAfterFiveVisibleSeconds() {
        let harness = EngineHarness()
        harness.startTest()
        harness.advance(seconds: 5.2)
        XCTAssertEqual(harness.engine.trials.count, 1)
        XCTAssertTrue(harness.engine.trials[0].timeout)
        XCTAssertFalse(harness.engine.trials[0].correct)
    }

    func testPausedTimeDoesNotCountTowardStimulusTimeout() {
        let harness = EngineHarness()
        harness.startTest()
        harness.advance(seconds: 3.0) // 3s visible
        harness.advance(seconds: 4.0, distance: 0.60) // paused (after 1s grace) — 1s of that was visible grace
        harness.advance(seconds: 0.8, distance: 0.40) // recover
        XCTAssertEqual(harness.engine.phase, .stimulus)
        XCTAssertTrue(harness.engine.trials.isEmpty, "no timeout should have fired during the pause")
        // Visible so far ~3 + 1(grace) + ~0.3(post-recovery) = ~4.3s; another
        // 1s crosses the 5s visible-time budget.
        harness.advance(seconds: 1.0)
        XCTAssertEqual(harness.engine.trials.count, 1)
        XCTAssertTrue(harness.engine.trials[0].timeout)
    }

    // §26.23/§26.28 — el test termina a los 60 segundos efectivos.
    func testEffectiveTimeLimitEndsTest() {
        var config = VisionTestConfiguration()
        config.stimulusTimeoutSeconds = 1000 // disable per-figure timeout for this test
        let harness = EngineHarness(configuration: config)
        harness.startTest()
        harness.advance(seconds: 61.0)
        XCTAssertTrue(harness.engine.isFinished)
        XCTAssertEqual(harness.engine.result?.terminationReason, .effectiveTimeLimit)
    }

    // §26.24 — el tiempo real nunca supera los 75 segundos.
    func testRealTimeNeverExceeds75Seconds() {
        let harness = EngineHarness()
        harness.startTest()
        // Alternate: 4s answering nothing (timeouts) + 4s out of range, repeatedly.
        for _ in 0..<12 {
            harness.advance(seconds: 4.0)
            if harness.engine.isFinished { break }
            harness.advance(seconds: 4.0, distance: 0.60)
            if harness.engine.isFinished { break }
            harness.advance(seconds: 0.8, distance: 0.40)
            if harness.engine.isFinished { break }
        }
        XCTAssertTrue(harness.engine.isFinished)
        XCTAssertLessThanOrEqual(harness.engine.result!.realSeconds, 75.5)
    }

    // §26.26 — seis reversiones terminan anticipadamente.
    func testSixReversalsEndTestEarly() {
        let harness = EngineHarness()
        harness.startTest()
        // Alternate CC / E to generate reversals quickly.
        var guardCounter = 0
        while !harness.engine.isFinished && guardCounter < 60 {
            harness.answer(correct: true)
            if harness.engine.isFinished { break }
            harness.answer(correct: true)
            if harness.engine.isFinished { break }
            harness.answer(correct: false)
            guardCounter += 1
        }
        XCTAssertTrue(harness.engine.isFinished)
        XCTAssertEqual(harness.engine.result?.terminationReason, .reversalsReached)
        XCTAssertEqual(harness.engine.result?.reversalCount, 6)
    }

    // §26.27 — veinte ensayos válidos terminan el test.
    func testTwentyValidTrialsEndTest() {
        let harness = EngineHarness()
        harness.startTest()
        // All correct: staircase only ever moves down -> no reversals.
        for _ in 0..<25 {
            harness.answer(correct: true, thinkSeconds: 0.2)
            if harness.engine.isFinished { break }
        }
        XCTAssertTrue(harness.engine.isFinished)
        XCTAssertEqual(harness.engine.result?.terminationReason, .maxTrialsReached)
        XCTAssertEqual(harness.engine.validTrialCount, 20)
    }

    // §26.29 — menos de diez ensayos válidos produce no concluyente.
    func testFewerThanTenValidTrialsIsInconclusive() {
        let harness = EngineHarness()
        harness.startTest()
        harness.answer(correct: true)
        harness.answer(correct: true)
        harness.engine.abandon()
        XCTAssertEqual(harness.engine.result?.outcome, .inconclusive)
    }

    // §26.25 — el reloj se detiene al abandonar; ingests posteriores no hacen nada.
    func testAbandonStopsEverything() {
        let harness = EngineHarness()
        harness.startTest()
        harness.answer(correct: true)
        harness.engine.abandon()
        XCTAssertTrue(harness.engine.isFinished)
        let effectiveAtEnd = harness.engine.effectiveSeconds
        let framesAfter = harness.engine.ingest(EngineFrameInput(
            timestamp: 999, viewingDistanceMeters: 0.4, faceTracked: true, trackingNormal: true, eyesVisible: true
        ))
        XCTAssertNil(framesAfter, "no frame context after finish — recording must stop (§22)")
        XCTAssertEqual(harness.engine.effectiveSeconds, effectiveAtEnd)
    }

    // §26.30/§26.34 — todos los ensayos válidos aparecen en los registros y
    // llevan el motivo de término.
    func testTrialsAreRecordedWithTerminationReason() {
        let harness = EngineHarness()
        harness.startTest()
        for _ in 0..<25 {
            harness.answer(correct: true, thinkSeconds: 0.2)
            if harness.engine.isFinished { break }
        }
        XCTAssertEqual(harness.engine.trials.filter { $0.validTrial }.count, 20)
        XCTAssertTrue(harness.engine.trials.allSatisfy { $0.terminationReason == "max_trials_reached" })
        XCTAssertTrue(harness.engine.trials.allSatisfy { $0.sessionID == "TEST" })
    }

    // §26.20 — el reloj efectivo se pausa durante pérdida técnica.
    func testEffectiveClockPausesDuringTechnicalLoss() {
        let harness = EngineHarness()
        harness.startTest()
        harness.advance(seconds: 2.0)
        let effectiveBefore = harness.engine.effectiveSeconds
        harness.advance(seconds: 3.0, faceTracked: false) // face lost: grace 1s (counts) then paused
        harness.advance(seconds: 0.8, distance: 0.40)
        let effectiveAfter = harness.engine.effectiveSeconds
        // Only the ~1s grace + recovery ~0.8s should have counted, not the ~2s pause.
        XCTAssertLessThan(effectiveAfter - effectiveBefore, 2.2)
    }

    // Real dropped-callback gaps go to the pause budget, not effective time.
    func testRealFrameGapDoesNotConsumeEffectiveTime() {
        let harness = EngineHarness()
        harness.startTest()
        harness.advance(seconds: 1.0)
        let effectiveBefore = harness.engine.effectiveSeconds
        let pausedBefore = harness.engine.pausedSeconds
        harness.gap(seconds: 2.0) // 2s with no callbacks at all
        XCTAssertEqual(harness.engine.effectiveSeconds, effectiveBefore, accuracy: 0.1)
        XCTAssertEqual(harness.engine.pausedSeconds, pausedBefore + 2.0, accuracy: 0.1)
    }
}
