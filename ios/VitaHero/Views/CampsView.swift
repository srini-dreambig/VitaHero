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
    /// Each child's place in the camp, by kid id.
    @State private var progress: [String: CampResult] = [:]

    /// The parent's children registered for this camp; all of them when the
    /// camp does not say.
    private var kids: [Kid] {
        let registered = registeredKids
        return registered.isEmpty ? store.allKids : registered
    }

    /// Only the children on this camp's list: a brother at another school must
    /// not be told a doctor is checking him for a camp he never attended.
    private var registeredKids: [Kid] {
        store.allKids.filter { camp.registeredKidIds.contains($0.id) }
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

            // Each child on this camp's list, from the day they are put on it:
            // which checks are done and which are still to come, then the
            // result once a doctor releases it. Progress only, never findings.
            if camp.isPartner && !registeredKids.isEmpty {
                Section {
                    ForEach(registeredKids) { kid in
                        NavigationLink { CampResultView(camp: camp, kid: kid) } label: {
                            progressRow(kid, progress[kid.id]?.progress)
                        }
                    }
                } header: {
                    Text(L("camp_progress_title"))
                } footer: {
                    Text(L("progress_values_note"))
                }
            } else if !camp.isUpcoming && !camp.isCancelled {
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
        // Live while the screen is open: asked again every half minute until
        // every child has an answer that will not change.
        .task(id: camp.id) {
            guard camp.isPartner else { return }
            while !Task.isCancelled {
                await loadProgress()
                let kids = registeredKids
                if kids.isEmpty || kids.allSatisfy({ progress[$0.id]?.progress?.settled == true }) { break }
                try? await Task.sleep(nanoseconds: 30_000_000_000)
            }
        }
        .refreshable { await loadProgress() }
    }

    private func loadProgress() async {
        for kid in registeredKids {
            if let r = try? await store.campResult(campId: camp.id, kidId: kid.id), r.progress != nil {
                progress[kid.id] = r
            }
        }
    }

    private func progressRow(_ kid: Kid, _ p: CampResult.Progress?) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 10) {
                Avatar(kid: kid, size: 32)
                VStack(alignment: .leading, spacing: 2) {
                    Text(kid.name).font(.headline).lineLimit(1)
                    if let p {
                        Text(p.stageLabel).font(.caption)
                            .fontWeight(p.stage == "RELEASED" ? .bold : .regular)
                            .foregroundColor(p.stage == "RELEASED" ? Brand.amber : .secondary)
                    } else {
                        ProgressView().controlSize(.small)
                    }
                }
            }
            ForEach(p?.checks ?? []) { CheckStateRow(check: $0) }
        }
        .padding(.vertical, 4)
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
                    // The stage, when the server says it: "a doctor is still
                    // checking this" was wrong for a child still in the queue.
                    EmptyState(icon: "hourglass",
                               title: pendingTitle(result.progress),
                               subtitle: result.message.isEmpty ? L("result_under_review_sub") : result.message)
                    if let checks = result.progress?.checks, !checks.isEmpty {
                        Section(L("camp_progress_title")) {
                            ForEach(checks) { CheckStateRow(check: $0) }
                        }
                    }
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

    private func pendingTitle(_ p: CampResult.Progress?) -> String {
        switch p?.stage {
        case "SCREENING": return L("progress_screening")
        case "WAITING": return L("progress_waiting")
        case "CONSENT_NEEDED": return L("progress_consent_needed")
        case "DECLINED": return L("progress_declined")
        default: return L("result_under_review")
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

/// One check at a camp and whether it is done yet. Never what it found.
struct CheckStateRow: View {
    let check: CampResult.Progress.Check

    var body: some View {
        HStack {
            Text(check.checkType).font(.subheadline).lineLimit(1)
            Spacer()
            Text(label).font(.caption.weight(.semibold)).foregroundColor(color)
        }
    }

    private var label: String {
        switch check.state {
        case "DONE": return "\u{2713} " + L("check_state_done")
        case "NOT_DONE": return L("check_state_not_done")
        case "NOT_CONSENTED": return L("check_state_not_included")
        default: return L("check_state_pending")
        }
    }

    private var color: Color {
        switch check.state {
        case "DONE": return Brand.blue
        case "PENDING": return Brand.amber
        default: return .secondary
        }
    }
}
