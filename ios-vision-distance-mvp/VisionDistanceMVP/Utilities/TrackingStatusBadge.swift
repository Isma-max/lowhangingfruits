import SwiftUI
import VisionMVPCore

/// Small reusable live-tracking readout, shared by the Preparation screen
/// (brief: "Calidad del tracking. Presencia y estabilidad del rostro.") and
/// the Distance Characterization Module.
struct TrackingStatusBadge: View {
    var sample: FaceTrackingSession.LiveSample?

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            statusRow("Rostro detectado", sample?.isFaceTracked == true)
            statusRow("Rostro centrado", sample?.faceCentered == true)
            statusRow("Ambos ojos en cuadro", (sample?.leftEyeInFrame ?? false) && (sample?.rightEyeInFrame ?? false))
            HStack {
                Text("Seguimiento mundo")
                Spacer()
                Text(worldTrackingLabel)
                    .foregroundStyle(.secondary)
            }
            .font(.subheadline)
            if let sample {
                HStack {
                    Text("Distancia")
                    Spacer()
                    if let d = sample.distanceToFaceMeters {
                        Text(String(format: "%.1f cm", d * 100))
                            .monospacedDigit()
                    } else {
                        Text("—")
                    }
                }
                .font(.subheadline)
                HStack {
                    Text("Yaw / Pitch / Roll")
                    Spacer()
                    Text(String(format: "%.0f° / %.0f° / %.0f°", sample.yawDegrees, sample.pitchDegrees, sample.rollDegrees))
                        .monospacedDigit()
                        .foregroundStyle(.secondary)
                }
                .font(.subheadline)
            }
        }
        .padding(12)
        .background(.gray.opacity(0.08), in: RoundedRectangle(cornerRadius: 10))
    }

    private var worldTrackingLabel: String {
        switch sample?.worldTrackingState {
        case .normal: return "Normal"
        case .limited(let reason): return "Limitado (\(reason))"
        case .notAvailable, .none: return "No disponible"
        }
    }

    private func statusRow(_ label: String, _ ok: Bool) -> some View {
        HStack {
            Image(systemName: ok ? "checkmark.circle.fill" : "xmark.circle")
                .foregroundStyle(ok ? .green : .secondary)
            Text(label)
            Spacer()
        }
        .font(.subheadline)
    }
}
