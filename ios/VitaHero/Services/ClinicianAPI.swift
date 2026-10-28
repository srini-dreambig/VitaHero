import Foundation

// A clinician's camp day, against endpoints that already know the rules.
//
// my-camps returns only the camps this person was assigned to; the screening
// form narrows its checks to their specialty and the guardian's consent; the
// save refuses a check outside either. None of that is re-implemented on the
// phone, so a stale build cannot widen what a doctor may record. The paths say
// "admin" because that is where the programme's API lives: the Worker scopes
// every answer to whoever holds the session.

extension APIClient {
    func myCamps() async throws -> [ClinicianCamp] {
        let reply: ClinicianCamps = try await get("/api/admin/my-camps")
        return reply.camps
    }

    func campRoster(_ campId: String) async throws -> CampRoster {
        try await get("/api/admin/camps/\(campId)/participants")
    }

    func setAttendance(campId: String, kidId: String, attendance: String) async throws {
        try await post("/api/admin/camps/\(campId)/attendance", json: ["kidId": kidId, "attendance": attendance])
    }

    func screeningForm(campId: String, kidId: String) async throws -> ScreeningForm {
        try await get("/api/admin/camps/\(campId)/screening/\(kidId)")
    }

    /// Readings go up as the form collected them. No flag is sent for a
    /// measurement: the server decides what a reading means. The one flag a
    /// device sends is NOT_MEASURED, with the reason as the note.
    func saveScreening(campId: String, kidId: String, findings: [[String: Any]]) async throws {
        try await post("/api/admin/camps/\(campId)/screening/\(kidId)", json: ["findings": findings])
    }

    func reviewQueue(_ campId: String) async throws -> [ReviewQueueItem] {
        let reply: ReviewQueue = try await get("/api/admin/camps/\(campId)/review")
        return reply.queue
    }

    func reviewDetail(campId: String, kidId: String) async throws -> ReviewDetail {
        try await get("/api/admin/camps/\(campId)/review/\(kidId)")
    }

    /// Sign off this physician's checks on one child. `flags` holds only the
    /// flags they moved: a specialist touching another specialty's check is
    /// refused (NOT_YOUR_CHECK). The server also refuses without a
    /// recommendation, for one of their checks not yet recorded
    /// (CHECKS_OUTSTANDING), for a child not theirs (NOT_YOUR_CHILD) and for
    /// one already released; those refusals reach the screen as written.
    func approve(campId: String, kidId: String, flags: [String: String], urgency: String,
                 recommendation: String) async throws -> SignOffResult {
        let findings: [[String: Any]] = flags.keys.sorted().map {
            ["checkType": $0, "flag": flags[$0] ?? "", "note": ""]
        }
        return try await post("/api/admin/camps/\(campId)/review/\(kidId)", json: [
            "findings": findings,
            "urgency": urgency,
            "recommendation": recommendation,
        ])
    }

    /// Release every approved child on this camp at once, as the server
    /// models it: results become visible, referrals open, urgent guardians
    /// are texted. There is no per-child release.
    func release(_ campId: String) async throws -> ReleaseResult {
        try await post("/api/admin/camps/\(campId)/release", json: [String: Any]())
    }
}
