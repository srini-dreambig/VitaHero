import Foundation

/// Everything the parent app shows, loaded from the Worker.
///
/// The rule for every list is the Android one: a list the server answered
/// replaces what was on screen, even when it is empty; a list the server did
/// not answer leaves what was on screen alone. An empty list from a failed
/// call is not news that the parent has no children.
///
/// The app writes only what a parent owns: symptoms, today's food ticks,
/// consent answers, bookings, family sharing and their own settings. Camp
/// results, growth and the roster are the school's and the clinicians', and
/// there is no code here that writes them.
@MainActor
final class AppStore: ObservableObject {
    @Published var kids: [Kid] = []
    @Published var sharedKids: [Kid] = []
    @Published var camps: [Camp] = []
    @Published var consents: [PendingConsent] = []
    @Published var notifications: [AppNotification] = []
    @Published var appointments: [Appointment] = []
    @Published var schools: [School] = []
    @Published var coParents: [CoParent] = []
    @Published var meals: [Meal] = []
    @Published var streaks: [String: Streak] = [:]
    @Published var badges: [String: [Badge]] = [:]
    @Published var dietPlans: [String: DietPlan] = [:]
    @Published var growth: [String: [GrowthPoint]] = [:]
    @Published var selectedKidId: String?

    @Published private(set) var loading = false
    /// The last full load could not reach the server; what is on screen is
    /// what the app last knew.
    @Published private(set) var unreachable = false
    /// A short message for the parent: something they did worked, or was refused.
    @Published var toast: String?

    private let api = APIClient.shared

    static let planSlot = "Plan"

    // MARK: Derived

    /// The parent's own children first, then any shared with them.
    var allKids: [Kid] {
        kids + sharedKids.filter { shared in !kids.contains { $0.id == shared.id } }
    }

    var selectedKid: Kid? {
        allKids.first { $0.id == selectedKidId } ?? allKids.first
    }

    var unreadCount: Int { notifications.filter(\.unread).count }

    /// The city the hospital directory opens on: the first of the parent's
    /// schools that says one.
    var homeCity: String {
        schools.map(\.city).first { !$0.isEmpty } ?? AppConfig.defaultCity
    }

    func reset() {
        kids = []; sharedKids = []; camps = []; consents = []; notifications = []
        appointments = []; schools = []; coParents = []; meals = []
        streaks = [:]; badges = [:]; dietPlans = [:]; growth = [:]
        selectedKidId = nil; unreachable = false; toast = nil
    }

    // MARK: Loading

    func loadAll(profile: Profile?) async {
        guard !loading else { return }
        loading = true
        defer { loading = false }

        async let kidsR = fetch { try await APIClient.shared.getList("/api/kids") as [Kid] }
        async let campsR = fetch { try await APIClient.shared.getList("/api/camps") as [Camp] }
        async let consentsR = fetch { try await APIClient.shared.get("/api/camps/consents") as ConsentList }
        async let notifR = fetch { try await APIClient.shared.getList("/api/notifications") as [AppNotification] }
        async let apptR = fetch { try await APIClient.shared.getList("/api/appointments") as [Appointment] }
        async let schoolsR = fetch { try await APIClient.shared.getList("/api/schools/my") as [School] }
        async let coR = fetch { try await APIClient.shared.getList("/api/co-parents") as [CoParent] }
        async let mealsR = fetch { try await APIClient.shared.getList("/api/meals") as [Meal] }

        let results: [Bool] = [
            apply(await kidsR) { self.kids = $0 },
            apply(await campsR) { self.camps = $0 },
            apply(await consentsR) { self.consents = $0.consents },
            apply(await notifR) { self.notifications = $0 },
            apply(await apptR) { self.appointments = $0 },
            apply(await schoolsR) { self.schools = $0 },
            apply(await coR) { self.coParents = $0 },
            apply(await mealsR) { self.meals = $0 },
        ]
        unreachable = results.contains(false)

        if let code = profile?.familyCode, !code.isEmpty { await loadSharedKids(familyCode: code) }
        if selectedKidId == nil || !allKids.contains(where: { $0.id == selectedKidId }) {
            selectedKidId = allKids.first?.id
        }
        if let kid = selectedKid { await loadKid(kid.id) }
    }

