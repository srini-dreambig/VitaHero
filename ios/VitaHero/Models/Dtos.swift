import Foundation

// What the Worker sends, read leniently.
//
// The parent payloads are snake_case and the guardian ones camelCase; a number
// can arrive as a string from a Postgres NUMERIC column; a field the server
// adds or drops must not take a whole screen down with it. So every model
// decodes through `AnyKey` and the helpers below, which take what is there and
// fall back to an empty value, rather than through synthesized Codable, which
// fails the whole payload on one surprise.

struct AnyKey: CodingKey {
    let stringValue: String
    var intValue: Int? { nil }
    init(_ string: String) { stringValue = string }
    init?(stringValue: String) { self.stringValue = stringValue }
    init?(intValue: Int) { return nil }
}

extension KeyedDecodingContainer where Key == AnyKey {
    func optStr(_ key: String) -> String? {
        let k = AnyKey(key)
        if let s = try? decodeIfPresent(String.self, forKey: k) { return s }
        if let i = try? decodeIfPresent(Int.self, forKey: k) { return String(i) }
        if let d = try? decodeIfPresent(Double.self, forKey: k) { return String(d) }
        return nil
    }

    func str(_ key: String, _ fallback: String = "") -> String { optStr(key) ?? fallback }

    func num(_ key: String) -> Double? {
        let k = AnyKey(key)
        if let d = try? decodeIfPresent(Double.self, forKey: k) { return d }
        if let s = try? decodeIfPresent(String.self, forKey: k) { return Double(s) }
        return nil
    }

    func int(_ key: String, _ fallback: Int = 0) -> Int {
        num(key).map { Int($0.rounded()) } ?? fallback
    }

    func bool(_ key: String, _ fallback: Bool = false) -> Bool {
        let k = AnyKey(key)
        if let b = try? decodeIfPresent(Bool.self, forKey: k) { return b }
        if let i = try? decodeIfPresent(Int.self, forKey: k) { return i != 0 }
        if let s = try? decodeIfPresent(String.self, forKey: k) { return ["true", "1", "yes"].contains(s.lowercased()) }
        return fallback
    }

    func strs(_ key: String) -> [String] {
        (try? decodeIfPresent([Lossy<String>].self, forKey: AnyKey(key)))?.compactMap(\.value) ?? []
    }

    func list<T: Decodable>(_ key: String) -> [T] {
        (try? decodeIfPresent([Lossy<T>].self, forKey: AnyKey(key)))?.compactMap(\.value) ?? []
    }

    func obj<T: Decodable>(_ key: String) -> T? {
        try? decodeIfPresent(T.self, forKey: AnyKey(key))
    }
}

/// One element of a list that is kept if it decodes and dropped if it does not.
struct Lossy<T: Decodable>: Decodable {
    let value: T?
    init(from decoder: Decoder) throws { value = try? T(from: decoder) }
}

// MARK: - Session

/// The signed-in parent, from `/api/auth/me` and the sign-in response.
struct Profile: Codable, Equatable {
    var id: String
    var userId: String
    var phone: String
    var name: String
    var email: String
    var role: String
    var schoolId: String
    var onboardingComplete: Bool
    var darkTheme: Bool
    var localeCode: String
    var familyCode: String
    var notificationsEnabled: Bool
    var campRemindersEnabled: Bool
    var consentAccepted: Bool
    var consentDeclined: Bool
    var authProvider: String

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: AnyKey.self)
        id = c.str("id")
        userId = c.str("user_id", id)
        phone = c.str("phone")
        name = c.str("name")
        email = c.str("email")
        role = c.str("role", "PARENT")
        schoolId = c.str("school_id")
        onboardingComplete = c.bool("onboarding_complete")
        darkTheme = c.bool("dark_theme")
        localeCode = c.str("locale_code", "en")
        familyCode = c.str("family_code")
        notificationsEnabled = c.bool("notifications_enabled", true)
        campRemindersEnabled = c.bool("camp_reminders_enabled", true)
        consentAccepted = c.bool("consent_accepted")
        consentDeclined = c.bool("consent_declined")
        authProvider = c.str("auth_provider", "PHONE")
    }

    /// Written back in the server's own shape, so the copy kept for offline
    /// launches reads back through the same decoder.
    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: AnyKey.self)
        try c.encode(id, forKey: AnyKey("id"))
        try c.encode(userId, forKey: AnyKey("user_id"))
        try c.encode(role, forKey: AnyKey("role"))
        try c.encode(schoolId, forKey: AnyKey("school_id"))
        for (key, value) in upsertBody {
            if let text = value as? String { try c.encode(text, forKey: AnyKey(key)) }
            if let flag = value as? Bool { try c.encode(flag, forKey: AnyKey(key)) }
        }
    }

    /// The body `/api/profiles` takes. The server replaces every settings
    /// column on save, so the whole profile goes, not just what changed.
    var upsertBody: [String: Any] {
        [
            "phone": phone, "name": name, "email": email,
            "onboarding_complete": onboardingComplete, "is_logged_in": true,
            "dark_theme": darkTheme, "locale_code": localeCode, "family_code": familyCode,
            "notifications_enabled": notificationsEnabled,
            "camp_reminders_enabled": campRemindersEnabled,
            "consent_accepted": consentAccepted, "consent_declined": consentDeclined,
            "auth_provider": authProvider.isEmpty ? "PHONE" : authProvider,
        ]
    }
}

