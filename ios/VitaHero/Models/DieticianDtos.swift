import Foundation

// The dietician's side of the wire, read through the same lenient helpers as
// every other payload. Keys match functions/dietician.ts and the Android
// DieticianDtos.kt one for one; a key the server drops reads as empty rather
// than taking the screen down.

struct DieticianMe: Decodable {
    let id: String
    let name: String
    let qualification: String

    init() {
        id = ""; name = ""; qualification = ""
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: AnyKey.self)
        id = c.str("id")
        name = c.str("name")
        qualification = c.str("qualification")
    }
}

struct DieticianSchool: Decodable, Identifiable, Hashable {
    let id: String
    let name: String
    let city: String
    let children: Int
    /// Plans running at this school right now.
    let plans: Int

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: AnyKey.self)
        id = c.str("id")
        name = c.str("name")
        city = c.str("city")
        children = c.int("children")
        plans = c.int("plans")
    }
}

struct DieticianSchools: Decodable {
    let me: DieticianMe
    let schools: [DieticianSchool]

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: AnyKey.self)
        me = c.obj("me") ?? DieticianMe()
        schools = c.list("schools")
    }
}

struct DieticianChild: Decodable, Identifiable {
    var id: String { kidId }
    let kidId: String
    let name: String
    let grade: String
    let section: String
    let age: Int?
    let gender: String
    var hasPlan: Bool
    /// Growth or haemoglobin flagged at a released camp. The dental and eye
    /// findings are not this person's to see and never leave the server.
    let concerns: Int

    /// Grade and section as one class name, "5 B".
    var className: String {
        [grade, section].filter { !$0.isEmpty }.joined(separator: " ")
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: AnyKey.self)
        kidId = c.str("kidId")
        name = c.str("name")
        grade = c.str("grade")
        section = c.str("section")
        age = c.num("age").map { Int($0.rounded()) }
        gender = c.str("gender")
        hasPlan = c.bool("hasPlan")
        concerns = c.int("concerns")
    }
}

struct DieticianChildren: Decodable {
    let schoolId: String
    let children: [DieticianChild]

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: AnyKey.self)
        schoolId = c.str("schoolId")
        children = c.list("children")
    }
}

/// Growth or haemoglobin from a released camp. The detail object is not read:
/// the screen shows the server's own value text and rationale, as Android does.
struct DieticianFinding: Decodable {
    let checkType: String
    let flag: String
    let valueText: String
    let rationale: String
    let date: String
    let campTitle: String

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: AnyKey.self)
        checkType = c.str("checkType")
        flag = c.str("flag")
        valueText = c.str("valueText")
        rationale = c.str("rationale")
        date = c.str("date")
        campTitle = c.str("campTitle")
    }
}

/// One day of the food log, rolled up. Not every meal the child has eaten.
struct FoodLogDay: Decodable {
    let day: String
    let items: Int
    let eaten: Int
    let kcal: Int

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: AnyKey.self)
        day = c.str("day")
        items = c.int("items")
        eaten = c.int("eaten")
        kcal = c.int("kcal")
    }
}

/// One thing a plan aims for, "Iron-rich food" / "once a day".
struct DietTarget: Decodable, Hashable {
    var label: String
    var value: String

    init(label: String, value: String) {
        self.label = label
        self.value = value
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: AnyKey.self)
        label = c.str("label")
        value = c.str("value")
    }

    var body: [String: Any] { ["label": label, "value": value] }
}

/// A plan as the dietician sees it, running or ended. The guardian's own
/// `DietPlan` reads the same row; this one also carries its status.
struct DieticianPlan: Decodable {
    let id: String
    let kidId: String
    let title: String
    let focus: String
    let startsOn: String
    let endsOn: String
    let guidance: String
    let targets: [DietTarget]
    let status: String
    let authorName: String
    let createdAt: String

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: AnyKey.self)
        id = c.str("id")
        kidId = c.str("kidId")
        title = c.str("title")
        focus = c.str("focus", "GENERAL")
        startsOn = c.str("startsOn")
        endsOn = c.str("endsOn")
        guidance = c.str("guidance")
        targets = c.list("targets")
        status = c.str("status", "ACTIVE")
        authorName = c.str("authorName")
        createdAt = c.str("createdAt")
    }
}

/// The server's first draft of a plan, from what was actually found.
struct DietDraft: Decodable {
    let title: String
    let focus: String
    let guidance: String

    init() {
        title = ""; focus = "GENERAL"; guidance = ""
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: AnyKey.self)
        title = c.str("title")
        focus = c.str("focus", "GENERAL")
        guidance = c.str("guidance")
    }
}

struct DieticianChildProfile: Decodable {
    let kidId: String
    let name: String
    let grade: String
    let section: String
    let age: Int?
    let gender: String
    let schoolName: String
    let heightCm: Double
    let weightKg: Double

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: AnyKey.self)
        kidId = c.str("kidId")
        name = c.str("name")
        grade = c.str("grade")
        section = c.str("section")
        age = c.num("age").map { Int($0.rounded()) }
        gender = c.str("gender")
        schoolName = c.str("schoolName")
        heightCm = c.num("heightCm") ?? 0
        weightKg = c.num("weightKg") ?? 0
    }
}

