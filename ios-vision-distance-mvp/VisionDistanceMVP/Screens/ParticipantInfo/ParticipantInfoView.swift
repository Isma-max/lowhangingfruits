import SwiftUI

/// Pantalla 4 (brief section 6) — fields verbatim, no name/RUT/email/phone.
struct ParticipantInfoView: View {
    @Binding var path: [AppRoute]
    @ObservedObject var draft: NewSessionDraft
    @EnvironmentObject private var sessionRepository: SessionRepository

    @State private var showsDuplicateWarning = false

    var body: some View {
        Form {
            Section("Identificación") {
                TextField("ID pseudónimo del participante (p. ej. P07)", text: $draft.pseudonymousID)
                    .autocapitalization(.allCharacters)
                    .disableAutocorrection(true)
                if showsDuplicateWarning {
                    Text("Ya existe un participante con este ID. Se reutilizará su ficha.")
                        .font(.footnote)
                        .foregroundStyle(.orange)
                }
            }

            Section("Datos básicos") {
                Picker("Edad", selection: $draft.ageBand) {
                    ForEach(AgeBand.allCases) { band in
                        Text(band.displayLabel).tag(band)
                    }
                }
                Picker("Mano dominante (opcional)", selection: $draft.dominantHand) {
                    ForEach(DominantHand.allCases) { hand in
                        Text(hand.displayLabel).tag(hand)
                    }
                }
            }

            Section("Uso de lentes") {
                Toggle("Usa lentes habitualmente", isOn: $draft.habitualGlassesUse)
                Picker("Tipo de lentes", selection: $draft.glassesType) {
                    ForEach(GlassesType.allCases) { type in
                        Text(type.displayLabel).tag(type)
                    }
                }
                Toggle("Realizará el test con lentes", isOn: $draft.testsWithGlasses)
                DatePicker(
                    "Fecha aproximada de última receta (opcional)",
                    selection: Binding(
                        get: { draft.lastPrescriptionApproxDate ?? Date() },
                        set: { draft.lastPrescriptionApproxDate = $0 }
                    ),
                    displayedComponents: .date
                )
                if draft.lastPrescriptionApproxDate != nil {
                    Button("Quitar fecha", role: .destructive) {
                        draft.lastPrescriptionApproxDate = nil
                    }
                    .font(.footnote)
                }
            }

            Section("Autoevaluación") {
                VStack(alignment: .leading) {
                    Text("Dificultad subjetiva para leer de cerca: \(draft.nearReadingDifficulty0to10)")
                    Slider(value: Binding(
                        get: { Double(draft.nearReadingDifficulty0to10) },
                        set: { draft.nearReadingDifficulty0to10 = Int($0.rounded()) }
                    ), in: 0...10, step: 1)
                }
                VStack(alignment: .leading) {
                    Text("Cansancio o demora de enfoque: \(draft.focusFatigue0to10)")
                    Slider(value: Binding(
                        get: { Double(draft.focusFatigue0to10) },
                        set: { draft.focusFatigue0to10 = Int($0.rounded()) }
                    ), in: 0...10, step: 1)
                }
            }

            Section {
                Button("Continuar") {
                    saveParticipantAndContinue()
                }
                .disabled(draft.pseudonymousID.trimmingCharacters(in: .whitespaces).isEmpty)
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .navigationTitle("Datos del participante")
    }

    private func saveParticipantAndContinue() {
        let id = draft.pseudonymousID.trimmingCharacters(in: .whitespaces)
        let participant: Participant
        if let existing = sessionRepository.fetchParticipant(pseudonymousID: id) {
            participant = existing
            participant.ageBand = draft.ageBand
            participant.dominantHand = draft.dominantHand
            participant.habitualGlassesUse = draft.habitualGlassesUse
            participant.glassesType = draft.glassesType
            participant.testsWithGlasses = draft.testsWithGlasses
            participant.lastPrescriptionApproxDate = draft.lastPrescriptionApproxDate
            participant.nearReadingDifficulty0to10 = draft.nearReadingDifficulty0to10
            participant.focusFatigue0to10 = draft.focusFatigue0to10
        } else {
            participant = Participant(
                pseudonymousID: id,
                ageBand: draft.ageBand,
                dominantHand: draft.dominantHand,
                habitualGlassesUse: draft.habitualGlassesUse,
                glassesType: draft.glassesType,
                testsWithGlasses: draft.testsWithGlasses,
                lastPrescriptionApproxDate: draft.lastPrescriptionApproxDate,
                nearReadingDifficulty0to10: draft.nearReadingDifficulty0to10,
                focusFatigue0to10: draft.focusFatigue0to10
            )
            sessionRepository.insert(participant)
        }

        if let sessionID = draft.persistedSessionID,
           let session = sessionRepository.allSessions().first(where: { $0.id == sessionID }) {
            session.participant = participant
        }
        sessionRepository.save()

        path.append(.preparation)
    }
}