struct SignInResponse: Decodable {
    let token: String
    let profile: Profile?

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: AnyKey.self)
        token = c.str("token")
        profile = c.obj("profile")
    }
}

// MARK: - Children

/// A child on the parent's roster, or one shared with them through a family code.
///
/// Children are enrolled by the school; the app reads them and never writes
/// them (the server answers a kid write with ROSTER_MANAGED).
struct Kid: Decodable, Identifiable, Hashable {
    var id: String
    var name: String
    var age: Int
    var gender: String
    var school: String
    var grade: String
    var heightCm: Double
    var weightKg: Double
    var overallScore: Int
    var dental: String
    var eyesight: String
    var nutrition: String
    var lastCheckup: String
    var source: String
    /// Came from another family through family sharing.
    var shared = false

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: AnyKey.self)
        id = c.str("id")
        name = c.str("name")
        age = c.int("age")
        gender = c.str("gender")
        school = c.str("school")
        grade = c.str("grade")
        // The roster is snake_case; the family-sharing list is camelCase.
        heightCm = c.num("height_cm") ?? c.num("heightCm") ?? 0
        weightKg = c.num("weight_kg") ?? c.num("weightKg") ?? 0
        overallScore = Int((c.num("overall_score") ?? c.num("overallScore") ?? 0).rounded())
        dental = c.str("dental")
        eyesight = c.str("eyesight")
        nutrition = c.str("nutrition")
        lastCheckup = c.optStr("last_checkup") ?? c.str("lastCheckup")
        source = c.str("source", "ADMIN")
    }

    var initials: String {
        name.split(separator: " ").prefix(2).compactMap(\.first).map { String($0) }.joined().uppercased()
    }
}

struct GrowthPoint: Decodable, Identifiable {
    let id: String
    let label: String
    let height: Double
    let weight: Double

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: AnyKey.self)
        id = c.str("id")
        label = c.str("label")
        height = c.num("height") ?? 0
        weight = c.num("weight") ?? 0
    }
}

struct School: Decodable, Identifiable {
    let id: String
    let name: String
    let city: String
    let kidId: String

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: AnyKey.self)
        id = c.str("id")
        name = c.str("name")
        city = c.str("city")
        kidId = c.str("kid_id")
    }
}

// MARK: - Camps

struct Camp: Decodable, Identifiable {
    let id: String
    let title: String
    let school: String
    let date: String
    let time: String
    let status: String
    let venue: String
    let consentDeadline: String
    let checks: [String]
    let resultSummary: String
    let isPartner: Bool
    let description: String
    let registeredKidIds: [String]

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: AnyKey.self)
        id = c.str("id")
        title = c.str("title")
        school = c.str("school")
        date = c.str("date")
        time = c.str("time")
        status = c.str("status").uppercased()
        venue = c.str("venue")
        consentDeadline = c.str("consent_deadline")
        checks = c.strs("checks")
        resultSummary = c.str("result_summary")
        isPartner = c.bool("is_partner")
        description = c.str("description")
        registeredKidIds = c.strs("registered_kid_ids")
    }

    /// Still to happen, or happening. The same split as Android's CampStatus.
    var isUpcoming: Bool { ["SCHEDULED", "IN_PROGRESS", "UPCOMING", "DRAFT"].contains(status) }
    var isCancelled: Bool { status == "CANCELLED" }
}