    /// The per-child extras: plan, streak, badges, growth.
    func loadKid(_ kidId: String) async {
        let q = ["kid_id": kidId]
        async let planR = fetch { try await APIClient.shared.get("/api/me/diet-plan", query: q) as DietPlanResponse }
        async let streakR = fetch { try await APIClient.shared.get("/api/streaks", query: q) as Streak? }
        async let badgesR = fetch { try await APIClient.shared.get("/api/badges", query: q) as BadgeList }
        async let growthR = fetch { try await APIClient.shared.getList("/api/growth-points", query: q) as [GrowthPoint] }

        _ = apply(await planR) { self.dietPlans[kidId] = $0.plan }
        _ = apply(await streakR) { self.streaks[kidId] = $0 }
        _ = apply(await badgesR) { self.badges[kidId] = $0.badges }
        _ = apply(await growthR) { self.growth[kidId] = $0 }
    }

    func loadSharedKids(familyCode: String) async {
        guard let shared = try? await api.get("/api/family-sharing/kids",
                                              query: ["familyCode": familyCode]) as SharedKids else { return }
        // The owner's own children are already on their roster.
        sharedKids = shared.isOwner ? [] : shared.kids.map { var kid = $0; kid.shared = true; return kid }
    }

    func refreshNotifications() async {
        if let rows = try? await api.getList("/api/notifications") as [AppNotification] { notifications = rows }
    }

    // MARK: Camps

    func campResult(campId: String, kidId: String) async throws -> CampResult {
        try await api.get("/api/camps/result", query: ["camp_id": campId, "kid_id": kidId])
    }

    func answerConsent(_ consent: PendingConsent, granted: Bool, checks: [String], photos: Bool) async -> Bool {
        do {
            try await api.post("/api/camps/consent", json: [
                "campId": consent.campId, "kidId": consent.kidId,
                "decision": granted ? "GRANTED" : "DECLINED",
                "checks": granted ? checks : [],
                "consentPhotos": granted && photos,
            ] as [String: Any])
            consents.removeAll { $0.id == consent.id }
            toast = granted ? L("consent_recorded_yes") : L("consent_recorded_no")
            return true
        } catch {
            toast = (error as? APIError).map { $0.localizedDescription } ?? L("consent_failed")
            return false
        }
    }

    // MARK: Diet plan

    /// Today's checklist for a child: one line per target in their plan.
    func planItems(kidId: String) -> [Meal] {
        guard let plan = dietPlans[kidId] else { return [] }
        let day = Dates.isoToday
        return plan.targets.enumerated().map { index, target in
            let id = "plan_\(plan.id)_\(index)_\(day)"
            let eaten = meals.first { $0.id == id }?.eaten ?? false
            return Meal(id: id, kidId: kidId, timeSlot: AppStore.planSlot,
                        name: target.label, detail: target.value, kcal: 0, eaten: eaten)
        }
    }

    /// Ticks or unticks one target. The server keeps the streak and the
    /// badges; both are read back after the write.
    func toggle(_ item: Meal, profile: Profile?) async {
        guard let profile else { return }
        var items = planItems(kidId: item.kidId)
        guard let index = items.firstIndex(where: { $0.id == item.id }) else { return }
        items[index].eaten.toggle()

        let before = meals
        // An earlier plan's lines go unless they were ticked: those are a
        // record of what the child ate.
        let wanted = Set(items.map(\.id))
        meals = meals.filter { $0.kidId != item.kidId || $0.timeSlot != AppStore.planSlot || $0.eaten || wanted.contains($0.id) }
            .filter { !wanted.contains($0.id) } + items

        do {
            try await api.post("/api/meals", json: items.map { $0.body(profileId: profile.id, userId: profile.userId) })
            async let streakR = fetch { try await APIClient.shared.get("/api/streaks", query: ["kid_id": item.kidId]) as Streak? }
            async let badgesR = fetch { try await APIClient.shared.get("/api/badges", query: ["kid_id": item.kidId]) as BadgeList }
            _ = apply(await streakR) { self.streaks[item.kidId] = $0 }
            _ = apply(await badgesR) { self.badges[item.kidId] = $0.badges }
        } catch {
            meals = before
            toast = error.localizedDescription
        }
    }

