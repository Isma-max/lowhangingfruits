import Foundation
import SwiftData

@MainActor
final class SessionRepository: ObservableObject {
    let modelContext: ModelContext

    init(modelContext: ModelContext) {
        self.modelContext = modelContext
    }

    func fetchParticipant(pseudonymousID: String) -> Participant? {
        let descriptor = FetchDescriptor<Participant>(
            predicate: #Predicate { $0.pseudonymousID == pseudonymousID }
        )
        return try? modelContext.fetch(descriptor).first
    }

    func allParticipants() -> [Participant] {
        let descriptor = FetchDescriptor<Participant>(sortBy: [SortDescriptor(\.createdAt, order: .reverse)])
        return (try? modelContext.fetch(descriptor)) ?? []
    }

    func allSessions() -> [SessionRecord] {
        let descriptor = FetchDescriptor<SessionRecord>(sortBy: [SortDescriptor(\.createdAt, order: .reverse)])
        return (try? modelContext.fetch(descriptor)) ?? []
    }

    func insert(_ participant: Participant) {
        modelContext.insert(participant)
    }

    func insert(_ session: SessionRecord) {
        modelContext.insert(session)
    }

    func delete(_ session: SessionRecord) {
        modelContext.delete(session)
    }

    func save() {
        try? modelContext.save()
    }
}
