import SwiftUI
import VisionMVPCore

/// The single 60-second vision test: positioning -> 3-2-1 countdown ->
/// timed stimulus loop with pause/recovery -> result. All logic lives in
/// `VisionTestEngine` (via `VisionTestRunner`); this view only renders state
/// and forwards taps.
struct VisionTestView: View {
    @Binding var path: [AppRoute]
    @EnvironmentObject private var faceTrackingSession: FaceTrackingSession
    @EnvironmentObject private var sessionRepository: SessionRepository
    @StateObject private var runner = VisionTestRunner()

    var body: some View {
        content
            .padding(20)
            .navigationBarTitleDisplayMode(.inline)
            .navigationBarBackButtonHidden(runner.uiState.phaseName == "stimulus")
            .onAppear {
                runner.attach(repository: sessionRepository)
                faceTrackingSession.start()
            }
            .onDisappear {
                faceTrackingSession.stop()
                if !runner.uiState.isFinished {
                    runner.abandon()
                }
            }
            .onReceive(faceTrackingSession.$latestSample) { sample in
                if let sample { runner.ingest(sample) }
            }
    }

    @ViewBuilder
    private var content: some View {
        if runner.uiState.isFinished, let result = runner.finalResult {
            resultView(result)
        } else {
            switch runner.uiState.phaseName {
            case "positioning":
                positioningView
            case "countdown":
                countdownView
            case "paused":
                pausedView
            default:
                stimulusView
            }
        }
    }

    // MARK: Positioning

