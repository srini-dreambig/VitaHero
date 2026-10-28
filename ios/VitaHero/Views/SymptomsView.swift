import SwiftUI

/// Illnesses the parent records for a child, for the doctor at the next camp.
struct SymptomsView: View {
    var kidId: String? = nil
    @EnvironmentObject private var store: AppStore
    @State private var data: SymptomsResponse?
    @State private var error: String?
    @State private var adding = false
    @State private var advice: String?

    private var kid: Kid? {
        if let kidId { return store.allKids.first { $0.id == kidId } }
        return store.selectedKid
    }

    var body: some View {
        List {
            if kidId == nil { KidPicker().listRowBackground(Color.clear).listRowInsets(EdgeInsets()) }
            if let error { Banner(text: error).listRowInsets(EdgeInsets()) }
            if let advice, !advice.isEmpty {
                Section {
                    Banner(text: advice, color: Brand.red)
                    Button(L("ok")) { self.advice = nil }
                }
            }
            if let kid {
                Section {
                    Text(L("symptoms_sub", kid.name)).foregroundColor(.secondary)
                    Button { adding = true } label: { Label(L("log_symptom"), systemImage: "plus.circle.fill") }
                }
                Section(header: Text(L("past_illnesses")), footer: Text(L("past_illnesses_sub"))) {
                    let events = data?.events ?? []
                    if events.isEmpty && data != nil {
                        Text(L("no_symptoms_yet")).foregroundColor(.secondary)
                    }
                    ForEach(events) { event in SymptomRow(event: event) }
                        .onDelete { offsets in delete(offsets.map { events[$0] }) }
                }
                Section {
                    Text(data?.notice.isEmpty == false ? data!.notice : L("symptoms_notice_fallback"))
                        .font(.caption).foregroundColor(.secondary)
                }
            } else {
                EmptyState(icon: "person.2", title: L("no_kids_yet"), subtitle: L("no_kids_sub"))
            }
        }
        .navigationTitle(L("symptoms_title"))
        .task(id: kid?.id) { await load() }
        .refreshable { await load() }
        .sheet(isPresented: $adding) {
            if let kid, let data {
                NavigationStack {
                    SymptomForm(kid: kid, symptoms: data.symptoms, severities: data.severities) { saved in
                        advice = saved.advice.isEmpty ? nil : saved.advice
                        if saved.advice.isEmpty { store.toast = L("symptom_saved") }
                        Task { await load() }
                    }
                }
            }
        }
    }

    private func load() async {
        guard let kid else { return }
        do {
            data = try await store.symptoms(kidId: kid.id)
            error = nil
        } catch {
            self.error = error.localizedDescription
        }
    }

    private func delete(_ events: [SymptomEvent]) {
        Task {
            for event in events {
                do { try await store.deleteSymptom(id: event.id) } catch { store.toast = error.localizedDescription }
            }
            await load()
        }
    }
}

struct SymptomRow: View {
    let event: SymptomEvent

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(event.symptom).font(.headline)
                Spacer()
                Pill(text: SymptomForm.severityLabel(event.severity),
                     color: event.severity.uppercased() == "MODERATE" ? Brand.amber : Brand.blue)
            }
            Text(event.endedOn.isEmpty ? "\(event.startedOn) · \(L("still_unwell"))" : "\(event.startedOn) – \(event.endedOn)")
                .font(.caption).foregroundColor(.secondary)
            HStack(spacing: 8) {
                if event.sawDoctor { Pill(text: L("saw_a_doctor"), color: Brand.green) }
                if event.missedSchool { Pill(text: L("missed_school"), color: Brand.purple) }
            }
            if !event.note.isEmpty { Text(event.note).font(.subheadline) }
        }
        .padding(.vertical, 2)
    }
}

struct SymptomForm: View {
    let kid: Kid
    let symptoms: [String]
    let severities: [String]
    let onSaved: (SymptomSaved) -> Void

    @EnvironmentObject private var store: AppStore
    @Environment(\.dismiss) private var dismiss
    @State private var symptom = ""
    @State private var severity = "MILD"
    @State private var started = Date()
    @State private var stillUnwell = true
    @State private var ended = Date()
    @State private var note = ""
    @State private var sawDoctor = false
    @State private var missedSchool = false
    @State private var busy = false
    @State private var error: String?

    static func severityLabel(_ value: String) -> String {
        switch value.uppercased() {
        case "MILD": return L("severity_mild")
        case "MODERATE": return L("severity_moderate")
        default: return value.capitalized
        }
    }

    var body: some View {
        Form {
            if let error { Banner(text: error, color: Brand.red) }
            Section(L("what_happened")) {
                Picker(L("what_happened"), selection: $symptom) {
                    ForEach(symptoms, id: \.self) { Text($0).tag($0) }
                }
                .pickerStyle(.menu)
            }
            Section(L("how_bad")) {
                Picker(L("how_bad"), selection: $severity) {
                    ForEach(severities.isEmpty ? ["MILD", "MODERATE"] : severities, id: \.self) {
                        Text(SymptomForm.severityLabel($0)).tag($0)
                    }
                }
                .pickerStyle(.segmented)
            }
            Section(L("when_started")) {
                DatePicker(L("when_started"), selection: $started, in: ...Date(), displayedComponents: .date)
                Toggle(L("still_unwell"), isOn: $stillUnwell)
                if !stillUnwell {
                    DatePicker(L("ended_on"), selection: $ended, in: started...Date(), displayedComponents: .date)
                }
            }
            Section {
                Toggle(L("saw_a_doctor"), isOn: $sawDoctor)
                Toggle(L("missed_school"), isOn: $missedSchool)
                TextField(L("symptom_note_hint"), text: $note, axis: .vertical).lineLimit(2...5)
            }
            Section { Text(L("symptom_not_a_diagnosis")).font(.caption).foregroundColor(.secondary) }
        }
        .navigationTitle(L("log_symptom"))
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) { Button(L("cancel")) { dismiss() } }
            ToolbarItem(placement: .confirmationAction) {
                if busy { ProgressView() } else {
                    Button(L("save")) { save() }.disabled(symptom.isEmpty)
                }
            }
        }
        .onAppear {
            if symptom.isEmpty { symptom = symptoms.first ?? "" }
            if let first = severities.first, !severities.contains(severity) { severity = first }
        }
    }

    private func save() {
        busy = true; error = nil
        var body: [String: Any] = [
            "kidId": kid.id, "symptom": symptom, "severity": severity,
            "startedOn": Self.iso(started), "note": note,
            "sawDoctor": sawDoctor, "missedSchool": missedSchool,
        ]
        if !stillUnwell { body["endedOn"] = Self.iso(max(ended, started)) }
        Task {
            do {
                let saved = try await store.saveSymptom(body)
                onSaved(saved)
                dismiss()
            } catch {
                self.error = (error as? APIError).map { $0.localizedDescription } ?? L("symptom_failed")
            }
            busy = false
        }
    }

    private static func iso(_ date: Date) -> String {
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .gregorian)
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd"
        return f.string(from: date)
    }
}