/// One child's record, as a dietician may see it.
struct DieticianChildRecord: Decodable {
    let child: DieticianChildProfile?
    let findings: [DieticianFinding]
    let foodLog: [FoodLogDay]
    let plans: [DieticianPlan]
    let draft: DietDraft

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: AnyKey.self)
        child = c.obj("child")
        findings = c.list("findings")
        foodLog = c.list("foodLog")
        plans = c.list("plans")
        draft = c.obj("draft") ?? DietDraft()
    }
}

struct DieticianPlanSaved: Decodable {
    let plan: DieticianPlan?
    init(from decoder: Decoder) throws {
        plan = try decoder.container(keyedBy: AnyKey.self).obj("plan")
    }
}

// MARK: - The reading library

/// One article on the shelf a family reads. A dietician sees and edits their
/// own; taking a page off the shelf stays with operations.
struct LibraryArticle: Decodable, Identifiable {
    let id: String
    let slug: String
    let locale: String
    let title: String
    let summary: String
    let body: String
    let checkTypes: [String]
    let flags: [String]
    let minAge: Int
    let maxAge: Int
    let published: Bool
    let updatedAt: String

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: AnyKey.self)
        id = c.str("id")
        slug = c.str("slug")
        locale = c.str("locale", "en")
        title = c.str("title")
        summary = c.str("summary")
        body = c.str("body")
        checkTypes = c.strs("checkTypes")
        flags = c.strs("flags")
        minAge = c.int("minAge")
        maxAge = c.int("maxAge", 99)
        published = c.bool("published", true)
        updatedAt = c.str("updatedAt")
    }
}

struct MyArticles: Decodable {
    let articles: [LibraryArticle]
    let checkTypes: [String]
    let locales: [String]

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: AnyKey.self)
        articles = c.list("articles")
        checkTypes = c.strs("checkTypes")
        locales = c.strs("locales")
    }
}

// MARK: - Groups: one plan for many children

/// One school's children grouped by what their checks found. Bands and flags
/// only: the readings stay behind the per-child record, whose every opening
/// is logged.
struct DieticianCohorts: Decodable {
    let schoolId: String
    let grade: String
    let grades: [String]
    let total: Int
    let cohorts: [DieticianCohort]

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: AnyKey.self)
        schoolId = c.str("schoolId")
        grade = c.str("grade")
        grades = c.strs("grades")
        total = c.int("total")
        cohorts = c.list("cohorts")
    }
}

struct DieticianCohort: Decodable, Identifiable, Hashable {
    var id: String { key }
    let key: String
    let label: String
    let focus: String
    let priority: Int
    let summary: CohortSummary
    let children: [CohortChild]
    let draft: CohortDraft

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: AnyKey.self)
        key = c.str("key")
        label = c.str("label")
        focus = c.str("focus", "GENERAL")
        priority = c.int("priority")
        summary = c.obj("summary") ?? CohortSummary()
        children = c.list("children")
        draft = c.obj("draft") ?? CohortDraft()
    }
}

struct CohortSummary: Decodable, Hashable {
    let count: Int
    let withPlan: Int
    let ageMin: Int?
    let ageMax: Int?
    let girls: Int
    let boys: Int
    let severeAnaemia: Int
    let toothDecay: Int

    init() {
        count = 0; withPlan = 0; ageMin = nil; ageMax = nil
        girls = 0; boys = 0; severeAnaemia = 0; toothDecay = 0
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: AnyKey.self)
        count = c.int("count")
        withPlan = c.int("withPlan")
        ageMin = c.num("ageMin").map { Int($0.rounded()) }
        ageMax = c.num("ageMax").map { Int($0.rounded()) }
        girls = c.int("girls")
        boys = c.int("boys")
        severeAnaemia = c.int("severeAnaemia")
        toothDecay = c.int("toothDecay")
    }
}

struct CohortChild: Decodable, Identifiable, Hashable {
    var id: String { kidId }
    let kidId: String
    let name: String
    let grade: String
    let section: String
    let age: Int?
    let gender: String
    let band: String
    /// "", NONE, MILD or SEVERE.
    let anaemia: String
    let toothDecay: Bool
    let hasPlan: Bool

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: AnyKey.self)
        kidId = c.str("kidId")
        name = c.str("name")
        grade = c.str("grade")
        section = c.str("section")
        age = c.num("age").map { Int($0.rounded()) }
        gender = c.str("gender")
        band = c.str("band")
        anaemia = c.str("anaemia")
        toothDecay = c.bool("toothDecay")
        hasPlan = c.bool("hasPlan")
    }
}

/// A starting point for the group's plan: RULES, or AI when the model wrote it.
struct CohortDraft: Decodable, Hashable {
    let title: String
    let focus: String
    let guidance: String
    let targets: [DietTarget]
    let source: String

    init() {
        title = ""; focus = "GENERAL"; guidance = ""; targets = []; source = "RULES"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: AnyKey.self)
        title = c.str("title")
        focus = c.str("focus", "GENERAL")
        guidance = c.str("guidance")
        targets = c.list("targets")
        source = c.str("source", "RULES")
    }
}

struct CohortDraftResponse: Decodable {
    let draft: CohortDraft
    init(from decoder: Decoder) throws {
        draft = try decoder.container(keyedBy: AnyKey.self).obj("draft") ?? CohortDraft()
    }
}

struct CohortPlanSaved: Decodable {
    let saved: Int
    init(from decoder: Decoder) throws {
        saved = try decoder.container(keyedBy: AnyKey.self).int("saved")
    }
}
