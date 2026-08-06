import SwiftUI
import AVFoundation

/// Pantalla 2 (brief section 6): checks device/iOS/TrueDepth/camera/orientation
/// and records the result on the session. Blocks continuing into the
/// experimental distance test when incompatible, per the brief's explicit
/// requirement ("Si el dispositivo no es compatible, bloquear el test
/// experimental de distancia").
struct CompatibilityView: View {
    @Binding var path: [AppRoute]
    @ObservedObject var draft: NewSessionDraft
    @EnvironmentObject private var sessionRepository: SessionRepository

    @State private var capabilities: DeviceCapabilities?
    @State private var isRequestingCameraAccess = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text("Comprobación de compatibilidad")
                    .font(.title2.bold())

                if let capabilities {
                    checklist(capabilities)

                    if !capabilities.isCompatible {
                        Text(
                            "Este dispositivo no cumple los requisitos mínimos (cámara TrueDepth " +
                            "y permiso de cámara concedido) para el módulo experimental de " +
                            "distancia. No se iniciará una medición que podría parecer válida sin " +
                            "serlo."
                        )
                        .font(.callout)
                        .foregroundStyle(.red)
                        .padding(12)
                        .background(.red.opacity(0.1), in: RoundedRectangle(cornerRadius: 10))
                    }

                    if capabilities.cameraAuthorizationStatusRaw == "not_determined" {
                        Button("Solicitar acceso a la cámara") {
                            requestCameraAccessAndRecheck()
                        }
                        .buttonStyle(.borderedProminent)
                        .disabled(isRequestingCameraAccess)
                    } else if capabilities.cameraAuthorizationStatusRaw == "denied" || capabilities.cameraAuthorizationStatusRaw == "restricted" {
                        Text("El acceso a la cámara fue denegado. Actívalo en Ajustes > Privacidad > Cámara.")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }

                    Button("Continuar") {
                        persistSessionAndContinue(capabilities)
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.large)
                    .frame(maxWidth: .infinity)
                    .disabled(!capabilities.isCompatible)
                } else {
                    ProgressView("Comprobando…")
                }
            }
            .padding()
        }
        .navigationBarTitleDisplayMode(.inline)
        .onAppear { refresh() }
    }

    private func refresh() {
        capabilities = CompatibilityChecker.currentCapabilities()
        draft.capabilities = capabilities
    }

    private func requestCameraAccessAndRecheck() {
        isRequestingCameraAccess = true
        AVCaptureDevice.requestAccess(for: .video) { _ in
            DispatchQueue.main.async {
                isRequestingCameraAccess = false
                refresh()
            }
        }
    }

    private func persistSessionAndContinue(_ capabilities: DeviceCapabilities) {
        let session = SessionRecord(
            appVersion: Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "0.1",
            deviceModelIdentifier: capabilities.deviceModelIdentifier,
            iosVersion: capabilities.iosVersion,
            hasTrueDepth: capabilities.hasARFaceTrackingConfiguration,
            hasKnownScreenGeometry: capabilities.hasKnownScreenGeometry,
            cameraAuthorizationStatusRaw: capabilities.cameraAuthorizationStatusRaw,
            wasPortraitOrientation: capabilities.isPortraitOrientation
        )
        sessionRepository.insert(session)
        sessionRepository.save()
        draft.persistedSessionID = session.id
        path.append(.consent)
    }

    @ViewBuilder
    private func checklist(_ capabilities: DeviceCapabilities) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            checkRow("Modelo", capabilities.deviceModelIdentifier, true)
            checkRow("iOS", capabilities.iosVersion, true)
            checkRow("Cámara TrueDepth / seguimiento facial", capabilities.hasARFaceTrackingConfiguration ? "Disponible" : "No disponible", capabilities.hasARFaceTrackingConfiguration)
            checkRow("Permiso de cámara", capabilities.cameraAuthorizationStatusRaw, capabilities.cameraAuthorizationStatusRaw == "authorized")
            checkRow("Tamaño de pantalla calibrado", capabilities.hasKnownScreenGeometry ? "Reconocido" : "No reconocido (tamaño angular no calibrado con precisión)", capabilities.hasKnownScreenGeometry)
            checkRow("Orientación", capabilities.isPortraitOrientation ? "Vertical" : "Gira el dispositivo a vertical", capabilities.isPortraitOrientation)
        }
        .padding(12)
        .background(.gray.opacity(0.08), in: RoundedRectangle(cornerRadius: 10))
    }

    private func checkRow(_ label: String, _ value: String, _ ok: Bool) -> some View {
        HStack {
            Image(systemName: ok ? "checkmark.circle.fill" : "exclamationmark.circle.fill")
                .foregroundStyle(ok ? .green : .orange)
            Text(label)
            Spacer()
            Text(value)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.trailing)
        }
        .font(.subheadline)
    }
}
