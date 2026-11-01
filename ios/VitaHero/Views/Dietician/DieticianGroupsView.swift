import SwiftUI

/// One school's children in groups, so a plan is written once for everyone who
/// needs the same thing rather than child by child.
///
/// The server groups them by what their checks found (growth band, then
/// anaemia, then tooth decay) and hands each group a draft. A child who needs
/// something different is still one tap away on the class list.
struct DieticianGroupsView: View {
    let school: DieticianSchool

    @EnvironmentObject private var dietician: DieticianStore
    @State private var grade = ""

    private var data: DieticianCohorts? {
        dietician.cohortsSchoolId == school.id ? dietician.cohorts : nil
    }

    var body: some View {
        List {
            Section {
                Text([school.name, grade.isEmpty ? "All classes" : "Class \(grade)"]
                    .filter { !$0.isEmpty }.joined(separator: " · "))
                    .font(.subheadline).foregroundColor(.secondary)
                if let error = dietician.cohortsError {
                    Banner(text: error, color: Brand.red)
                }
                // Built from the whole school's list, so picking one class
                // does not make the others disappear.
                if let grades = data?.grades, grades.count > 1 {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 6) {
                            DieticianChip(title: "All classes", selected: grade.isEmpty) { grade = "" }
                            ForEach(grades, id: \.self) { g in
                                DieticianChip(title: "Class \(g)", selected: grade == g) { grade = g }
                            }
                        }
                    }
                }
            }

            if let d = data, !d.cohorts.isEmpty {
                Section {
                    ForEach(d.cohorts) { cohort in
                        NavigationLink(value: DieticianRoute.cohort(school: school, grade: grade, cohort: cohort)) {
                            row(cohort)
                        }
                    }
                } header: {
                    Text("\(d.total) children with check results, in \(d.cohorts.count) "
                         + (d.cohorts.count == 1 ? "group" : "groups") + ". Most urgent first.")
                        .textCase(nil)
                }
            } else {
                Group {
                    if data == nil || dietician.cohortsLoading {
                        if data == nil, dietician.cohortsError != nil, !dietician.cohortsLoading {
                            EmptyState(icon: "wifi.exclamationmark", title: "The groups could not be loaded")
                        } else {
                            EmptyState(icon: "hourglass", title: "Loading…", subtitle: "One moment.")
                        }
                    } else {
                        EmptyState(icon: "person.3", title: "No checks to plan from yet",
                                   subtitle: "Groups appear once a camp's doctors have recorded growth, "
                                       + "haemoglobin or teeth for these children.")
                    }
                }
                .listRowBackground(Color.clear)
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle("Plan by groups")
        .navigationBarTitleDisplayMode(.inline)
        .refreshable { await dietician.loadCohorts(school.id, grade: grade) }
        .task(id: grade) { await dietician.loadCohorts(school.id, grade: grade) }
    }

    private func row(_ cohort: DieticianCohort) -> some View {
        HStack(spacing: 12) {
            Image(systemName: "person.3.fill").foregroundColor(cohortColour(cohort))
            VStack(alignment: .leading, spacing: 3) {
                Text(cohort.label).font(.body.weight(.semibold))
                Text(cohortSummaryLine(cohort)).font(.caption).foregroundColor(.secondary)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 2) {
                Text("\(cohort.summary.count)").font(.title3.bold())
                Text("\(cohort.summary.withPlan) on a plan").font(.caption2).foregroundColor(.secondary)
            }
        }
        .padding(.vertical, 2)
    }
}

/// "ages 8–10 · 5 girls, 4 boys · 2 severe anaemia · 1 tooth decay".
func cohortSummaryLine(_ cohort: DieticianCohort) -> String {
    let s = cohort.summary
    var ages = ""
    if let youngest = s.ageMin {
        let oldest = s.ageMax.map { "\($0)" } ?? ""
        ages = youngest == s.ageMax ? "age \(youngest)" : "ages \(youngest)–\(oldest)"
    }
    return [
        ages,
        "\(s.girls) girls, \(s.boys) boys",
        s.severeAnaemia > 0 ? "\(s.severeAnaemia) severe anaemia" : "",
        s.toothDecay > 0 ? "\(s.toothDecay) tooth decay" : "",
    ].filter { !$0.isEmpty }.joined(separator: " · ")
}