/// What the doctors found for one child at one camp. Read only: results are
/// written by the camp's clinicians, never by a parent.
struct CampResult: Decodable {
    struct Finding: Decodable, Identifiable {
        let checkType: String
        let flag: String
        let summary: String
        let note: String
        var id: String { checkType + summary }

        init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: AnyKey.self)
            checkType = c.str("checkType")
            flag = c.str("flag")
            summary = c.str("summary")
            note = c.str("note")
        }
    }

    let status: String
    let message: String
    let kidName: String
    let campTitle: String
    let date: String
    let urgency: String
    let recommendation: String
    let findings: [Finding]

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: AnyKey.self)
        status = c.str("status").uppercased()
        message = c.str("message")
        kidName = c.str("kidName")
        campTitle = c.str("campTitle")
        date = c.str("date")
        urgency = c.str("urgency").uppercased()
        recommendation = c.str("recommendation")
        findings = c.list("findings")
    }
}

/// A camp waiting on the parent's yes or no for one child.
struct PendingConsent: Decodable, Identifiable {
    let campId: String
    let kidId: String
    let kidName: String
    let schoolName: String
    let title: String
    let date: String
    let time: String
    let venue: String
    let deadline: String
    let checks: [String]
    let photosAsked: Bool
    var id: String { campId + "/" + kidId }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: AnyKey.self)
        campId = c.str("campId")
        kidId = c.str("kidId")
        kidName = c.str("kidName")
        schoolName = c.str("schoolName")
        title = c.str("title")
        date = c.str("date")
        time = c.str("time")
        venue = c.str("venue")
        deadline = c.str("deadline")
        checks = c.strs("checks")
        photosAsked = c.bool("photosAsked")
    }
}

struct ConsentList: Decodable {
    let consents: [PendingConsent]
    init(from decoder: Decoder) throws {
        consents = try decoder.container(keyedBy: AnyKey.self).list("consents")
    }
}

// MARK: - Symptoms

struct SymptomEvent: Decodable, Identifiable {
    let id: String
    let symptom: String
    let severity: String
    let startedOn: String
    let endedOn: String
    let note: String
    let sawDoctor: Bool
    let missedSchool: Bool

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: AnyKey.self)
        id = c.str("id")
        symptom = c.str("symptom")
        severity = c.str("severity")
        startedOn = c.str("startedOn")
        endedOn = c.str("endedOn")
        note = c.str("note")
        sawDoctor = c.bool("sawDoctor")
        missedSchool = c.bool("missedSchool")
    }
}

struct SymptomsResponse: Decodable {
    let symptoms: [String]
    let severities: [String]
    let notice: String
    let events: [SymptomEvent]

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: AnyKey.self)
        symptoms = c.strs("symptoms")
        severities = c.strs("severities")
        notice = c.str("notice")
        events = c.list("events")
    }
}

struct SymptomSaved: Decodable {
    let id: String
    let advice: String

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: AnyKey.self)
        id = c.str("id")
        advice = c.str("advice")
    }
}

// MARK: - Diet, streaks, badges

struct DietPlan: Decodable, Identifiable {
    struct Target: Decodable {
        let label: String
        let value: String
        init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: AnyKey.self)
            label = c.str("label")
            value = c.str("value")
        }
    }

    let id: String
    let kidId: String
    let title: String
    let focus: String
    let startsOn: String
    let endsOn: String
    let guidance: String
    let targets: [Target]
    let authorName: String

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: AnyKey.self)
        id = c.str("id")
        kidId = c.str("kidId")
        title = c.str("title")
        focus = c.str("focus")
        startsOn = c.str("startsOn")
        endsOn = c.str("endsOn")
        guidance = c.str("guidance")
        targets = c.list("targets")
        authorName = c.str("authorName")
    }
}

struct DietPlanResponse: Decodable {
    let plan: DietPlan?
    init(from decoder: Decoder) throws {
        plan = try decoder.container(keyedBy: AnyKey.self).obj("plan")
    }
}

