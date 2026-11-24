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

// MARK: - The menu

/// The menu's words, one for one with functions/diet-menus.ts and Android's
/// DieticianDtos.kt. The menu is the same for every age; only the quantity
/// changes. "W/1" and "W/2" in the dietician's notes are once and twice a week.
enum DietMenu {
    static let ageGroups = ["UNDER_5", "AGE_6_10", "AGE_11_16"]
    static let ageLabels = ["UNDER_5": "Up to 5", "AGE_6_10": "6–10 yrs", "AGE_11_16": "11–16 yrs"]
    static let frequencies = ["DAILY", "WEEKLY_ONCE", "WEEKLY_TWICE"]
    static let frequencyLabels = ["DAILY": "Daily", "WEEKLY_ONCE": "Once a week", "WEEKLY_TWICE": "Twice a week"]
    static let slots = ["EARLY_MORNING", "BREAKFAST", "MID_MORNING", "LUNCH", "EVENING", "DINNER", "BEDTIME"]
    static let slotLabels = [
        "EARLY_MORNING": "Early morning", "BREAKFAST": "Breakfast", "MID_MORNING": "Mid-morning snack",
        "LUNCH": "Lunch", "EVENING": "Evening snack", "DINNER": "Dinner", "BEDTIME": "Bedtime",
    ]
}

/// One food on the dietician's menu, with a quantity for each age group.
struct MenuItem: Decodable, Hashable, Identifiable {
    /// Only for the editor's lists; never sent.
    var uid = UUID()
    var name = ""
    var qty: [String: String] = [:]
    var frequency = "DAILY"
    var id: UUID { uid }

    var body: [String: Any] { ["name": name, "qty": qty, "frequency": frequency] }
}

extension MenuItem {
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: AnyKey.self)
        name = c.str("name")
        qty = (try? c.decodeIfPresent([String: Lossy<String>].self, forKey: AnyKey("qty")))?
            .compactMapValues(\.value) ?? [:]
        frequency = c.str("frequency", "DAILY")
    }
}

/// One meal: its slot, the heading the family reads, a time, and its foods.
struct MenuMeal: Decodable, Hashable, Identifiable {
    var uid = UUID()
    var slot = "BREAKFAST"
    var label = ""
    var time = ""
    /// The family picks one of the foods rather than eating them all.
    var chooseAny = false
    var items: [MenuItem] = []
    var id: UUID { uid }

    var body: [String: Any] {
        ["slot": slot, "label": label, "time": time, "chooseAny": chooseAny, "items": items.map(\.body)]
    }
}

extension MenuMeal {
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: AnyKey.self)
        slot = c.str("slot", "BREAKFAST")
        label = c.str("label")
        time = c.str("time")
        chooseAny = c.bool("chooseAny")
        items = c.list("items")
    }
}

/// A food as a family sees it: the quantity for their own child's age.
struct FamilyMenuItem: Decodable, Hashable {
    var name = ""
    var quantity = ""
    var frequency = "DAILY"
}

extension FamilyMenuItem {
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: AnyKey.self)
        name = c.str("name")
        quantity = c.str("quantity")
        frequency = c.str("frequency", "DAILY")
    }
}

struct FamilyMenuMeal: Decodable, Hashable {
    var slot = ""
    var label = ""
    var time = ""
    var chooseAny = false
    var items: [FamilyMenuItem] = []
}

extension FamilyMenuMeal {
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: AnyKey.self)
        slot = c.str("slot")
        label = c.str("label")
        time = c.str("time")
        chooseAny = c.bool("chooseAny")
        items = c.list("items")
    }
}

extension Array where Element == MenuMeal {
    /// At least one named food: enough to send without written advice.
    var hasFood: Bool {
        contains { $0.items.contains { !$0.name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty } }
    }
}

