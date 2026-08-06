import SwiftUI
import AVFoundation
import VisionMVPCore

/// Pre-test explanation (encargo §6) + the minimal device/camera check the
/// test needs, phrased without technical jargon.
struct TestIntroView: View {
    @Binding var path: [AppRoute]

    @State private var cameraStatus = AVCaptureDevice.authorizationStatus(for: .video)

    private var deviceSupported: Bool { FaceTrackingSession.isSupported }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Text("Encuentra la abertura")
                    .font(.title.bold())

                Text(
                    "Verás una figura con una abertura. Indica si apunta arriba, abajo, " +
                    "izquierda o derecha. Responde correctamente y tan rápido como puedas. " +
                    "El test dura sólo un minuto."
                )
                .font(.body)

                orientationDemo

                VStack(alignment: .leading, spacing: 8) {
                    instruction(1, "Apoya el teléfono en una posición fija.")
                    instruction(2, "Ubica tu rostro aproximadamente a 40 cm.")
                    instruction(3, "Mantén la posición.")
                    instruction(4, "Mira hacia dónde apunta la abertura.")
                    instruction(5, "Toca la dirección correspondiente.")
                    instruction(6, "Algunas figuras serán cada vez más pequeñas.")
                }

                if !deviceSupported {
                    Text("Este dispositivo no tiene la cámara frontal necesaria para medir la distancia, así que el test no puede realizarse aquí.")
                        .font(.callout)
                        .foregroundStyle(.red)
                        .padding(12)
                        .background(.red.opacity(0.1), in: RoundedRectangle(cornerRadius: 10))
                } else if cameraStatus == .denied || cameraStatus == .restricted {
                    Text("El test necesita la cámara frontal para medir la distancia de tu rostro. Actívala en Ajustes > Privacidad > Cámara.")
                        .font(.callout)
                        .foregroundStyle(.orange)
                        .padding(12)
                        .background(.orange.opacity(0.1), in: RoundedRectangle(cornerRadius: 10))
                }

                if deviceSupported && cameraStatus == .notDetermined {
                    Button("Permitir cámara para continuar") {
                        AVCaptureDevice.requestAccess(for: .video) { _ in
                            DispatchQueue.main.async {
                                cameraStatus = AVCaptureDevice.authorizationStatus(for: .video)
                            }
                        }
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.large)
                    .frame(maxWidth: .infinity)
                } else {
                    Button {
                        path.append(.practice)
                    } label: {
                        Text("Practicar primero")
                            .font(.headline)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 6)
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.large)
                    .disabled(!deviceSupported || cameraStatus != .authorized)
                }
            }
            .padding(24)
        }
        .navigationBarTitleDisplayMode(.inline)
    }

    private var orientationDemo: some View {
        HStack(spacing: 20) {
            ForEach([GapOrientation.up, .down, .left, .right], id: \.self) { orientation in
                VStack(spacing: 6) {
                    StimulusView(gapOrientation: orientation, sizePoints: 56)
                    Image(systemName: symbolName(for: orientation))
                        .font(.headline)
                        .foregroundStyle(.tint)
                }
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 8)
    }

    private func symbolName(for orientation: GapOrientation) -> String {
        switch orientation {
        case .up: return "arrow.up"
        case .down: return "arrow.down"
        case .left: return "arrow.left"
        case .right: return "arrow.right"
        default: return "questionmark"
        }
    }

    private func instruction(_ number: Int, _ text: String) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Text("\(number)")
                .font(.subheadline.bold())
                .frame(width: 24, height: 24)
                .background(.tint.opacity(0.15), in: Circle())
            Text(text)
                .font(.subheadline)
        }
    }
}
