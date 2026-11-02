import Foundation

// A dietician's work, against /api/dietician/*.
//
// The same bargain the clinician side keeps: every rule lives on the server.
// The schools are the ones this person was assigned; a child outside them is
// refused with the same message as a child that does not exist; the child's
// record carries growth, haemoglobin and the food log and nothing else,
// because the query filters rather than the screen hiding.

extension APIClient {
    /// The schools this dietician was assigned, and who they are.
    func dieticianSchools() async throws -> DieticianSchools {
        try await get("/api/dietician/schools")
    }

    func dieticianChildren(schoolId: String, query: String = "") async throws -> [DieticianChild] {
        let reply: DieticianChildren = try await get("/api/dietician/children",
                                                     query: ["school_id": schoolId, "q": query])
        return reply.children
    }

    /// One child's record. Opening it is written to the access trail.
    func dieticianChild(_ kidId: String) async throws -> DieticianChildRecord {
        try await get("/api/dietician/child", query: ["kid_id": kidId])
    }

    /// Write a plan. The server ends whatever was running before it, and
    /// refuses one without something a family can act on, in its own words.
    func saveDietPlan(kidId: String, title: String, focus: String, startsOn: String = "",
                      guidance: String, targets: [DietTarget]) async throws -> DieticianPlan? {
        let reply: DieticianPlanSaved = try await post("/api/dietician/plan", json: [
            "kidId": kidId,
            "title": title,
            "focus": focus,
            "startsOn": startsOn,
            "endsOn": "",
            "guidance": guidance,
            "targets": targets.map(\.body),
        ])
        return reply.plan
    }

    /// The children at one school, grouped by what their checks found.
    func dieticianCohorts(schoolId: String, grade: String = "") async throws -> DieticianCohorts {
        try await get("/api/dietician/cohorts", query: ["school_id": schoolId, "grade": grade])
    }

    /// A first draft of a group's plan from the model. The server sends it the
    /// group's make-up and never a name, and falls back to its own rules when
    /// the model is not there or answers nonsense.
    func cohortDraft(schoolId: String, key: String, grade: String) async throws -> CohortDraft {
        let reply: CohortDraftResponse = try await post("/api/dietician/cohort-draft", json: [
            "schoolId": schoolId, "key": key, "grade": grade,
        ])
        return reply.draft
    }

    /// The twelve pre-camp plans, written or still starter drafts.
    func dieticianTemplates() async throws -> DietTemplates {
        try await get("/api/dietician/templates")
    }

    /// Write or rewrite one pre-camp plan. The server sets its focus from the
    /// group. Answers with all twelve.
    func saveDieticianTemplate(key: String, title: String, guidance: String,
                               targets: [DietTarget]) async throws -> DietTemplates {
        try await post("/api/dietician/templates", json: [
            "key": key,
            "title": title,
            "guidance": guidance,
            "targets": targets.map(\.body),
        ])
    }

    /// One plan to every child ticked. All of them or none: the server checks
    /// each is at one of this person's schools. Returns how many it went to.
    func saveCohortPlan(kidIds: [String], title: String, focus: String, guidance: String,
                        targets: [DietTarget]) async throws -> Int {
        let reply: CohortPlanSaved = try await post("/api/dietician/cohort-plan", json: [
            "kidIds": kidIds,
            "title": title,
            "focus": focus,
            "guidance": guidance,
            "targets": targets.map(\.body),
        ])
        return reply.saved
    }

    /// The articles this dietician has written for the family reading list.
    func dieticianArticles() async throws -> [LibraryArticle] {
        let reply: MyArticles = try await get("/api/dietician/articles")
        return reply.articles
    }

    /// Publish or update one of their own articles. The server refuses an
    /// article somebody else wrote, so a colliding slug is a refusal to read
    /// rather than a silent overwrite.
    func saveArticle(slug: String, locale: String, title: String, summary: String, body: String,
                     checkTypes: [String], flags: [String]) async throws {
        try await post("/api/dietician/articles", json: [
            "slug": slug,
            "locale": locale,
            "title": title,
            "summary": summary,
            "body": body,
            "checkTypes": checkTypes,
            "flags": flags,
            "published": true,
        ])
    }
}
