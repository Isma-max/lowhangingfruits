import Foundation

/// Deterministic, rule-based explanation codes (encargo §5): the result
/// screen maps these to human sentences — it never invents a cause.
public enum ExplanationCode: String, CaseIterable, Sendable {
    case consistentMeasurement = "consistent_measurement"
    case fewReversals = "few_reversals"
    case highReversalSpread = "high_reversal_spread"
    case distanceVariability = "distance_variability"
    case slowResponses = "slow_responses"
    case timeLimitBeforeConvergence = "time_limit_before_convergence"
    case responseVariability = "response_variability"
    case insufficientValidTrials = "insufficient_valid_trials"
    case pauseBudgetExceeded = "pause_budget_exceeded"
    case abandonedByUser = "abandoned_by_user"
}

public enum ExplanationCodeEngine {
    /// Thresholds are fixed constants so the same inputs always produce the
    /// same codes (versioned implicitly by `InstrumentVersions.algorithmVersion`).
    public static func codes(
        result: TestResult,
        timeoutCount: Int,
        medianReactionTimeMs: Double?,
        percentFramesInsideRange: Double?,
        minValidTrialsForResult: Int = 10,
        reversalsTarget: Int = 6
    ) -> [ExplanationCode] {
        switch result.terminationReason {
        case .abandoned:
            return [.abandonedByUser]
        case .pauseBudgetExceeded:
            var codes: [ExplanationCode] = [.pauseBudgetExceeded]
            if let inside = percentFramesInsideRange, inside < 90 { codes.append(.distanceVariability) }
            return codes
        default:
            break
        }

        if result.outcome == .completed {
            return [.consistentMeasurement]
        }

        var codes: [ExplanationCode] = []
        if result.validTrialCount < minValidTrialsForResult {
            codes.append(.insufficientValidTrials)
        }
        if result.reversalCount < reversalsTarget {
            codes.append(.fewReversals)
        }
        if let spread = result.reversalSpreadLogMAR, spread > 0.15 {
            codes.append(.highReversalSpread)
        }
        if let inside = percentFramesInsideRange, inside < 90 {
            codes.append(.distanceVariability)
        }
        if timeoutCount >= 3 || (medianReactionTimeMs ?? 0) > 2500 {
            codes.append(.slowResponses)
        }
        if result.terminationReason == .effectiveTimeLimit || result.terminationReason == .realTimeLimit {
            codes.append(.timeLimitBeforeConvergence)
        }
        if codes.isEmpty {
            codes.append(.responseVariability)
        }
        return codes
    }
}

/// App/device context for the summary; injected so the builder stays pure.
public struct SummaryMetadata: Sendable {
    public var appVersion: String
    public var buildNumber: String
    public var deviceModel: String
    public var systemVersion: String

    public init(appVersion: String, buildNumber: String, deviceModel: String, systemVersion: String) {
        self.appVersion = appVersion
        self.buildNumber = buildNumber
        self.deviceModel = deviceModel
        self.systemVersion = systemVersion
    }
}