/// One line of today's food log. The diet plan's targets are logged as meals
/// so the server's streak and badges count them.
struct Meal: Decodable, Identifiable {
    var id: String
    var kidId: String
    var timeSlot: String
    var name: String
    var detail: String
    var kcal: Int
    var eaten: Bool

    init(id: String, kidId: String, timeSlot: String, name: String, detail: String, kcal: Int, eaten: Bool) {
        self.id = id; self.kidId = kidId; self.timeSlot = timeSlot
        self.name = name; self.detail = detail; self.kcal = kcal; self.eaten = eaten
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: AnyKey.self)
        id = c.str("id")
        kidId = c.str("kid_id")
        timeSlot = c.str("time_slot")
        name = c.str("name")
        detail = c.str("detail")
        kcal = c.int("kcal")
        eaten = c.bool("eaten")
    }

    func body(profileId: String, userId: String) -> [String: Any] {
        [
            "id": id, "profile_id": profileId, "user_id": userId, "kid_id": kidId,
            "time_slot": timeSlot, "name": name, "detail": detail, "kcal": kcal, "eaten": eaten,
        ]
    }
}

struct Streak: Decodable {
    let current: Int
    let best: Int
    let lastLogDate: String

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: AnyKey.self)
        current = c.int("current_streak")
        best = c.int("best_streak")
        lastLogDate = c.str("last_log_date")
    }
}

struct Badge: Decodable, Identifiable {
    let id: String
    let earned: Bool
    let meets: Bool
    let earnedAt: String
    let target: Int
    let current: Int
    let progress: Double

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: AnyKey.self)
        id = c.str("id")
        earned = c.bool("earned")
        meets = c.bool("meets")
        earnedAt = c.str("earnedAt")
        target = c.int("target")
        current = c.int("current")
        progress = min(max(c.num("progress") ?? 0, 0), 1)
    }
}

struct BadgeList: Decodable {
    let badges: [Badge]
    init(from decoder: Decoder) throws {
        badges = try decoder.container(keyedBy: AnyKey.self).list("badges")
    }
}

// MARK: - Notifications

struct AppNotification: Decodable, Identifiable {
    let id: String
    let title: String
    let body: String
    let time: String
    /// CAMP, CHECKUP, DIET, REWARD, CONSENT, RESULT or REFERRAL.
    let type: String
    var unread: Bool

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: AnyKey.self)
        id = c.str("id")
        title = c.str("title")
        body = c.str("body")
        time = c.str("time")
        type = c.str("type", "CAMP").uppercased()
        unread = c.bool("unread", true)
    }
}

// MARK: - Booking

struct Appointment: Decodable, Identifiable {
    let id: String
    let doctorId: String
    let doctorName: String
    let specialty: String
    let kidName: String
    let date: String
    let time: String

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: AnyKey.self)
        id = c.str("id")
        doctorId = c.str("doctor_id")
        doctorName = c.str("doctor_name")
        specialty = c.str("specialty")
        kidName = c.str("kid_name")
        date = c.str("date")
        time = c.str("time")
    }
}

struct Doctor: Decodable, Identifiable, Hashable {
    let id: String
    let name: String
    let specialty: String
    let hospital: String
    let rating: Double
    let isCampPartner: Bool

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: AnyKey.self)
        id = c.str("id")
        name = c.str("name")
        specialty = c.str("specialty")
        hospital = c.str("hospital")
        rating = c.num("rating") ?? 0
        isCampPartner = c.bool("is_camp_partner")
    }
}

struct Hospital: Decodable, Identifiable {
    let id: String
    let name: String
    let city: String
    let district: String
    let address: String
    let phone: String
    let rating: Double
    let isCampPartner: Bool
    let userCampLinked: Bool
    let distanceKm: Double?
    let specialties: [String]
    let doctors: [Doctor]

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: AnyKey.self)
        id = c.str("id")
        name = c.str("name")
        city = c.str("city")
        district = c.str("district")
        address = c.str("address")
        phone = c.str("phone")
        rating = c.num("rating") ?? 0
        isCampPartner = c.bool("is_camp_partner")
        userCampLinked = c.bool("user_camp_linked")
        distanceKm = c.num("distance_km")
        specialties = c.strs("specialties")
        doctors = c.list("doctors")
    }
}

struct BookingDirectory: Decodable {
    let city: String
    let hospitals: [Hospital]
    let specialties: [String]

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: AnyKey.self)
        city = c.str("city")
        hospitals = c.list("hospitals")
        specialties = c.strs("specialties")
    }
}

