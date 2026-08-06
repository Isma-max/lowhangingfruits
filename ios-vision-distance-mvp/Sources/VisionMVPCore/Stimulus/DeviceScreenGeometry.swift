import Foundation

/// Physical active-display size (portrait), in millimeters.
public struct ScreenPhysicalSize: Equatable, Sendable {
    public var widthMillimeters: Double
    public var heightMillimeters: Double

    public init(widthMillimeters: Double, heightMillimeters: Double) {
        self.widthMillimeters = widthMillimeters
        self.heightMillimeters = heightMillimeters
    }
}

/// iOS exposes no public API for a screen's physical size in millimeters —
/// only point/pixel dimensions and `UIScreen.scale`. To convert a stimulus
/// size from millimeters (what angular-size math produces) into points (what
/// SwiftUI draws), we need the physical width, so this is a hardcoded lookup
/// table keyed by hardware model identifier (`utsname().machine`, e.g.
/// `"iPhone15,2"`), limited to Face ID / TrueDepth-capable iPhones (iPhone X
/// onward — TrueDepth is required for the distance module, so any device
/// missing from this table is also a device the compatibility screen should
/// already be rejecting).
///
/// Values are `width_px / ppi * 25.4` and `height_px / ppi * 25.4`, computed
/// from each model's published resolution and pixel density (not from a
/// vaguer "diagonal inches" figure, and not from the outer case dimensions,
/// which include bezel and are NOT the active display area). Resolution/ppi
/// pairs were cross-checked against multiple independent sources during
/// development (see DECISIONS.md for the full list and computation).
///
/// IMPORTANT: this was populated from reference lookups at development time,
/// not measured on physical hardware and not fetched at build/run time.
/// Devices released after this file was written will be missing. Verify
/// against Apple's published tech specs (support.apple.com, per-model page)
/// before trusting angular-size accuracy for anything beyond feasibility
/// testing, and extend this table for any new TrueDepth iPhone.
public enum DeviceScreenGeometry {
    public static let physicalSizeByModelIdentifier: [String: ScreenPhysicalSize] = [
        // 1125x2436 px @ 458 ppi -> 62.39 x 135.10 mm
        "iPhone10,3": ScreenPhysicalSize(widthMillimeters: 62.39, heightMillimeters: 135.10), // iPhone X (global)
        "iPhone10,6": ScreenPhysicalSize(widthMillimeters: 62.39, heightMillimeters: 135.10), // iPhone X (GSM)
        "iPhone11,2": ScreenPhysicalSize(widthMillimeters: 62.39, heightMillimeters: 135.10), // iPhone XS
        "iPhone12,3": ScreenPhysicalSize(widthMillimeters: 62.39, heightMillimeters: 135.10), // iPhone 11 Pro

        // 1242x2688 px @ 458 ppi -> 68.90 x 149.06 mm
        "iPhone11,4": ScreenPhysicalSize(widthMillimeters: 68.90, heightMillimeters: 149.06), // iPhone XS Max (global)
        "iPhone11,6": ScreenPhysicalSize(widthMillimeters: 68.90, heightMillimeters: 149.06), // iPhone XS Max (GSM)
        "iPhone12,5": ScreenPhysicalSize(widthMillimeters: 68.90, heightMillimeters: 149.06), // iPhone 11 Pro Max

        // 828x1792 px @ 326 ppi -> 64.51 x 139.62 mm
        "iPhone11,8": ScreenPhysicalSize(widthMillimeters: 64.51, heightMillimeters: 139.62), // iPhone XR
        "iPhone12,1": ScreenPhysicalSize(widthMillimeters: 64.51, heightMillimeters: 139.62), // iPhone 11

        // 1080x2340 px @ 476 ppi -> 57.65 x 124.87 mm
        "iPhone13,1": ScreenPhysicalSize(widthMillimeters: 57.65, heightMillimeters: 124.87), // iPhone 12 mini
        "iPhone14,4": ScreenPhysicalSize(widthMillimeters: 57.65, heightMillimeters: 124.87), // iPhone 13 mini

        // 1170x2532 px @ 460 ppi -> 64.59 x 139.77 mm
        "iPhone13,2": ScreenPhysicalSize(widthMillimeters: 64.59, heightMillimeters: 139.77), // iPhone 12
        "iPhone13,3": ScreenPhysicalSize(widthMillimeters: 64.59, heightMillimeters: 139.77), // iPhone 12 Pro
        "iPhone14,5": ScreenPhysicalSize(widthMillimeters: 64.59, heightMillimeters: 139.77), // iPhone 13
        "iPhone14,2": ScreenPhysicalSize(widthMillimeters: 64.59, heightMillimeters: 139.77), // iPhone 13 Pro
        "iPhone14,7": ScreenPhysicalSize(widthMillimeters: 64.59, heightMillimeters: 139.77), // iPhone 14

        // 1284x2778 px @ 458 ppi -> 71.22 x 154.02 mm
        "iPhone13,4": ScreenPhysicalSize(widthMillimeters: 71.22, heightMillimeters: 154.02), // iPhone 12 Pro Max
        "iPhone14,3": ScreenPhysicalSize(widthMillimeters: 71.22, heightMillimeters: 154.02), // iPhone 13 Pro Max
        "iPhone14,8": ScreenPhysicalSize(widthMillimeters: 71.22, heightMillimeters: 154.02), // iPhone 14 Plus

        // 1179x2556 px @ 460 ppi -> 65.09 x 141.15 mm
        "iPhone15,2": ScreenPhysicalSize(widthMillimeters: 65.09, heightMillimeters: 141.15), // iPhone 14 Pro
        "iPhone15,4": ScreenPhysicalSize(widthMillimeters: 65.09, heightMillimeters: 141.15), // iPhone 15
        "iPhone16,1": ScreenPhysicalSize(widthMillimeters: 65.09, heightMillimeters: 141.15), // iPhone 15 Pro
        "iPhone17,3": ScreenPhysicalSize(widthMillimeters: 65.09, heightMillimeters: 141.15), // iPhone 16

        // 1290x2796 px @ 460 ppi -> 71.24 x 154.37 mm
        "iPhone15,3": ScreenPhysicalSize(widthMillimeters: 71.24, heightMillimeters: 154.37), // iPhone 14 Pro Max
        "iPhone15,5": ScreenPhysicalSize(widthMillimeters: 71.24, heightMillimeters: 154.37), // iPhone 15 Plus
        "iPhone16,2": ScreenPhysicalSize(widthMillimeters: 71.24, heightMillimeters: 154.37), // iPhone 15 Pro Max
        "iPhone17,4": ScreenPhysicalSize(widthMillimeters: 71.24, heightMillimeters: 154.37), // iPhone 16 Plus

        // 1206x2622 px @ 460 ppi -> 66.60 x 144.79 mm
        "iPhone17,1": ScreenPhysicalSize(widthMillimeters: 66.60, heightMillimeters: 144.79), // iPhone 16 Pro

        // 1320x2868 px @ 460 ppi -> 72.89 x 158.36 mm
        "iPhone17,2": ScreenPhysicalSize(widthMillimeters: 72.89, heightMillimeters: 158.36), // iPhone 16 Pro Max
    ]

    /// `nil` for any identifier not in the table — callers must treat this as
    /// "angular size not calibrated precisely" and record that explicitly in
    /// the session, never silently fall back to a guessed value.
    public static func physicalSize(forModelIdentifier identifier: String) -> ScreenPhysicalSize? {
        physicalSizeByModelIdentifier[identifier]
    }
}
