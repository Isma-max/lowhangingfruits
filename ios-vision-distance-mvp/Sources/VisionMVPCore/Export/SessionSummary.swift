import Foundation

/// `session_summary.json`, schema v2 (encargo §14). Snake_case keys match
/// the spec exactly. Missing values are encoded as explicit JSON `null`,
/// never as zero — the custom `encode(to:)` below uses `encode` (which
/// writes null for nil optionals) instead of the synthesized
/// `encodeIfPresent` (which would omit the key entirely).
public struct SessionSummary: Codable, Sendable, Equatable {
    public var schemaVersion: String
    public var sessionID: String
    public var participantID: String
    public var startedAt: Date
    public var completedAt: Date
    public var wallDurationMs: Double
    public var effectiveDurationMs: Double
    /// completed | approximate | inconclusive | abandoned | technical_interruption
    public var sessionStatus: String
    /// consistent | approximate | inconclusive
    public var qualityClassification: String
    public var terminationReason: String
    public var explanationCodes: [String]
    public var validTrialCount: Int
    public var invalidTrialCount: Int
    public var correctCount: Int
    public var incorrectCount: Int
    public var timeoutCount: Int
    public var accuracy: Double?
    public var medianReactionTimeMs: Double?
    public var medianViewingDistanceM: Double?
    public var distanceStandardDeviationM: Double?
    public var percentFramesInsideRange: Double?
    public var validFrameRatio: Double?
    public var reversalCount: Int
    public var reversalSpreadLogmar: Double?
    public var estimatedThresholdLogmar: Double?
    public var thresholdConfidence: String
    /// Smallest logMAR level with at least one correct valid response, and
    /// its physical/angular size — the "nivel visual alcanzado" shown in the
    /// experimental result section.
    public var bestCorrectLogmar: Double?
    public var bestCorrectHeightMm: Double?
    public var bestCorrectDetailArcmin: Double?
    public var appVersion: String
    public var buildNumber: String
    public var protocolVersion: String
    public var algorithmVersion: String
    public var deviceModel: String
    public var systemVersion: String

    public init(
        schemaVersion: String = InstrumentVersions.exportSchemaVersion,
        sessionID: String,
        participantID: String,
        startedAt: Date,
        completedAt: Date,
        wallDurationMs: Double,
        effectiveDurationMs: Double,
        sessionStatus: String,
        qualityClassification: String,
        terminationReason: String,
        explanationCodes: [String],
        validTrialCount: Int,
        invalidTrialCount: Int,
        correctCount: Int,
        incorrectCount: Int,
        timeoutCount: Int,
        accuracy: Double?,
        medianReactionTimeMs: Double?,
        medianViewingDistanceM: Double?,
        distanceStandardDeviationM: Double?,
        percentFramesInsideRange: Double?,
        validFrameRatio: Double?,
        reversalCount: Int,
        reversalSpreadLogmar: Double?,
        estimatedThresholdLogmar: Double?,
        thresholdConfidence: String,
        bestCorrectLogmar: Double?,
        bestCorrectHeightMm: Double?,
        bestCorrectDetailArcmin: Double?,
        appVersion: String,
        buildNumber: String,
        protocolVersion: String = InstrumentVersions.protocolVersion,
        algorithmVersion: String = InstrumentVersions.algorithmVersion,
        deviceModel: String,
        systemVersion: String
    ) {
        self.schemaVersion = schemaVersion
        self.sessionID = sessionID
        self.participantID = participantID
        self.startedAt = startedAt
        self.completedAt = completedAt
        self.wallDurationMs = wallDurationMs
        self.effectiveDurationMs = effectiveDurationMs
        self.sessionStatus = sessionStatus
        self.qualityClassification = qualityClassification
        self.terminationReason = terminationReason
        self.explanationCodes = explanationCodes
        self.validTrialCount = validTrialCount
        self.invalidTrialCount = invalidTrialCount
        self.correctCount = correctCount
        self.incorrectCount = incorrectCount
        self.timeoutCount = timeoutCount
        self.accuracy = accuracy
        self.medianReactionTimeMs = medianReactionTimeMs
        self.medianViewingDistanceM = medianViewingDistanceM
        self.distanceStandardDeviationM = distanceStandardDeviationM
        self.percentFramesInsideRange = percentFramesInsideRange
        self.validFrameRatio = validFrameRatio
        self.reversalCount = reversalCount
        self.reversalSpreadLogmar = reversalSpreadLogmar
        self.estimatedThresholdLogmar = estimatedThresholdLogmar
        self.thresholdConfidence = thresholdConfidence
        self.bestCorrectLogmar = bestCorrectLogmar
        self.bestCorrectHeightMm = bestCorrectHeightMm
        self.bestCorrectDetailArcmin = bestCorrectDetailArcmin
        self.appVersion = appVersion
        self.buildNumber = buildNumber
        self.protocolVersion = protocolVersion
        self.algorithmVersion = algorithmVersion
        self.deviceModel = deviceModel
        self.systemVersion = systemVersion
    }