private func cohortColour(_ cohort: DieticianCohort) -> Color {
    if cohort.key.hasPrefix("SEVERE") || cohort.summary.severeAnaemia > 0 { return Brand.red }
    if cohort.key.hasPrefix("NORMAL") && !cohort.key.contains("+") { return Brand.green }
    if cohort.key.hasPrefix("UNKNOWN") && !cohort.key.contains("+") { return Brand.blue }
    return Brand.amber
}

/// The plan for one group, and who it goes to.
///
/// Opens on the server's draft with every child ticked: the group is the
/// reason they are here. The dietician can ask the model for a better draft,
/// edit it, untick anyone it does not suit, and send it to the rest.
struct DieticianCohortView: View {
    let school: DieticianSchool
    let grade: String
    let cohort: DieticianCohort

    @EnvironmentObject private var dietician: DieticianStore

    @State private var title: String
    @State private var guidance: String
    @State private var targets: [DietTarget]
    @State private var source: String
    @State private var ticked: Set<String>
    @State private var busy = false
    @State private var drafting = false
    @State private var message = ""
    @State private var saved = 0

    init(school: DieticianSchool, grade: String, cohort: DieticianCohort) {
        self.school = school
        self.grade = grade
        self.cohort = cohort
        _title = State(initialValue: cohort.draft.title)
        _guidance = State(initialValue: cohort.draft.guidance)
        _targets = State(initialValue: cohort.draft.targets)
        _source = State(initialValue: cohort.draft.source)
        _ticked = State(initialValue: Set(cohort.children.map(\.kidId)))
    }

    /// The group as last read, so "has a plan" is right after a send.
    private var live: DieticianCohort {
        guard dietician.cohortsSchoolId == school.id,
              let fresh = dietician.cohorts?.cohorts.first(where: { $0.key == cohort.key }) else { return cohort }
        return fresh
    }

    private var allTicked: Bool { live.children.allSatisfy { ticked.contains($0.kidId) } }

    private var sendTitle: String {
        if busy { return "Saving…" }
        if ticked.isEmpty { return "Tick at least one child" }
        return ticked.count == 1 ? "Send to 1 family" : "Send to \(ticked.count) families"
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(live.label).font(.title2.bold())
                    Text([school.name, grade.isEmpty ? "All classes" : "Class \(grade)"].joined(separator: " · "))
                        .font(.subheadline).foregroundColor(.secondary)
                    Text(cohortSummaryLine(live)).font(.footnote).foregroundColor(.secondary)
                }
                if saved > 0 {
                    Banner(text: "Sent to \(saved == 1 ? "1 family" : "\(saved) families"). "
                           + "Each child's earlier plan was kept as history.", color: Brand.green)
                }
                if !message.isEmpty { Banner(text: message, color: Brand.red) }

                planCard
                childrenCard

