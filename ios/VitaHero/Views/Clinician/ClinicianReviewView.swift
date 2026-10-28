import SwiftUI

/// A physician's queue for one camp: who is waiting, who is approved, and the
/// one release that sends every approved child's results at once.
struct ClinicianReviewView: View {
    let camp: ClinicianCamp

    @EnvironmentObject private var clinician: ClinicianStore
    @Environment(\.dismiss) private var dismiss

    @State private var confirmRelease = false
    @State private var releasing = false
    @State private var releaseError: String?
    @State private var released: ReleaseResult?

    /// Everyone not yet approved, ready or not; the footer counts them all.
    private var waiting: [ReviewQueueItem] { clinician.queue.filter { $0.status != "APPROVED" } }
    /// Every check recorded, so this physician can sign off.
    private var ready: [ReviewQueueItem] { waiting.filter { $0.waitingFor.isEmpty } }
    /// Another doctor still has a check to record.
    private var screening: [ReviewQueueItem] { waiting.filter { !$0.waitingFor.isEmpty } }
    private var approved: [ReviewQueueItem] { clinician.queue.filter { $0.status == "APPROVED" } }

    var body: some View {
        List {
            if let error = releaseError ?? clinician.queueError {
                Banner(text: error, color: Brand.red).listRowBackground(Color.clear)
            }
            if clinician.queue.isEmpty {
                Group {
                    if clinician.queueLoading {
                        EmptyState(icon: "hourglass", title: L("clin_loading_list"), subtitle: L("clin_one_moment"))
                    } else {
                        EmptyState(icon: "checkmark.seal", title: L("clin_nothing_review"), subtitle: L("clin_nothing_review_sub"))
                    }
                }
                .listRowBackground(Color.clear)
            } else {
                if !ready.isEmpty {
                    Section(L("clin_waiting_on_you", String(ready.count))) {
                        ForEach(ready) { row($0) }
                    }
                }
                if !screening.isEmpty {
                    Section(L("clin_still_screening", String(screening.count))) {
                        ForEach(screening) { row($0) }
                    }
                }
                if !approved.isEmpty {
                    Section(L("clin_approved_not_sent", String(approved.count))) {
                        ForEach(approved) { row($0) }
                    }
                }
                Section {
                    PrimaryButton(title: releasing ? L("clin_sending") : L("clin_send_results"),
                                  busy: releasing, enabled: !approved.isEmpty && !releasing) {
                        confirmRelease = true
                    }
                    .listRowInsets(EdgeInsets())
                    .listRowBackground(Color.clear)
                } footer: {
                    Text(waiting.isEmpty ? L("clin_all_reviewed")
                         : waiting.count == 1 ? L("clin_still_waiting_one")
                         : L("clin_still_waiting_many", String(waiting.count)))
                }
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle(L("clin_review_title"))
        .navigationBarTitleDisplayMode(.inline)
        .refreshable { await clinician.loadQueue(camp.id) }
        .task { await clinician.loadQueue(camp.id) }
        .alert(L("clin_release_title"), isPresented: $confirmRelease) {
            Button(L("clin_release_send")) { Task { await release() } }
            Button(L("clin_release_not_yet"), role: .cancel) {}
        } message: {
            Text(releaseBody)
        }
        .alert(L("clin_released_title"), isPresented: Binding(
            get: { released != nil },
            set: { if !$0 { released = nil } }
        )) {
            Button(L("done")) { released = nil; dismiss() }
        } message: {
            Text(releasedBody)
        }
    }

    private func row(_ item: ReviewQueueItem) -> some View {
        NavigationLink(value: ClinicianRoute.reviewChild(campId: camp.id, kidId: item.kidId)) {
            HStack(spacing: 10) {
                VStack(alignment: .leading, spacing: 3) {
                    Text(item.name).font(.body.weight(.semibold))
                    let sub = [item.grade, item.age.map { L("clin_years", String($0)) } ?? ""]
                        .filter { !$0.isEmpty }.joined(separator: " · ")
                    if !sub.isEmpty { Text(sub).font(.caption).foregroundColor(.secondary) }
                    if !item.waitingFor.isEmpty, item.status != "APPROVED" {
                        Text(L("clin_waiting_for", item.waitingFor.joined(separator: ", ")))
                            .font(.caption).foregroundColor(Brand.orange)
                    }
                }
                Spacer()
                if item.alerts > 0 { Pill(text: L("clin_n_alert", String(item.alerts)), color: Brand.red) }
                if item.watches > 0 { Pill(text: L("clin_n_watch", String(item.watches)), color: Brand.orange) }
                if item.status == "APPROVED" {
                    Image(systemName: "checkmark.circle.fill").foregroundColor(Brand.green)
                }
            }
            .padding(.vertical, 2)
        }
    }

    private var releaseBody: String {
        var text = approved.count == 1 ? L("clin_release_body_one")
            : L("clin_release_body_many", String(approved.count))
        if !waiting.isEmpty { text += " " + L("clin_release_body_waiting", String(waiting.count)) }
        return text
    }

    private var releasedBody: String {
        guard let released else { return "" }
        var parts = [released.released == 1 ? L("clin_released_one")
            : L("clin_released_many", String(released.released))]
        parts.append(L("clin_referrals_opened", String(released.referralsOpened)))
        if released.urgentNotified > 0 {
            parts.append(L("clin_urgent_texted", String(released.urgentNotified)))
        }
        return parts.joined(separator: " ")
    }

    private func release() async {
        releasing = true
        defer { releasing = false }
        switch await clinician.release(camp.id) {
        case .success(let result):
            releaseError = nil
            released = result
        case .failure(let error):
            releaseError = clinicianMessage(error, fallback: L("clin_err_release"))
        }
    }
}
