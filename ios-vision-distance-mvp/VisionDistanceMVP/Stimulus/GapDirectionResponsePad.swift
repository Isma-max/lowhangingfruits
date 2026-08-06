import SwiftUI
import VisionMVPCore

/// 8-alternative forced-choice input for the Landolt C gap direction, laid
/// out as a 3x3 compass grid (center empty) so the spatial arrangement of
/// buttons matches the spatial meaning of the answer — no reading required,
/// which matters since near-vision difficulty is exactly what's being
/// studied.
struct GapDirectionResponsePad: View {
    var onSelect: (GapOrientation) -> Void

    private let grid: [[GapOrientation?]] = [
        [.upLeft, .up, .upRight],
        [.left, nil, .right],
        [.downLeft, .down, .downRight],
    ]

    var body: some View {
        VStack(spacing: 12) {
            ForEach(0..<grid.count, id: \.self) { row in
                HStack(spacing: 12) {
                    ForEach(0..<grid[row].count, id: \.self) { column in
                        if let orientation = grid[row][column] {
                            Button {
                                onSelect(orientation)
                            } label: {
                                Image(systemName: symbolName(for: orientation))
                                    .font(.title2.weight(.semibold))
                                    .frame(width: 56, height: 56)
                            }
                            .buttonStyle(.bordered)
                            .accessibilityLabel(accessibilityLabel(for: orientation))
                        } else {
                            Color.clear.frame(width: 56, height: 56)
                        }
                    }
                }
            }
        }
    }

    private func symbolName(for orientation: GapOrientation) -> String {
        switch orientation {
        case .up: return "arrow.up"
        case .upRight: return "arrow.up.right"
        case .right: return "arrow.right"
        case .downRight: return "arrow.down.right"
        case .down: return "arrow.down"
        case .downLeft: return "arrow.down.left"
        case .left: return "arrow.left"
        case .upLeft: return "arrow.up.left"
        }
    }

    private func accessibilityLabel(for orientation: GapOrientation) -> String {
        switch orientation {
        case .up: return "Arriba"
        case .upRight: return "Arriba a la derecha"
        case .right: return "Derecha"
        case .downRight: return "Abajo a la derecha"
        case .down: return "Abajo"
        case .downLeft: return "Abajo a la izquierda"
        case .left: return "Izquierda"
        case .upLeft: return "Arriba a la izquierda"
        }
    }
}
