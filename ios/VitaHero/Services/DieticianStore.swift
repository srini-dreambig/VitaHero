import Foundation

/// A dietician's schools, the children at the one being worked, its groups,
/// and the articles they have written.
///
/// Nothing here decides who may be seen: the server scopes every answer to the
/// schools this person was assigned. One child's record is held by the screen
/// that opens it, which tells this store when a plan was saved so the class
/// list behind it is right on return.
@MainActor
final class DieticianStore: ObservableObject {
    @Published private(set) var me = DieticianMe()
    @Published private(set) var schools: [DieticianSchool] = []
    @Published private(set) var schoolsLoading = false
    @Published private(set) var schoolsError: String?

    @Published private(set) var children: [DieticianChild] = []
    @Published private(set) var childrenSchoolId: String?
    @Published private(set) var childrenLoading = false
    @Published private(set) var childrenError: String?

    @Published private(set) var cohorts: DieticianCohorts?
    @Published private(set) var cohortsSchoolId: String?
    @Published private(set) var cohortsLoading = false
    @Published private(set) var cohortsError: String?

    @Published private(set) var templates: DietTemplates?
    @Published private(set) var templatesLoading = false
    @Published private(set) var templatesError: String?

    @Published private(set) var articles: [LibraryArticle] = []
    @Published private(set) var articlesLoading = false
    @Published private(set) var articlesError: String?

    private let api = APIClient.shared

    func reset() {
        me = DieticianMe()
        schools = []; schoolsError = nil
        children = []; childrenSchoolId = nil; childrenError = nil
        cohorts = nil; cohortsSchoolId = nil; cohortsError = nil
        templates = nil; templatesError = nil
        articles = []; articlesError = nil
    }

    // MARK: Schools

    func loadSchools() async {
        schoolsLoading = true
        defer { schoolsLoading = false }
        do {
            let reply = try await api.dieticianSchools()
            me = reply.me
            schools = reply.schools
            schoolsError = nil
        } catch is CancellationError {
        } catch APIError.unauthorized {
        } catch {
            schoolsError = clinicianMessage(error,
                fallback: "Your schools could not be loaded. Check the connection and try again.")
        }
    }

    // MARK: Children

    /// An empty list is a real answer, a school with no roster yet, so it
    /// replaces what was there. A failure does not.
    func loadChildren(_ schoolId: String) async {
        if childrenSchoolId != schoolId { children = [] }
        childrenSchoolId = schoolId
        childrenLoading = true
        defer { childrenLoading = false }
        do {
            children = try await api.dieticianChildren(schoolId: schoolId)
            childrenError = nil
        } catch is CancellationError {
        } catch APIError.unauthorized {
        } catch {
            childrenError = clinicianMessage(error,
                fallback: "That list could not be loaded. Check the connection and try again.")
        }
    }

    /// Write one child's plan. On success the class list shows them on one.
    func savePlan(kidId: String, title: String, focus: String, guidance: String,
                  targets: [DietTarget]) async -> Result<DieticianPlan, Error> {
        do {
            guard let plan = try await api.saveDietPlan(kidId: kidId, title: title, focus: focus,
                                                        guidance: guidance, targets: targets) else {
                return .failure(APIError.refused(status: 200, code: "", message: "The plan did not come back"))
            }
            if let index = children.firstIndex(where: { $0.kidId == kidId }) {
                children[index].hasPlan = true
            }
            return .success(plan)
        } catch {
            return .failure(error)
        }
    }

    // MARK: Groups

    func loadCohorts(_ schoolId: String, grade: String) async {
        if cohortsSchoolId != schoolId { cohorts = nil }
        cohortsSchoolId = schoolId
        cohortsLoading = true
        defer { cohortsLoading = false }
        do {
            cohorts = try await api.dieticianCohorts(schoolId: schoolId, grade: grade)
            cohortsError = nil
        } catch is CancellationError {
        } catch APIError.unauthorized {
        } catch {
            cohortsError = clinicianMessage(error,
                fallback: "The groups could not be loaded. Check the connection and try again.")
        }
    }

    func cohortDraft(schoolId: String, key: String, grade: String) async -> Result<CohortDraft, Error> {
        do {
            return .success(try await api.cohortDraft(schoolId: schoolId, key: key, grade: grade))
        } catch {
            return .failure(error)
        }
    }

    /// Send one plan to every child ticked, then re-read the groups: who is
    /// on a plan is the server's to say.
    func saveCohortPlan(schoolId: String, grade: String, kidIds: [String], title: String, focus: String,
                        guidance: String, targets: [DietTarget]) async -> Result<Int, Error> {
        do {
            let saved = try await api.saveCohortPlan(kidIds: kidIds, title: title, focus: focus,
                                                     guidance: guidance, targets: targets)
            await loadCohorts(schoolId, grade: grade)
            if childrenSchoolId == schoolId { await loadChildren(schoolId) }
            return .success(saved)
        } catch {
            return .failure(error)
        }
    }

    // MARK: Pre-camp plans

    func loadTemplates() async {
        templatesLoading = true
        defer { templatesLoading = false }
        do {
            templates = try await api.dieticianTemplates()
            templatesError = nil
        } catch is CancellationError {
        } catch APIError.unauthorized {
        } catch {
            templatesError = clinicianMessage(error,
                fallback: "The pre-camp plans could not be loaded. Check the connection and try again.")
        }
    }

    /// Save one, then re-read the groups if open: their drafts start from these.
    func saveTemplate(key: String, title: String, guidance: String,
                      targets: [DietTarget]) async -> Result<Void, Error> {
        do {
            templates = try await api.saveDieticianTemplate(key: key, title: title, guidance: guidance,
                                                            targets: targets)
            if let schoolId = cohortsSchoolId { await loadCohorts(schoolId, grade: "") }
            return .success(())
        } catch {
            return .failure(error)
        }
    }

    // MARK: Articles

    func loadArticles() async {
        articlesLoading = true
        defer { articlesLoading = false }
        do {
            articles = try await api.dieticianArticles()
            articlesError = nil
        } catch is CancellationError {
        } catch APIError.unauthorized {
        } catch {
            articlesError = clinicianMessage(error, fallback: "Your articles could not be loaded. Check the connection.")
        }
    }

    /// Publish an article, or update one of their own.
    ///
    /// The slug comes from the title so a dietician never thinks about
    /// url-safe text; the server normalises it again and refuses one too short.
    /// Nutrition is why a dietician writes, so the article is offered to
    /// families whose child was flagged on one of the two checks this role reads.
    func saveArticle(title: String, summary: String, body: String, locale: String) async -> Result<Void, Error> {
        let slug = title.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            .replacingOccurrences(of: "[^a-z0-9]+", with: "-", options: .regularExpression)
            .trimmingCharacters(in: CharacterSet(charactersIn: "-"))
        do {
            try await api.saveArticle(
                slug: slug, locale: locale,
                title: title.trimmingCharacters(in: .whitespacesAndNewlines),
                summary: summary.trimmingCharacters(in: .whitespacesAndNewlines),
                body: body.trimmingCharacters(in: .whitespacesAndNewlines),
                checkTypes: ["Height & weight", "Haemoglobin"],
                flags: ["WATCH", "ALERT"])
            await loadArticles()
            return .success(())
        } catch {
            return .failure(error)
        }
    }
}
