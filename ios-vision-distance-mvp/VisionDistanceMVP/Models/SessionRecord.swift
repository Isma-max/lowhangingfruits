import Foundation
import SwiftData

/// One supervised test session for one participant. Brief section 6
/// (Pantallas 2, 3, 5): captures device capabilities, consent/alarm outcome,
/// and environment readings at session setup time. Frame-level and trial-level
/// data live in per-session CSV/JSON files on disk (see `FileStore`), not
/// here — SwiftData holds the structured, low-frequency session metadata.
@Model
final class SessionRecord {
    @Attribute(.unique) var id: UUID
    var createdAt: Date
    var appVersion: String

    // Pantalla 2 — compatibilidad
    var deviceModelIdentifier: String
    var iosVersion: String
    var hasTrueDepth: Bool
    var hasKnownScreenGeometry: Bool
    var cameraAuthorizationStatusRaw: String
    var wasPortraitOrientation: Bool

    // Pantalla 3 — consentimiento y alarmas
    var consentAccepted: Bool
    var alarmPresent: Bool
    var excluded: Bool

    // Pantalla 5 — preparación / entorno
    /// 0-1, source: `UIScreen.main.brightness` (system-reported).
    var systemBrightness0to1: Double?
    /// Always false: iOS exposes no public API to read the Auto-Brightness
    /// toggle state. Never inferred — see DECISIONS.md.
    var autoBrightnessStateKnown: Bool
    /// Uncalibrated relative-units proxy derived from TrueDepth camera
    /// ISO/exposure duration, never presented as lux. `nil` until measured.
    var ambientLightProxyValue: Double?
    var deviceTiltDegrees: Double?
    var plannedEyeConditionRaw: String?

    /// JSON-encoded `VisionMVPCore.QualityThresholds` actually used for this
    /// session's distance module runs — stored as data so the exact
    /// configuration is traceable per session even if defaults change later.
    var qualityThresholdsJSON: Data?

    var investigatorNotes: String?

    var participant: Participant?

    init(
        id: UUID = UUID(),
        appVersion: String,
        deviceModelIdentifier: String,
        iosVersion: String,
        hasTrueDepth: Bool,
        hasKnownScreenGeometry: Bool,
        cameraAuthorizationStatusRaw: String,
        wasPortraitOrientation: Bool
    ) {
        self.id = id
        self.createdAt = Date()
        self.appVersion = appVersion
        self.deviceModelIdentifier = deviceModelIdentifier
        self.iosVersion = iosVersion
        self.hasTrueDepth = hasTrueDepth
        self.hasKnownScreenGeometry = hasKnownScreenGeometry
        self.cameraAuthorizationStatusRaw = cameraAuthorizationStatusRaw
        self.wasPortraitOrientation = wasPortraitOrientation
        self.consentAccepted = false
        self.alarmPresent = false
        self.excluded = false
        self.autoBrightnessStateKnown = false
    }
}
