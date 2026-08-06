import XCTest
@testable import VisionMVPCore

/// Encargo §26, bloque "Escalera" (11-18) + §17 niveles.
final class LevelStaircaseTests: XCTestCase {
    private func makeStaircase(startIndex: Int = 2) -> LevelStaircase {
        LevelStaircase(levels: StimulusLevels.defaultLogMARLevels, startIndex: startIndex)
    }

    // §26.11 — un acierto no cambia el nivel.
    func testSingleCorrectDoesNotChangeLevel() {
        var staircase = makeStaircase()
        let update = staircase.record(correct: true)
        XCTAssertFalse(update.moved)
        XCTAssertEqual(staircase.currentLogMAR, 0.6, accuracy: 1e-9)
        XCTAssertEqual(staircase.consecutiveCorrect, 1)
    }

    // §26.12 — dos aciertos consecutivos bajan exactamente un nivel.
    func testTwoConsecutiveCorrectsMoveDownExactlyOneLevel() {
        var staircase = makeStaircase()
        staircase.record(correct: true)
        let update = staircase.record(correct: true)
        XCTAssertTrue(update.moved)
        XCTAssertEqual(update.direction, .down)
        XCTAssertEqual(staircase.currentLogMAR, 0.5, accuracy: 1e-9) // 0.6 -> 0.5, one level only
        XCTAssertEqual(staircase.consecutiveCorrect, 0)
    }

    // §26.13 — un error sube exactamente un nivel.
    func testSingleErrorMovesUpExactlyOneLevel() {
        var staircase = makeStaircase()
        let update = staircase.record(correct: false)
        XCTAssertTrue(update.moved)
        XCTAssertEqual(update.direction, .up)
        XCTAssertEqual(staircase.currentLogMAR, 0.7, accuracy: 1e-9) // 0.6 -> 0.7
    }

    // §26.14 — un error reinicia el contador de aciertos consecutivos.
    func testErrorResetsConsecutiveCorrectCounter() {
        var staircase = makeStaircase()
        staircase.record(correct: true)
        XCTAssertEqual(staircase.consecutiveCorrect, 1)
        staircase.record(correct: false)
        XCTAssertEqual(staircase.consecutiveCorrect, 0)
        // The next single correct must not move the staircase.
        let update = staircase.record(correct: true)
        XCTAssertFalse(update.moved)
    }

    // §26.15 — un cambio de dirección registra una reversión.
    func testDirectionChangeRegistersReversal() {
        var staircase = makeStaircase()
        staircase.record(correct: true)
        staircase.record(correct: true) // move down (0.6 -> 0.5), first move: no reversal
        XCTAssertEqual(staircase.reversalCount, 0)
        let update = staircase.record(correct: false) // move up: direction change -> reversal at 0.5
        XCTAssertTrue(update.wasReversal)
        XCTAssertEqual(staircase.reversalCount, 1)
        XCTAssertEqual(staircase.reversalValues.first!, 0.5, accuracy: 1e-9)
    }

    // §26.18 — los límites superior e inferior se respetan.
    func testBoundsAreRespected() {
        var atTop = makeStaircase(startIndex: 0) // 0.8, easiest
        atTop.record(correct: false) // would go easier; clamps at 0.8
        XCTAssertEqual(atTop.currentLogMAR, 0.8, accuracy: 1e-9)

        var atBottom = makeStaircase(startIndex: StimulusLevels.defaultLogMARLevels.count - 1) // -0.2
        atBottom.record(correct: true)
        atBottom.record(correct: true) // would go harder; clamps at -0.2
        XCTAssertEqual(atBottom.currentLogMAR, -0.2, accuracy: 1e-9)
    }

    // §17 — nunca más de un nivel por actualización, secuencia trazada a mano.
    func testHandTracedSequenceMovesOneLevelAtATime() {
        var staircase = makeStaircase() // 0.6
        var previousIndex = staircase.currentIndex
        let responses: [Bool] = [true, true, true, true, false, true, true, false, false]
        for correct in responses {
            staircase.record(correct: correct)
            XCTAssertLessThanOrEqual(abs(staircase.currentIndex - previousIndex), 1, "moved more than one level")
            previousIndex = staircase.currentIndex
        }
        // Trace: CC->0.5, CC->0.4, E->0.5(rev@0.4), CC->0.4(rev@0.5), E->0.5(rev@0.4), E->0.6
        XCTAssertEqual(staircase.currentLogMAR, 0.6, accuracy: 1e-9)
        XCTAssertEqual(staircase.reversalCount, 3)
    }

    func testThresholdEstimateAveragesLastReversals() {
        var staircase = makeStaircase()
        // Build reversals: down, up, down, up...
        staircase.record(correct: true); staircase.record(correct: true) // -> 0.5
        staircase.record(correct: false) // rev @0.5 -> 0.6
        staircase.record(correct: true); staircase.record(correct: true) // rev @0.6 -> 0.5
        staircase.record(correct: false) // rev @0.5 -> 0.6
        XCTAssertEqual(staircase.reversalCount, 3)
        let estimate = staircase.thresholdEstimate(usingLastReversals: 2)
        XCTAssertEqual(estimate!, (0.6 + 0.5) / 2, accuracy: 1e-9)
    }

    // §26.32 — sólo existen cuatro orientaciones en el set del test.
    func testCardinalDirectionsAreExactlyFour() {
        XCTAssertEqual(GapOrientation.cardinalDirections.count, 4)
        XCTAssertEqual(Set(GapOrientation.cardinalDirections), Set([.up, .down, .left, .right]))
    }

    // §26.31 (parte pura) — cambiar de nivel cambia realmente el tamaño físico.
    func testLevelChangeChangesRenderedSize() {
        let distance = 0.40
        let sizes = StimulusLevels.defaultLogMARLevels.map {
            StimulusLevels.totalHeightMillimeters(logMAR: $0, viewingDistanceMeters: distance)
        }
        // Strictly decreasing from easiest to hardest, ~ x10^0.1 per step.
        for index in 1..<sizes.count {
            XCTAssertLessThan(sizes[index], sizes[index - 1])
            let ratio = sizes[index - 1] / sizes[index]
            XCTAssertEqual(ratio, pow(10, 0.1), accuracy: 0.01)
        }
    }

    // §26.33 — la geometría 5x5 se mantiene: el detalle crítico de la altura
    // presentada en un nivel es exactamente 10^logMAR arcmin.
    func testLevelHeightYieldsExactMARAtDistance() {
        let distance = 0.40
        for logMAR in StimulusLevels.defaultLogMARLevels {
            let height = StimulusLevels.totalHeightMillimeters(logMAR: logMAR, viewingDistanceMeters: distance)
            let measurement = StimulusScaler.measurement(totalHeightMillimeters: height, distanceMeters: distance)
            XCTAssertEqual(measurement.marArcMinutes, VisualAcuityMath.marArcMinutes(logMAR: logMAR), accuracy: 0.01)
            XCTAssertEqual(measurement.criticalDetailMillimeters * 5, measurement.totalHeightMillimeters, accuracy: 1e-9)
        }
    }
}
