import SwiftUI
import UIKit
import VisionMVPCore

/// UIActivityViewController wrapper — presented only AFTER the export files
/// (or ZIP) exist and were verified, never with a URL that might not exist
/// yet (encargo §10/§16).
struct ActivityShareSheet: UIViewControllerRepresentable {
    var items: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }

    func updateUIViewController(_ controller: UIActivityViewController, context: Context) {}
}

/// The useful result screen (encargo §5-§9), shared by the post-test flow
/// and the history: state header, rule-based explanation, summary card,
/// experimental disclosure, share/details/repeat/home actions.
struct TestResultScreen: View {
    var summary: SessionSummary
    var saveConfirmed: Bool
    var onRepeat: () -> Void
    var onHome: () -> Void

    @State private var shareItems: [Any] = []
    @State private var showShareSheet = false
    @State private var showDetails = false
    @State private var exportMessage: String?
    @State private var showExperimental = false

    var body: some View {
        ScrollView {
            VStack(spacing: 18) {
                header
                explanationSection
                saveConfirmation
                summaryCard
                experimentalSection

                Text("Este test entrega una estimación orientativa y no reemplaza un examen profesional.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)

                buttons
            }
            .padding(20)
        }
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $showShareSheet) {
            ActivityShareSheet(items: shareItems)
        }
        .sheet(isPresented: $showDetails) {
            detailsSheet
        }
    }

    // MARK: Header + explanation

    private var outcomeKind: String { summary.qualityClassification }

