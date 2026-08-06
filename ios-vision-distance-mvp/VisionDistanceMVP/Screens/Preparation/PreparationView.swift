import SwiftUI
import UIKit

/// Pantalla 5 (brief section 6). Registers environment readings with their
/// source/unit made explicit, never inferring precision iOS doesn't provide.
struct PreparationView: View {
    @Binding var path: [AppRoute]
    @ObservedObject var draft: NewSessionDraft
    @EnvironmentObject private var faceTrackingSession: FaceTrackingSession
    @EnvironmentObject private var deviceMotionMonitor: DeviceMotionMonitor
    @EnvironmentObject private var sessionRepository: SessionRepository

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Text("Preparación").font(.title2.bold())

                instructions

                Picker("Prueba", selection: $draft.plannedEyeCondition) {
                    Text("Binocular (ambos ojos)").tag(EyeCondition.oculusUterque)
                    Text("Solo ojo derecho").tag(EyeCondition.oculusDexter)
                    Text("Solo ojo izquierdo").tag(EyeCondition.oculusSinister)
                }
                .pickerStyle(.segmented)

                if draft.plannedEyeCondition != .oculusUterque {
                    Text(
                        "Para la prueba monocular, cubre suavemente el otro ojo con la palma de " +
                        "la mano ahuecada, sin presionar el globo ocular, dejando el ojo abierto " +
                        "detrás de la mano."
                    )
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                }

                Divider()

                Text("Estado en vivo").font(.headline)
                TrackingStatusBadge(sample: faceTrackingSession.latestSample)

                environmentSummary

                Button("Continuar") {
                    saveEnvironmentAndContinue()
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
                .frame(maxWidth: .infinity)
            }
            .padding()
        }
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            draft.systemBrightness0to1 = Double(UIScreen.main.brightness)
            faceTrackingSession.start()
            deviceMotionMonitor.start()
        }
        .onDisappear {
            faceTrackingSession.stop()
            deviceMotionMonitor.stop()
        }
        .onReceive(faceTrackingSession.$latestAmbientLightLumens) { value in
            if let value { draft.ambientLightProxyLumens = value }
        }
        .onReceive(deviceMotionMonitor.$tiltDegrees) { value in
            if let value { draft.deviceTiltDegrees = value }
        }
    }

    private var instructions: some View {
        VStack(alignment: .leading, spacing: 6) {
            bullet("Limpia la pantalla del teléfono.")
            bullet("Busca un lugar con iluminación suficiente y uniforme.")
            bullet("Evita reflejos directos sobre la pantalla.")
            bullet("Sostén el teléfono frente a tu rostro, a la altura de los ojos.")
            bullet("Mantén la cabeza relativamente estable durante la prueba.")
        }
    }

    private func bullet(_ text: String) -> some View {
        HStack(alignment: .top, spacing: 8) {
            Text("•")
            Text(text)
        }
        .font(.subheadline)
    }

    private var environmentSummary: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("Lectura del entorno (registrado con origen y unidad)")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
            row("Brillo de pantalla", draft.systemBrightness0to1.map { String(format: "%.0f%% (UIScreen.brightness)", $0 * 100) } ?? "—")
            row("Brillo automático", "No disponible (iOS no expone esta lectura)")
            row("Luz ambiental (aprox.)", draft.ambientLightProxyLumens.map { String(format: "%.0f lm (estimación ARKit, no calibrada)", $0) } ?? "—")
            row("Inclinación del dispositivo", draft.deviceTiltDegrees.map { String(format: "%.0f°", $0) } ?? "—")
        }
    }

    private func row(_ label: String, _ value: String) -> some View {
        HStack {
            Text(label).font(.caption)
            Spacer()
            Text(value).font(.caption).foregroundStyle(.secondary)
        }
    }

    private func saveEnvironmentAndContinue() {
        if let sessionID = draft.persistedSessionID,
           let session = sessionRepository.allSessions().first(where: { $0.id == sessionID }) {
            session.systemBrightness0to1 = draft.systemBrightness0to1
            session.autoBrightnessStateKnown = false
            session.ambientLightProxyValue = draft.ambientLightProxyLumens
            session.deviceTiltDegrees = draft.deviceTiltDegrees
            session.plannedEyeConditionRaw = draft.plannedEyeCondition.rawValue
            session.qualityThresholdsJSON = try? JSONEncoder().encode(draft.qualityThresholds)
            sessionRepository.save()
        }
        path.append(.testChoice)
    }
}