    // MARK: Symptoms

    func symptoms(kidId: String) async throws -> SymptomsResponse {
        try await api.get("/api/me/symptoms", query: ["kid_id": kidId])
    }

    func saveSymptom(_ body: [String: Any]) async throws -> SymptomSaved {
        try await api.post("/api/me/symptoms", json: body)
    }

    func deleteSymptom(id: String) async throws {
        try await api.delete("/api/me/symptoms/\(id)")
    }

    // MARK: Notifications

    func markRead(_ ids: [String]) async {
        let unread = ids.filter { id in notifications.contains { $0.id == id && $0.unread } }
        guard !unread.isEmpty else { return }
        for i in notifications.indices where unread.contains(notifications[i].id) { notifications[i].unread = false }
        try? await api.post("/api/notifications/read", json: ["ids": unread])
    }

    // MARK: Booking

    func directory(city: String, specialty: String, lat: Double?, lng: Double?) async throws -> BookingDirectory {
        var q = ["city": city, "specialty": specialty]
        if let lat, let lng { q["lat"] = String(lat); q["lng"] = String(lng) }
        return try await api.get("/api/booking/directory", query: q)
    }

    func slots(doctorId: String) async throws -> [Slot] {
        (try await api.get("/api/booking/slots", query: ["doctor_id": doctorId]) as SlotList).slots
    }

    /// Books a slot. A slot someone else took first comes back as SLOT_TAKEN,
    /// and the server's words are what the parent sees.
    func book(doctor: Doctor, slot: Slot, kid: Kid, profile: Profile?) async throws {
        guard let profile else { throw APIError.unauthorized }
        let id = "a\(Int(Date().timeIntervalSince1970 * 1000))"
        try await api.post("/api/appointments", json: [
            "id": id, "profile_id": profile.id, "user_id": profile.userId,
            "doctor_id": doctor.id, "doctor_name": doctor.name, "specialty": doctor.specialty,
            "kid_name": kid.name, "date": slot.date, "time": slot.time,
        ] as [String: Any])
        if let rows = try? await api.getList("/api/appointments") as [Appointment] { appointments = rows }
    }

    func cancel(_ appointment: Appointment) async throws {
        try await api.delete("/api/appointments/\(appointment.id)")
        appointments.removeAll { $0.id == appointment.id }
    }

    // MARK: Family sharing

    func validateFamily(code: String) async throws -> FamilyValidation {
        try await api.post("/api/family-sharing/validate", json: ["code": code])
    }

    func joinFamily(code: String, name: String, relation: String) async throws -> FamilyJoin {
        try await api.post("/api/family-sharing/join",
                           json: ["code": code, "coParentName": name, "relation": relation])
    }

    /// The owner's answer to a request to join their family.
    func answerCoParent(_ coParent: CoParent, approve: Bool) async {
        let action = approve ? "approve" : "decline"
        do {
            try await api.post("/api/co-parents/\(coParent.id)/\(action)")
        } catch {
            toast = error.localizedDescription
        }
        if let rows = try? await api.getList("/api/co-parents") as [CoParent] { coParents = rows }
    }

    // MARK: Helpers

    private nonisolated func fetch<T>(_ operation: @escaping () async throws -> T) async -> Result<T, Error> {
        do { return .success(try await operation()) } catch { return .failure(error) }
    }

    /// Applies a result that came back, and says whether one did.
    private func apply<T>(_ result: Result<T, Error>, _ assign: (T) -> Void) -> Bool {
        switch result {
        case .success(let value):
            assign(value)
            return true
        case .failure(let error):
            if case APIError.unreachable = error { return false }
            return true
        }
    }
}

enum Dates {
    /// Today in the device's time zone, as YYYY-MM-DD: the day a food tick belongs to.
    static var isoToday: String {
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .gregorian)
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd"
        return f.string(from: Date())
    }
}
