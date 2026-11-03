import SwiftUI

/// One child's screening, narrowed by the server to this clinician's specialty
/// and the guardian's consent. The form renders the `checks` it was given and
/// nothing else; the server refuses anything outside them.
struct ClinicianScreeningView: View {
    let campId: String
    let kidId: String

    @EnvironmentObject private var clinician: ClinicianStore
    @Environment(\.dismiss) private var dismiss

    @State private var form: ScreeningForm?
    @State private var loading = true
    @State private var loadError: String?
    /// check -> key -> value, as typed. Kept per check so a check marked could
    /// not be done keeps nothing but its reason.
    @State private var values: [String: [String: String]] = [:]
    @State private var gapMessage = ""
    @State private var message = ""
    @State private var busy = false

    private typealias O = ScreeningOptions

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                header
                if let form {
                    content(form)
                } else if loading {
                    ProgressView().frame(maxWidth: .infinity).padding(.top, 40)
                } else {
                    EmptyState(icon: "wifi.exclamationmark", title: loadError ?? L("clin_err_form"))
                }
            }
            .padding(16)
        }
        .background(Color(.systemGroupedBackground))
        .navigationTitle(form?.child?.name ?? "")
        .navigationBarTitleDisplayMode(.inline)
        .scrollDismissesKeyboard(.interactively)
        .task { await load() }
    }

    // MARK: Header and notices

    @ViewBuilder
    private var header: some View {
        if let child = form?.child {
            VStack(alignment: .leading, spacing: 2) {
                Text(child.name).font(.vh(.title2, .bold))
                let gradeSection = [child.grade, child.section].filter { !$0.isEmpty }.joined(separator: " ")
                let parts = [gradeSection, child.gender, child.age.map { L("clin_years", String($0)) } ?? ""]
                Text(parts.filter { !$0.isEmpty }.joined(separator: " · "))
                    .font(.vh(.subheadline)).foregroundColor(.secondary)
            }
        }
    }

    @ViewBuilder
    private func content(_ form: ScreeningForm) -> some View {
        if form.consentStatus != "GRANTED" && form.consentStatus != "PAPER" {
            Banner(text: form.consentStatus == "DECLINED" ? L("clin_consent_declined") : L("clin_consent_none"),
                   color: Brand.red)
        } else {
            notices(form)
            if let history = form.illnessHistory, !history.events.isEmpty {
                illnessCard(history)
            }
            if form.attendance == "ABSENT" {
                absentBlock(form)
            } else {
                ForEach(form.checks, id: \.self) { check in checkCard(check, form) }
                Button(L("clin_child_absent")) { Task { await setAttendance("ABSENT") } }
                    .disabled(busy)
                saveBlock(form)
            }
        }
    }

    @ViewBuilder
    private func notices(_ form: ScreeningForm) -> some View {
        if !form.specialty.isEmpty {
            Banner(text: specialtyNotice(form), color: Brand.blue)
        }
        if !form.excludedByConsent.isEmpty {
            Banner(text: L("clin_consent_excludes", form.excludedByConsent.joined(separator: ", ")), color: Brand.blue)
        }
        if !message.isEmpty { Banner(text: message, color: Brand.red) }
        if !gapMessage.isEmpty { Banner(text: gapMessage, color: Brand.red) }
        Text(L("clin_required_intro")).font(.vh(.footnote)).foregroundColor(.secondary)
    }

    /// "Dental: Dental. Vision is another clinician's at this camp."
    private func specialtyNotice(_ form: ScreeningForm) -> String {
        let joined = form.checks.joined(separator: ", ")
        var text = form.specialty + ": " + (joined.isEmpty ? L("clin_nothing_here") : joined)
        if !form.otherSpecialties.isEmpty {
            let others = form.otherSpecialties.joined(separator: ", ")
            text += ". " + (form.otherSpecialties.count == 1 ? L("clin_other_one", others) : L("clin_other_many", others))
        }
        return text
    }

    private func illnessCard(_ history: IllnessHistory) -> some View {
        Card {
            Text(L("clin_illness_title")).font(.vh(.headline))
            if !history.caution.isEmpty { Text(history.caution).font(.vh(.footnote)) }
            ForEach(history.events.prefix(10)) { e in
                let dates = e.endedOn.isEmpty ? e.startedOn : L("clin_date_range", e.startedOn, e.endedOn)
                let extras = [e.severity.lowercased(),
                              e.sawDoctor ? L("clin_saw_doctor") : "",
                              e.missedSchool ? L("clin_missed_school") : ""]
                    .filter { !$0.isEmpty }.joined(separator: ", ")
                let note = e.note.isEmpty ? "" : " — " + e.note
                Text("\(dates): \(e.symptom) (\(extras))\(note)").font(.vh(.subheadline))
            }
            if history.events.count > 10 {
                Text(L("clin_and_earlier", String(history.events.count - 10))).font(.vh(.footnote))
            }
        }
    }

    private func absentBlock(_ form: ScreeningForm) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Banner(text: L("clin_absent_notice", form.child?.name ?? ""), color: Brand.blue)
            Button(L("clin_mark_present_instead")) { Task { await setAttendance("PRESENT") } }
                .disabled(busy)
            if !message.isEmpty { Banner(text: message, color: Brand.red) }
            PrimaryButton(title: L("clin_confirm_absent"), busy: busy, enabled: !busy) {
                // Nothing to record for an absent child: the attendance is the record.
                clinician.noteSaved(kidId: kidId, absentOnly: true)
                dismiss()
            }
        }
    }

    // MARK: One check

    private func checkCard(_ check: String, _ form: ScreeningForm) -> some View {
        Card {
            Text(check).font(.vh(.headline))
            if let existing = form.findings.first(where: { $0.checkType == check && $0.flag != "NOT_MEASURED" }) {
                let reason = existing.rationale.isEmpty ? "" : " — " + existing.rationale
                Text(L("clin_recorded", flagWord(existing.flag)) + reason)
                    .font(.vh(.footnote)).foregroundColor(flagColor(existing.flag))
            }
            ToggleRow(label: L("clin_not_done"), value: field(check, RequiredChecks.notDone))
            if isNotDone(check) {
                TextFieldRow(label: L("clin_not_done_why"), value: field(check, RequiredChecks.notDoneReason),
                             placeholder: L("clin_not_done_hint"))
                // What was seen still counts: the server keeps a WATCH or
                // ALERT it raises, so the fields stay, none of them required.
                Text(L("clin_not_done_seen")).font(.vh(.footnote)).foregroundColor(.secondary)
            }
            checkFields(check)
        }
    }

    @ViewBuilder
    private func checkFields(_ check: String) -> some View {
        switch check {
        case "Height & weight": heightWeight(check)
        case "Vision": vision(check)
        case "Dental": dental(check)
        case "ENT": ent(check)
        case "Skin": skin(check)
        case "Spine": spine(check)
        case "Immunisation review": immunisation(check)
        case "Haemoglobin": haemoglobin(check)
        default:
            Text(L("clin_no_form")).font(.vh(.footnote)).foregroundColor(.secondary)
        }
    }

    // Physical growth assessment: height, weight, BMI for age and the
    // nutritional status. Left blank, the status is the WHO reading the
    // server makes from the same numbers when the record is saved.
    private func heightWeight(_ c: String) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            pair(number("Height (cm) *", c, "heightCm"), number("Weight (kg) *", c, "weightKg"))
            // BMI for age, live as the numbers are typed, with the WHO status.
            if let child = form?.child {
                if let who = WhoBmi.forChild(
                    heightCm: Double(values[c]?["heightCm"] ?? "") ?? 0,
                    weightKg: Double(values[c]?["weightKg"] ?? "") ?? 0,
                    gender: child.gender, dob: child.dob, ageYears: child.age) {
                    GrowthChartsPanel(reading: who, bmiOnly: true)
                } else if child.age == nil && child.dob.isEmpty {
                    Text("No age or date of birth on record, so BMI for age cannot be read.")
                        .font(.vh(.footnote)).foregroundColor(.secondary)
                }
            }
            choice("Nutritional status (blank = WHO reading)", O.NUTRITIONAL_STATUS, c, "nutritionalStatus")
        }
    }

    private func vision(_ c: String) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Group {
                FormSectionHeader(title: "Visual acuity", subtitle: "Distance (Snellen), each eye")
                pair(choice("Right eye (OD) *", O.ACUITY, c, "rightAcuity"),
                     choice("Left eye (OS) *", O.ACUITY, c, "leftAcuity"))
                pair(choice("Near, right (OD)", O.NEAR_VISION, c, "rightNearVision"),
                     choice("Near, left (OS)", O.NEAR_VISION, c, "leftNearVision"))
                choice("Testing condition", O.VISION_TEST_CONDITION, c, "testingCondition")
            }
            Group {
                FormSectionHeader(title: "Present glasses prescription",
                                  subtitle: "Only if the child already wears glasses")
                HStack(spacing: 6) {
                    text("OD Sph", c, "presentOdSph", "-1.50"); text("OD Cyl", c, "presentOdCyl", "-0.50")
                    text("OD Axi", c, "presentOdAxi", "180"); text("OD CVA", c, "presentOdCva", "6/6")
                }
                HStack(spacing: 6) {
                    text("OS Sph", c, "presentOsSph", "-1.75"); text("OS Cyl", c, "presentOsCyl", "-0.50")
                    text("OS Axi", c, "presentOsAxi", "175"); text("OS CVA", c, "presentOsCva", "6/6")
                }
                FormSectionHeader(title: "New glasses prescription")
                HStack(spacing: 6) {
                    text("OD UVA", c, "newOdUva", "6/18"); text("OD Sph", c, "newOdSph", "-2.00")
                    text("OD Cyl", c, "newOdCyl", "-0.75"); text("OD Axi", c, "newOdAxi", "180")
                    text("OD CVA", c, "newOdCva", "6/6")
                }
                HStack(spacing: 6) {
                    text("OS UVA", c, "newOsUva", "6/24"); text("OS Sph", c, "newOsSph", "-2.25")
                    text("OS Cyl", c, "newOsCyl", "-0.75"); text("OS Axi", c, "newOsAxi", "175")
                    text("OS CVA", c, "newOsCva", "6/6")
                }
            }
            Group {
                FormSectionHeader(title: "Colour vision")
                choice("Colour vision (Ishihara /17)", O.COLOR_VISION, c, "colorVision")
                FormSectionHeader(title: "Any other complaints")
                text("Any other complaints, if present", c, "otherComplaints", "e.g. headache after reading, watering")
            }
        }
    }

    // Oral & dental, as the sheet has it: tooth index, oral hygiene index,
    // enamel, alignment & occlusion, the treatment plan and any other complaints.
    private func dental(_ c: String) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Group {
                FormSectionHeader(title: "Tooth index (dmft / DMFT)")
                choice("Type of dentition", O.DENTITION, c, "dentition")
                HStack(alignment: .top, spacing: 8) {
                    number("Decayed *", c, "cariesCount")
                    number("Missing", c, "missingCount")
                    number("Filled", c, "filledCount")
                }
            }
            Group {
                FormSectionHeader(title: "Oral hygiene index")
                choice("Oral hygiene *", O.ORAL_HYGIENE_INDEX, c, "hygiene")
                FormSectionHeader(title: "Enamel, alignment & occlusion")
                choice("Dental fluorosis", O.FLUOROSIS_STAGE, c, "fluorosis")
                FormSectionHeader(title: "Treatment plan")
                multi("Select dental interventions", O.DENTAL_TREATMENTS, c, "treatmentNeeded")
                FormSectionHeader(title: "Any other complaints")
                text("Any other complaints, if present", c, "otherComplaints", "e.g. bleeding gums, bad breath")
            }
        }
    }

    private func ent(_ c: String) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            FormSectionHeader(title: "Hearing Acuity Screening")
            pair(choice("Left Ear Acuity *", O.HEARING_ACUITY, c, "leftHearing"),
                 choice("Right Ear Acuity *", O.HEARING_ACUITY, c, "rightHearing"))
            FormSectionHeader(title: "Clinical ENT Examination")
            multi("Ear Canals & Tympanic Membrane Findings", O.EAR_CANAL_EXAM, c, "earExam")
            multi("Nasal Cavity & Septum Findings", O.NASAL_EXAM, c, "nasalExam")
            multi("Throat, Tonsils & Adenoids Findings", O.THROAT_TONSILS, c, "throatExam")
            choice("Speech & Voice", O.SPEECH_VOICE, c, "speechVoice")
            FormSectionHeader(title: "Recommended ENT Interventions")
            multi("Select ENT Interventions", O.ENT_TREATMENTS, c, "entTreatment")
        }
    }

    private func skin(_ c: String) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            FormSectionHeader(title: "Dermatological Examination")
            multi("Primary Skin Condition & Findings *", O.SKIN_CONDITIONS, c, "skinCondition")
            multi("Lesion Distribution & Body Sites", O.SKIN_LOCATIONS, c, "skinLocation")
            FormSectionHeader(title: "Symptoms & Parasitic Screening")
            multi("Symptoms & Parasitic Signs (Itching, Lice...)", O.PRURITUS_SIGNS, c, "pruritus",
                  flags: [("itching", "Itching"), ("lice", "Lice")])
            FormSectionHeader(title: "Recommended Dermatological Care")
            multi("Select Dermatological Treatments", O.SKIN_TREATMENTS, c, "skinTreatment")
        }
    }

    private func spine(_ c: String) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            FormSectionHeader(title: "Musculoskeletal & Posture Assessment")
            multi("Spinal Posture & Alignment (Slouching, Scoliosis...) *", O.POSTURE_ALIGN, c, "posture")
            multi("Gait & Lower Limb Assessment (Flat Feet, Knock-knees...) *", O.GAIT_LIMB, c, "gaitLimb")
            FormSectionHeader(title: "Functional Symptoms & Joint Exam")
            multi("Joint Symptoms & ROM (Pain, Swelling, Restricted Motion...)", O.JOINT_SYMPTOMS, c, "jointSymptoms",
                  flags: [("jointPain", "Pain"), ("restrictedMotion", "Restricted")])
            FormSectionHeader(title: "Recommended Musculoskeletal Interventions")
            multi("Select Orthopaedic Interventions", O.SPINE_TREATMENTS, c, "spineTreatment")
        }
    }

    private func immunisation(_ c: String) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            FormSectionHeader(title: "Immunization Status Review")
            choice("Overall Vaccine Status for Age *", O.VACCINE_STATUS, c, "vaccineStatus")
            FormSectionHeader(title: "Missed Routine Immunizations")
            multi("Select Missed Routine Vaccines", O.MISSED_VACCINES, c, "missedVaccines")
            FormSectionHeader(title: "Recommended Immunization Action")
            multi("Select Recommended Action", O.VACCINE_TREATMENTS, c, "vaccineTreatment")
        }
    }

    private func haemoglobin(_ c: String) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            FormSectionHeader(title: "Anaemia & Haemoglobin Screening")
            number("Haemoglobin Level (g/dL) *", c, "hb")
            choice("Clinical Pallor Sign", O.PALLOR_SIGNS, c, "pallor")
            FormSectionHeader(title: "Recommended Anaemia Management")
            multi("Select Anaemia Interventions", O.HB_TREATMENTS, c, "hbTreatment")
        }
    }

    // MARK: Save

    private func saveBlock(_ form: ScreeningForm) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            // Said again here: Save sits at the foot of a long form, and the
            // notice at the top is out of sight when it is tapped.
            if !gapMessage.isEmpty {
                Banner(text: gapMessage, color: Brand.red)
            } else if !message.isEmpty {
                Banner(text: message, color: Brand.red)
            }
            PrimaryButton(title: busy ? L("clin_saving") : L("clin_save_record"), busy: busy,
                          enabled: !busy && !form.checks.isEmpty) {
                Task { await save(form) }
            }
            Text(L("clin_reviewed_first")).font(.vh(.footnote)).foregroundColor(.secondary)
        }
        .padding(.top, 4)
    }

    private func save(_ form: ScreeningForm) async {
        let recorded = Set(form.findings
            .filter { $0.flag != "NOT_MEASURED" || !RequiredChecks.isBlank($0.note) }
            .map(\.checkType))
        let gaps = RequiredChecks.screeningGaps(checks: form.checks, values: values, alreadyRecorded: recorded)
        gapMessage = RequiredChecks.gapMessage(gaps)
        guard gaps.isEmpty else { return }
        let ranges = RequiredChecks.rangeProblems(checks: form.checks, values: values)
        if !ranges.isEmpty {
            gapMessage = "Not saved. " + ranges.joined(separator: "; ") + "."
            return
        }
        let findings = ScreeningRecord.findings(order: form.checks + ["Systemic", "Investigations"],
                                                values: values, note: "")
        guard !findings.isEmpty else {
            message = L("clin_record_one")
            return
        }
        busy = true
        defer { busy = false }
        do {
            try await APIClient.shared.saveScreening(campId: campId, kidId: kidId, findings: findings)
            message = ""
            clinician.noteSaved(kidId: kidId, absentOnly: false)
            dismiss()
        } catch {
            message = clinicianMessage(error, fallback: L("clin_err_save"))
        }
    }

    private func load() async {
        // Once open, coming back from a sheet must not wipe what was entered.
        guard form == nil else { return }
        loading = true
        defer { loading = false }
        do {
            let fetched = try await APIClient.shared.screeningForm(campId: campId, kidId: kidId)
            // What was saved before comes back into the form, as the console
            // reopens it, so a second save does not drop it.
            var seeded: [String: [String: String]] = [:]
            for finding in fetched.findings {
                let fields = ScreeningRecord.restore(flag: finding.flag, note: finding.note, detail: finding.detail)
                if !fields.isEmpty { seeded[finding.checkType] = fields }
                // Every check carries the same history and lab card; the first
                // one found fills it.
                for (section, saved) in finding.context where seeded[section] == nil && !saved.isEmpty {
                    seeded[section] = saved
                }
            }
            values = seeded
            form = fetched
            loadError = nil
        } catch is CancellationError {
        } catch {
            loadError = clinicianMessage(error, fallback: L("clin_err_form"))
        }
    }

    private func setAttendance(_ attendance: String) async {
        busy = true
        defer { busy = false }
        if let failure = await clinician.markAttendance(campId: campId, kidId: kidId, attendance: attendance) {
            message = failure
        } else {
            message = ""
            form?.attendance = attendance
        }
    }

    // MARK: Field helpers

    private func field(_ check: String, _ key: String) -> Binding<String> {
        Binding(
            get: { values[check]?[key] ?? "" },
            set: { values[check, default: [:]][key] = $0 }
        )
    }

    private func isNotDone(_ check: String) -> Bool {
        values[check]?[RequiredChecks.notDone] == "true"
    }

    /// A check that could not be done requires only its reason, so its
    /// labels lose the asterisk.
    private func shown(_ label: String, _ check: String) -> String {
        isNotDone(check) && label.hasSuffix(" *") ? String(label.dropLast(2)) : label
    }

    private func pair<A: View, B: View>(_ a: A, _ b: B) -> some View {
        HStack(alignment: .top, spacing: 10) { a; b }
    }

    private func number(_ label: String, _ check: String, _ key: String) -> some View {
        NumberField(label: shown(label, check), value: field(check, key))
    }

    private func text(_ label: String, _ check: String, _ key: String, _ placeholder: String = "") -> some View {
        TextFieldRow(label: shown(label, check), value: field(check, key), placeholder: placeholder)
    }

    private func choice(_ label: String, _ options: [String], _ check: String, _ key: String) -> some View {
        ChoiceField(label: shown(label, check), options: options, value: field(check, key))
    }

    private func toggle(_ label: String, _ check: String, _ key: String) -> some View {
        ToggleRow(label: label, value: field(check, key))
    }

    /// A multi-select. With `flags`, the selection also sets yes/no keys the
    /// server's rules read, each true when a picked option mentions its word.
    private func multi(_ label: String, _ options: [String], _ check: String, _ key: String,
                       flags: [(key: String, word: String)] = []) -> some View {
        var onSelect: (([String]) -> Void)? = nil
        if !flags.isEmpty {
            onSelect = { picked in
                var fields = values[check] ?? [:]
                fields[key] = picked.joined(separator: ",")
                for flag in flags {
                    let mentioned = picked.contains { $0.localizedCaseInsensitiveContains(flag.word) }
                    fields[flag.key] = mentioned ? "true" : "false"
                }
                values[check] = fields
            }
        }
        return MultiChoiceField(label: shown(label, check), options: options, value: field(check, key), onSelect: onSelect)
    }

    private func flagWord(_ flag: String) -> String {
        switch flag {
        case "GOOD": return L("clin_flag_good")
        case "WATCH": return L("clin_flag_watch")
        case "ALERT": return L("clin_flag_alert")
        default: return flag
        }
    }

    private func flagColor(_ flag: String) -> Color {
        switch flag {
        case "ALERT": return Brand.red
        case "WATCH": return Brand.orange
        default: return Brand.blue
        }
    }
}
