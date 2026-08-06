import Foundation
import SwiftData

/// Brief section 5: "No almacenar nombre, RUT, correo, teléfono ni otros
/// identificadores personales." `pseudonymousID` is investigator-assigned
/// free text (e.g. "P07") — never validated against or linked to real
/// identity by this app.
@Model
final class Participant {
    @Attribute(.unique) var pseudonymousID: String
    var ageBandRaw: String
    var dominantHandRaw: String?
    var habitualGlassesUse: Bool
    var glassesTypeRaw: String
    var testsWithGlasses: Bool
    var lastPrescriptionApproxDate: Date?
    var nearReadingDifficulty0to10: Int
    var focusFatigue0to10: Int
    var createdAt: Date

    @Relationship(deleteRule: .cascade, inverse: \SessionRecord.participant)
    var sessions: [SessionRecord] = []

    init(
        pseudonymousID: String,
        ageBand: AgeBand,
        dominantHand: DominantHand?,
        habitualGlassesUse: Bool,
        glassesType: GlassesType,
        testsWithGlasses: Bool,
        lastPrescriptionApproxDate: Date?,
        nearReadingDifficulty0to10: Int,
        focusFatigue0to10: Int
    ) {
        self.pseudonymousID = pseudonymousID
        self.ageBandRaw = ageBand.rawValue
        self.dominantHandRaw = dominantHand?.rawValue
        self.habitualGlassesUse = habitualGlassesUse
        self.glassesTypeRaw = glassesType.rawValue
        self.testsWithGlasses = testsWithGlasses
        self.lastPrescriptionApproxDate = lastPrescriptionApproxDate
        self.nearReadingDifficulty0to10 = nearReadingDifficulty0to10
        self.focusFatigue0to10 = focusFatigue0to10
        self.createdAt = Date()
    }

    var ageBand: AgeBand {
        get { AgeBand(rawValue: ageBandRaw) ?? .under30 }
        set { ageBandRaw = newValue.rawValue }
    }

    var dominantHand: DominantHand? {
        get { dominantHandRaw.flatMap(DominantHand.init(rawValue:)) }
        set { dominantHandRaw = newValue?.rawValue }
    }

    var glassesType: GlassesType {
        get { GlassesType(rawValue: glassesTypeRaw) ?? .other }
        set { glassesTypeRaw = newValue.rawValue }
    }
}
