import SwiftUI
import VisionMVPCore

private enum VisionModulePhase: Equatable {
    case setup
    case runningStatic
    case runningDynamic
    case runningBlurCrossing
}

/// Entry point for the vision/stimulus module (brief section 2). Lets the
/// investigator configure and run any of the four sub-tests, repeatedly,
/// accumulating all trials before a single export.
struct VisionTestSetupView: View {
    @ObservedObject var draft: NewSessionDraft
    @StateObject private var testSession = VisionTestSession()
    @EnvironmentObject private var faceTrackingSession: FaceTrackingSession

    @State private var phase: VisionModulePhase = .setup
    @State private var taskPhase: TaskPhase = .staticBaseline
    @State private var eyeCondition: EyeCondition = .oculusUterque
    @State private var correctionUsed = false
    @State private var targetAngularSizeArcMinutes: Double = 24
    @State private var fixedPhysicalSizeMillimeters: Double = 5
    @State private var dynamicTrialCount = 20
    @State private var exportMessage: String?
    @State private var showAdvancedSettings = false

    var body: some View {
        Group {
            switch phase {
            case .setup:
                setupView
            case .runningStatic:
                StaticBaselineTrialView(
                    eyeCondition: eyeCondition,
                    correctionUsed: correctionUsed,
                    sessionID: draft.persistedSessionID,
                    testSession: testSession,
                    onFinish: { phase = .setup }
                )
            case .runningDynamic:
                DynamicTrialView(
                    taskPhase: taskPhase,
                    eyeCondition: eyeCondition,
                    correctionUsed: correctionUsed,
                    targetAngularSizeArcMinutes: targetAngularSizeArcMinutes,
                    fixedPhysicalSizeMillimeters: fixedPhysicalSizeMillimeters,
                    trialCount: dynamicTrialCount,
                    sessionID: draft.persistedSessionID,
                    testSession: testSession,
                    onFinish: { phase = .setup }
                )
            case .runningBlurCrossing:
                BlurCrossingTrialView(
                    eyeCondition: eyeCondition,
                    correctionUsed: correctionUsed,
                    fixedPhysicalSizeMillimeters: fixedPhysicalSizeMillimeters,
                    sessionID: draft.persistedSessionID,
                    testSession: testSession,
                    onFinish: { phase = .setup }
                )
            }
        }
        .onAppear { faceTrackingSession.start() }
        .onDisappear { faceTrackingSession.stop() }
    }

    private var setupView: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Text("Módulo de test visual").font(.title2.bold())

                Picker("Sub-prueba", selection: $taskPhase) {
                    Text("Basal a distancia fija").tag(TaskPhase.staticBaseline)
                    Text("Dinámica, ángulo constante").tag(TaskPhase.dynamicConstantAngularSize)
                    Text("Dinámica, tamaño fijo").tag(TaskPhase.dynamicFixedPhysicalSize)
                    Text("Cruce claro/borroso").tag(TaskPhase.blurCrossing)
                }
                .pickerStyle(.menu)

                Group {
                    switch taskPhase {
                    case .staticBaseline:
                        Text("El participante sostiene el teléfono a una distancia estable mientras la app reduce el tamaño del optotipo con cada acierto.")
                    case .dynamicConstantAngularSize:
                        Text("El participante acerca y aleja el teléfono; el optotipo cambia de tamaño para mantener su tamaño angular aproximadamente constante.")
                    case .dynamicFixedPhysicalSize:
                        Text("El participante acerca y aleja el teléfono; el optotipo mantiene siempre el mismo tamaño físico (control, sin reescalado).")
                    case .blurCrossing:
                        Text("El participante acerca y aleja el teléfono, marcando el momento en que el estímulo cambia entre claro y borroso. Se registran 3 repeticiones.")
                    }
                }
                .font(.footnote).foregroundStyle(.secondary)

                DisclosureGroup("Ajustes (opcional)", isExpanded: $showAdvancedSettings) {
                    VStack(alignment: .leading, spacing: 16) {
                        Picker("Condición ocular", selection: $eyeCondition) {
                            Text("Binocular").tag(EyeCondition.oculusUterque)
                            Text("Ojo derecho").tag(EyeCondition.oculusDexter)
                            Text("Ojo izquierdo").tag(EyeCondition.oculusSinister)
                        }
                        .pickerStyle(.segmented)

                        Toggle("Usa corrección óptica en esta prueba", isOn: $correctionUsed)

                        switch taskPhase {
                        case .staticBaseline:
                            EmptyView()
                        case .dynamicConstantAngularSize:
                            sliderRow("Tamaño angular objetivo", value: $targetAngularSizeArcMinutes, range: 5...60, unit: "arcmin")
                            stepperRow("Número de ensayos", value: $dynamicTrialCount, range: 5...60)
                        case .dynamicFixedPhysicalSize:
                            sliderRow("Tamaño físico fijo", value: $fixedPhysicalSizeMillimeters, range: 1...20, unit: "mm")
                            stepperRow("Número de ensayos", value: $dynamicTrialCount, range: 5...60)
                        case .blurCrossing:
                            sliderRow("Tamaño físico del estímulo", value: $fixedPhysicalSizeMillimeters, range: 1...20, unit: "mm")
                        }
                    }
                    .padding(.top, 8)
                }

                Button("Comenzar") {
                    switch taskPhase {
                    case .staticBaseline: phase = .runningStatic
                    case .dynamicConstantAngularSize, .dynamicFixedPhysicalSize: phase = .runningDynamic
                    case .blurCrossing: phase = .runningBlurCrossing
                    }
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
                .frame(maxWidth: .infinity)

                Divider()

                Text("Ensayos acumulados: \(testSession.trials.count) · Cruces: \(testSession.crossings.count)")
                    .font(.subheadline.weight(.semibold))

                if let exportMessage {
                    Text(exportMessage).font(.footnote).foregroundStyle(.secondary)
                }

                Button("Exportar y finalizar módulo") {
                    exportAndFinish()
                }
                .buttonStyle(.bordered)
                .frame(maxWidth: .infinity)
                .disabled(testSession.trials.isEmpty && testSession.crossings.isEmpty)
            }
            .padding()
        }
        .navigationBarTitleDisplayMode(.inline)
    }

    private func sliderRow(_ label: String, value: Binding<Double>, range: ClosedRange<Double>, unit: String) -> some View {
        VStack(alignment: .leading) {
            Text("\(label): \(String(format: "%.1f", value.wrappedValue)) \(unit)")
                .font(.subheadline)
            Slider(value: value, in: range)
        }
    }

    private func stepperRow(_ label: String, value: Binding<Int>, range: ClosedRange<Int>) -> some View {
        Stepper("\(label): \(value.wrappedValue)", value: value, in: range)
            .font(.subheadline)
    }

    private func exportAndFinish() {
        guard let sessionID = draft.persistedSessionID else { return }
        do {
            try testSession.exportTrialsAndCrossings(sessionID: sessionID)
            exportMessage = "Guardado: vision_trials.csv / blur_crossings.csv."
        } catch {
            exportMessage = "Error al guardar: \(error.localizedDescription)"
        }
    }
}
