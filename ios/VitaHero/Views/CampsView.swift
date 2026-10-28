import SwiftUI

struct CampsView: View {
    @EnvironmentObject private var auth: AuthManager
    @EnvironmentObject private var store: AppStore

    private var upcoming: [Camp] { store.camps.filter(\.isUpcoming) }
    private var past: [Camp] { store.camps.filter { !$0.isUpcoming } }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                if store.unreachable { Banner(text: L("server_unreachable")) }

                if !store.consents.isEmpty {
                    NavigationLink { ConsentListView() } label: {
                        Banner(text: "\(L("camp_consent_title")): \(store.consents.map(\.kidName).joined(separator: ", "))",
                               color: Brand.orange)
                    }
                    .buttonStyle(.plain)
                }

                if store.camps.isEmpty && !store.loading {
                    EmptyState(icon: "cross.case", title: L("no_camps_yet"), subtitle: L("no_camps_sub"))
                }
                if !upcoming.isEmpty {
                    Text(L("upcoming")).font(.headline)
                    ForEach(upcoming) { camp in
                        NavigationLink { CampDetailView(camp: camp) } label: { CampRow(camp: camp) }
                            .buttonStyle(.plain)
                    }
                }
                if !past.isEmpty {
                    Text(L("past_camps")).font(.headline).padding(.top, 8)
                    ForEach(past) { camp in
                        NavigationLink { CampDetailView(camp: camp) } label: { CampRow(camp: camp) }
                            .buttonStyle(.plain)
                    }
                }
            }
            .padding(16)
        }
        .background(Color(.systemGroupedBackground))
        .navigationTitle(L("school_camps"))
        .toolbar { ToolbarItem(placement: .navigationBarTrailing) { BellButton() } }
        .refreshable { await store.loadAll(profile: auth.profile) }
    }
}

struct CampRow: View {
    let camp: Camp

    var body: some View {
        Card {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(camp.title).font(.headline)
                    if !camp.school.isEmpty { Text(camp.school).font(.subheadline).foregroundColor(.secondary) }
                    Label([camp.date, camp.time].filter { !$0.isEmpty }.joined(separator: " · "), systemImage: "calendar")
                        .font(.caption).foregroundColor(.secondary)
                }
                Spacer()
                CampStatusPill(status: camp.status)
            }
        }
    }
}

struct CampStatusPill: View {
    let status: String

    var body: some View {
        switch status {
        case "SCHEDULED", "UPCOMING", "DRAFT": Pill(text: L("upcoming"), color: Brand.blue)
        case "IN_PROGRESS": Pill(text: L("ongoing_label"), color: Brand.amber)
        case "SCREENED": Pill(text: L("screened"), color: Brand.purple)
        case "RELEASED", "COMPLETED": Pill(text: L("completed"), color: Brand.green)
        case "CANCELLED": Pill(text: L("camp_cancelled"), color: Brand.red)
        default: Pill(text: status.capitalized, color: .secondary)
        }
    }
}

/// A camp, and for a past one, each child's result from it.
struct CampDetailView: View {
    let camp: Camp
    @EnvironmentObject private var store: AppStore

    /// The parent's children registered for this camp; all of them when the
    /// camp does not say.
    private var kids: [Kid] {
        let registered = store.allKids.filter { camp.registeredKidIds.contains($0.id) }
        return registered.isEmpty ? store.allKids : registered
    }

