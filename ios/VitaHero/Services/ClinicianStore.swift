import Foundation

/// The clinician's camps, the roster being worked and its review queue.
///
/// Screens that open one child (the screening form, the review of one child)
/// keep that child's state themselves and tell this store what changed, so the
/// roster and queue behind them are right when they close without a reload.
@MainActor
final class ClinicianStore: ObservableObject {
    @Published private(set) var camps: [ClinicianCamp] = []
    @Published private(set) var campsLoading = false
    @Published private(set) var campsError: String?

    @Published private(set) var roster: CampRoster?
    @Published private(set) var rosterCampId: String?
    @Published private(set) var rosterLoading = false
    @Published private(set) var rosterError: String?

    @Published private(set) var queue: [ReviewQueueItem] = []
    @Published private(set) var queueLoading = false
    @Published private(set) var queueError: String?

    private let api = APIClient.shared

    func reset() {
        camps = []; campsError = nil
        roster = nil; rosterCampId = nil; rosterError = nil
        queue = []; queueError = nil
    }

    // MARK: Camps

    func loadCamps() async {
        campsLoading = true
        defer { campsLoading = false }
        do {
            camps = try await api.myCamps()
            campsError = nil
        } catch is CancellationError {
        } catch APIError.unauthorized {
        } catch {
            campsError = L("clin_err_camps")
        }
    }

    // MARK: Roster

    func loadRoster(_ campId: String) async {
        if rosterCampId != campId { roster = nil }
        rosterCampId = campId
        rosterLoading = true
        defer { rosterLoading = false }
        do {
            roster = try await api.campRoster(campId)
            rosterError = nil
        } catch is CancellationError {
        } catch APIError.unauthorized {
        } catch {
            rosterError = L("clin_err_roster")
        }
    }

    /// Mark a child present or absent. Returns the failure to show, or nil.
    func markAttendance(campId: String, kidId: String, attendance: String) async -> String? {
        do {
            try await api.setAttendance(campId: campId, kidId: kidId, attendance: attendance)
            updateChild(kidId) { $0.attendance = attendance }
            return nil
        } catch {
            return L("clin_err_attendance")
        }
    }

    /// What a save did to the roster row, so the list is right on return.
    func noteSaved(kidId: String, absentOnly: Bool) {
        updateChild(kidId) { child in
            if absentOnly {
                child.attendance = "ABSENT"
                child.status = "ABSENT"
            } else {
                child.status = "SCREENED"
            }
        }
    }

    private func updateChild(_ kidId: String, _ change: (inout CampChild) -> Void) {
        guard var current = roster, let index = current.participants.firstIndex(where: { $0.kidId == kidId }) else { return }
        change(&current.participants[index])
        roster = current
    }

    // MARK: Review

    func loadQueue(_ campId: String) async {
        queueLoading = true
        defer { queueLoading = false }
        do {
            queue = try await api.reviewQueue(campId)
            queueError = nil
        } catch is CancellationError {
        } catch APIError.unauthorized {
        } catch {
            queueError = error.localizedDescription
        }
    }

    func noteApproved(kidId: String, urgency: String) {
        guard let index = queue.firstIndex(where: { $0.kidId == kidId }) else { return }
        queue[index].status = "APPROVED"
        queue[index].reviewed = true
        queue[index].urgency = urgency
    }

    /// Release the camp. The result, or the server's refusal as written.
    func release(_ campId: String) async -> Result<ReleaseResult, Error> {
        do {
            let result = try await api.release(campId)
            await loadQueue(campId)
            return .success(result)
        } catch {
            return .failure(error)
        }
    }
}
