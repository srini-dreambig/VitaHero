import SwiftUI

/// One camp's children, split into who is left to screen and who is done.
struct ClinicianRosterView: View {
    let camp: ClinicianCamp

    @EnvironmentObject private var clinician: ClinicianStore
    @State private var query = ""
    @State private var attendanceError: String?

    private var roster: CampRoster? {
        clinician.rosterCampId == camp.id ? clinician.roster : nil
    }

    private var children: [CampChild] { roster?.participants ?? [] }

    private var screenedCount: Int { children.filter { $0.status != "NOT_SCREENED" }.count }

    private var filtered: [CampChild] {
        let q = query.trimmingCharacters(in: .whitespaces).lowercased()
        guard !q.isEmpty else { return children }
        return children.filter { $0.name.lowercased().contains(q) || $0.studentRef.lowercased().contains(q) }
    }

    private var toDo: [CampChild] { filtered.filter { $0.status == "NOT_SCREENED" } }
    private var done: [CampChild] { filtered.filter { $0.status != "NOT_SCREENED" } }

    var body: some View {
        List {
            Section {
                VStack(alignment: .leading, spacing: 4) {
                    Text([camp.schoolName, camp.date].filter { !$0.isEmpty }.joined(separator: " · "))
                        .font(.subheadline).foregroundColor(.secondary)
                    Text(L("clin_x_of_y_screened", String(screenedCount), String(children.count)))
                        .font(.headline)
                }
                if let error = clinician.rosterError, roster != nil {
                    Banner(text: error, color: Brand.red)
                }
                if let attendanceError {
                    Banner(text: attendanceError, color: Brand.red)
                }
                if let roster, roster.can.review, screenedCount > 0 {
                    NavigationLink(value: ClinicianRoute.review(camp)) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(L("clin_review_send")).font(.headline).foregroundColor(Brand.orange)
                            Text(L("clin_review_send_sub", String(screenedCount)))
                                .font(.footnote).foregroundColor(.secondary)
                        }
                        .padding(.vertical, 4)
                    }
                }
            }

            if roster == nil {
                Group {
                    if let error = clinician.rosterError {
                        EmptyState(icon: "wifi.exclamationmark", title: L("clin_roster_failed"), subtitle: error)
                    } else {
                        EmptyState(icon: "hourglass", title: L("clin_loading_list"), subtitle: L("clin_one_moment"))
                    }
                }
                .listRowBackground(Color.clear)
            } else if children.isEmpty {
                EmptyState(icon: "person.3", title: L("clin_no_children"), subtitle: L("clin_no_children_sub"))
                    .listRowBackground(Color.clear)
            } else if filtered.isEmpty {
                EmptyState(icon: "magnifyingglass", title: L("clin_no_match"), subtitle: L("clin_no_match_sub", query))
                    .listRowBackground(Color.clear)
            } else {
                if !toDo.isEmpty {
                    Section(L("clin_to_do") + " · \(toDo.count)") {
                        ForEach(toDo) { row($0) }
                    }
                }
                if !done.isEmpty {
                    Section(L("clin_done") + " · \(done.count)") {
                        ForEach(done) { row($0) }
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
        .searchable(text: $query, prompt: L("clin_search"))
        .navigationTitle(camp.title)
        .navigationBarTitleDisplayMode(.inline)
        .refreshable { await clinician.loadRoster(camp.id) }
        .task { await clinician.loadRoster(camp.id) }
    }

    @ViewBuilder
    private func row(_ child: CampChild) -> some View {
        let canScreen = roster?.can.screen ?? false
        let content = HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 3) {
                Text(child.name).font(.body.weight(.semibold))
                let sub = [[child.grade, child.section].filter { !$0.isEmpty }.joined(separator: " "), child.studentRef]
                    .filter { !$0.isEmpty }.joined(separator: " · ")
                if !sub.isEmpty { Text(sub).font(.caption).foregroundColor(.secondary) }
            }
            Spacer()
            statusPills(child)
        }
        .padding(.vertical, 2)

        if canScreen {
            NavigationLink(value: ClinicianRoute.screening(campId: camp.id, kidId: child.kidId)) { content }
                .swipeActions(edge: .trailing) { attendanceAction(child) }
        } else {
            content
        }
    }

    @ViewBuilder
    private func statusPills(_ child: CampChild) -> some View {
        HStack(spacing: 6) {
            if child.attendance == "ABSENT" {
                Pill(text: L("clin_absent"), color: .secondary)
            }
            switch child.consentStatus {
            case "DECLINED": Pill(text: L("clin_declined"), color: Brand.red)
            case "GRANTED", "PAPER":
                if child.status == "NOT_SCREENED" {
                    Pill(text: L("clin_to_do"), color: Brand.orange)
                } else {
                    Pill(text: L("clin_done"), color: Brand.blue)
                }
            default: Pill(text: L("clin_no_consent"), color: Brand.red)
            }
        }
    }

    /// Swipe to mark a child absent, or back to present. The screening form
    /// offers the same, with a confirmation; this is the quick path at the door.
    @ViewBuilder
    private func attendanceAction(_ child: CampChild) -> some View {
        let next = child.attendance == "ABSENT" ? "PRESENT" : "ABSENT"
        Button {
            Task {
                attendanceError = await clinician.markAttendance(campId: camp.id, kidId: child.kidId, attendance: next)
            }
        } label: {
            Text(next == "ABSENT" ? L("clin_mark_absent") : L("clin_mark_present"))
        }
        .tint(next == "ABSENT" ? .gray : Brand.blue)
    }
}
