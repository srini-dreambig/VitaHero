import SwiftUI

/// The dietician's plan for a child, and today's targets to tick.
struct DietPlanView: View {
    let kid: Kid
    @EnvironmentObject private var store: AppStore
    @EnvironmentObject private var auth: AuthManager

    var body: some View {
        List {
            if let plan = store.dietPlans[kid.id] {
                Section {
                    VStack(alignment: .leading, spacing: 6) {
                        Text(plan.title).font(.title3.bold())
                        if !plan.focus.isEmpty { Pill(text: plan.focus, color: Brand.green) }
                        if !plan.authorName.isEmpty {
                            Text(L("diet_plan_from", plan.authorName)).font(.subheadline).foregroundColor(.secondary)
                        }
                        if !plan.startsOn.isEmpty {
                            Text([plan.startsOn, plan.endsOn].filter { !$0.isEmpty }.joined(separator: " – "))
                                .font(.caption).foregroundColor(.secondary)
                        }
                    }
                    if !plan.guidance.isEmpty { Text(plan.guidance).font(.subheadline) }
                }
                Section(header: Text(L("todays_plan")), footer: Text(L("log_all_meals_hint"))) {
                    ForEach(store.planItems(kidId: kid.id)) { item in
                        Button {
                            Task { await store.toggle(item, profile: auth.profile) }
                        } label: {
                            HStack {
                                Image(systemName: item.eaten ? "checkmark.circle.fill" : "circle")
                                    .foregroundColor(item.eaten ? Brand.green : .secondary).font(.title3)
                                VStack(alignment: .leading) {
                                    Text(item.name).foregroundColor(.primary)
                                    if !item.detail.isEmpty {
                                        Text(item.detail).font(.caption).foregroundColor(.secondary)
                                    }
                                }
                            }
                        }
                    }
                }
                StreakSection(kidId: kid.id)
            } else {
                EmptyState(icon: "fork.knife", title: L("no_diet_plan"), subtitle: L("no_diet_plan_sub"))
            }
            Section { Text(L("medical_disclaimer")).font(.caption).foregroundColor(.secondary) }
        }
        .navigationTitle(L("diet_plan_title"))
        .navigationBarTitleDisplayMode(.inline)
        .task { await store.loadKid(kid.id) }
        .refreshable { await store.loadKid(kid.id) }
    }
}

struct StreakSection: View {
    let kidId: String
    @EnvironmentObject private var store: AppStore

    var body: some View {
        let streak = store.streaks[kidId]
        Section {
            HStack {
                stat(icon: "flame.fill", color: Brand.orange, value: streak?.current ?? 0, label: L("streak_current"))
                Divider()
                stat(icon: "trophy.fill", color: Brand.amber, value: streak?.best ?? 0, label: L("streak_best"))
            }
            .padding(.vertical, 4)
        }
    }

    private func stat(icon: String, color: Color, value: Int, label: String) -> some View {
        VStack(spacing: 4) {
            Label("\(value)", systemImage: icon).font(.title2.bold()).foregroundColor(color)
            Text(label).font(.caption).foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity)
    }
}

/// Streaks and badges, which the server keeps per child.
struct RewardsView: View {
    var kidId: String? = nil
    @EnvironmentObject private var store: AppStore
    @EnvironmentObject private var auth: AuthManager

    private var kid: Kid? {
        if let kidId { return store.allKids.first { $0.id == kidId } }
        return store.selectedKid
    }

    var body: some View {
        List {
            if kidId == nil { KidPicker().listRowBackground(Color.clear).listRowInsets(EdgeInsets()) }
            if let kid {
                Section {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(L("kid_badges", kid.name)).font(.headline)
                        Text(L("hero_badges_title")).font(.subheadline).foregroundColor(.secondary)
                    }
                }
                StreakSection(kidId: kid.id)
                let badges = (store.badges[kid.id] ?? []).compactMap(BadgeInfo.init)
                Section(L("badges")) {
                    if badges.isEmpty {
                        EmptyState(icon: "star", title: L("badges_empty"), subtitle: L("badges_empty_sub"))
                    }
                    ForEach(badges) { BadgeRow(info: $0) }
                }
            } else {
                EmptyState(icon: "person.2", title: L("no_kids_yet"), subtitle: L("no_kids_sub"))
            }
        }
        .navigationTitle(L("hero_badges"))
        .toolbar { if kidId == nil { ToolbarItem(placement: .navigationBarTrailing) { BellButton() } } }
        .task(id: kid?.id) { if let id = kid?.id { await store.loadKid(id) } }
        .refreshable { if let id = kid?.id { await store.loadKid(id) } }
    }
}

/// A badge with the words and colour this build has for it. A badge the
/// server adds before the app knows it is left out, as on Android.
struct BadgeInfo: Identifiable {
    let badge: Badge
    let title: String
    let subtitle: String
    let icon: String
    let color: Color
    var id: String { badge.id }

    init?(_ badge: Badge) {
        self.badge = badge
        switch badge.id {
        case "b1": title = L("badge_super_eater"); subtitle = L("badge_super_eater_sub"); icon = "fork.knife.circle.fill"; color = Brand.green
        case "b2": title = L("badge_every_meal"); subtitle = L("badge_every_meal_sub"); icon = "checkmark.seal.fill"; color = Brand.blue
        case "b3": title = L("badge_three_day"); subtitle = L("badge_three_day_sub"); icon = "flame.fill"; color = Color.cyan
        case "b4": title = L("badge_two_week"); subtitle = L("badge_two_week_sub"); icon = "calendar.badge.checkmark"; color = Brand.amber
        case "b5":
            title = L("badge_bright_smile")
            subtitle = badge.current > 0 || badge.earned ? L("badge_bright_smile_sub") : L("badge_bright_smile_unknown")
            icon = "mouth.fill"; color = Brand.purple
        case "b6": title = L("badge_half_way"); subtitle = L("badge_half_way_sub"); icon = "star.leadinghalf.filled"; color = Color.pink
        default: return nil
        }
    }
}

struct BadgeRow: View {
    let info: BadgeInfo

    var body: some View {
        HStack(spacing: 14) {
            Image(systemName: info.icon)
                .font(.title2)
                .foregroundColor(info.badge.earned ? .white : info.color)
                .frame(width: 48, height: 48)
                .background(info.badge.earned ? info.color : info.color.opacity(0.14))
                .clipShape(Circle())
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(info.title).font(.headline)
                    Spacer()
                    if info.badge.earned { Pill(text: L("earned"), color: info.color) }
                }
                Text(info.subtitle).font(.caption).foregroundColor(.secondary)
                if !info.badge.earned {
                    ProgressView(value: info.badge.progress).tint(info.color)
                    if info.badge.target > 0 {
                        Text("\(info.badge.current) / \(info.badge.target)").font(.caption2).foregroundColor(.secondary)
                    }
                }
            }
        }
        .padding(.vertical, 4)
    }
}
