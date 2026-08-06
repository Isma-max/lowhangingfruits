import Foundation
import VisionMVPCore

/// Carries a single new-session flow's collected data across Pantallas 2-5
/// (brief section 6) before/while it's persisted to SwiftData. Created fresh
/// for every "Nueva sesión" tap; discarded on completion or cancellation.
@MainActor
final class NewSessionDraft: ObservableObject {
    // Pantalla 2 — compatibilidad
    @Published var capabilities: DeviceCapabilities?

    // Pantalla 3 — consentimiento y alarmas
    @Published var consentAccepted = false
    @Published var hasAlarmSymptom = false
    @Published var excluded = false

    // Pantalla 4 — identificación experimental
    @Published var pseudonymousID = ""
    @Published var ageBand: AgeBand = .under30
    @Published var dominantHand: DominantHand = .preferNotToSay
    @Published var habitualGlassesUse = false
    @Published var glassesType: GlassesType = .none
    @Published var testsWithGlasses = false
    @Published var lastPrescriptionApproxDate: Date?
    @Published var nearReadingDifficulty0to10 = 0
    @Published var focusFatigue0to10 = 0

    // Pantalla 5 — preparación
    @Published var plannedEyeCondition: EyeCondition = .oculusUterque
    @Published var systemBrightness0to1: Double?
    @Published var ambientLightProxyLumens: Double?
    @Published var deviceTiltDegrees: Double?

    /// Set once the session + participant are persisted (brief: exclusion by
    /// alarm still saves *that* the session was excluded, with no further
    /// detail).
    @Published var persistedSessionID: UUID?

    var qualityThresholds: QualityThresholds = .default
}
