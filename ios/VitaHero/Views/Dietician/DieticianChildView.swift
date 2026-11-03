import SwiftUI

/// One child, and the plan they are given.
///
/// Everything here is what the server was willing to send: growth and
/// haemoglobin from released camps, the last week of the food log by day, and
/// the plans written so far. The dental and eye findings never left the server.
///
/// The plan form opens pre-filled from the server's draft, so a dietician at
/// the end of a long day corrects a sentence rather than facing an empty box.
struct DieticianChildView: View {
    let kidId: String

    @EnvironmentObject private var dietician: DieticianStore

    @State private var record: DieticianChildRecord?
    @State private var loading = true
    @State private var loadError: String?
    @State private var message = ""
    @State private var busy = false

    @State private var writing = false
    @State private var title = ""
    @State private var focus = "GENERAL"
    @State private var guidance = ""
    @State private var targetLabel = ""
    @State private var targetValue = ""

    private var current: DieticianPlan? { record?.plans.first { $0.status == "ACTIVE" } }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                if let record {
                    content(record)
                } else if loading {
                    ProgressView().frame(maxWidth: .infinity).padding(.top, 40)
                } else {
                    EmptyState(icon: "wifi.exclamationmark",
                               title: loadError ?? "That record could not be opened. Check the connection and try again.")
                }
            }
            .padding(16)
        }
        .background(Color(.systemGroupedBackground))
        .navigationTitle(record?.child?.name ?? "")
        .navigationBarTitleDisplayMode(.inline)
        .scrollDismissesKeyboard(.interactively)
        .task { if record == nil { await load() } }
    }

    @ViewBuilder
    private func content(_ r: DieticianChildRecord) -> some View {
        if let child = r.child {
            VStack(alignment: .leading, spacing: 2) {
                Text(child.name).font(.vh(.title2, .bold))
                let className = [child.grade, child.section].filter { !$0.isEmpty }.joined(separator: " ")
                let line = [dieticianChildLine(className: className, age: child.age), child.schoolName]
                    .filter { !$0.isEmpty }.joined(separator: " · ")
                if !line.isEmpty { Text(line).font(.vh(.subheadline)).foregroundColor(.secondary) }
            }
        }
        if !message.isEmpty { Banner(text: message, color: Brand.red) }

        // What the camps found
        Group {
            Text("What the camps found").font(.vh(.headline))
            if r.findings.isEmpty {
                Text("Nobody has measured this child yet. Once a camp records height and weight, the child's growth shows here.")
                    .font(.vh(.footnote)).foregroundColor(.secondary)
            }
            ForEach(Array(r.findings.enumerated()), id: \.offset) { _, finding in findingCard(finding) }
        }

        // The food log
        Text("The last week of meals").font(.vh(.headline)).padding(.top, 6)
        if r.foodLog.isEmpty {
            Text("This family has not logged any meals yet.").font(.vh(.footnote)).foregroundColor(.secondary)
        } else {
            Card {
                ForEach(Array(r.foodLog.enumerated()), id: \.offset) { _, day in
                    HStack {
                        Text(day.day).font(.vh(.footnote))
                        Spacer()
                        Text("\(day.eaten) of \(day.items) logged").font(.vh(.footnote)).foregroundColor(.secondary)
                        Text("\(day.kcal) kcal").font(.vh(.footnote, .semibold)).foregroundColor(Brand.blue)
                            .padding(.leading, 8)
                    }
                }
            }
        }

        // The plan
        Text("The plan").font(.vh(.headline)).padding(.top, 6)
        if writing {
            editor
        } else if let current {
            currentCard(current)
        } else {
            Card {
                Text("No plan yet").font(.vh(.subheadline, .semibold))
                Text("What you write here is what the family reads in the app, against their own food log.")
                    .font(.vh(.footnote)).foregroundColor(.secondary)
                PrimaryButton(title: "Write a plan", enabled: !busy) { writing = true }
            }
        }

        // What came before
        let past = r.plans.filter { $0.status != "ACTIVE" }
        if !past.isEmpty {
            Text("Plans before this one").font(.vh(.headline)).padding(.top, 6)
            ForEach(Array(past.enumerated()), id: \.offset) { _, plan in
                Card {
                    Text(plan.title.isEmpty ? "Plan" : plan.title).font(.vh(.subheadline, .semibold))
                    let meta = [dietFocusLabel(plan.focus), plan.authorName].filter { !$0.isEmpty }
                        .joined(separator: " · ")
                    Text(meta).font(.vh(.caption)).foregroundColor(.secondary)
                    Text(plan.guidance).font(.vh(.footnote)).lineLimit(3)
                }
            }
        }
    }

    private func findingCard(_ finding: DieticianFinding) -> some View {
        let colour: Color = finding.flag == "ALERT" ? Brand.red : finding.flag == "WATCH" ? Brand.amber : Brand.green
        let text = [finding.valueText, finding.rationale].first { !$0.isEmpty } ?? ""
        return HStack(spacing: 12) {
            RoundedRectangle(cornerRadius: 2).fill(colour).frame(width: 4, height: 36)
            VStack(alignment: .leading, spacing: 2) {
                Text(finding.checkType).font(.vh(.subheadline, .semibold))
                if !text.isEmpty { Text(text).font(.vh(.footnote)).foregroundColor(.secondary) }
                if !finding.date.isEmpty {
                    Text([finding.campTitle, finding.date].filter { !$0.isEmpty }.joined(separator: " · "))
                        .font(.vh(.caption2)).foregroundColor(.secondary)
                }
            }
            Spacer(minLength: 0)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    private func currentCard(_ plan: DieticianPlan) -> some View {
        Card {
            Text(plan.title.isEmpty ? "Plan" : plan.title).font(.vh(.subheadline, .semibold))
            Text([dietFocusLabel(plan.focus), plan.authorName, plan.startsOn].filter { !$0.isEmpty }
                .joined(separator: " · "))
                .font(.vh(.caption)).foregroundColor(.secondary)
            Text(plan.guidance).font(.vh(.body))
            ForEach(Array(plan.targets.enumerated()), id: \.offset) { _, target in
                HStack {
                    Text(target.label).font(.vh(.footnote)).foregroundColor(.secondary)
                    Spacer()
                    Text(target.value).font(.vh(.footnote, .semibold))
                }
            }
            PrimaryButton(title: "Replace this plan", enabled: !busy) {
                title = plan.title
                focus = plan.focus
                guidance = plan.guidance
                writing = true
            }
            Text("The plan before it is kept, so the family can see what changed.")
                .font(.vh(.footnote)).foregroundColor(.secondary)
        }
    }

    private var editor: some View {
        Card {
            TextFieldRow(label: "Title", value: $title)
            Text("What this plan is for").font(.vh(.subheadline, .semibold))
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 6) {
                    ForEach(dietFocuses, id: \.self) { f in
                        DieticianChip(title: dietFocusLabel(f), selected: focus == f) { focus = f }
                    }
                }
            }
            DieticianTextArea(label: "What the family should do", text: $guidance)
            Text("One thing to aim for (optional)").font(.vh(.subheadline, .semibold))
            HStack(spacing: 8) {
                TextFieldRow(label: "Such as", value: $targetLabel)
                TextFieldRow(label: "How much", value: $targetValue)
            }
            PrimaryButton(title: busy ? "Saving…" : "Send this plan to the family", busy: busy,
                          enabled: !busy && guidance.trimmingCharacters(in: .whitespacesAndNewlines).count >= 10) {
                Task { await save() }
            }
            Text("A plan needs a sentence the family can act on.")
                .font(.vh(.footnote)).foregroundColor(.secondary)
        }
    }

    // MARK: Network

    private func load() async {
        loading = true
        defer { loading = false }
        do {
            let fetched = try await APIClient.shared.dieticianChild(kidId)
            record = fetched
            loadError = nil
            // A fresh record starts the form from the server's draft.
            if !writing {
                title = fetched.draft.title
                focus = fetched.draft.focus
                guidance = fetched.draft.guidance
            }
        } catch is CancellationError {
        } catch {
            loadError = clinicianMessage(error,
                fallback: "That record could not be opened. Check the connection and try again.")
        }
    }

    private func save() async {
        busy = true
        defer { busy = false }
        let label = targetLabel.trimmingCharacters(in: .whitespaces)
        let targets = label.isEmpty ? [] : [DietTarget(label: targetLabel, value: targetValue)]
        let result = await dietician.savePlan(kidId: kidId, title: title, focus: focus,
                                              guidance: guidance, targets: targets)
        switch result {
        case .success:
            message = ""
            writing = false
            // Re-read rather than patching: saving ends whatever plan was
            // running, and the list of past plans is the server's to state.
            await load()
        case .failure(let error):
            message = clinicianMessage(error, fallback: "The plan was not saved.")
        }
    }
}
