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
                Text(child.name).font(.title2.bold())
                let gradeSection = [child.grade, child.section].filter { !$0.isEmpty }.joined(separator: " ")
                let parts = [gradeSection, child.gender, child.age.map { L("clin_years", String($0)) } ?? ""]
                Text(parts.filter { !$0.isEmpty }.joined(separator: " · "))
                    .font(.subheadline).foregroundColor(.secondary)
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
                historyCard
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
        Text(L("clin_required_intro")).font(.footnote).foregroundColor(.secondary)
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
            Text(L("clin_illness_title")).font(.headline)
            if !history.caution.isEmpty { Text(history.caution).font(.footnote) }
            ForEach(history.events.prefix(10)) { e in
                let dates = e.endedOn.isEmpty ? e.startedOn : L("clin_date_range", e.startedOn, e.endedOn)
                let extras = [e.severity.lowercased(),
                              e.sawDoctor ? L("clin_saw_doctor") : "",
                              e.missedSchool ? L("clin_missed_school") : ""]
                    .filter { !$0.isEmpty }.joined(separator: ", ")
                let note = e.note.isEmpty ? "" : " — " + e.note
                Text("\(dates): \(e.symptom) (\(extras))\(note)").font(.subheadline)
            }
            if history.events.count > 10 {
                Text(L("clin_and_earlier", String(history.events.count - 10))).font(.footnote)
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
            Text(check).font(.headline)
            if let existing = form.findings.first(where: { $0.checkType == check && $0.flag != "NOT_MEASURED" }) {
                let reason = existing.rationale.isEmpty ? "" : " — " + existing.rationale
                Text(L("clin_recorded", flagWord(existing.flag)) + reason)
                    .font(.footnote).foregroundColor(flagColor(existing.flag))
            }
            ToggleRow(label: L("clin_not_done"), value: field(check, RequiredChecks.notDone))
            if isNotDone(check) {
                TextFieldRow(label: L("clin_not_done_why"), value: field(check, RequiredChecks.notDoneReason),
                             placeholder: L("clin_not_done_hint"))
                // What was seen still counts: the server keeps a WATCH or
                // ALERT it raises, so the fields stay, none of them required.
                Text(L("clin_not_done_seen")).font(.footnote).foregroundColor(.secondary)
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
            Text(L("clin_no_form")).font(.footnote).foregroundColor(.secondary)
        }
    }

    private func heightWeight(_ c: String) -> some View {
        pair(number("Height (cm) *", c, "heightCm"), number("Weight (kg) *", c, "weightKg"))
    }

    private func vision(_ c: String) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Group {
                FormSectionHeader(title: "Visual Acuity (Distant & Near) - Image 3",
                                  subtitle: "Snellen distance & near reading metrics per eye")
                pair(choice("Distance OD (Right) *", O.ACUITY, c, "rightAcuity"),
                     choice("Distance OS (Left) *", O.ACUITY, c, "leftAcuity"))
                pair(choice("Near OD (Right)", O.NEAR_VISION, c, "rightNearVision"),
                     choice("Near OS (Left)", O.NEAR_VISION, c, "leftNearVision"))
                choice("Testing Condition", O.VISION_TEST_CONDITION, c, "testingCondition")
                FormSectionHeader(title: "External Anterior Symptoms / Signs (Image 3)")
                multi("Select External Signs (Ptosis, Swelling, Watering...)", O.EXTERNAL_SIGNS, c, "externalSigns")
                choice("External Eye Exam", O.EXTERNAL_EXAM, c, "externalExam")
            }
            Group {
                FormSectionHeader(title: "Present Glasses Prescription (Image 5)")
                HStack(spacing: 6) {
                    text("OD Sph", c, "presentOdSph", "-1.50"); text("OD Cyl", c, "presentOdCyl", "-0.50")
                    text("OD Axi", c, "presentOdAxi", "180"); text("OD CVA", c, "presentOdCva", "6/6")
                }
                HStack(spacing: 6) {
                    text("OS Sph", c, "presentOsSph", "-1.75"); text("OS Cyl", c, "presentOsCyl", "-0.50")
                    text("OS Axi", c, "presentOsAxi", "175"); text("OS CVA", c, "presentOsCva", "6/6")
                }
                FormSectionHeader(title: "New Glasses Prescription (Image 5)")
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
                FormSectionHeader(title: "Tonometry & Dilatation (Image 5)")
                pair(number("NCT IOP RE (mmHg)", c, "rightNctIop"), number("NCT IOP LE (mmHg)", c, "leftNctIop"))
                pair(choice("Dominant Eye", O.DOMINANT_EYE, c, "dominantEye"),
                     choice("Dilatation Status", O.DILATATION_STATUS, c, "dilatation"))
                text("Dilatation Time", c, "dilatationTime", "e.g. 10:30 AM")
            }
            Group {
                FormSectionHeader(title: "Anterior Segment Examination (Image 4)",
                                  subtitle: "Lashes, Lids, Conjunctiva, Sclera, Cornea, AC, Iris, Pupil & Lens")
                pair(choice("Eyelashes (OD)", O.EYE_LASHES, c, "rightLashes"),
                     choice("Eyelashes (OS)", O.EYE_LASHES, c, "leftLashes"))
                pair(choice("Eyelid (OD)", O.EYE_LIDS, c, "rightLid"), choice("Eyelid (OS)", O.EYE_LIDS, c, "leftLid"))
                pair(choice("Conjunctiva (OD)", O.CONJUNCTIVA, c, "rightConjunctiva"),
                     choice("Conjunctiva (OS)", O.CONJUNCTIVA, c, "leftConjunctiva"))
                pair(choice("Sclera (OD)", O.SCLERA, c, "rightSclera"), choice("Sclera (OS)", O.SCLERA, c, "leftSclera"))
                pair(choice("Cornea (OD)", O.CORNEA, c, "rightCornea"), choice("Cornea (OS)", O.CORNEA, c, "leftCornea"))
                pair(choice("Anterior Chamber (OD)", O.ANTERIOR_CHAMBER, c, "rightAc"),
                     choice("Anterior Chamber (OS)", O.ANTERIOR_CHAMBER, c, "leftAc"))
                pair(choice("Iris (OD)", O.IRIS, c, "rightIris"), choice("Iris (OS)", O.IRIS, c, "leftIris"))
                pair(choice("Pupil Size", O.PUPIL_SIZE, c, "pupilSize"),
                     choice("Light Reaction", O.PUPIL_LIGHT_REACTION, c, "pupilReaction"))
                pair(choice("Crystalline Lens (OD)", O.EYE_LENS, c, "rightLens"),
                     choice("Crystalline Lens (OS)", O.EYE_LENS, c, "leftLens"))
            }
            Group {
                FormSectionHeader(title: "Posterior Segment / Fundus Examination (Image 4)",
                                  subtitle: "Vitreous, Optic Disc, Macula, Retina & Blood Vessels")
                pair(choice("Optic Disc (OD)", O.OPTIC_DISC, c, "rightOpticDisc"),
                     choice("Optic Disc (OS)", O.OPTIC_DISC, c, "leftOpticDisc"))
                pair(choice("Macula & Fovea (OD)", O.MACULA, c, "rightMacula"),
                     choice("Macula & Fovea (OS)", O.MACULA, c, "leftMacula"))
                pair(choice("Background Retina (OD)", O.RETINA, c, "rightRetina"),
                     choice("Background Retina (OS)", O.RETINA, c, "leftRetina"))
                pair(choice("Blood Vessels (OD)", O.BLOOD_VESSELS, c, "rightVessels"),
                     choice("Blood Vessels (OS)", O.BLOOD_VESSELS, c, "leftVessels"))
            }
            Group {
                FormSectionHeader(title: "Motility, Alignment, Gonioscopy & Color Vision")
                choice("Ocular Motility (9 Gazes)", O.OCULAR_MOTILITY, c, "ocularMotility")
                choice("Ocular Alignment / Squint", O.SQUINT_ALIGNMENT, c, "squintAlignment")
                choice("Color Vision (Ishihara /17)", O.COLOR_VISION, c, "colorVision")
                choice("Gonioscopy Angle", O.GONIOSCOPY, c, "gonioscopy")
                choice("Glasses Status", O.GLASSES_STATUS, c, "glassesWorn")
                toggle("Strabismus / Squint Noted", c, "squint")
            }
            Group {
                FormSectionHeader(title: "Ocular Diagnostic Investigations (Image 1)")
                multi("Order Ocular Tests (Keratometry, A-Scan, OCT, FFA...)", O.OCULAR_INVESTIGATIONS, c, "ocularInvestigations")
                FormSectionHeader(title: "Recommended Vision Interventions (Images 3, 4)")
                multi("Select Vision Interventions", O.VISION_TREATMENTS, c, "treatmentsRecommended")
                FormSectionHeader(title: "Diagnosis & Plan of Care (Image 4)")
                text("Provisional Diagnosis", c, "provisionalDiagnosis", "e.g. Myopic Astigmatism OD/OS")
                text("Plan of Care", c, "planOfCare", "Corrective glasses, repeat exam in 6 months...")
                text("Final Diagnosis", c, "finalDiagnosis", "e.g. Simple Myopia OD -2.00, OS -2.25")
            }
        }
    }

    private func dental(_ c: String) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Group {
                FormSectionHeader(title: "Tooth Index (dmft / DMFT)")
                HStack(alignment: .top, spacing: 8) {
                    number("Carious (Decayed) *", c, "cariesCount")
                    number("Missing", c, "missingCount")
                    number("Filled", c, "filledCount")
                }
                FormSectionHeader(title: "Gums & Periodontium")
                multi("Gums Condition (Healthy, Bleeding, Swollen, Recession...) *", O.GUMS_CONDITION, c, "gums")
                choice("Oral Hygiene Index *", O.ORAL_HYGIENE_INDEX, c, "hygiene")
                FormSectionHeader(title: "Enamel, Alignment & Occlusion")
                choice("Dental Fluorosis", O.FLUOROSIS_STAGE, c, "fluorosis")
                multi("Occlusion & Alignment (Normal, Crowding, Crossbite...)", O.OCCLUSION_ALIGNMENT, c, "malocclusion")
            }
            Group {
                FormSectionHeader(title: "Symptoms, Trauma & Habits")
                multi("Symptoms & Dental Trauma (Toothache, Sensitivity, Fractures...)", O.DENTAL_SYMPTOMS, c,
                      "dentalSymptoms",
                      flags: [("pain", "Toothache"), ("sensitivity", "Sensitivity"),
                              ("trauma", "Chipped"), ("stainsTartar", "Stains")])
                multi("Oral Habits (Thumb sucking, mouth breathing...)", O.DENTAL_HABITS, c, "dentalHabits")
                FormSectionHeader(title: "Recommended Dental Treatment")
                multi("Select Dental Treatments", O.DENTAL_TREATMENTS, c, "treatmentNeeded")
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

    /// Birth history, co-morbidities and lab orders: the same card under every
    /// child on Android, saved as the Systemic and Investigations checks.
    private var historyCard: some View {
        Card {
            VStack(alignment: .leading, spacing: 12) {
                Group {
                    FormSectionHeader(title: "Birth History & Co-morbidities (Images 2 & 5)",
                                      subtitle: "Perinatal history, chronic illness & allergies")
                    pair(choice("Gestational Status", O.GESTATIONAL_AGE, "Systemic", "gestationalAge"),
                         number("Birth Weight (kg)", "Systemic", "birthWeightKg"))
                    pair(choice("Consanguinity", O.CONSANGUINITY_MARRIAGE, "Systemic", "consanguinity"),
                         choice("Parental Myopia", O.PARENTAL_MYOPIA, "Systemic", "parentalMyopia"))
                    toggle("Incubation / NICU Stay Required", "Systemic", "incubationStay")
                }
                Group {
                    FormSectionHeader(title: "Systemic Health Issues & Allergies")
                    multi("Systemic Diseases (DM, Polio, Paralysis...)", O.SYSTEMIC_DISEASES, "Systemic", "systemicDiseases")
                    multi("Drug Allergies (Penicillin, Xylocaine, Sulpha...)", O.ALLERGIES_LIST, "Systemic", "drugAllergies")
                    multi("Current Medications (Insulin, Anticoagulants...)", O.CURRENT_TREATMENTS, "Systemic", "currentTreatments")
                    choice("Nutritional Screening", O.NUTRITIONAL_STATUS, "Systemic", "nutritionalStatus")
                }
                Group {
                    FormSectionHeader(title: "Diagnostic Lab Requisition Orders (Image 1)",
                                      subtitle: "Maxivision clinical pathology & imaging tests")
                    multi("Routine Blood & Urine Tests (CBP, RBS, HbA1c...)", O.GENERAL_INVESTIGATIONS,
                          "Investigations", "generalLabs")
                    multi("Specialist & Imaging (LFT, Thyroid, Mantoux, MRI...)", O.ADDITIONAL_INVESTIGATIONS,
                          "Investigations", "specialistTests")
                }
            }
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
            Text(L("clin_reviewed_first")).font(.footnote).foregroundColor(.secondary)
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