/// A menu as one age group's family reads it — what the server's menuFor()
/// sends a parent, so the dietician sees what the family will see.
func familyMenu(_ meals: [MenuMeal], ageGroup: String) -> [FamilyMenuMeal] {
    meals.map { m in
        FamilyMenuMeal(slot: m.slot, label: m.label, time: m.time, chooseAny: m.chooseAny,
                       items: m.items.map { FamilyMenuItem(name: $0.name, quantity: $0.qty[ageGroup] ?? "",
                                                          frequency: $0.frequency) })
    }
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
    /// The dietician's menu, every age's quantity. Empty on plans written before menus.
    let meals: [MenuMeal]
    /// The dietician's own words beside the menu: blank when the guidance is
    /// only the menu spelled out for older apps.
    let notes: String

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
        meals = c.list("meals")
        notes = c.optStr("notes") ?? guidance
    }
}

/// The server's first draft of a plan, from what was actually found.
struct DietDraft: Decodable {
    let title: String
    let focus: String
    let guidance: String
    /// What goes in the notes box beside the menu: the guidance without the
    /// menu written out as text. The guidance itself from an older server.
    let notes: String
    let meals: [MenuMeal]

    init() {
        title = ""; focus = "GENERAL"; guidance = ""; notes = ""; meals = []
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: AnyKey.self)
        title = c.str("title")
        focus = c.str("focus", "GENERAL")
        guidance = c.str("guidance")
        notes = c.optStr("notes") ?? guidance
        meals = c.list("meals")
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
    /// UNDER_5, AGE_6_10 or AGE_11_16: whose quantities this child's family sees.
    let ageGroup: String
    let ageGroupLabel: String
    let kcal: String

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
        ageGroup = c.str("ageGroup")
        ageGroupLabel = c.str("ageGroupLabel")
        kcal = c.str("kcal")
    }
}

/// One child's record, as a dietician may see it.
struct DieticianChildRecord: Decodable {
    let child: DieticianChildProfile?
    let findings: [DieticianFinding]
    let plans: [DieticianPlan]
    let draft: DietDraft

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: AnyKey.self)
        child = c.obj("child")
        findings = c.list("findings")
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
    /// What goes in the notes box beside the menu: the guidance without the
    /// menu written out as text. The guidance itself from an older server.
    let notes: String
    let targets: [DietTarget]
    let source: String
    let meals: [MenuMeal]

    init() {
        title = ""; focus = "GENERAL"; guidance = ""; notes = ""; targets = []; source = "RULES"; meals = []
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: AnyKey.self)
        title = c.str("title")
        focus = c.str("focus", "GENERAL")
        guidance = c.str("guidance")
        notes = c.optStr("notes") ?? guidance
        targets = c.list("targets")
        source = c.str("source", "RULES")
        meals = c.list("meals")
    }
}

/// One of the twelve plans written before a camp, one per group. Families get
/// the one for their child's group once the results are released.
struct DietTemplate: Decodable, Identifiable, Hashable {
    let key: String
    let label: String
    let focus: String
    /// False while it is still the starter draft.
    let saved: Bool
    let title: String
    let guidance: String
    /// What goes in the notes box beside the menu: the guidance without the
    /// menu written out as text. The guidance itself from an older server.
    let notes: String
    let targets: [DietTarget]
    let updatedAt: String
    let meals: [MenuMeal]
    var id: String { key }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: AnyKey.self)
        key = c.str("key")
        label = c.str("label")
        focus = c.str("focus", "GENERAL")
        saved = c.bool("saved")
        title = c.str("title")
        guidance = c.str("guidance")
        notes = c.optStr("notes") ?? guidance
        targets = c.list("targets")
        updatedAt = c.str("updatedAt")
        meals = c.list("meals")
    }
}

struct DietTemplates: Decodable {
    let templates: [DietTemplate]
    let ready: Int

    init() {
        templates = []; ready = 0
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: AnyKey.self)
        templates = c.list("templates")
        ready = c.int("ready")
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
