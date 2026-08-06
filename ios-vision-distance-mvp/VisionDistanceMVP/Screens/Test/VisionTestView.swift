import SwiftUI
import VisionMVPCore

/// The single 60-second vision test: positioning -> 3-2-1 countdown ->
/// timed stimulus loop with pause/recovery -> saved result. All logic lives
/// in `VisionTestEngine` (via `VisionTestRunner`); the session is persisted
/// synchronously by the runner the moment the engine finishes — before the
/// result UI appears, and never from `onDisappear` (encargo §2).
struct VisionTestView: View {
    @Binding var path: [AppRoute]
    var participantID: String
    @EnvironmentObject private var faceTrackingSession: FaceTrackingSession
    @StateObject private var runner = VisionTestRunner()

    var body: some View {
        content
            .navigationBarTitleDisplayMode(.inline)
            .navigationBarBackButtonHidden(runner.uiState.phaseName == "stimulus" || runner.saveState == .saving)
            .onAppear {
                runner.participantID = participantID
                faceTrackingSession.start()
            }
            .onDisappear {
                faceTrackingSession.stop()
                // Safety net only: a started-but-unfinished test is closed as
                // abandoned and persisted synchronously inside abandon() —
                // the normal path saved long before this runs.
                if !runner.uiState.isFinished {
                    runner.abandon()
                }
            }
            .onReceive(faceTrackingSession.$latestSample) { sample in
                if let sample { runner.ingest(sample) }
            }
    }

    /// The result screen brings its own scrolling and padding; the in-test
    /// phases are fixed-layout and get theirs here.
    @ViewBuilder
    private var content: some View {
        if runner.uiState.isFinished {
            finishedContent
        } else {
            Group {
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
            .padding(20)
        }
    }

    // MARK: Finished: saving -> saved result / save error (encargo §2/§8)

    @ViewBuilder
    private var finishedContent: some View {
        switch runner.saveState {
        case .saving:
            VStack(spacing: 16) {
                Spacer()
                ProgressView()
                Text("Guardando resultado…")
                    .font(.headline)
                Spacer()
            }
            .padding(20)
        case .failed(let message):
            VStack(spacing: 16) {
                Spacer()
                Image(systemName: "exclamationmark.triangle.fill")
                    .font(.system(size: 48))
                    .foregroundStyle(.orange)
                Text("No pudimos guardar el resultado")
                    .font(.title3.bold())
                Text(message)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                Button {
                    runner.retrySave()
                } label: {
                    Text("Reintentar")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 6)
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
                Button("Volver al inicio") { path.removeAll() }
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                Spacer()
            }
            .padding(20)
        case .saved, .idle:
            if let summary = runner.summary {
                TestResultScreen(
                    summary: summary,
                    saveConfirmed: runner.saveState == .saved,
                    onRepeat: { runner.restart() },
                    onHome: { path.removeAll() }
                )
            } else {
                // Finished without a started test (backed out of positioning):
                // nothing to show or save.
                Color.clear.onAppear { path.removeAll() }
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
                Button("Salir") { abandonOrLeave() }
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
                    .animation(nil, value: orientation)
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
            Button("Salir") { abandonOrLeave() }
                .font(.footnote)
                .foregroundStyle(.secondary)
            debugPanel
        }
    }

    private func abandonOrLeave() {
        if runner.hasStarted {
            runner.abandon() // persists the abandoned session, then shows result
        } else {
            path.removeAll()
        }
    }

    // MARK: Debug panel (DEBUG builds only)

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
