import Foundation
import VisionMVPCore

/// Accumulates trials/crossings across all sub-tests run within one Vision
/// Test module visit, and exports them together. Brief section 2's four
/// sub-tests map 1:1 to `VisionMVPCore.TaskPhase`:
/// - `.staticBaseline`: fixed distance, staircase on physical size — the
///   "simpler variable" comparison arm (objective #4).
/// - `.dynamicConstantAngularSize` / `.dynamicFixedPhysicalSize`: free
///   movement, repeated forced-choice trials logged continuously while
///   distance changes — objective #3 (does rescaling matter?).
/// - `.blurCrossing`: free movement, participant marks the clear/blurry
///   boundary directly — objective #2.
@MainActor
final class VisionTestSession: ObservableObject {
    @Published private(set) var trials: [VisionTrialRecord] = []
    @Published private(set) var crossings: [BlurCrossingRecord] = []

    func record(_ trial: VisionTrialRecord) {
        trials.append(trial)
    }

    func record(_ crossing: BlurCrossingRecord) {
        crossings.append(crossing)
    }

    func exportTrialsAndCrossings(sessionID: UUID) throws {
        if !trials.isEmpty {
            try FileStore.writeCSV(trials, filename: "vision_trials.csv", sessionID: sessionID)
        }
        if !crossings.isEmpty {
            try FileStore.writeCSV(crossings, filename: "blur_crossings.csv", sessionID: sessionID)
        }
    }
}
