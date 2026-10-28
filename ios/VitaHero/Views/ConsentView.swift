import SwiftUI

/// Camps waiting on the parent's yes or no.
struct ConsentListView: View {
    @EnvironmentObject private var store: AppStore

    var body: some View {
        List {
            if store.consents.isEmpty {
                EmptyState(icon: "checkmark.shield", title: L("no_consent_pending"), subtitle: L("no_consent_pending_sub"))
            }
            ForEach(store.consents) { consent in
                NavigationLink { ConsentView(consent: consent) } label: {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(consent.title).font(.headline)
                        Text("\(consent.kidName) · \(consent.date)").font(.subheadline).foregroundColor(.secondary)
                        if !consent.deadline.isEmpty {
                            Text(L("consent_deadline_msg", consent.deadline)).font(.caption).foregroundColor(Brand.orange)
                        }
                    }
                }
            }
        }
        .navigationTitle(L("camp_consent_title"))
    }
}

/// One camp's request: which checks, photographs, and the answer.
struct ConsentView: View {
    let consent: PendingConsent
    @EnvironmentObject private var store: AppStore
    @Environment(\.dismiss) private var dismiss
    @State private var checks: Set<String> = []
    @State private var photos = false
    @State private var busy = false

    var body: some View {
        List {
            Section {
                VStack(alignment: .leading, spacing: 6) {
                    Text(consent.title).font(.title3.bold())
                    Text(L("camp_consent_sub")).foregroundColor(.secondary)
                }
                Label(consent.kidName, systemImage: "person.fill")
                if !consent.schoolName.isEmpty { Label(consent.schoolName, systemImage: "building.columns") }
                Label([consent.date, consent.time].filter { !$0.isEmpty }.joined(separator: " · "), systemImage: "calendar")
                if !consent.venue.isEmpty { Label(consent.venue, systemImage: "mappin.and.ellipse") }
                if !consent.deadline.isEmpty {
                    Text(L("consent_deadline_msg", consent.deadline)).font(.subheadline).foregroundColor(Brand.orange)
                }
            }

            if !consent.checks.isEmpty {
                Section(header: Text(L("consent_checks_title")), footer: Text(L("consent_checks_hint"))) {
                    ForEach(consent.checks, id: \.self) { check in
                        Toggle(check, isOn: Binding(
                            get: { checks.contains(check) },
                            set: { on in if on { checks.insert(check) } else { checks.remove(check) } }))
                    }
                }
            }

            if consent.photosAsked {
                Section(header: Text(L("photo_consent_title")), footer: Text(L("photo_consent_body"))) {
                    Toggle(L("photo_consent_agree"), isOn: $photos)
                }
            }

            Section {
                PrimaryButton(title: L("consent_grant"), busy: busy,
                              enabled: consent.checks.isEmpty || !checks.isEmpty) { answer(true) }
                    .listRowInsets(EdgeInsets())
                Button(L("camp_consent_decline"), role: .destructive) { answer(false) }
                    .disabled(busy)
                    .frame(maxWidth: .infinity)
            }
            .listRowBackground(Color.clear)
        }
        .navigationTitle(L("camp_consent_title"))
        .navigationBarTitleDisplayMode(.inline)
        .onAppear { if checks.isEmpty { checks = Set(consent.checks) } }
    }

    private func answer(_ granted: Bool) {
        busy = true
        Task {
            let ok = await store.answerConsent(consent, granted: granted,
                                               checks: consent.checks.filter(checks.contains), photos: photos)
            busy = false
            if ok { dismiss() }
        }
    }
}
