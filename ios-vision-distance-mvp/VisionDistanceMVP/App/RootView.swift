import SwiftUI

struct RootView: View {
    @State private var path: [AppRoute] = []
    @State private var draft = NewSessionDraft()
    @EnvironmentObject private var sessionRepository: SessionRepository

    var body: some View {
        NavigationStack(path: $path) {
            HomeView(
                path: $path,
                onStartNewSession: {
                    draft = NewSessionDraft()
                    path.append(.compatibility)
                },
                onStartQuickTestSession: { startQuickTestSession() }
            )
                .navigationDestination(for: AppRoute.self) { route in
                    switch route {
                    case .compatibility:
                        CompatibilityView(path: $path, draft: draft)
                    case .consent:
                        ConsentAndAlarmsView(path: $path, draft: draft)
                    case .participantInfo:
                        ParticipantInfoView(path: $path, draft: draft)
                    case .preparation:
                        PreparationView(path: $path, draft: draft)
                    case .testChoice:
                        TestChoiceView(path: $path, draft: draft)
                    case .distanceModule:
                        DistanceModuleView(draft: draft)
                    case .visionTest:
                        VisionTestSetupView(draft: draft)
                    case .sessionSummary:
                        SessionSummaryView(path: $path, draft: draft)
                    case .savedSessions:
                        SavedSessionsView(path: $path)
                    case .sessionDetail(let id):
                        SessionDetailView(sessionID: id)
                    case .export:
                        ExportView()
                    case .privacy:
                        PrivacyInfoView()
                    }
                }
        }
    }

    #if DEBUG
    /// Dev-only fast path: fills the new-session forms with placeholder
    /// values and jumps straight to the module picker, so a developer
    /// testing on-device doesn't have to retype the same participant form
    /// every launch. Never appears in a Release build — real sessions still
    /// go through every screen the research protocol requires (brief
    /// section 6), unabridged.
    private func startQuickTestSession() {
        let quick = NewSessionDraft()
        quick.capabilities = CompatibilityChecker.currentCapabilities()
        quick.consentAccepted = true
        quick.hasAlarmSymptom = false
        quick.excluded = false
        quick.pseudonymousID = "TEST-\(Int(Date().timeIntervalSince1970) % 10000)"
        quick.ageBand = .under30

        let session = SessionRecord(
            appVersion: Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "0.1",
            deviceModelIdentifier: quick.capabilities?.deviceModelIdentifier ?? "unknown",
            iosVersion: quick.capabilities?.iosVersion ?? "unknown",
            hasTrueDepth: quick.capabilities?.hasARFaceTrackingConfiguration ?? false,
            hasKnownScreenGeometry: quick.capabilities?.hasKnownScreenGeometry ?? false,
            cameraAuthorizationStatusRaw: quick.capabilities?.cameraAuthorizationStatusRaw ?? "unknown",
            wasPortraitOrientation: quick.capabilities?.isPortraitOrientation ?? true
        )
        session.consentAccepted = true

        let participant = Participant(
            pseudonymousID: quick.pseudonymousID,
            ageBand: quick.ageBand,
            dominantHand: quick.dominantHand,
            habitualGlassesUse: quick.habitualGlassesUse,
            glassesType: quick.glassesType,
            testsWithGlasses: quick.testsWithGlasses,
            lastPrescriptionApproxDate: nil,
            nearReadingDifficulty0to10: quick.nearReadingDifficulty0to10,
            focusFatigue0to10: quick.focusFatigue0to10
        )
        session.participant = participant

        sessionRepository.insert(participant)
        sessionRepository.insert(session)
        sessionRepository.save()

        quick.persistedSessionID = session.id
        draft = quick
        path = [.preparation]
    }
    #endif
}