    enum CodingKeys: String, CodingKey {
        case schemaVersion = "schema_version"
        case sessionID = "session_id"
        case participantID = "participant_id"
        case startedAt = "started_at"
        case completedAt = "completed_at"
        case wallDurationMs = "wall_duration_ms"
        case effectiveDurationMs = "effective_duration_ms"
        case sessionStatus = "session_status"
        case qualityClassification = "quality_classification"
        case terminationReason = "termination_reason"
        case explanationCodes = "explanation_codes"
        case validTrialCount = "valid_trial_count"
        case invalidTrialCount = "invalid_trial_count"
        case correctCount = "correct_count"
        case incorrectCount = "incorrect_count"
        case timeoutCount = "timeout_count"
        case accuracy
        case medianReactionTimeMs = "median_reaction_time_ms"
        case medianViewingDistanceM = "median_viewing_distance_m"
        case distanceStandardDeviationM = "distance_standard_deviation_m"
        case percentFramesInsideRange = "percent_frames_inside_range"
        case validFrameRatio = "valid_frame_ratio"
        case reversalCount = "reversal_count"
        case reversalSpreadLogmar = "reversal_spread_logmar"
        case estimatedThresholdLogmar = "estimated_threshold_logmar"
        case thresholdConfidence = "threshold_confidence"
        case bestCorrectLogmar = "best_correct_logmar"
        case bestCorrectHeightMm = "best_correct_height_mm"
        case bestCorrectDetailArcmin = "best_correct_detail_arcmin"
        case appVersion = "app_version"
        case buildNumber = "build_number"
        case protocolVersion = "protocol_version"
        case algorithmVersion = "algorithm_version"
        case deviceModel = "device_model"
        case systemVersion = "system_version"
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(schemaVersion, forKey: .schemaVersion)
        try container.encode(sessionID, forKey: .sessionID)
        try container.encode(participantID, forKey: .participantID)
        try container.encode(startedAt, forKey: .startedAt)
        try container.encode(completedAt, forKey: .completedAt)
        try container.encode(wallDurationMs, forKey: .wallDurationMs)
        try container.encode(effectiveDurationMs, forKey: .effectiveDurationMs)
        try container.encode(sessionStatus, forKey: .sessionStatus)
        try container.encode(qualityClassification, forKey: .qualityClassification)
        try container.encode(terminationReason, forKey: .terminationReason)
        try container.encode(explanationCodes, forKey: .explanationCodes)
        try container.encode(validTrialCount, forKey: .validTrialCount)
        try container.encode(invalidTrialCount, forKey: .invalidTrialCount)
        try container.encode(correctCount, forKey: .correctCount)
        try container.encode(incorrectCount, forKey: .incorrectCount)
        try container.encode(timeoutCount, forKey: .timeoutCount)
        // Optionals via `encode` (not `encodeIfPresent`): nil -> explicit null.
        try container.encode(accuracy, forKey: .accuracy)
        try container.encode(medianReactionTimeMs, forKey: .medianReactionTimeMs)
        try container.encode(medianViewingDistanceM, forKey: .medianViewingDistanceM)
        try container.encode(distanceStandardDeviationM, forKey: .distanceStandardDeviationM)
        try container.encode(percentFramesInsideRange, forKey: .percentFramesInsideRange)
        try container.encode(validFrameRatio, forKey: .validFrameRatio)
        try container.encode(reversalCount, forKey: .reversalCount)
        try container.encode(reversalSpreadLogmar, forKey: .reversalSpreadLogmar)
        try container.encode(estimatedThresholdLogmar, forKey: .estimatedThresholdLogmar)
        try container.encode(thresholdConfidence, forKey: .thresholdConfidence)
        try container.encode(bestCorrectLogmar, forKey: .bestCorrectLogmar)
        try container.encode(bestCorrectHeightMm, forKey: .bestCorrectHeightMm)
        try container.encode(bestCorrectDetailArcmin, forKey: .bestCorrectDetailArcmin)
        try container.encode(appVersion, forKey: .appVersion)
        try container.encode(buildNumber, forKey: .buildNumber)
        try container.encode(protocolVersion, forKey: .protocolVersion)
        try container.encode(algorithmVersion, forKey: .algorithmVersion)
        try container.encode(deviceModel, forKey: .deviceModel)
        try container.encode(systemVersion, forKey: .systemVersion)
    }
}
