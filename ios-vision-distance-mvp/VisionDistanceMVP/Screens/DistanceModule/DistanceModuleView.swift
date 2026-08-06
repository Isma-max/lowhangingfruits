import SwiftUI
import VisionMVPCore

/// Módulo de caracterización de distancia (brief section 7). Independent
/// experimental mode to validate TrueDepth against an externally-measured
/// reference distance (tape measure / laser rangefinder) at fixed
/// milestones, 3 repetitions each, exporting both frame-level and
/// summary data.
struct DistanceModuleView: View {
    @ObservedObject var draft: NewSessionDraft
    @EnvironmentObject private var faceTrackingSession: FaceTrackingSession
    @StateObject private var recorder = DistanceRunRecorder()

    private static let milestonesCm: [Double] = [20, 25, 30, 35, 40, 50, 60, 70, 80]

    @State private var selectedMilestoneCm: Double = 20
    @State private var selectedRepetition = 1
    @State private var referenceDistanceText = ""
    @State private var accumulatedFrames: [DistanceFrameRecord] = []
    @State private var accumulatedSummaries: [DistanceRunSummary] = []
    @State private var lastRunSummary: DistanceRunSummary?
    @State private var showThresholdSettings = false
    @State private var exportMessage: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Text("Caracterización de distancia").font(.title2.bold())

                TrackingStatusBadge(sample: faceTrackingSession.latestSample)

                liveStatsTable

                runControls

                if let lastRunSummary {
                    summaryCard(lastRunSummary)
                }

                DisclosureGroup("Tolerancia de calidad (avanzado)", isExpanded: $showThresholdSettings) {
                    thresholdControls
                }

                Divider()

                VStack(alignment: .leading, spacing: 4) {
                    Text("Repeticiones guardadas: \(accumulatedSummaries.count)")
                        .font(.subheadline.weight(.semibold))
                    if let exportMessage {
                        Text(exportMessage).font(.footnote).foregroundStyle(.secondary)
                    }
                }

