import SwiftUI

/// One camp's children as this clinician sees them: To do and Done count
/// only their own checks, so another doctor's save does not tick a child off.
struct ClinicianRosterView: View {
    let camp: ClinicianCamp

    @EnvironmentObject private var clinician: ClinicianStore
    @State private var query = ""
    @State private var stateFilter = ""
    @State private var classFilter = ""
    @State private var attendanceError: String?

    private static let states: [(value: String, key: String)] = [
        ("", "clin_filter_all"), ("TODO", "clin_to_do"), ("DONE", "clin_done"),
        ("ABSENT", "clin_absent"), ("NO_CONSENT", "clin_no_consent"),
    ]

    private var roster: CampRoster? {
        clinician.rosterCampId == camp.id ? clinician.roster : nil
    }

    /// Every child on the camp, for the physician's review count.
    private var everyone: [CampChild] { roster?.participants ?? [] }

    /// The children with a check of this clinician's on them.
    private var children: [CampChild] { everyone.filter { $0.state != "NOT_MINE" } }

    private var doneCount: Int { children.filter { $0.state == "DONE" }.count }

    /// The review counts children anyone has screened. An absent child has
    /// no findings, so it is not sent for review.
    private var screenedCount: Int {
        everyone.filter { $0.status != "NOT_SCREENED" && $0.status != "ABSENT" }.count
    }

    private var classes: [String] {
        var seen: [String] = []
        for name in children.map(\.className) where !name.isEmpty && !seen.contains(name) { seen.append(name) }
        return seen.sorted { $0.localizedStandardCompare($1) == .orderedAscending }
    }

    /// Search and class, before the status filter, so each status shows its count.
    private var searched: [CampChild] {
        let q = query.trimmingCharacters(in: .whitespaces).lowercased()
        return children.filter { child in
            (classFilter.isEmpty || child.className == classFilter)
                && (q.isEmpty || child.name.lowercased().contains(q) || child.studentRef.lowercased().contains(q))
        }
    }

    private var filtered: [CampChild] {
        stateFilter.isEmpty ? searched : searched.filter { $0.state == stateFilter }
    }

    private var toDo: [CampChild] { filtered.filter { $0.state != "DONE" } }
    private var done: [CampChild] { filtered.filter { $0.state == "DONE" } }

    var body: some View {
        List {
            Section {
                VStack(alignment: .leading, spacing: 4) {
                    Text([camp.schoolName, camp.date].filter { !$0.isEmpty }.joined(separator: " · "))
                        .font(.subheadline).foregroundColor(.secondary)
                    Text(L("clin_x_of_y_done_by_you", String(doneCount), String(children.count)))
                        .font(.headline)
                }
                if !children.isEmpty { filters }
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
                EmptyState(icon: "person.3", title: L("clin_no_children"),
                           subtitle: everyone.isEmpty ? L("clin_no_children_sub") : L("clin_none_mine"))
                    .listRowBackground(Color.clear)
            } else if filtered.isEmpty {
                let q = query.trimmingCharacters(in: .whitespaces)
                EmptyState(icon: "magnifyingglass", title: L("clin_no_match"),
                           subtitle: q.isEmpty ? L("clin_no_match_filters") : L("clin_no_match_sub", q))
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

    // MARK: Filters

    /// Status with counts, then class when there is more than one. Both
    /// combine with the search.
    private var filters: some View {
        VStack(alignment: .leading, spacing: 8) {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(Self.states, id: \.value) { option in
                        let count = option.value.isEmpty ? searched.count
                            : searched.filter { $0.state == option.value }.count
                        chip(L(option.key) + " \(count)", selected: stateFilter == option.value) {
                            stateFilter = option.value
                        }
                    }
                }
            }
            if classes.count > 1 {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        chip(L("clin_all_classes"), selected: classFilter.isEmpty) { classFilter = "" }
                        ForEach(classes, id: \.self) { name in
                            chip(L("clin_class", name), selected: classFilter == name) { classFilter = name }
                        }
                    }
                }
            }
        }
        .padding(.vertical, 2)
    }

    private func chip(_ title: String, selected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(.footnote.weight(.medium))
                .foregroundColor(selected ? .white : .primary)
                .padding(.horizontal, 12)
                .frame(minHeight: 32)
                .background(Capsule().fill(selected ? Brand.orange : Color(.tertiarySystemGroupedBackground)))
        }
        .buttonStyle(.borderless)
        .accessibilityAddTraits(selected ? .isSelected : [])
    }

    // MARK: Rows

    @ViewBuilder
    private func row(_ child: CampChild) -> some View {
        let canScreen = roster?.can.screen ?? false
        let content = HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 3) {
                Text(child.name).font(.body.weight(.semibold))
                let sub = [child.className, child.studentRef]
                    .filter { !$0.isEmpty }.joined(separator: " · ")
                if !sub.isEmpty { Text(sub).font(.caption).foregroundColor(.secondary) }
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 3) {
                statusPills(child)
                // With more than one check, say which are still to record.
                if child.myChecks.count > 1, child.state != "DONE", !child.myOutstanding.isEmpty {
                    Text(child.myOutstanding.joined(separator: ", "))
                        .font(.caption2).foregroundColor(.secondary)
                        .multilineTextAlignment(.trailing)
                }
            }
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
            if child.state == "NO_CONSENT" {
                if child.consentStatus == "DECLINED" {
                    Pill(text: L("clin_declined"), color: Brand.red)
                } else {
                    Pill(text: L("clin_no_consent"), color: Brand.red)
                }
            } else if child.state == "DONE" {
                Pill(text: L("clin_done"), color: Brand.blue)
            } else {
                Pill(text: L("clin_to_do"), color: Brand.orange)
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
