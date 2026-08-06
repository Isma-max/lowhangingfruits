import Foundation
import SwiftData

/// Local-only persistence (brief section 3: "Sin backend para esta primera
/// versión"; section 4 privacy priority). `cloudKitDatabase: .none` is
/// explicit rather than relying on the default, so this can never silently
/// start syncing if CloudKit capabilities are ever added to the Xcode
/// project for some other reason.
enum SwiftDataStack {
    static let shared: ModelContainer = {
        let schema = Schema([Participant.self, SessionRecord.self])
        let configuration = ModelConfiguration(
            schema: schema,
            isStoredInMemoryOnly: false,
            cloudKitDatabase: .none
        )
        do {
            return try ModelContainer(for: schema, configurations: [configuration])
        } catch {
            fatalError("No se pudo crear el almacenamiento local: \(error)")
        }
    }()
}