                PrimaryButton(title: sendTitle, busy: busy,
                              enabled: !busy && !ticked.isEmpty
                                  && guidance.trimmingCharacters(in: .whitespacesAndNewlines).count >= 10) {
                    Task { await send() }
                }
                Text("Tap a name to open that child's record and write them a plan of their own.")
                    .font(.footnote).foregroundColor(.secondary)
            }
            .padding(16)
        }
        .background(Color(.systemGroupedBackground))
        .navigationTitle(live.label)
        .navigationBarTitleDisplayMode(.inline)
        .scrollDismissesKeyboard(.interactively)
    }

    // MARK: The plan

    private var planCard: some View {
        Card {
            HStack {
                Text("The plan").font(.headline)
                Spacer()
                Pill(text: source == "AI" ? "Drafted by AI" : "Starter draft",
                     color: source == "AI" ? Brand.orange : .secondary)
            }
            Text("A starting point. Change anything before you send it.")
                .font(.footnote).foregroundColor(.secondary)
            TextFieldRow(label: "Title", value: $title)
            DieticianTextArea(label: "What the family should do", text: $guidance, minHeight: 160)
            Text("Targets").font(.subheadline.weight(.semibold))
            ForEach(targets.indices, id: \.self) { i in
                HStack(alignment: .bottom, spacing: 6) {
                    TextFieldRow(label: "Such as", value: targetBinding(i, \.label))
                    TextFieldRow(label: "How much", value: targetBinding(i, \.value))
                    Button("Remove") { if i < targets.count { targets.remove(at: i) } }
                        .font(.footnote)
                        .buttonStyle(.borderless)
                        .frame(minHeight: 44)
                }
            }
            if targets.count < 8 {
                Button("Add a target") { targets.append(DietTarget(label: "", value: "")) }
                    .font(.footnote.weight(.semibold))
                    .buttonStyle(.borderless)
            }
            Button {
                Task { await askAi() }
            } label: {
                Label(drafting ? "Working…" : "Draft with AI", systemImage: "sparkles")
                    .font(.subheadline.weight(.semibold))
            }
            .buttonStyle(.borderless)
            .disabled(busy || drafting)
            Text("The AI is told the group's make-up — ages, how many girls and boys, what was found — and never a child's name.")
                .font(.footnote).foregroundColor(.secondary)
        }
    }

    /// A field of one target, safe against the row having just been removed.
    private func targetBinding(_ index: Int, _ field: WritableKeyPath<DietTarget, String>) -> Binding<String> {
        Binding(
            get: { index < targets.count ? targets[index][keyPath: field] : "" },
            set: { if index < targets.count { targets[index][keyPath: field] = $0 } }
        )
    }

    // MARK: Who it goes to

    private var childrenCard: some View {
        Card {
            HStack {
                Text("Children (\(ticked.count) of \(live.children.count) ticked)").font(.headline)
                Spacer()
                Button(allTicked ? "Untick all" : "Tick all") {
                    ticked = allTicked ? [] : Set(live.children.map(\.kidId))
                }
                .font(.footnote.weight(.semibold))
                .buttonStyle(.borderless)
            }
            ForEach(live.children) { child in
                HStack(spacing: 10) {
                    Button {
                        if ticked.contains(child.kidId) { ticked.remove(child.kidId) } else { ticked.insert(child.kidId) }
                    } label: {
                        Image(systemName: ticked.contains(child.kidId) ? "checkmark.square.fill" : "square")
                            .font(.title3)
                            .foregroundColor(ticked.contains(child.kidId) ? Brand.orange : .secondary)
                            .frame(minWidth: 32, minHeight: 44)
                    }
                    .buttonStyle(.borderless)
                    .accessibilityLabel(child.name)
                    .accessibilityAddTraits(ticked.contains(child.kidId) ? .isSelected : [])

                    NavigationLink(value: DieticianRoute.child(kidId: child.kidId)) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(child.name).font(.subheadline.weight(.semibold)).foregroundColor(.primary)
                            Text(childLine(child)).font(.caption).foregroundColor(.secondary)
                                .multilineTextAlignment(.leading)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private func childLine(_ child: CohortChild) -> String {
        let className = [child.grade, child.section].filter { !$0.isEmpty }.joined(separator: " ")
        let anaemia: String
        switch child.anaemia {
        case "SEVERE": anaemia = "severe anaemia"
        case "MILD": anaemia = "anaemia"
        default: anaemia = ""
        }
        return [
            dieticianChildLine(className: className, age: child.age),
            child.band,
            anaemia,
            child.toothDecay ? "tooth decay" : "",
            child.hasPlan ? "has a plan, will be replaced" : "",
        ].filter { !$0.isEmpty }.joined(separator: " · ")
    }

    // MARK: Network

    /// A new draft from the model replaces the text, which is still the
    /// dietician's to change before anything is sent.
    private func askAi() async {
        drafting = true
        defer { drafting = false }
        switch await dietician.cohortDraft(schoolId: school.id, key: cohort.key, grade: grade) {
        case .success(let draft):
            message = ""
            title = draft.title
            guidance = draft.guidance
            targets = draft.targets
            source = draft.source
        case .failure(let error):
            message = clinicianMessage(error, fallback: "No draft came back.")
        }
    }

    private func send() async {
        busy = true
        defer { busy = false }
        message = ""
        let kids = live.children.map(\.kidId).filter { ticked.contains($0) }
        let result = await dietician.saveCohortPlan(
            schoolId: school.id, grade: grade, kidIds: kids,
            title: title.trimmingCharacters(in: .whitespacesAndNewlines),
            focus: cohort.focus,
            guidance: guidance.trimmingCharacters(in: .whitespacesAndNewlines),
            targets: targets.filter { !$0.label.trimmingCharacters(in: .whitespaces).isEmpty })
        switch result {
        case .success(let n):
            saved = n
        case .failure(let error):
            message = clinicianMessage(error, fallback: "The plan was not saved.")
        }
    }
}
