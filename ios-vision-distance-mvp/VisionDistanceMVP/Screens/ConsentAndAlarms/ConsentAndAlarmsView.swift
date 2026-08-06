import SwiftUI

/// Pantalla 3 (brief section 6). Any "yes" on the alarm checklist stops the
/// test and records only `excluded = true` on the session — no symptom
/// detail is stored.
struct ConsentAndAlarmsView: View {
    @Binding var path: [AppRoute]
    @ObservedObject var draft: NewSessionDraft
    @EnvironmentObject private var sessionRepository: SessionRepository

    @State private var consentAccepted = false
    @State private var answers: [Bool] = Array(repeating: false, count: alarmSymptoms.count)
    @State private var showExclusion = false

    private static let alarmSymptoms = [
        "Pérdida visual repentina",
        "Dolor ocular importante",
        "Aparición súbita de destellos o muchas manchas flotantes",
        "Sombra o cortina en el campo visual",
        "Visión doble nueva",
        "Líneas que aparecen deformadas",
        "Diferencia visual marcada y reciente entre ambos ojos",
        "Traumatismo ocular reciente",
        "Síntomas neurológicos (por ejemplo, debilidad, dificultad para hablar)",
        "Empeoramiento visual rápido",
    ]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Text("Consentimiento experimental")
                    .font(.title2.bold())

                Text(
                    "Vas a participar en una prueba experimental que mide, de forma orientativa, " +
                    "la distancia entre tus ojos y la pantalla mientras miras un estímulo visual. " +
                    "La cámara TrueDepth se usa solo para calcular esa distancia y la posición de " +
                    "tu rostro; no se guarda ninguna imagen ni video. Los datos se guardan de forma " +
                    "anónima, identificados solo por un código, y se usan únicamente con fines de " +
                    "investigación. Puedes detener la prueba en cualquier momento."
                )
                .font(.body)

                Toggle("Acepto participar en esta prueba experimental", isOn: $consentAccepted)
                    .font(.subheadline.weight(.semibold))

                Divider()

                Text("Antes de continuar, indica si presentas actualmente alguno de estos síntomas:")
                    .font(.subheadline.weight(.semibold))

                ForEach(Array(Self.alarmSymptoms.enumerated()), id: \.offset) { index, symptom in
                    Toggle(symptom, isOn: $answers[index])
                        .font(.subheadline)
                }

                if showExclusion {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("No continuaremos con esta prueba")
                            .font(.headline)
                        Text(
                            "Por los síntomas indicados, te recomendamos acudir a una evaluación " +
                            "oftalmológica u optométrica profesional lo antes posible. Esta app no " +
                            "sustituye esa evaluación."
                        )
                    }
                    .padding(12)
                    .background(.red.opacity(0.1), in: RoundedRectangle(cornerRadius: 10))

                    Button("Volver al inicio") {
                        path.removeAll()
                    }
                    .buttonStyle(.borderedProminent)
                    .frame(maxWidth: .infinity)
                } else {
                    Button("Continuar") {
                        proceed()
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.large)
                    .frame(maxWidth: .infinity)
                    .disabled(!consentAccepted)
                }
            }
            .padding()
        }
        .navigationBarTitleDisplayMode(.inline)
    }

    private func proceed() {
        let hasAlarm = answers.contains(true)
        draft.consentAccepted = consentAccepted
        draft.hasAlarmSymptom = hasAlarm
        draft.excluded = hasAlarm

        if let sessionID = draft.persistedSessionID,
           let session = sessionRepository.allSessions().first(where: { $0.id == sessionID }) {
            session.consentAccepted = consentAccepted
            session.alarmPresent = hasAlarm
            session.excluded = hasAlarm
            sessionRepository.save()
        }

        if hasAlarm {
            showExclusion = true
        } else {
            path.append(.participantInfo)
        }
    }
}