    private var positioningView: some View {
        VStack(spacing: 24) {
            Spacer()
            Image(systemName: hintSymbol)
                .font(.system(size: 64))
                .foregroundStyle(runner.uiState.hint == .correct ? .green : .secondary)
            Text(hintText)
                .font(.title2.weight(.semibold))
                .multilineTextAlignment(.center)
            Text("Apoya el teléfono en una posición fija y ubica tu rostro a unos 40 cm.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            Spacer()
            debugPanel
        }
    }

    private var hintText: String {
        switch runner.uiState.hint {
        case .faceNotDetected: return "Ubica tu rostro frente a la pantalla"
        case .moveCloser: return "Acércate un poco"
        case .moveBack: return "Aléjate un poco"
        case .hold: return "Mantén la posición"
        case .correct: return "Posición correcta"
        }
    }

    private var hintSymbol: String {
        switch runner.uiState.hint {
        case .faceNotDetected: return "faceid"
        case .moveCloser: return "arrow.down.forward.and.arrow.up.backward"
        case .moveBack: return "arrow.up.backward.and.arrow.down.forward"
        case .hold: return "hand.raised"
        case .correct: return "checkmark.circle.fill"
        }
    }

    // MARK: Countdown

    private var countdownView: some View {
        VStack(spacing: 16) {
            Spacer()
            Text("Comenzamos en…")
                .font(.title3)
                .foregroundStyle(.secondary)
            Text(runner.uiState.countdownText ?? "3")
                .font(.system(size: 96, weight: .bold, design: .rounded))
                .contentTransition(.numericText())
            Spacer()
        }
    }

    // MARK: Stimulus

    private var stimulusView: some View {
        VStack(spacing: 16) {
            HStack {
                clockRing
                VStack(alignment: .leading, spacing: 4) {
                    Text("Figura \(runner.uiState.validTrials + 1) de un máximo de \(runner.uiState.maxTrials)")
                        .font(.subheadline.weight(.semibold))
                    Text("Responde hasta \(runner.uiState.maxTrials) figuras")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    ProgressView(value: runner.uiState.progress)
                }
                Spacer()
                Button("Salir") { abandonAndShowResult() }
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }

            if let message = runner.uiState.pacingMessage {
                Text(message)
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(.tint)
            }

            Spacer()

            if let orientation = runner.uiState.stimulusOrientation {
                StimulusView(gapOrientation: orientation, sizePoints: runner.uiState.stimulusSizePoints)
                    .frame(height: max(140, runner.uiState.stimulusSizePoints))
                    .animation(nil, value: orientation) // instant swap, no long animation (§14)
            }

            Spacer()

            Text("Responde correctamente y tan rápido como puedas.")
                .font(.footnote)
                .foregroundStyle(.secondary)

            GapDirectionResponsePad(orientations: GapOrientation.cardinalDirections) { response in
                runner.respond(response)
            }

            debugPanel
        }
    }

    private var clockRing: some View {
        let remaining = runner.uiState.effectiveSecondsRemaining
        let total = 60.0
        return ZStack {
            Circle()
                .stroke(.quaternary, lineWidth: 5)
            Circle()
                .trim(from: 0, to: max(0, CGFloat(Double(remaining) / total)))
                .stroke(remaining <= 10 ? Color.red : Color.accentColor, style: StrokeStyle(lineWidth: 5, lineCap: .round))
                .rotationEffect(.degrees(-90))
            Text("\(remaining)")
                .font(.callout.monospacedDigit().weight(remaining <= 10 ? .bold : .regular))
                .foregroundStyle(remaining <= 10 ? .red : .primary)
        }
        .frame(width: 48, height: 48)
    }

    // MARK: Paused

    private var pausedView: some View {
        VStack(spacing: 24) {
            Spacer()
            Image(systemName: "pause.circle")
                .font(.system(size: 64))
                .foregroundStyle(.orange)
            Text(hintText)
                .font(.title2.weight(.semibold))
                .multilineTextAlignment(.center)
            Text("El test continúa donde quedó cuando vuelvas a la posición.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            Spacer()
            Button("Salir") { abandonAndShowResult() }
                .font(.footnote)
                .foregroundStyle(.secondary)
            debugPanel
        }
    }

    // MARK: Result (encargo §21)

    private func resultView(_ result: TestResult) -> some View {
        VStack(spacing: 20) {
            Spacer()
            Image(systemName: resultSymbol(result.outcome))
                .font(.system(size: 56))
                .foregroundStyle(resultColor(result.outcome))

            Text(resultTitle(result.outcome))
                .font(.title2.bold())
                .multilineTextAlignment(.center)

            Text(resultMessage(result))
                .font(.body)
                .multilineTextAlignment(.center)

            if result.outcome == .completed {
                Text("Completaste el test en \(Int(result.effectiveSeconds.rounded())) segundos.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }

            Text("Este test entrega una estimación orientativa y no reemplaza un examen profesional.")
                .font(.footnote)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.top, 8)

            Spacer()

            if result.outcome == .inconclusive {
                Button {
                    runner.restart()
                } label: {
                    Text("Repetir test")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 6)
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
            }

            Button {
                path.removeAll()
            } label: {
                Text("Volver al inicio")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.bordered)
            .controlSize(.large)
        }
    }

    private func resultSymbol(_ outcome: TestOutcome) -> String {
        switch outcome {
        case .completed: return "checkmark.seal.fill"
        case .approximate: return "checkmark.seal"
        case .inconclusive: return "questionmark.circle"
        }
    }

    private func resultColor(_ outcome: TestOutcome) -> Color {
        switch outcome {
        case .completed: return .green
        case .approximate: return .orange
        case .inconclusive: return .secondary
        }
    }

    private func resultTitle(_ outcome: TestOutcome) -> String {
        switch outcome {
        case .completed: return "Medición completada"
        case .approximate: return "Medición aproximada"
        case .inconclusive: return "Resultado no concluyente"
        }
    }

    private func resultMessage(_ result: TestResult) -> String {
        switch result.outcome {
        case .completed:
            return "Pudimos obtener una medición consistente de tu visión cercana."
        case .approximate:
            return "Completaste el test, pero el resultado presenta cierta variabilidad y debe interpretarse con cautela."
        case .inconclusive:
            return "No pudimos obtener una medición suficientemente consistente. Puedes repetir el test procurando mantener la posición."
        }
    }

    private func abandonAndShowResult() {
        runner.abandon()
    }

    // MARK: Debug panel (encargo §25 — DEBUG builds only)

    @ViewBuilder
    private var debugPanel: some View {
        #if DEBUG
        DisclosureGroup("Debug") {
            VStack(alignment: .leading, spacing: 2) {
                debugRow("Distancia", faceTrackingSession.latestSample?.distanceMeanEyesMeters.map { String(format: "%.1f cm", $0 * 100) } ?? "—")
                debugRow("Estado", runner.uiState.phaseName)
                debugRow("Nivel logMAR", String(format: "%.1f", runner.engine.staircase.currentLogMAR))
                debugRow("Tamaño", runner.engine.currentStimulus.map { String(format: "%.2f mm / %.0f pt", $0.totalHeightMillimeters, runner.uiState.stimulusSizePoints) } ?? "—")
                debugRow("Aciertos consecutivos", "\(runner.engine.staircase.consecutiveCorrect)")
                debugRow("Dirección", runner.engine.staircase.lastMoveDirection?.rawValue ?? "—")
                debugRow("Reversiones", "\(runner.engine.staircase.reversalCount)")
                debugRow("Ensayos válidos", "\(runner.engine.validTrialCount)")
                debugRow("Efectivo", String(format: "%.1f s", runner.engine.effectiveSeconds))
                debugRow("Pausa acumulada", String(format: "%.1f s", runner.engine.pausedSeconds))
                debugRow("No termina porque", runner.engine.notFinishedBecause)
            }
            .font(.caption2.monospaced())
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .font(.caption)
        #else
        EmptyView()
        #endif
    }

    private func debugRow(_ label: String, _ value: String) -> some View {
        HStack {
            Text(label)
            Spacer()
            Text(value).foregroundStyle(.secondary)
        }
    }
}