                Button("Exportar módulo de distancia") {
                    exportModule()
                }
                .buttonStyle(.borderedProminent)
                .frame(maxWidth: .infinity)
                .disabled(accumulatedFrames.isEmpty)
            }
            .padding()
        }
        .navigationBarTitleDisplayMode(.inline)
        .onAppear { faceTrackingSession.start() }
        .onDisappear { faceTrackingSession.stop() }
    }

    private var runControls: some View {
        VStack(alignment: .leading, spacing: 12) {
            Picker("Hito (cm)", selection: $selectedMilestoneCm) {
                ForEach(Self.milestonesCm, id: \.self) { cm in
                    Text("\(Int(cm)) cm").tag(cm)
                }
            }
            .pickerStyle(.menu)

            Picker("Repetición", selection: $selectedRepetition) {
                ForEach(1...3, id: \.self) { rep in
                    Text("Repetición \(rep)").tag(rep)
                }
            }
            .pickerStyle(.segmented)

            TextField("Distancia de referencia medida (cm)", text: $referenceDistanceText)
                .keyboardType(.decimalPad)

            if recorder.isRecording {
                Button("Detener") {
                    stopRun()
                }
                .buttonStyle(.borderedProminent)
                .tint(.red)
                .frame(maxWidth: .infinity)
            } else {
                Button("Iniciar grabación") {
                    startRun()
                }
                .buttonStyle(.borderedProminent)
                .frame(maxWidth: .infinity)
            }
        }
        .padding(12)
        .background(.gray.opacity(0.08), in: RoundedRectangle(cornerRadius: 10))
    }

    private var liveStatsTable: some View {
        VStack(alignment: .leading, spacing: 4) {
            windowRow("1 s", recorder.liveStats.window1s)
            windowRow("2 s", recorder.liveStats.window2s)
            windowRow("3 s", recorder.liveStats.window3s)
            HStack {
                Text("Frecuencia efectiva")
                Spacer()
                Text(recorder.liveStats.effectiveHz.map { String(format: "%.1f Hz", $0) } ?? "—")
            }
            .font(.caption)
            HStack {
                Text("Frames válidos / descartados")
                Spacer()
                Text("\(recorder.liveStats.validFrameCount) / \(recorder.liveStats.invalidFrameCount)")
            }
            .font(.caption)
        }
        .padding(12)
        .background(.blue.opacity(0.06), in: RoundedRectangle(cornerRadius: 10))
    }

    private func windowRow(_ label: String, _ stats: WindowStats?) -> some View {
        HStack {
            Text(label).frame(width: 32, alignment: .leading)
            if let stats {
                Text(String(format: "media %.1f cm · med %.1f · σ %.2f · [%.1f, %.1f] · n=%d",
                             stats.mean * 100, stats.median * 100, stats.standardDeviation * 100,
                             stats.minimum * 100, stats.maximum * 100, stats.sampleCount))
            } else {
                Text("sin datos suficientes")
            }
            Spacer()
        }
        .font(.caption.monospaced())
    }

    private var thresholdControls: some View {
        VStack(alignment: .leading, spacing: 10) {
            stepperRow("Yaw máx.", value: Binding(
                get: { recorder.thresholds.maxYawDegrees },
                set: { recorder.thresholds.maxYawDegrees = $0 }
            ), range: 5...45, unit: "°")
            stepperRow("Pitch máx.", value: Binding(
                get: { recorder.thresholds.maxPitchDegrees },
                set: { recorder.thresholds.maxPitchDegrees = $0 }
            ), range: 5...45, unit: "°")
            stepperRow("Distancia mín.", value: Binding(
                get: { recorder.thresholds.minDistanceMeters * 100 },
                set: { recorder.thresholds.minDistanceMeters = $0 / 100 }
            ), range: 5...50, unit: "cm")
            stepperRow("Distancia máx.", value: Binding(
                get: { recorder.thresholds.maxDistanceMeters * 100 },
                set: { recorder.thresholds.maxDistanceMeters = $0 / 100 }
            ), range: 50...150, unit: "cm")
            stepperRow("SD máx. (inestabilidad)", value: Binding(
                get: { recorder.thresholds.maxStandardDeviationMeters * 100 },
                set: { recorder.thresholds.maxStandardDeviationMeters = $0 / 100 }
            ), range: 0.2...5, unit: "cm")
            stepperRow("Pérdida de frames máx.", value: Binding(
                get: { recorder.thresholds.maxFrameLossRatio * 100 },
                set: { recorder.thresholds.maxFrameLossRatio = $0 / 100 }
            ), range: 5...80, unit: "%")
        }
    }

    private func stepperRow(_ label: String, value: Binding<Double>, range: ClosedRange<Double>, unit: String) -> some View {
        Stepper(value: value, in: range, step: 1) {
            HStack {
                Text(label)
                Spacer()
                Text(String(format: "%.1f %@", value.wrappedValue, unit))
                    .foregroundStyle(.secondary)
            }
        }
        .font(.caption)
    }

    private func summaryCard(_ summary: DistanceRunSummary) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Resumen de la última repetición").font(.subheadline.weight(.semibold))
            if let overall = summary.overall {
                Text(String(format: "Media %.1f cm · mediana %.1f cm · σ %.2f cm · n=%d",
                             overall.meanMeters * 100, overall.medianMeters * 100,
                             overall.standardDeviationMeters * 100, overall.sampleCount))
                    .font(.caption)
            }
            if let error = summary.errorVersusReferenceCentimeters {
                Text(String(format: "Error vs. referencia: %+.1f cm", error))
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(abs(error) > 2 ? .orange : .green)
            }
            Text("Válidos \(summary.validFrameCount) · Descartados \(summary.discardedFrameCount)")
                .font(.caption)
            if !summary.discardReasonCounts.isEmpty {
                Text(summary.discardReasonCounts.map { "\($0.key): \($0.value)" }.joined(separator: ", "))
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(12)
        .background(.green.opacity(0.08), in: RoundedRectangle(cornerRadius: 10))
    }

    private func startRun() {
        recorder.currentMilestoneCentimeters = selectedMilestoneCm
        recorder.currentRepetition = selectedRepetition
        recorder.currentReferenceDistanceCentimeters = Double(referenceDistanceText.replacingOccurrences(of: ",", with: "."))
        lastRunSummary = nil
        recorder.startRecording(on: faceTrackingSession)
    }

    private func stopRun() {
        recorder.stopRecording()
        let summary = DistanceSummaryBuilder.buildSummary(
            frames: recorder.frames,
            milestoneCentimeters: selectedMilestoneCm,
            repetition: selectedRepetition,
            referenceDistanceCentimeters: recorder.currentReferenceDistanceCentimeters
        )
        lastRunSummary = summary
        accumulatedFrames.append(contentsOf: recorder.frames)
        accumulatedSummaries.append(summary)

        if selectedRepetition < 3 {
            selectedRepetition += 1
        } else if let nextMilestoneIndex = Self.milestonesCm.firstIndex(of: selectedMilestoneCm).map({ $0 + 1 }),
                  nextMilestoneIndex < Self.milestonesCm.count {
            selectedMilestoneCm = Self.milestonesCm[nextMilestoneIndex]
            selectedRepetition = 1
        }
    }

    private func exportModule() {
        guard let sessionID = draft.persistedSessionID else { return }
        do {
            try FileStore.writeCSV(accumulatedFrames, filename: "distance_frames.csv", sessionID: sessionID)
            try FileStore.writeJSON(accumulatedSummaries, filename: "distance_summary.json", sessionID: sessionID)
            exportMessage = "Guardado: distance_frames.csv y distance_summary.json (\(accumulatedFrames.count) frames)."
        } catch {
            exportMessage = "Error al guardar: \(error.localizedDescription)"
        }
    }
}