struct Slot: Decodable, Identifiable, Hashable {
    let date: String
    let time: String
    let label: String
    var id: String { date + " " + time }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: AnyKey.self)
        date = c.str("date")
        time = c.str("time")
        label = c.str("label")
    }
}

struct SlotList: Decodable {
    let slots: [Slot]
    init(from decoder: Decoder) throws {
        slots = try decoder.container(keyedBy: AnyKey.self).list("slots")
    }
}

// MARK: - Family sharing

struct CoParent: Decodable, Identifiable {
    let id: String
    let name: String
    let relation: String
    let joinedDate: String
    /// PENDING (waiting on the owner), APPROVED or DECLINED.
    let status: String

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: AnyKey.self)
        id = c.str("id")
        name = c.str("name")
        relation = c.str("relation")
        joinedDate = c.str("joined_date")
        status = c.str("status", "APPROVED").uppercased()
    }

    /// The server lists the family's owner as a synthetic row so a co-parent
    /// can see whose family they are in. It is not a request to answer.
    var isOwnerRow: Bool { id.hasPrefix("owner_") }
}

struct FamilyValidation: Decodable {
    let valid: Bool
    let familyOwner: String
    let error: String

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: AnyKey.self)
        valid = c.bool("valid")
        familyOwner = c.str("familyOwner")
        error = c.str("error")
    }
}

struct FamilyJoin: Decodable {
    let success: Bool
    let pending: Bool
    let error: String

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: AnyKey.self)
        success = c.bool("success")
        pending = c.bool("pending") || c.str("status").uppercased() == "PENDING"
        error = c.str("error")
    }
}

struct SharedKids: Decodable {
    let kids: [Kid]
    let isOwner: Bool

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: AnyKey.self)
        kids = c.list("kids")
        isOwner = c.bool("isOwner")
    }
}

/// An empty response, for writes whose answer the app does not read.
struct Ignored: Decodable {
    init(from decoder: Decoder) throws {}
}

// MARK: - Clinician
//
// What a screener or physician sees at a camp. The server already decides all
// of it: my-camps returns only assigned camps, and the screening form narrows
// its `checks` to the guardian's consent and the clinician's specialty. These
// types are the shape those answers have, so the app asks rather than reasons.

/// A JSON value of any shape, for a finding's `detail`, whose keys vary by check.
enum JSONValue: Decodable, Equatable {
    case string(String)
    case number(Double)
    case bool(Bool)
    case null
    case other

    init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if c.decodeNil() { self = .null }
        else if let b = try? c.decode(Bool.self) { self = .bool(b) }
        else if let d = try? c.decode(Double.self) { self = .number(d) }
        else if let s = try? c.decode(String.self) { self = .string(s) }
        else { self = .other }
    }

    /// The value as the form would have typed it: whole numbers without ".0".
    var text: String {
        switch self {
        case .string(let s): return s
        case .number(let d):
            return d == d.rounded() && abs(d) < 1e15 ? String(Int(d)) : String(d)
        case .bool(let b): return b ? "true" : "false"
        case .null, .other: return ""
        }
    }

    var number: Double? {
        switch self {
        case .number(let d): return d
        case .string(let s): return Double(s.trimmingCharacters(in: .whitespaces))
        default: return nil
        }
    }
}

struct ClinicianCamp: Decodable, Identifiable, Hashable {
    let id: String
    let title: String
    let schoolName: String
    let date: String
    let staffRole: String
    let participants: Int
    let screened: Int
    /// Children screened and waiting on a physician. The server sends this as
    /// `approved`, but for a clinician's camps it counts status SCREENED.
    let awaitingReview: Int
    let status: String

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: AnyKey.self)
        id = c.str("id")
        title = c.str("title")
        schoolName = c.str("schoolName")
        date = c.str("date")
        staffRole = c.str("staffRole")
        participants = c.int("participants")
        screened = c.int("screened")
        awaitingReview = c.int("approved")
        status = c.str("status")
    }
}

struct ClinicianCamps: Decodable {
    let camps: [ClinicianCamp]

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: AnyKey.self)
        camps = c.list("camps")
    }
}

