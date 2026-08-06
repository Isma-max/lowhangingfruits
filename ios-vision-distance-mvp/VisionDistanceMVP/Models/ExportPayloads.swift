import Foundation
import VisionMVPCore

/// `participant.json` — no personal identifiers, matches brief Pantalla 4 fields.
struct ParticipantExportPayload: Codable {
    var pseudonymousID: String
    var ageBand: String
    var dominantHand: String?
    var habitualGlassesUse: Bool
    var glassesType: String
    var testsWithGlasses: Bool
    /// Month precision only ("yyyy-MM"), matching the brief's "fecha
    /// aproximada" — never the exact day.
    var lastPrescriptionApproxDate: String?
    var nearReadingDifficulty0to10: Int
    var focusFatigue0to10: Int

    init(participant: Participant) {
        pseudonymousID = participant.pseudonymousID
        ageBand = participant.ageBandRaw
        dominantHand = participant.dominantHandRaw
        habitualGlassesUse = participant.habitualGlassesUse
        glassesType = participant.glassesTypeRaw
        testsWithGlasses = participant.testsWithGlasses
        if let date = participant.lastPrescriptionApproxDate {
            let formatter = DateFormatter()
            formatter.dateFormat = "yyyy-MM"
            formatter.timeZone = TimeZone(identifier: "UTC")
            lastPrescriptionApproxDate = formatter.string(from: date)
        } else {
            lastPrescriptionApproxDate = nil
        }
        nearReadingDifficulty0to10 = participant.nearReadingDifficulty0to10
        focusFatigue0to10 = participant.focusFatigue0to10
    }
}

/// `session.json` — device capabilities, consent/alarm outcome, and
/// environment readings, each tagged with its source/unit so nothing is
/// presented with false precision (brief section 6, Pantalla 5).
struct SessionExportPayload: Codable {
    struct EnvironmentPayload: Codable {
        var systemBrightness0to1: Double?
        var systemBrightnessSource = "UIScreen.main.brightness"
        var autoBrightnessStateKnown: Bool
        var ambientLightProxyValue: Double?
        var ambientLightProxyUnit = "relative_uncalibrated_proxy_from_camera_iso_exposure"
        var deviceTiltDegrees: Double?
        var deviceTiltSource = "CoreMotion.deviceMotion.attitude"
    }

    var sessionID: String
    var participantPseudonymousID: String?
    var createdAt: Date
    var appVersion: String
    var deviceModelIdentifier: String
    var iosVersion: String
    var hasTrueDepth: Bool
    var hasKnownScreenGeometry: Bool
    var cameraAuthorizationStatus: String
    var wasPortraitOrientation: Bool
    var consentAccepted: Bool
    var alarmPresent: Bool
    var excluded: Bool
    var environment: EnvironmentPayload
    var qualityThresholds: QualityThresholds?

    init(session: SessionRecord) {
        sessionID = session.id.uuidString
        participantPseudonymousID = session.participant?.pseudonymousID
        createdAt = session.createdAt
        appVersion = session.appVersion
        deviceModelIdentifier = session.deviceModelIdentifier
        iosVersion = session.iosVersion
        hasTrueDepth = session.hasTrueDepth
        hasKnownScreenGeometry = session.hasKnownScreenGeometry
        cameraAuthorizationStatus = session.cameraAuthorizationStatusRaw
        wasPortraitOrientation = session.wasPortraitOrientation
        consentAccepted = session.consentAccepted
        alarmPresent = session.alarmPresent
        excluded = session.excluded
        environment = EnvironmentPayload(
            systemBrightness0to1: session.systemBrightness0to1,
            autoBrightnessStateKnown: session.autoBrightnessStateKnown,
            ambientLightProxyValue: session.ambientLightProxyValue,
            deviceTiltDegrees: session.deviceTiltDegrees
        )
        if let data = session.qualityThresholdsJSON {
            qualityThresholds = try? JSONDecoder().decode(QualityThresholds.self, from: data)
        } else {
            qualityThresholds = nil
        }
    }
}