    var body: some View {
        List {
            Section {
                VStack(alignment: .leading, spacing: 6) {
                    HStack {
                        Text(camp.title).font(.title3.bold())
                        Spacer()
                        CampStatusPill(status: camp.status)
                    }
                    if !camp.school.isEmpty { Text(camp.school).foregroundColor(.secondary) }
                }
                if !camp.date.isEmpty { row("calendar", [camp.date, camp.time].filter { !$0.isEmpty }.joined(separator: " · ")) }
                if !camp.venue.isEmpty { row("mappin.and.ellipse", camp.venue) }
                if camp.isPartner { row("cross.case.fill", L("camp_partner_hospital")) }
                if !camp.description.isEmpty { Text(camp.description).font(.subheadline) }
            }

            if !camp.checks.isEmpty {
                Section(L("screenings_included")) {
                    ForEach(camp.checks, id: \.self) { Text($0) }
                }
            }

            if !camp.isUpcoming && !camp.isCancelled {
                Section(L("camp_result_title")) {
                    ForEach(kids) { kid in
                        NavigationLink { CampResultView(camp: camp, kid: kid) } label: {
                            HStack(spacing: 10) {
                                Avatar(kid: kid, size: 32)
                                Text(kid.name)
                            }
                        }
                    }
                }
            }
        }
        .navigationTitle(L("camp_details"))
        .navigationBarTitleDisplayMode(.inline)
    }

    private func row(_ icon: String, _ text: String) -> some View {
        Label(text, systemImage: icon).font(.subheadline)
    }
}

/// One child's findings from one camp, as the clinicians released them.
struct CampResultView: View {
    let camp: Camp
    let kid: Kid
    @EnvironmentObject private var store: AppStore
    @State private var result: CampResult?
    @State private var error: String?

    var body: some View {
        List {
            if let error { Banner(text: error).listRowInsets(EdgeInsets()) }
            if let result {
                switch result.status {
                case "PENDING", "UNDER_REVIEW", "SCREENED":
                    EmptyState(icon: "hourglass", title: L("result_under_review"), subtitle: L("result_under_review_sub"))
                case "NOT_SCREENED", "NONE", "NOT_FOUND":
                    EmptyState(icon: "minus.circle", title: L("result_not_screened"),
                               subtitle: result.message.isEmpty ? nil : result.message)
                default:
                    released(result)
                }
            } else if error == nil {
                HStack { Spacer(); ProgressView(); Spacer() }
            }
            Section { Text(L("medical_disclaimer")).font(.caption).foregroundColor(.secondary) }
        }
        .navigationTitle(kid.name)
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
        .refreshable { await load() }
    }

    @ViewBuilder
    private func released(_ result: CampResult) -> some View {
        Section {
            VStack(alignment: .leading, spacing: 4) {
                Text(result.campTitle.isEmpty ? camp.title : result.campTitle).font(.headline)
                Text(result.date.isEmpty ? camp.date : result.date).font(.subheadline).foregroundColor(.secondary)
            }
            if !result.urgency.isEmpty { urgency(result.urgency) }
        }
        if result.findings.isEmpty {
            Section { Text(result.message.isEmpty ? L("result_not_screened") : result.message) }
        } else {
            Section(L("current_assessment")) {
                ForEach(result.findings) { finding in
                    let flag = HealthFlag(server: finding.flag)
                    VStack(alignment: .leading, spacing: 4) {
                        HStack {
                            Text(finding.checkType.capitalized).font(.headline)
                            Spacer()
                            Pill(text: flag.label, color: flag.color)
                        }
                        if !finding.summary.isEmpty { Text(finding.summary).font(.subheadline) }
                        if !finding.note.isEmpty { Text(finding.note).font(.caption).foregroundColor(.secondary) }
                    }
                    .padding(.vertical, 4)
                }
            }
        }
        if !result.recommendation.isEmpty {
            Section(L("doctor_says")) { Text(result.recommendation) }
        }
    }

    @ViewBuilder
    private func urgency(_ value: String) -> some View {
        switch value {
        case "URGENT": Pill(text: L("urgency_urgent"), color: Brand.red)
        case "SOON": Pill(text: L("urgency_soon"), color: Brand.amber)
        case "ROUTINE": Pill(text: L("urgency_routine"), color: Brand.green)
        default: EmptyView()
        }
    }

    private func load() async {
        do {
            result = try await store.campResult(campId: camp.id, kidId: kid.id)
            error = nil
        } catch {
            self.error = error.localizedDescription
        }
    }
}