struct CampChild: Decodable, Identifiable {
    var id: String { kidId }
    let kidId: String
    let name: String
    let grade: String
    let section: String
    let gender: String
    let age: Int?
    let studentRef: String
    let consentStatus: String
    var attendance: String
    /// NOT_SCREENED, SCREENED, APPROVED or RELEASED; ABSENT after a local
    /// absent-only save.
    var status: String

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: AnyKey.self)
        kidId = c.str("kidId")
        name = c.str("name")
        grade = c.str("grade")
        section = c.str("section")
        gender = c.str("gender")
        age = c.num("age").map { Int($0.rounded()) }
        studentRef = c.str("studentRef")
        consentStatus = c.str("consentStatus", "PENDING")
        attendance = c.str("attendance", "UNKNOWN")
        status = c.str("status", "NOT_SCREENED")
    }
}

/// What this person may do on this camp, as the server states it.
struct CampCan: Decodable {
    let schedule: Bool
    let screen: Bool
    let review: Bool

    init(schedule: Bool = false, screen: Bool = false, review: Bool = false) {
        self.schedule = schedule
        self.screen = screen
        self.review = review
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: AnyKey.self)
        schedule = c.bool("schedule")
        screen = c.bool("screen")
        review = c.bool("review")
    }
}

struct CampRoster: Decodable {
    var participants: [CampChild]
    let can: CampCan

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: AnyKey.self)
        participants = c.list("participants")
        can = c.obj("can") ?? CampCan()
    }
}

struct ScreeningChild: Decodable {
    let kidId: String
    let name: String
    let grade: String
    let section: String
    let gender: String
    let age: Int?
    let studentRef: String
    let previousHeightCm: Double?
    let previousWeightKg: Double?

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: AnyKey.self)
        kidId = c.str("kidId")
        name = c.str("name")
        grade = c.str("grade")
        section = c.str("section")
        gender = c.str("gender")
        age = c.num("age").map { Int($0.rounded()) }
        studentRef = c.str("studentRef")
        previousHeightCm = c.num("previousHeightCm")
        previousWeightKg = c.num("previousWeightKg")
    }
}

struct ExistingFinding: Decodable {
    let checkType: String
    let flag: String
    let rationale: String
    let note: String
    /// The saved readings as the form holds them. Nested values have no field
    /// on the form and are left out.
    let detail: [String: String]

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: AnyKey.self)
        checkType = c.str("checkType")
        flag = c.str("flag", "NOT_MEASURED")
        rationale = c.str("rationale")
        note = c.str("note")
        var fields: [String: String] = [:]
        if let nested = try? c.nestedContainer(keyedBy: AnyKey.self, forKey: AnyKey("detail")) {
            for key in nested.allKeys {
                guard let value = try? nested.decode(JSONValue.self, forKey: key) else { continue }
                if case .other = value { continue }
                if case .null = value { continue }
                fields[key.stringValue] = value.text
            }
        }
        detail = fields
    }
}

/// The guardian's own account of illness since the last camp.
struct IllnessHistory: Decodable {
    let caution: String
    let events: [SymptomEvent]

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: AnyKey.self)
        caution = c.str("caution")
        events = c.list("events")
    }
}

struct ScreeningForm: Decodable {
    let child: ScreeningChild?
    let consentStatus: String
    var attendance: String
    let status: String
    /// The checks this clinician may record for this child, already narrowed
    /// by consent and specialty. The form renders these and nothing else.
    let checks: [String]
    /// Checks the guardian declined, named so their absence is explained.
    let excludedByConsent: [String]
    /// Checks on this camp that belong to another clinician's round.
    let otherSpecialties: [String]
    let specialty: String
    let findings: [ExistingFinding]
    let illnessHistory: IllnessHistory?

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: AnyKey.self)
        child = c.obj("child")
        consentStatus = c.str("consentStatus", "PENDING")
        attendance = c.str("attendance", "UNKNOWN")
        status = c.str("status", "NOT_SCREENED")
        checks = c.strs("checks")
        excludedByConsent = c.strs("excludedByConsent")
        otherSpecialties = c.strs("otherSpecialties")
        specialty = c.str("specialty")
        findings = c.list("findings")
        illnessHistory = c.obj("illnessHistory")
    }
}