/// Builds `session_summary.json` from the engine's outputs. Every number
/// shown on the result screen comes from this same struct, so the UI can
/// never disagree with the exported data (encargo §6).
public enum SummaryBuilder {
    public static func build(
        sessionID: String,
        participantID: String,
        result: TestResult,
        trials: [TrialRecord],
        frames: [TestFrameRecord],
        startedAt: Date,
        completedAt: Date,
        metadata: SummaryMetadata
    ) -> SessionSummary {
        let validTrials = trials.filter { $0.validTrial }
        let corrects = validTrials.filter { $0.correct }.count
        let timeouts = validTrials.filter { $0.timeout }.count
        let incorrects = validTrials.count - corrects - timeouts
        let reactionTimes = validTrials.compactMap { $0.reactionTimeMs }
        let stimulusFrames = frames.filter { $0.testState == "stimulus" }
        let distances = stimulusFrames.compactMap { $0.viewingDistanceMeters }
        let insideCount = stimulusFrames.filter { $0.insideDistanceRange }.count
        let validFrames = frames.filter { $0.valid }.count
        let percentInside: Double? = stimulusFrames.isEmpty ? nil : Double(insideCount) / Double(stimulusFrames.count) * 100

        let sessionStatus: String
        switch result.terminationReason {
        case .abandoned: sessionStatus = "abandoned"
        case .pauseBudgetExceeded: sessionStatus = "technical_interruption"
        default: sessionStatus = result.outcome.rawValue
        }

        let quality: String
        switch result.outcome {
        case .completed: quality = "consistent"
        case .approximate: quality = "approximate"
        case .inconclusive: quality = "inconclusive"
        }

        let medianRT = StatMath.median(reactionTimes)
        let explanationCodes = ExplanationCodeEngine.codes(
            result: result,
            timeoutCount: timeouts,
            medianReactionTimeMs: medianRT,
            percentFramesInsideRange: percentInside
        ).map { $0.rawValue }

        let correctValid = validTrials.filter { $0.correct }
        let bestLogmar = correctValid.map { $0.logMARLevel }.min()
        let bestHeight = correctValid.map { $0.stimulusHeightMillimeters }.min()
        let bestDetail = correctValid.map { $0.criticalDetailArcMinutes }.min()

        return SessionSummary(
            sessionID: sessionID,
            participantID: participantID,
            startedAt: startedAt,
            completedAt: completedAt,
            wallDurationMs: completedAt.timeIntervalSince(startedAt) * 1000,
            effectiveDurationMs: result.effectiveSeconds * 1000,
            sessionStatus: sessionStatus,
            qualityClassification: quality,
            terminationReason: result.terminationReason.rawValue,
            explanationCodes: explanationCodes,
            validTrialCount: validTrials.count,
            invalidTrialCount: trials.count - validTrials.count,
            correctCount: corrects,
            incorrectCount: incorrects,
            timeoutCount: timeouts,
            accuracy: validTrials.isEmpty ? nil : Double(corrects) / Double(validTrials.count),
            medianReactionTimeMs: medianRT,
            medianViewingDistanceM: StatMath.median(distances),
            distanceStandardDeviationM: StatMath.standardDeviation(distances),
            percentFramesInsideRange: percentInside,
            validFrameRatio: frames.isEmpty ? nil : Double(validFrames) / Double(frames.count),
            reversalCount: result.reversalCount,
            reversalSpreadLogmar: result.reversalSpreadLogMAR,
            estimatedThresholdLogmar: result.thresholdLogMAR,
            thresholdConfidence: result.confidence,
            bestCorrectLogmar: bestLogmar,
            bestCorrectHeightMm: bestHeight,
            bestCorrectDetailArcmin: bestDetail,
            appVersion: metadata.appVersion,
            buildNumber: metadata.buildNumber,
            deviceModel: metadata.deviceModel,
            systemVersion: metadata.systemVersion
        )
    }
}

/// README.txt for the export package (encargo §10).
public enum ExportReadme {
    public static func text(summary: SessionSummary) -> String {
        let formatter = ISO8601DateFormatter()
        return """
        TEST DE VISIÓN CERCANA — PAQUETE DE DATOS EXPERIMENTAL
        =======================================================

        ID de sesión: \(summary.sessionID)
        Participante: \(summary.participantID)
        Fecha: \(formatter.string(from: summary.startedAt))
        Versión de la app: \(summary.appVersion) (build \(summary.buildNumber))
        Versión del protocolo: \(summary.protocolVersion)
        Versión del algoritmo: \(summary.algorithmVersion)
        Versión del esquema de datos: \(summary.schemaVersion)
        Dispositivo: \(summary.deviceModel), iOS \(summary.systemVersion)

        ARCHIVOS
        --------
        session_summary.json  Resumen de la sesión: estado, calidad, umbral
                              estimado, conteos y estadísticas. Los valores
                              faltantes aparecen como null, nunca como cero.
        vision_trials.csv     Un renglón por figura presentada: nivel logMAR,
                              tamaños físico/angular, respuesta, tiempo de
                              reacción y estado de la escalera adaptativa.
        distance_frames.csv   Un renglón por frame de tracking: distancia
                              óptica, pose, calidad y estado del test.
        session_complete.json Manifiesto interno de guardado (puede ignorarse
                              para el análisis).

        UNIDADES PRINCIPALES
        --------------------
        Distancias: metros (m). Tamaños de estímulo: milímetros (mm), puntos
        y píxeles de pantalla. Ángulos visuales: minutos de arco (arcmin).
        Agudeza: logMAR. Demanda acomodativa: dioptrías (D = 1/distancia_m).
        Tiempos: milisegundos (ms). Timestamps: ISO 8601. Decimales con punto.

        AVISO
        -----
        Este es un prototipo experimental de investigación. Sus resultados
        son una estimación orientativa: no constituyen un diagnóstico, no
        generan una receta y no reemplazan una evaluación oftalmológica u
        optométrica profesional.
        """
    }
}
