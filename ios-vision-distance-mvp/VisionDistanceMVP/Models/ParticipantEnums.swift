import Foundation

/// Age band, not exact age, per brief section 6 ("Edad o banda de edad" —
/// "No utilizar edad como resultado automático. Es una variable del análisis
/// posterior."). Bands are narrower around the typical presbyopia onset range
/// (40s) since that's where the research question is most sensitive to age.
enum AgeBand: String, Codable, CaseIterable, Identifiable {
    case under30 = "under_30"
    case age30to39 = "30_39"
    case age40to44 = "40_44"
    case age45to49 = "45_49"
    case age50to54 = "50_54"
    case age55to59 = "55_59"
    case age60to64 = "60_64"
    case age65plus = "65_plus"

    var id: String { rawValue }

    var displayLabel: String {
        switch self {
        case .under30: return "Menos de 30"
        case .age30to39: return "30–39"
        case .age40to44: return "40–44"
        case .age45to49: return "45–49"
        case .age50to54: return "50–54"
        case .age55to59: return "55–59"
        case .age60to64: return "60–64"
        case .age65plus: return "65 o más"
        }
    }
}

enum DominantHand: String, Codable, CaseIterable, Identifiable {
    case left, right, ambidextrous, preferNotToSay = "prefer_not_to_say"

    var id: String { rawValue }

    var displayLabel: String {
        switch self {
        case .left: return "Izquierda"
        case .right: return "Derecha"
        case .ambidextrous: return "Ambidiestra"
        case .preferNotToSay: return "Prefiero no decir"
        }
    }
}

/// Brief section 6, "Tipo de lentes" — exact list from the brief, verbatim order.
enum GlassesType: String, Codable, CaseIterable, Identifiable {
    case none
    case distanceGlasses = "distance_glasses"
    case readingGlasses = "reading_glasses"
    case bifocals
    case progressives
    case monofocalContacts = "monofocal_contacts"
    case multifocalContacts = "multifocal_contacts"
    case monovision
    case other

    var id: String { rawValue }

    var displayLabel: String {
        switch self {
        case .none: return "Ninguno"
        case .distanceGlasses: return "Lentes de lejos"
        case .readingGlasses: return "Lentes de lectura"
        case .bifocals: return "Bifocales"
        case .progressives: return "Progresivos"
        case .monofocalContacts: return "Contactos monofocales"
        case .multifocalContacts: return "Contactos multifocales"
        case .monovision: return "Monovisión"
        case .other: return "Otro"
        }
    }
}