struct ReviewQueueItem: Decodable, Identifiable {
    var id: String { kidId }
    let kidId: String
    let name: String
    let grade: String
    let age: Int?
    let alerts: Int
    let watches: Int
    /// SCREENED (waiting on this physician) or APPROVED (awaiting release).
    var status: String
    var urgency: String
    let recommendation: String
    var reviewed: Bool

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: AnyKey.self)
        kidId = c.str("kidId")
        name = c.str("name")
        grade = c.str("grade")
        age = c.num("age").map { Int($0.rounded()) }
        alerts = c.int("alerts")
        watches = c.int("watches")
        status = c.str("status", "SCREENED")
        urgency = c.str("urgency", "NONE")
        recommendation = c.str("recommendation")
        reviewed = c.bool("reviewed")
    }
}

struct ReviewQueue: Decodable {
    let queue: [ReviewQueueItem]

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: AnyKey.self)
        queue = c.list("queue")
    }
}

struct ReviewChild: Decodable {
    let kidId: String
    let name: String
    let grade: String
    let age: Int?
    let gender: String
    let guardianName: String

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: AnyKey.self)
        kidId = c.str("kidId")
        name = c.str("name")
        grade = c.str("grade")
        age = c.num("age").map { Int($0.rounded()) }
        gender = c.str("gender")
        guardianName = c.str("guardianName")
    }
}

/// One earlier camp where the same check was flagged.
struct PriorFinding: Decodable {
    let flag: String
    let date: String
    let title: String

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: AnyKey.self)
        flag = c.str("flag")
        date = c.str("date")
        title = c.str("title")
    }
}

/// One measured key of a finding's detail.
struct DetailEntry: Equatable {
    let key: String
    let value: JSONValue
}

struct ReviewFinding: Decodable, Identifiable {
    var id: String { checkType }
    let checkType: String
    /// What was measured. Keys vary by check; sorted for a stable display.
    let detail: [DetailEntry]
    let flag: String
    /// What the rules said before anyone overrode it.
    let autoFlag: String
    let rationale: String
    let urgency: String
    let screenerNote: String
    let reviewNote: String
    let overridden: Bool
    let previous: [PriorFinding]

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: AnyKey.self)
        checkType = c.str("checkType")
        if let nested = try? c.nestedContainer(keyedBy: AnyKey.self, forKey: AnyKey("detail")) {
            detail = nested.allKeys
                .compactMap { key in
                    (try? nested.decode(JSONValue.self, forKey: key)).map { DetailEntry(key: key.stringValue, value: $0) }
                }
                .sorted { $0.key < $1.key }
        } else {
            detail = []
        }
        flag = c.str("flag", "NOT_MEASURED")
        autoFlag = c.str("autoFlag", "NOT_MEASURED")
        rationale = c.str("rationale")
        urgency = c.str("urgency", "NONE")
        screenerNote = c.str("screenerNote")
        reviewNote = c.str("reviewNote")
        overridden = c.bool("overridden")
        previous = c.list("previous")
    }
}

struct Recurring: Decodable {
    let checkType: String
    let timesBefore: Int

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: AnyKey.self)
        checkType = c.str("checkType")
        timesBefore = c.int("timesBefore")
    }
}

struct ReviewDetail: Decodable {
    let child: ReviewChild?
    let status: String
    let findings: [ReviewFinding]
    /// Checks flagged at an earlier camp too; the server raises urgency for these.
    let recurring: [Recurring]
    /// NONE, ROUTINE, SOON or URGENT, worked out from the findings.
    let suggestedUrgency: String
    /// What the guardian will read. Drafted by the server when nobody has
    /// written one yet; `recommendationIsDraft` says which.
    let recommendation: String
    let recommendationIsDraft: Bool

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: AnyKey.self)
        child = c.obj("child")
        status = c.str("status", "SCREENED")
        findings = c.list("findings")
        recurring = c.list("recurring")
        suggestedUrgency = c.str("suggestedUrgency", "NONE")
        recommendation = c.str("recommendation")
        recommendationIsDraft = c.bool("recommendationIsDraft")
    }
}

struct ReleaseResult: Decodable {
    let released: Int
    let referralsOpened: Int
    let urgentNotified: Int

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: AnyKey.self)
        released = c.int("released")
        referralsOpened = c.int("referralsOpened")
        urgentNotified = c.int("urgentNotified")
    }
}