    private var header: some View {
        VStack(spacing: 10) {
            Image(systemName: headerSymbol)
                .font(.system(size: 52))
                .foregroundStyle(headerColor)
            Text(headerTitle)
                .font(.title2.bold())
                .multilineTextAlignment(.center)
            Text("Completaste el test en \(Int((summary.effectiveDurationMs / 1000).rounded())) segundos.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
    }

    private var headerTitle: String {
        switch outcomeKind {
        case "consistent": return "Medición completada"
        case "approximate": return "Medición aproximada"
        default: return "Resultado no concluyente"
        }
    }

    private var headerSymbol: String {
        switch outcomeKind {
        case "consistent": return "checkmark.seal.fill"
        case "approximate": return "checkmark.seal"
        default: return "questionmark.circle"
        }
    }

    private var headerColor: Color {
        switch outcomeKind {
        case "consistent": return .green
        case "approximate": return .orange
        default: return .secondary
        }
    }

    private var explanationSection: some View {
        VStack(alignment: .leading, spacing: 6) {
            ForEach(summary.explanationCodes, id: \.self) { code in
                HStack(alignment: .top, spacing: 8) {
                    Text("•")
                    Text(sentence(forCode: code))
                }
                .font(.subheadline)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    /// Fixed mapping from deterministic codes to sentences — the UI never
    /// invents a cause (encargo §5).
    private func sentence(forCode code: String) -> String {
        switch ExplanationCode(rawValue: code) {
        case .consistentMeasurement:
            return "Pudimos obtener una medición consistente de tu visión cercana."
        case .fewReversals:
            return "Hubo pocas reversiones para calcular un umbral estable."
        case .highReversalSpread:
            return "Tus respuestas variaron alrededor del nivel mínimo visible."
        case .distanceVariability:
            return "La distancia cambió durante parte del test."
        case .slowResponses:
            return "Se registraron varios tiempos de respuesta muy largos."
        case .timeLimitBeforeConvergence:
            return "El test terminó por tiempo antes de converger."
        case .responseVariability:
            return "La medición técnica fue correcta, pero las respuestas fueron variables."
        case .insufficientValidTrials:
            return "No hubo suficientes figuras respondidas en condiciones válidas."
        case .pauseBudgetExceeded:
            return "El test estuvo pausado demasiado tiempo por pérdida de posición."
        case .abandonedByUser:
            return "El test fue abandonado antes de completarse."
        case nil:
            return code
        }
    }

    private var saveConfirmation: some View {
        HStack(spacing: 6) {
            Image(systemName: saveConfirmed ? "checkmark.circle.fill" : "exclamationmark.circle")
                .foregroundStyle(saveConfirmed ? .green : .orange)
            Text(saveConfirmed ? "Resultado guardado en este iPhone" : "Resultado sin confirmar guardado")
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
    }

    // MARK: Summary card (encargo §6 — values come straight from the summary,
    // the same struct that was exported, so UI and files can never disagree)

    private var summaryCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Resumen del test").font(.headline)
            summaryRow("Duración", "\(Int((summary.effectiveDurationMs / 1000).rounded())) segundos")
            summaryRow("Figuras", "\(summary.validTrialCount)")
            summaryRow("Respuestas correctas", "\(summary.correctCount) de \(summary.validTrialCount)")
            summaryRow("Precisión", summary.accuracy.map { "\(Int(($0 * 100).rounded()))%" } ?? "—")
            summaryRow("Tiempo mediano de respuesta", summary.medianReactionTimeMs.map { String(format: "%.1f s", $0 / 1000) } ?? "—")
            summaryRow("Distancia mediana", summary.medianViewingDistanceM.map { String(format: "%.1f cm", $0 * 100) } ?? "—")
            summaryRow("Consistencia de distancia", summary.distanceStandardDeviationM.map { String(format: "±%.1f cm", $0 * 100) } ?? "—")
            summaryRow("Reversiones", "\(summary.reversalCount)")
            summaryRow("Test finalizado", terminationLabel)
            summaryRow("Calidad", qualityLabel)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.gray.opacity(0.08), in: RoundedRectangle(cornerRadius: 12))
    }

    private var terminationLabel: String {
        switch summary.terminationReason {
        case "reversals_reached": return "umbral encontrado"
        case "max_trials_reached": return "máximo de figuras"
        case "effective_time_limit", "real_time_limit": return "límite de tiempo"
        case "pause_budget_exceeded": return "demasiadas pausas"
        case "abandoned": return "abandonado"
        default: return summary.terminationReason
        }
    }

    private var qualityLabel: String {
        switch outcomeKind {
        case "consistent": return "consistente"
        case "approximate": return "aproximada"
        default: return "no concluyente"
        }
    }

    private func summaryRow(_ label: String, _ value: String) -> some View {
        HStack {
            Text(label).font(.subheadline)
            Spacer()
            Text(value).font(.subheadline.weight(.medium)).foregroundStyle(.secondary)
        }
    }

    // MARK: Experimental section (encargo §7)

    private var experimentalSection: some View {
        DisclosureGroup("Ver resultado experimental", isExpanded: $showExperimental) {
            VStack(alignment: .leading, spacing: 8) {
                summaryRow("Umbral logMAR estimado", summary.estimatedThresholdLogmar.map { String(format: "%.2f", $0) } ?? "—")
                summaryRow("Nivel visual alcanzado", summary.bestCorrectLogmar.map { String(format: "%.1f logMAR", $0) } ?? "—")
                summaryRow("Tamaño físico mínimo identificado", summary.bestCorrectHeightMm.map { String(format: "%.2f mm", $0) } ?? "—")
                summaryRow("Tamaño angular mínimo identificado", summary.bestCorrectDetailArcmin.map { String(format: "%.2f arcmin", $0) } ?? "—")
                summaryRow("Demanda acomodativa", summary.medianViewingDistanceM.map { String(format: "%.2f D", AccommodativeDemand.diopters(distanceMeters: $0)) } ?? "—")
                summaryRow("Confianza del umbral", summary.thresholdConfidence)
                summaryRow("Variabilidad entre reversiones", summary.reversalSpreadLogmar.map { String(format: "±%.2f logMAR", $0) } ?? "—")
                Text("Datos experimentales. No constituyen un diagnóstico ni una receta.")
                    .font(.caption)
                    .foregroundStyle(.orange)
                    .padding(.top, 4)
            }
            .padding(.top, 8)
        }
        .font(.subheadline)
    }

    // MARK: Actions (encargo §9)

    private var buttons: some View {
        VStack(spacing: 10) {
            if let exportMessage {
                Text(exportMessage).font(.footnote).foregroundStyle(.orange)
            }

            Button {
                share()
            } label: {
                Label("Compartir resultados", systemImage: "square.and.arrow.up")
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 6)
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)

            Button {
                showDetails = true
            } label: {
                Text("Ver detalles")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.bordered)
            .controlSize(.large)

            Button {
                onRepeat()
            } label: {
                Text("Repetir test")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.bordered)
            .controlSize(.large)

            Button("Volver al inicio") {
                onHome() // never deletes the session (§9)
            }
            .font(.footnote)
            .foregroundStyle(.secondary)
            .padding(.top, 4)
        }
    }

    /// ZIP first; if the ZIP path fails for any reason, fall back to sharing
    /// the four files directly (encargo §11 — never block the export on ZIP).
    private func share() {
        exportMessage = nil
        guard let store = AppSessionStore.shared else {
            exportMessage = "No se pudo acceder al almacenamiento local."
            return
        }
        do {
            let zipURL = try store.exportZip(forSessionID: summary.sessionID)
            shareItems = [zipURL]
            showShareSheet = true
        } catch {
            do {
                let files = try store.files(forSessionID: summary.sessionID)
                shareItems = files.shareableURLs
                showShareSheet = true
                exportMessage = "No se pudo generar el ZIP; se comparten los archivos sueltos."
            } catch {
                exportMessage = "No se pudieron preparar los archivos: \(error.localizedDescription)"
            }
        }
    }

    // MARK: Details sheet (encargo §9 "Ver detalles")

    private var detailsSheet: some View {
        NavigationStack {
            List {
                Section("Sesión") {
                    detailRow("ID de sesión", summary.sessionID)
                    detailRow("Participante", summary.participantID)
                    detailRow("Inicio", summary.startedAt.formatted(date: .abbreviated, time: .standard))
                    detailRow("Fin", summary.completedAt.formatted(date: .abbreviated, time: .standard))
                    detailRow("Duración real", String(format: "%.1f s", summary.wallDurationMs / 1000))
                    detailRow("Duración efectiva", String(format: "%.1f s", summary.effectiveDurationMs / 1000))
                    detailRow("Estado", summary.sessionStatus)
                    detailRow("Motivo de término", summary.terminationReason)
                }
                Section("Ensayos") {
                    detailRow("Válidos", "\(summary.validTrialCount)")
                    detailRow("Invalidados", "\(summary.invalidTrialCount)")
                    detailRow("Correctos", "\(summary.correctCount)")
                    detailRow("Incorrectos", "\(summary.incorrectCount)")
                    detailRow("Timeouts", "\(summary.timeoutCount)")
                }
                Section("Medición") {
                    detailRow("Distancia mediana", summary.medianViewingDistanceM.map { String(format: "%.3f m", $0) } ?? "null")
                    detailRow("SD de distancia", summary.distanceStandardDeviationM.map { String(format: "%.4f m", $0) } ?? "null")
                    detailRow("% frames en rango", summary.percentFramesInsideRange.map { String(format: "%.1f%%", $0) } ?? "null")
                    detailRow("Ratio frames válidos", summary.validFrameRatio.map { String(format: "%.2f", $0) } ?? "null")
                }
                Section("Versiones") {
                    detailRow("App", "\(summary.appVersion) (\(summary.buildNumber))")
                    detailRow("Protocolo", summary.protocolVersion)
                    detailRow("Algoritmo", summary.algorithmVersion)
                    detailRow("Esquema", summary.schemaVersion)
                    detailRow("Dispositivo", summary.deviceModel)
                    detailRow("iOS", summary.systemVersion)
                }
            }
            .navigationTitle("Detalles técnicos")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Cerrar") { showDetails = false }
                }
            }
        }
    }

    private func detailRow(_ label: String, _ value: String) -> some View {
        LabeledContent(label) {
            Text(value).font(.caption.monospaced())
        }
    }
}
