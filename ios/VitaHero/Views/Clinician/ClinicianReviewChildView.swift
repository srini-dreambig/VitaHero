import SwiftUI

/// A physician signs off one child: confirm or move each flag, set how soon
/// the guardian should act, and write what they will read. Approving sends
/// nothing; the camp's release does.
struct ClinicianReviewChildView: View {
    let campId: String
    let kidId: String

    @EnvironmentObject private var clinician: ClinicianStore
    @Environment(\.dismiss) private var dismiss

    @State private var detail: ReviewDetail?
    @State private var loading = true
    @State private var loadError: String?
    /// Only the flags the physician changed, as Android sends them.
    @State private var moved: [String: String] = [:]
    @State private var urgency = "NONE"
    @State private var recommendation = ""
    @State private var message = ""
    @State private var busy = false

    private static let flags: [(value: String, key: String)] = [
        ("GOOD", "clin_review_normal"), ("WATCH", "clin_review_watch"), ("ALERT", "clin_review_alert"),
    ]
    private static let urgencies: [(value: String, key: String)] = [
        ("NONE", "clin_urgency_none"), ("ROUTINE", "clin_urgency_routine"),
        ("SOON", "clin_urgency_soon"), ("URGENT", "clin_urgency_urgent"),
    ]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                if let detail {
                    content(detail)
                } else if loading {
                    ProgressView().frame(maxWidth: .infinity).padding(.top, 40)
                } else {
                    EmptyState(icon: "wifi.exclamationmark", title: loadError ?? L("clin_err_record"))
                }
            }
            .padding(16)
        }
        .background(Color(.systemGroupedBackground))
        .navigationTitle(detail?.child?.name ?? "")
        .navigationBarTitleDisplayMode(.inline)
        .scrollDismissesKeyboard(.interactively)
        .task { await load() }
    }

    @ViewBuilder
    private func content(_ detail: ReviewDetail) -> some View {
        if let child = detail.child {
            VStack(alignment: .leading, spacing: 2) {
                Text(child.name).font(.title2.bold())
                let parts = [child.grade, child.age.map { L("clin_years", String($0)) } ?? "", child.guardianName]
                Text(parts.filter { !$0.isEmpty }.joined(separator: " · "))
                    .font(.subheadline).foregroundColor(.secondary)
            }
        }
        if detail.status == "APPROVED" {
            Banner(text: L("clin_already_approved"), color: Brand.blue)
        }
        if !detail.recurring.isEmpty {
            Banner(text: recurringNotice(detail.recurring), color: Brand.orange)
        }
        if !message.isEmpty { Banner(text: message, color: Brand.red) }

        ForEach(detail.findings) { finding in findingCard(finding) }

        urgencyCard
        messageCard(detail)

        PrimaryButton(title: busy ? L("clin_approving") : L("clin_approve"), busy: busy,
                      enabled: !busy && !RequiredChecks.isBlank(recommendation)) {
            Task { await approve() }
        }
        Text(L("clin_approve_footer")).font(.footnote).foregroundColor(.secondary)
    }

    private func recurringNotice(_ recurring: [Recurring]) -> String {
        recurring.map { L("clin_recurring_one", $0.checkType, String($0.timesBefore)) }
            .joined(separator: "; ") + ". " + L("clin_recurring_raised")
    }

    // MARK: Findings

    private func findingCard(_ finding: ReviewFinding) -> some View {
        let chosen = moved[finding.checkType] ?? finding.flag
        return Card {
            Text(finding.checkType).font(.headline)
            let measured = finding.detail
                .filter { $0.key != "__note" }
                .map { "\(Self.detailLabel($0.key)): \(Self.detailValue($0))" }
                .joined(separator: " · ")
            if !measured.isEmpty {
                Text(measured).font(.footnote).foregroundColor(.secondary)
            }
            if !finding.rationale.isEmpty {
                Text(finding.rationale).font(.footnote).foregroundColor(.secondary)
            }
            if !finding.screenerNote.isEmpty {
                Text(L("clin_screener_note", finding.screenerNote)).font(.footnote).foregroundColor(.secondary)
            }
            if !finding.previous.isEmpty {
                Text(L("clin_flagged_before", finding.previous.map { "\($0.flag) \($0.date)" }.joined(separator: ", ")))
                    .font(.footnote).foregroundColor(Brand.orange)
            }
            Picker(finding.checkType, selection: Binding(
                get: { chosen },
                set: { flag in
                    if flag == finding.flag { moved[finding.checkType] = nil } else { moved[finding.checkType] = flag }
                }
            )) {
                ForEach(Self.flags, id: \.value) { Text(L($0.key)).tag($0.value) }
            }
            .pickerStyle(.segmented)
            if chosen != finding.autoFlag, finding.autoFlag != "NOT_MEASURED" {
                Text(L("clin_rules_said", flagName(finding.autoFlag).lowercased()))
                    .font(.footnote).foregroundColor(.secondary)
            }
        }
    }

    private func flagName(_ flag: String) -> String {
        Self.flags.first { $0.value == flag }.map { L($0.key) } ?? flag
    }

    /// The Android labels for detail keys, so both apps read the same.
    static func detailLabel(_ key: String) -> String {
        switch key {
        case "heightCm": return "height"
        case "weightKg": return "weight"
        case "leftAcuity": return "left eye"
        case "rightAcuity": return "right eye"
        case "leftHearing": return "left ear"
        case "rightHearing": return "right ear"
        case "cariesCount": return "caries"
        case "missingCount": return "missing"
        case "filledCount": return "filled"
        case "stainsTartar": return "stains/tartar"
        case "skinCondition": return "condition"
        case "skinLocation": return "location"
        case "gaitLimb": return "gait/limb"
        case "jointPain": return "joint pain"
        case "restrictedMotion": return "restricted motion"
        case "vaccineStatus": return "vaccine status"
        case "missedVaccines": return "missed vaccines"
        case "entTreatment", "skinTreatment", "spineTreatment", "vaccineTreatment", "hbTreatment",
             "treatmentNeeded", "treatmentsRecommended":
            return "rec"
        default:
            var out = ""
            var previous: Character?
            for ch in key {
                if let p = previous, p.isLowercase, ch.isUppercase { out.append(" ") }
                out.append(ch)
                previous = ch
            }
            return out.lowercased()
        }
    }

    /// Weight to one decimal, as the guardian's app shows it; the rest as sent.
    static func detailValue(_ entry: DetailEntry) -> String {
        if entry.key == "weightKg", let kg = entry.value.number {
            return String(format: "%.1f", kg)
        }
        return entry.value.text
    }

    // MARK: Urgency and message

    private var urgencyCard: some View {
        Card {
            Text(L("clin_how_soon")).font(.headline)
            Picker(L("clin_how_soon"), selection: $urgency) {
                ForEach(Self.urgencies, id: \.value) { Text(L($0.key)).tag($0.value) }
            }
            .pickerStyle(.segmented)
            if urgency == "URGENT" {
                Text(L("clin_urgent_note")).font(.footnote).foregroundColor(Brand.red)
            }
        }
    }

    private func messageCard(_ detail: ReviewDetail) -> some View {
        Card {
            Text(L("clin_guardian_reads")).font(.headline)
            if detail.recommendationIsDraft {
                Text(L("clin_draft_note")).font(.footnote).foregroundColor(.secondary)
            }
            TextEditor(text: $recommendation)
                .frame(minHeight: 140)
                .padding(6)
                .background(Color(.tertiarySystemGroupedBackground))
                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            if RequiredChecks.isBlank(recommendation) {
                Text(L("clin_write_first")).font(.footnote).foregroundColor(Brand.red)
            }
        }
    }

    // MARK: Network

    private func load() async {
        // Once open, coming back from a sheet must not wipe what was entered.
        guard detail == nil else { return }
        loading = true
        defer { loading = false }
        do {
            let fetched = try await APIClient.shared.reviewDetail(campId: campId, kidId: kidId)
            detail = fetched
            urgency = fetched.suggestedUrgency
            recommendation = fetched.recommendation
            moved = [:]
            loadError = nil
        } catch is CancellationError {
        } catch {
            loadError = clinicianMessage(error, fallback: L("clin_err_record"))
        }
    }

    private func approve() async {
        let text = recommendation.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else {
            message = L("clin_write_first")
            return
        }
        busy = true
        defer { busy = false }
        do {
            try await APIClient.shared.approve(campId: campId, kidId: kidId, flags: moved,
                                               urgency: urgency, recommendation: text)
            message = ""
            clinician.noteApproved(kidId: kidId, urgency: urgency)
            dismiss()
        } catch {
            message = clinicianMessage(error, fallback: L("clin_err_approve"))
        }
    }
}
