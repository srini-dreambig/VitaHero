import SwiftUI

struct HomeView: View {
    @EnvironmentObject private var auth: AuthManager
    @EnvironmentObject private var store: AppStore

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if store.unreachable { Banner(text: L("server_unreachable")) }

                if !store.consents.isEmpty {
                    NavigationLink { ConsentListView() } label: {
                        Card {
                            HStack {
                                Image(systemName: "checkmark.shield.fill").foregroundColor(Brand.orange)
                                VStack(alignment: .leading) {
                                    Text(L("camp_consent_title")).font(.headline)
                                    Text(store.consents.map(\.kidName).joined(separator: ", "))
                                        .font(.subheadline).foregroundColor(.secondary)
                                }
                                Spacer()
                                Image(systemName: "chevron.right").foregroundColor(.secondary)
                            }
                        }
                    }
                    .buttonStyle(.plain)
                }

                if store.allKids.isEmpty && !store.loading {
                    Card { EmptyState(icon: "person.2", title: L("no_kids_yet"), subtitle: L("no_kids_sub")) }
                } else {
                    KidPicker()
                    if let kid = store.selectedKid {
                        KidSummaryCard(kid: kid)
                        TodaysPlanCard(kid: kid)
                    }
                }

                quickLinks

                if let camp = store.camps.first(where: \.isUpcoming) {
                    Text(L("upcoming_camp")).font(.headline)
                    NavigationLink { CampDetailView(camp: camp) } label: { CampRow(camp: camp) }
                        .buttonStyle(.plain)
                }

                if !store.appointments.isEmpty {
                    Text(L("upcoming_appts")).font(.headline)
                    ForEach(store.appointments) { AppointmentRow(appointment: $0) }
                }

                Text(L("medical_disclaimer")).font(.caption).foregroundColor(.secondary)
            }
            .padding(16)
        }
        .background(Color(.systemGroupedBackground))
        .navigationTitle(greeting)
        .toolbar { ToolbarItem(placement: .navigationBarTrailing) { BellButton() } }
        .refreshable { await store.loadAll(profile: auth.profile) }
    }

    private var greeting: String {
        let name = auth.profile?.name.split(separator: " ").first.map { String($0) } ?? ""
        return name.isEmpty ? L("nav_home") : L("hi_name", name)
    }

    private var quickLinks: some View {
        HStack(spacing: 12) {
            QuickLink(title: L("symptoms_title"), icon: "thermometer.medium", color: Brand.red) { SymptomsView() }
            QuickLink(title: L("book_visit"), icon: "stethoscope", color: Brand.blue) { BookingView() }
            QuickLink(title: L("family_sharing"), icon: "person.3.fill", color: Brand.purple) { FamilyView() }
        }
    }
}

struct QuickLink<Destination: View>: View {
    let title: String
    let icon: String
    let color: Color
    @ViewBuilder var destination: () -> Destination

    var body: some View {
        NavigationLink {
            destination()
        } label: {
            VStack(spacing: 8) {
                Image(systemName: icon).font(.title2).foregroundColor(color)
                Text(title).font(.caption.weight(.semibold)).multilineTextAlignment(.center)
                    .foregroundColor(.primary).lineLimit(2)
            }
            .frame(maxWidth: .infinity, minHeight: 84)
            .background(Color(.secondarySystemGroupedBackground))
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        }
    }
}

/// The child's last school measurements and flags, read only.
struct KidSummaryCard: View {
    let kid: Kid

    var body: some View {
        NavigationLink { KidDetailView(kid: kid) } label: {
            Card {
                HStack(spacing: 12) {
                    Avatar(kid: kid)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(kid.name).font(.headline)
                        Text([kid.school, kid.grade].filter { !$0.isEmpty }.joined(separator: " · "))
                            .font(.subheadline).foregroundColor(.secondary)
                    }
                    Spacer()
                    if kid.shared { Pill(text: L("family_sharing"), color: Brand.purple) }
                }
                HStack {
                    FlagChip(title: L("dental_tab_label"), flag: HealthFlag(server: kid.dental))
                    FlagChip(title: L("eye_tab_label"), flag: HealthFlag(server: kid.eyesight))
                    FlagChip(title: L("nutrition_tab_label"), flag: HealthFlag(server: kid.nutrition))
                }
            }
        }
        .buttonStyle(.plain)
    }
}

struct FlagChip: View {
    let title: String
    let flag: HealthFlag

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title).font(.caption).foregroundColor(.secondary)
            HStack(spacing: 4) {
                Circle().fill(flag.color).frame(width: 8, height: 8)
                Text(flag.label).font(.caption.weight(.semibold)).lineLimit(1).minimumScaleFactor(0.8)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// The dietician's targets as today's checklist, with the streak beside it.
struct TodaysPlanCard: View {
    let kid: Kid
    @EnvironmentObject private var store: AppStore
    @EnvironmentObject private var auth: AuthManager

    var body: some View {
        let items = store.planItems(kidId: kid.id)
        if let plan = store.dietPlans[kid.id] {
            Card {
                HStack {
                    Text(L("todays_plan")).font(.headline)
                    Spacer()
                    if let streak = store.streaks[kid.id], streak.current > 0 {
                        Label(L("streak_days", String(streak.current)), systemImage: "flame.fill")
                            .font(.caption.weight(.semibold))
                            .foregroundColor(Brand.orange)
                    }
                }
                Text(plan.title).font(.subheadline).foregroundColor(.secondary)
                ForEach(items) { item in
                    Button {
                        Task { await store.toggle(item, profile: auth.profile) }
                    } label: {
                        HStack(alignment: .top) {
                            Image(systemName: item.eaten ? "checkmark.circle.fill" : "circle")
                                .foregroundColor(item.eaten ? Brand.green : .secondary)
                                .font(.title3)
                            VStack(alignment: .leading) {
                                Text(item.name).foregroundColor(.primary)
                                if !item.detail.isEmpty {
                                    Text(item.detail).font(.caption).foregroundColor(.secondary)
                                }
                            }
                            Spacer()
                        }
                    }
                    .buttonStyle(.plain)
                }
                NavigationLink(L("view_diet_plan")) { DietPlanView(kid: kid) }
                    .font(.subheadline.weight(.semibold))
            }
        }
    }
}

struct AppointmentRow: View {
    let appointment: Appointment
    var onCancel: (() -> Void)? = nil

    var body: some View {
        Card {
            HStack(alignment: .top) {
                Image(systemName: "calendar.badge.clock").foregroundColor(Brand.blue).font(.title3)
                VStack(alignment: .leading, spacing: 2) {
                    Text(appointment.doctorName).font(.headline)
                    Text(appointment.specialty).font(.subheadline).foregroundColor(.secondary)
                    Text("\(appointment.kidName) · \(appointment.date) · \(appointment.time)")
                        .font(.caption).foregroundColor(.secondary)
                }
                Spacer()
            }
            if let onCancel {
                Button(L("cancel_appt"), role: .destructive, action: onCancel).font(.subheadline)
            }
        }
    }
}
