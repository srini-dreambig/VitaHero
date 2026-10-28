import SwiftUI

/// The children on the parent's roster and those shared with them. The school
/// enrols children, so there is no add or edit here.
struct KidsView: View {
    @EnvironmentObject private var auth: AuthManager
    @EnvironmentObject private var store: AppStore

    var body: some View {
        List {
            if store.unreachable { Banner(text: L("server_unreachable")).listRowInsets(EdgeInsets()) }
            if store.allKids.isEmpty && !store.loading {
                EmptyState(icon: "person.2", title: L("no_kids_yet"), subtitle: L("no_kids_sub"))
            }
            Section(footer: Text(L("children_from_school"))) {
                ForEach(store.allKids) { kid in
                    NavigationLink { KidDetailView(kid: kid) } label: {
                        HStack(spacing: 12) {
                            Avatar(kid: kid, size: 40)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(kid.name).font(.headline)
                                Text([kid.school, kid.grade].filter { !$0.isEmpty }.joined(separator: " · "))
                                    .font(.subheadline).foregroundColor(.secondary)
                            }
                            Spacer()
                            if kid.shared { Pill(text: L("shared_child"), color: Brand.purple) }
                        }
                    }
                }
            }
        }
        .navigationTitle(L("my_kids"))
        .toolbar { ToolbarItem(placement: .navigationBarTrailing) { BellButton() } }
        .refreshable { await store.loadAll(profile: auth.profile) }
    }
}

/// One child's school measurements, flags and growth, read only, with the
/// things a parent records for them: illnesses and today's food.
struct KidDetailView: View {
    let kid: Kid
    @EnvironmentObject private var store: AppStore

    var body: some View {
        List {
            Section {
                HStack(spacing: 14) {
                    Avatar(kid: kid, size: 56)
                    VStack(alignment: .leading, spacing: 4) {
                        Text(kid.name).font(.title3.bold())
                        Text([kid.age > 0 ? "\(kid.age)" : "", kid.gender, kid.grade]
                            .filter { !$0.isEmpty }.joined(separator: " · "))
                            .foregroundColor(.secondary)
                        if !kid.school.isEmpty { Text(kid.school).font(.subheadline).foregroundColor(.secondary) }
                    }
                }
                .padding(.vertical, 4)
            }

            Section(header: Text(L("current_assessment")), footer: Text(L("measurements_from_school"))) {
                metric(L("kid_height"), kid.heightCm > 0 ? String(format: "%.1f cm", kid.heightCm) : "—")
                metric(L("kid_weight"), kid.weightKg > 0 ? String(format: "%.1f kg", kid.weightKg) : "—")
                if kid.heightCm > 0 && kid.weightKg > 0 {
                    let bmi = kid.weightKg / pow(kid.heightCm / 100, 2)
                    metric(L("bmi_label"), String(format: "%.1f", bmi))
                }
                if kid.overallScore > 0 { metric(L("health_score"), "\(kid.overallScore)") }
                if !kid.lastCheckup.isEmpty { metric(L("school_screenings"), kid.lastCheckup) }
                flagRow(L("dental_tab_label"), kid.dental)
                flagRow(L("eye_tab_label"), kid.eyesight)
                flagRow(L("nutrition_tab_label"), kid.nutrition)
            }

            Section(L("growth_tab_label")) {
                let points = store.growth[kid.id] ?? []
                if points.isEmpty {
                    Text(L("no_growth_data_sub")).font(.subheadline).foregroundColor(.secondary)
                }
                ForEach(points) { point in
                    HStack {
                        Text(point.label)
                        Spacer()
                        Text(String(format: "%.1f cm · %.1f kg", point.height, point.weight))
                            .foregroundColor(.secondary)
                    }
                }
            }

            Section {
                NavigationLink { SymptomsView(kidId: kid.id) } label: {
                    Label(L("symptoms_title"), systemImage: "thermometer.medium")
                }
                NavigationLink { DietPlanView(kid: kid) } label: {
                    Label(L("diet_plan_title"), systemImage: "fork.knife")
                }
                NavigationLink { RewardsView(kidId: kid.id) } label: {
                    Label(L("hero_badges"), systemImage: "star.fill")
                }
            }

            Section { Text(L("medical_disclaimer")).font(.caption).foregroundColor(.secondary) }
        }
        .navigationTitle(kid.name)
        .navigationBarTitleDisplayMode(.inline)
        .task {
            store.selectedKidId = kid.id
            await store.loadKid(kid.id)
        }
    }

    private func metric(_ title: String, _ value: String) -> some View {
        HStack {
            Text(title)
            Spacer()
            Text(value).foregroundColor(.secondary)
        }
    }

    private func flagRow(_ title: String, _ value: String) -> some View {
        let flag = HealthFlag(server: value)
        return HStack {
            Text(title)
            Spacer()
            Pill(text: flag.label, color: flag.color)
        }
    }
}
