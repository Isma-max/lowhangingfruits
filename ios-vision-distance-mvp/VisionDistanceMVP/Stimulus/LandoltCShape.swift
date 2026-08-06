import SwiftUI
import VisionMVPCore

/// Standard Landolt C: gap width = stroke width = 1/5 of the ring's outer
/// diameter. `gapOrientation.rotationDegrees` is compass-style (0° = gap at
/// top, clockwise — defined in `VisionMVPCore.GapOrientation`); converted
/// here to SwiftUI's arc-angle convention (0° = east/3 o'clock) via
/// `compassDegrees - 90`.
///
/// NOTE: this environment cannot render SwiftUI, so the exact on-screen gap
/// position for each `GapOrientation` has not been visually verified on a
/// device. This does not affect measurement validity — the same shape is
/// used both to render the stimulus and to build the response buttons in
/// the vision-test screens, so truth/response scoring stays internally
/// consistent regardless of which physical direction is actually "up" —
/// but do a quick visual check on first device run and adjust
/// `compassDegrees - 90` below if the gap doesn't appear where the label
/// says it should.
struct LandoltCShape: Shape {
    var gapOrientation: GapOrientation

    func path(in rect: CGRect) -> Path {
        let diameter = min(rect.width, rect.height)
        let strokeWidth = diameter / 5.0
        let radius = (diameter - strokeWidth) / 2.0
        guard radius > 0 else { return Path() }
        let center = CGPoint(x: rect.midX, y: rect.midY)

        let gapLinearWidth = strokeWidth
        let halfGapAngleRadians = asin(min(1, (gapLinearWidth / 2) / radius))
        let halfGapAngleDegrees = halfGapAngleRadians * 180.0 / .pi

        let gapCenterDegrees = gapOrientation.rotationDegrees - 90
        let startDegrees = gapCenterDegrees + halfGapAngleDegrees
        let sweepDegrees = 360.0 - (halfGapAngleDegrees * 2)
        let endDegrees = startDegrees + sweepDegrees

        var path = Path()
        path.addArc(
            center: center,
            radius: radius,
            startAngle: .degrees(startDegrees),
            endAngle: .degrees(endDegrees),
            clockwise: false
        )

        return path.strokedPath(StrokeStyle(lineWidth: strokeWidth, lineCap: .butt))
    }
}

/// Renders a `LandoltCShape` at a fixed on-screen size in points (already
/// converted from the target physical/angular size by the caller via
/// `StimulusScaler`), on a plain background so nothing else in view could
/// act as an inadvertent size/contrast cue.
struct StimulusView: View {
    var gapOrientation: GapOrientation
    var sizePoints: Double
    var color: Color = .primary

    var body: some View {
        LandoltCShape(gapOrientation: gapOrientation)
            .fill(color)
            .frame(width: sizePoints, height: sizePoints)
            .accessibilityHidden(true) // a screen-reader announcement would defeat the visual task
    }
}
