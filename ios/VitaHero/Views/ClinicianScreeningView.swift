import SwiftUI

/// World-Class Multi-Specialty Clinical Pediatric Screening Workspace View.
struct ClinicianScreeningView: View {
    @EnvironmentObject var appViewModel: AppViewModel
    @EnvironmentObject var clinicianViewModel: ClinicianViewModel
    @Environment(\.presentationMode) var presentationMode
    
    var body: some View {
        VStack(spacing: 0) {
            // Top Student Header Banner
            if let student = clinicianViewModel.selectedStudent {
                HStack(spacing: AppTheme.Layout.spacing12) {
                    Circle()
                        .fill(AppTheme.Colors.heroOrange)
                        .frame(width: 44, height: 44)
                        .overlay(
                            Text(String(student.studentName.prefix(1)))
                                .font(.system(size: 18, weight: .bold))
                                .foregroundColor(.white)
                        )
                    
                    VStack(alignment: .leading, spacing: 2) {
                        Text(student.studentName)
                            .font(AppTheme.Typography.font(for: .cardTitleMedium))
                            .foregroundColor(AppTheme.Colors.textPrimary)
                        Text("Roll #\(student.rollNumber) • \(student.age) yrs • Grade \(student.gradeClass)")
                            .font(AppTheme.Typography.font(for: .captionRegular))
                            .foregroundColor(AppTheme.Colors.textSecondary)
                    }
                    Spacer()
                    
                    if !clinicianViewModel.isAbsent {
                        Button(action: { clinicianViewModel.isAbsent = true }) {
                            Text("Mark Absent")
                                .font(AppTheme.Typography.font(for: .captionMedium))
                                .foregroundColor(AppTheme.Colors.coralRed)
                                .padding(.horizontal, 10)
                                .padding(.vertical, 5)
                                .background(AppTheme.Colors.coralRed.opacity(0.12))
                                .cornerRadius(8)
                        }
                    }
                    
                    Button(action: { presentationMode.wrappedValue.dismiss() }) {
                        Image(systemName: "xmark.circle.fill")
                            .font(.system(size: 24))
                            .foregroundColor(AppTheme.Colors.textSecondary)
                    }
                }
                .padding(.horizontal, AppTheme.Layout.spacing20)
                .padding(.vertical, AppTheme.Layout.spacing12)
                .background(Color.white)
                .shadow(color: Color.black.opacity(0.04), radius: 3, x: 0, y: 2)
            }
            
            if !clinicianViewModel.isAbsent {
                // Specialty Tab Bar Switcher
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: AppTheme.Layout.spacing8) {
                        ForEach(ClinicianViewModel.SpecialtyTab.allCases) { tab in
                            Button(action: { clinicianViewModel.selectedSpecialtyTab = tab }) {
                                HStack(spacing: 6) {
                                    Image(systemName: tab.icon)
                                    Text(tab.rawValue)
                                }
                                .font(AppTheme.Typography.font(for: .captionMedium))
                                .padding(.horizontal, 14)
                                .padding(.vertical, 8)
                                .background(
                                    clinicianViewModel.selectedSpecialtyTab == tab ? AppTheme.Colors.heroBlue : Color.white
                                )
                                .foregroundColor(clinicianViewModel.selectedSpecialtyTab == tab ? .white : AppTheme.Colors.textPrimary)
                                .cornerRadius(16)
                                .overlay(
                                    RoundedRectangle(cornerRadius: 16)
                                        .stroke(AppTheme.Colors.glassBorder, lineWidth: 1)
                                        .stroke(AppTheme.Colors.glassBorder, lineWidth: 1)
                                )
                            }
                        }
                    }
                    .padding(.horizontal, AppTheme.Layout.spacing20)
                    .padding(.vertical, AppTheme.Layout.spacing10)
                }
                .background(AppTheme.Colors.surfaceBackground)
            }
            
            // Specialty Form Body View
            ScrollView {
                VStack(spacing: AppTheme.Layout.spacing16) {
                    if clinicianViewModel.isAbsent {
                        HeroCard {
                            VStack(alignment: .leading, spacing: AppTheme.Layout.spacing12) {
                                HStack(spacing: 8) {
                                    Image(systemName: "person.crop.circle.badge.xmark")
                                        .foregroundColor(AppTheme.Colors.coralRed)
                                        .font(.title3)
                                    Text("Student Marked Absent")
                                        .font(AppTheme.Typography.font(for: .cardTitleSmall))
                                }
                                Text("\(student.name) is recorded as ABSENT for this camp session. No clinical examination measurements or options need to be selected.")
                                    .font(AppTheme.Typography.font(for: .bodyMedium))
                                    .foregroundColor(AppTheme.Colors.textSecondary)
                                
                                Button("Mark Present Instead") {
                                    clinicianViewModel.isAbsent = false
                                }
                                .font(AppTheme.Typography.font(for: .captionMedium))
                                .foregroundColor(AppTheme.Colors.heroBlue)
                            }
                            .padding(.vertical, 4)
                        }
                        
                        PrimaryGradientButton(
                            title: "Confirm Absent & Close",
                            iconName: "checkmark.circle.fill",
                            isLoading: clinicianViewModel.isSubmittingRecord
                        ) {
                            Task {
                                _ = await clinicianViewModel.markAttendanceAbsent()
                                appViewModel.showToast(title: "Marked Absent", message: "\(student.name) marked absent.", style: .info)
                                presentationMode.wrappedValue.dismiss()
                            }
                        }
                        .padding(.top, AppTheme.Layout.spacing12)
                    } else {
                        switch clinicianViewModel.selectedSpecialtyTab {
                        case .vision:
                            visionFormContent
                        case .refraction:
                            refractionGlassesContent
                        case .dental:
                            dentalFormContent
                        case .ent:
                            entFormContent
                        case .dermatology:
                            dermatologyHbFormContent
                        case .spineVaccine:
                            spineVaccineFormContent
                        case .historyInvest:
                            historyInvestFormContent
                        case .summary:
                            summaryAssessmentContent
                        }
                        
                        // Bottom Navigation / Save Button
                        PrimaryGradientButton(
                            title: clinicianViewModel.selectedSpecialtyTab == .summary ? "Submit Screening Record" : "Next Specialty Tab",
                            iconName: clinicianViewModel.selectedSpecialtyTab == .summary ? "checkmark.circle.fill" : "arrow.right",
                            isLoading: clinicianViewModel.isSubmittingRecord
                        ) {
                            if clinicianViewModel.selectedSpecialtyTab == .summary {
                                Task {
                                    let success = await clinicianViewModel.submitScreeningRecord()
                                    if success {
                                        appViewModel.showToast(title: "Record Saved", message: "Screening completed & synced.", style: .success)
                                        presentationMode.wrappedValue.dismiss()
                                    }
                                }
                            } else {
                                advanceToNextTab()
                            }
                        }
                        .padding(.top, AppTheme.Layout.spacing12)
                    }
                }
                .padding(.horizontal, AppTheme.Layout.spacing20)
                .padding(.vertical, AppTheme.Layout.spacing16)
            }
            .background(AppTheme.Colors.surfaceBackground.ignoresSafeArea())
        }
    }
    
    // MARK: - 1. Pediatric Ophthalmology Form (Images 1, 3, 4, 5)
    private var visionFormContent: some View {
        VStack(spacing: AppTheme.Layout.spacing16) {
            HeroFormSectionHeader(
                title: "Visual Acuity & Testing (OD / OS)",
                subtitle: "Snellen distance & near vision metrics",
                iconName: "eye.fill",
                accentColor: AppTheme.Colors.heroOrange
            )
            
            BilateralEyeExamControl(
                title: "Distance Visual Acuity",
                subtitle: "Snellen chart / Low vision scale",
                options: SnellenAcuity.allCases,
                odValue: $clinicianViewModel.odAcuity,
                osValue: $clinicianViewModel.osAcuity
            )
            
            BilateralEyeExamControl(
                title: "Near Vision Acuity",
                subtitle: "N6 to N36 reading chart",
                options: NearVisionAcuity.allCases,
                odValue: $clinicianViewModel.odNearVision,
                osValue: $clinicianViewModel.osNearVision
            )
            
            HeroCard {
                HStack {
                    Text("Testing Condition:")
                        .font(AppTheme.Typography.font(for: .formLabel))
                    Spacer()
                    Picker("Condition", selection: $clinicianViewModel.testingCondition) {
                        ForEach(VisualTestingCondition.allCases, id: \.self) { c in
                            Text(c.rawValue).tag(c)
                        }
                    }
                }
            }
            
            // External Anterior Signs (Image 3)
            HeroCard {
                VStack(alignment: .leading, spacing: AppTheme.Layout.spacing10) {
                    Text("External Anterior Symptoms / Signs")
                        .font(AppTheme.Typography.font(for: .cardTitleSmall))
                    
                    let signs = [
                        "Ptosis (Lid Droop)",
                        "Swelling / Edema",
                        "Redness / Congestion",
                        "Watering / Epiphora",
                        "Purulent Discharge",
                        "Mucoid Discharge",
                        "Foreign Body"
                    ]
                    
                    ForEach(signs, id: \.self) { sign in
                        Toggle(isOn: Binding(
                            get: { clinicianViewModel.externalSigns.contains(sign) },
                            set: { on in
                                if on { clinicianViewModel.externalSigns.insert(sign) }
                                else { clinicianViewModel.externalSigns.remove(sign) }
                            }
                        )) {
                            Text(sign).font(AppTheme.Typography.font(for: .bodyMedium))
                        }
                        .tint(AppTheme.Colors.heroOrange)
                    }
                }
            }
            
            HeroFormSectionHeader(
                title: "Anterior Segment Examination (OD / OS)",
                subtitle: "Lids, Conjunctiva, Sclera, Cornea, AC, Iris, Pupil, Lens",
                iconName: "circle.circle",
                accentColor: AppTheme.Colors.heroBlue
            )
            
            BilateralEyeExamControl(
                title: "Eyelashes & Eyelids",
                subtitle: "Trichiasis, Blepharitis, Chalazion, Stye",
                options: EyeLashesState.allCases,
                odValue: $clinicianViewModel.odLashes,
                osValue: $clinicianViewModel.osLashes
            )
            
            BilateralEyeExamControl(
                title: "Conjunctiva & Sclera",
                subtitle: "Hyperemia, discharge, Bitot's spots, icterus",
                options: EyeConjunctivaState.allCases,
                odValue: $clinicianViewModel.odConjunctiva,
                osValue: $clinicianViewModel.osConjunctiva
            )
            
            BilateralEyeExamControl(
                title: "Cornea & Anterior Chamber",
                subtitle: "Clarity, opacities, ulcer, flare, hyphema",
                options: EyeCorneaState.allCases,
                odValue: $clinicianViewModel.odCornea,
                osValue: $clinicianViewModel.osCornea
            )
            
            BilateralEyeExamControl(
                title: "Pupil & Light Reaction",
                subtitle: "Size, brisk reaction, anisocoria, RAPD",
                options: EyePupilState.allCases,
                odValue: $clinicianViewModel.odPupil,
                osValue: $clinicianViewModel.osPupil
            )
            
            BilateralEyeExamControl(
                title: "Crystalline Lens",
                subtitle: "Clear, cataractous opacity, subluxation, IOL",
                options: EyeLensState.allCases,
                odValue: $clinicianViewModel.odLens,
                osValue: $clinicianViewModel.osLens
            )
            
            HeroFormSectionHeader(
                title: "Posterior Segment / Fundus (OD / OS)",
                subtitle: "Vitreous, Optic Disc, Macula, Retina & Vessels",
                iconName: "sparkles",
                accentColor: AppTheme.Colors.purple
            )
            
            BilateralEyeExamControl(
                title: "Optic Disc & Cup-to-Disc",
                subtitle: "Pink sharp margins, pallor, cupping C:D",
                options: OpticDiscState.allCases,
                odValue: $clinicianViewModel.odOpticDisc,
                osValue: $clinicianViewModel.osOpticDisc
            )
            
            BilateralEyeExamControl(
                title: "Macula & Fovea Reflex",
                subtitle: "Foveal reflex, edema, scar, cherry-red spot",
                options: MaculaState.allCases,
                odValue: $clinicianViewModel.odMacula,
                osValue: $clinicianViewModel.osMacula
            )
            
            BilateralEyeExamControl(
                title: "Retina & Blood Vessels",
                subtitle: "Hemorrhages, exudates, ROP, detachment, A:V",
                options: RetinaState.allCases,
                odValue: $clinicianViewModel.odRetina,
                osValue: $clinicianViewModel.osRetina
            )
            
            HeroFormSectionHeader(
                title: "Motility, Alignment & Tonometry",
                subtitle: "Eye movement, squint, IOP & color vision",
                iconName: "arrow.up.and.down.and.arrow.left.and.right",
                accentColor: AppTheme.Colors.emerald
            )
            
            HeroCard {
                VStack(alignment: .leading, spacing: AppTheme.Layout.spacing12) {
                    HStack {
                        Text("Ocular Motility:")
                            .font(AppTheme.Typography.font(for: .formLabel))
                        Spacer()
                        Picker("Motility", selection: $clinicianViewModel.ocularMotility) {
                            ForEach(OcularMotilityState.allCases, id: \.self) { m in
                                Text(m.rawValue).tag(m)
                            }
                        }
                    }
                    
                    HStack {
                        Text("Squint / Alignment:")
                            .font(AppTheme.Typography.font(for: .formLabel))
                        Spacer()
                        Picker("Squint", selection: $clinicianViewModel.squintAlignment) {
                            ForEach(SquintState.allCases, id: \.self) { s in
                                Text(s.rawValue).tag(s)
                            }
                        }
                    }
                    
                    HStack {
                        Text("Ishihara Color Vision:")
                            .font(AppTheme.Typography.font(for: .formLabel))
                        Spacer()
                        Picker("Color", selection: $clinicianViewModel.colorVision) {
                            ForEach(IshiharaColorVisionState.allCases, id: \.self) { c in
                                Text(c.rawValue).tag(c)
                            }
                        }
                    }
                    
                    HStack {
                        Text("Dominant Eye:")
                            .font(AppTheme.Typography.font(for: .formLabel))
                        Spacer()
                        Picker("Dominant Eye", selection: $clinicianViewModel.dominantEye) {
                            ForEach(DominantEyeState.allCases, id: \.self) { d in
                                Text(d.rawValue).tag(d)
                            }
                        }
                    }
                    
                    HStack {
                        Text("Dilatation Status:")
                            .font(AppTheme.Typography.font(for: .formLabel))
                        Spacer()
                        Picker("Dilatation", selection: $clinicianViewModel.dilatation) {
                            ForEach(DilatationState.allCases, id: \.self) { d in
                                Text(d.rawValue).tag(d)
                            }
                        }
                    }
                    
                    if clinicianViewModel.dilatation != .no {
                        HeroTextField(
                            label: "Dilatation Time",
                            placeholder: "e.g. 10:45 AM",
                            text: $clinicianViewModel.dilatationTime,
                            iconName: "clock"
                        )
                    }
                    
                    HStack(spacing: AppTheme.Layout.spacing12) {
                        HeroTextField(
                            label: "NCT IOP RE (mmHg)",
                            placeholder: "15",
                            text: $clinicianViewModel.rightNctIop,
                            iconName: "gauge"
                        )
                        HeroTextField(
                            label: "NCT IOP LE (mmHg)",
                            placeholder: "15",
                            text: $clinicianViewModel.leftNctIop,
                            iconName: "gauge"
                        )
                    }
                }
            }
            
            // Diagnostic Ocular Investigations (Image 1)
            HeroCard {
                VStack(alignment: .leading, spacing: AppTheme.Layout.spacing10) {
                    Text("Ocular Investigations Ordered (Image 1)")
                        .font(AppTheme.Typography.font(for: .cardTitleSmall))
                        .foregroundColor(AppTheme.Colors.heroBlue)
                    
                    ForEach(OcularInvestigationOption.allCases, id: \.self) { opt in
                        Toggle(isOn: Binding(
                            get: { clinicianViewModel.ocularInvestigations.contains(opt) },
                            set: { on in
                                if on { clinicianViewModel.ocularInvestigations.insert(opt) }
                                else { clinicianViewModel.ocularInvestigations.remove(opt) }
                            }
                        )) {
                            Text(opt.rawValue).font(AppTheme.Typography.font(for: .bodyMedium))
                        }
                        .tint(AppTheme.Colors.heroBlue)
                    }
                }
            }
            
            // Vision Interventions Checklist
            HeroCard {
                VStack(alignment: .leading, spacing: AppTheme.Layout.spacing10) {
                    Text("Recommended Vision Interventions")
                        .font(AppTheme.Typography.font(for: .cardTitleSmall))
                    
                    ForEach(EyeInterventionOption.allCases, id: \.self) { opt in
                        Toggle(isOn: Binding(
                            get: { clinicianViewModel.visionInterventions.contains(opt) },
                            set: { isSelected in
                                if isSelected { clinicianViewModel.visionInterventions.insert(opt) }
                                else { clinicianViewModel.visionInterventions.remove(opt) }
                            }
                        )) {
                            Text(opt.rawValue).font(AppTheme.Typography.font(for: .bodyMedium))
                        }
                        .tint(AppTheme.Colors.heroOrange)
                    }
                }
            }
            
            HeroTextField(
                label: "Provisional Diagnosis",
                placeholder: "e.g. Myopic Astigmatism, Amblyopia OD",
                text: $clinicianViewModel.provisionalDiagnosis,
                iconName: "stethoscope"
            )
            
            HeroTextField(
                label: "Plan of Care / Interventions",
                placeholder: "Spectacle prescription, patching 2hrs/day...",
                text: $clinicianViewModel.planOfCare,
                iconName: "doc.text"
            )
        }
    }
    
    // MARK: - 1b. Refraction & Glasses Form (Image 5)
    private var refractionGlassesContent: some View {
        VStack(spacing: AppTheme.Layout.spacing16) {
            HeroFormSectionHeader(
                title: "Refraction & Glasses Prescription",
                subtitle: "Maxivision clinical optical records",
                iconName: "eyeglasses",
                accentColor: AppTheme.Colors.heroOrange
            )
            
            HeroCard {
                VStack(alignment: .leading, spacing: AppTheme.Layout.spacing12) {
                    HStack {
                        Text("Current Glasses Status:")
                            .font(AppTheme.Typography.font(for: .formLabel))
                        Spacer()
                        Picker("Status", selection: $clinicianViewModel.glassesStatus) {
                            ForEach(GlassesStatusState.allCases, id: \.self) { s in
                                Text(s.rawValue).tag(s)
                            }
                        }
                    }
                }
            }
            
            // Present Glasses Prescription
            HeroCard {
                VStack(alignment: .leading, spacing: AppTheme.Layout.spacing10) {
                    Text("Present Glasses Prescription")
                        .font(AppTheme.Typography.font(for: .cardTitleSmall))
                    
                    Text("Right Eye (OD)")
                        .font(AppTheme.Typography.font(for: .captionMedium))
                        .foregroundColor(AppTheme.Colors.heroOrange)
                    HStack(spacing: 8) {
                        HeroTextField(label: "SPH", placeholder: "-1.50", text: $clinicianViewModel.presentGlassesOd.sphere)
                        HeroTextField(label: "CYL", placeholder: "-0.50", text: $clinicianViewModel.presentGlassesOd.cylinder)
                        HeroTextField(label: "AXI", placeholder: "180", text: $clinicianViewModel.presentGlassesOd.axis)
                        HeroTextField(label: "ADD", placeholder: "", text: $clinicianViewModel.presentGlassesOd.add)
                        HeroTextField(label: "CVA", placeholder: "6/6", text: $clinicianViewModel.presentGlassesOd.cva)
                    }
                    
                    Divider().padding(.vertical, 4)
                    
                    Text("Left Eye (OS)")
                        .font(AppTheme.Typography.font(for: .captionMedium))
                        .foregroundColor(AppTheme.Colors.heroBlue)
                    HStack(spacing: 8) {
                        HeroTextField(label: "SPH", placeholder: "-1.75", text: $clinicianViewModel.presentGlassesOs.sphere)
                        HeroTextField(label: "CYL", placeholder: "-0.50", text: $clinicianViewModel.presentGlassesOs.cylinder)
                        HeroTextField(label: "AXI", placeholder: "175", text: $clinicianViewModel.presentGlassesOs.axis)
                        HeroTextField(label: "ADD", placeholder: "", text: $clinicianViewModel.presentGlassesOs.add)
                        HeroTextField(label: "CVA", placeholder: "6/6", text: $clinicianViewModel.presentGlassesOs.cva)
                    }
                }
            }
            
            // New Glasses Prescription
            HeroCard {
                VStack(alignment: .leading, spacing: AppTheme.Layout.spacing10) {
                    Text("New Glasses Prescription (Recommended)")
                        .font(AppTheme.Typography.font(for: .cardTitleSmall))
                        .foregroundColor(AppTheme.Colors.emerald)
                    
                    Text("Right Eye (OD)")
                        .font(AppTheme.Typography.font(for: .captionMedium))
                        .foregroundColor(AppTheme.Colors.heroOrange)
                    HStack(spacing: 8) {
                        HeroTextField(label: "UVA", placeholder: "6/18", text: $clinicianViewModel.newGlassesOd.uva)
                        HeroTextField(label: "SPH", placeholder: "-2.00", text: $clinicianViewModel.newGlassesOd.sphere)
                        HeroTextField(label: "CYL", placeholder: "-0.75", text: $clinicianViewModel.newGlassesOd.cylinder)
                        HeroTextField(label: "AXI", placeholder: "180", text: $clinicianViewModel.newGlassesOd.axis)
                        HeroTextField(label: "CVA", placeholder: "6/6", text: $clinicianViewModel.newGlassesOd.cva)
                    }
                    
                    Divider().padding(.vertical, 4)
                    
                    Text("Left Eye (OS)")
                        .font(AppTheme.Typography.font(for: .captionMedium))
                        .foregroundColor(AppTheme.Colors.heroBlue)
                    HStack(spacing: 8) {
                        HeroTextField(label: "UVA", placeholder: "6/24", text: $clinicianViewModel.newGlassesOs.uva)
                        HeroTextField(label: "SPH", placeholder: "-2.25", text: $clinicianViewModel.newGlassesOs.sphere)
                        HeroTextField(label: "CYL", placeholder: "-0.75", text: $clinicianViewModel.newGlassesOs.cylinder)
                        HeroTextField(label: "AXI", placeholder: "175", text: $clinicianViewModel.newGlassesOs.axis)
                        HeroTextField(label: "CVA", placeholder: "6/6", text: $clinicianViewModel.newGlassesOs.cva)
                    }
                }
            }
        }
    }
    
    // MARK: - 2. Dental Form Content
    private var dentalFormContent: some View {
        VStack(spacing: AppTheme.Layout.spacing16) {
            HeroFormSectionHeader(
                title: "Pediatric Dental Examination",
                subtitle: "dmft index, caries, oral hygiene, & occlusion",
                iconName: "mouth.fill",
                accentColor: AppTheme.Colors.heroOrange
            )
            
            HeroCard {
                VStack(alignment: .leading, spacing: AppTheme.Layout.spacing12) {
                    Text("Tooth Index (dmft / DMFT)")
                        .font(AppTheme.Typography.font(for: .cardTitleSmall))
                    
                    HStack(spacing: 12) {
                        HeroTextField(label: "Decayed", placeholder: "0", text: $clinicianViewModel.cariesCount)
                        HeroTextField(label: "Missing", placeholder: "0", text: $clinicianViewModel.missingCount)
                        HeroTextField(label: "Filled", placeholder: "0", text: $clinicianViewModel.filledCount)
                    }
                    
                    Divider().padding(.vertical, 4)
                    
                    HStack {
                        Text("Dental Caries Severity:")
                            .font(AppTheme.Typography.font(for: .formLabel))
                        Spacer()
                        Picker("Caries", selection: $clinicianViewModel.dentalCaries) {
                            ForEach(DentalCariesState.allCases, id: \.self) { c in
                                Text(c.rawValue).tag(c)
                            }
                        }
                    }
                    
                    HStack {
                        Text("Oral Hygiene Grade:")
                            .font(AppTheme.Typography.font(for: .formLabel))
                        Spacer()
                        Picker("Hygiene", selection: $clinicianViewModel.dentalHygiene) {
                            ForEach(OralHygieneState.allCases, id: \.self) { h in
                                Text(h.rawValue).tag(h)
                            }
                        }
                    }
                    
                    HStack {
                        Text("Dental Fluorosis Stage:")
                            .font(AppTheme.Typography.font(for: .formLabel))
                        Spacer()
                        Picker("Fluorosis", selection: $clinicianViewModel.dentalFluorosis) {
                            ForEach(FluorosisState.allCases, id: \.self) { f in
                                Text(f.rawValue).tag(f)
                            }
                        }
                    }
                    
                    HStack {
                        Text("Occlusion & Alignment:")
                            .font(AppTheme.Typography.font(for: .formLabel))
                        Spacer()
                        Picker("Occlusion", selection: $clinicianViewModel.dentalOcclusion) {
                            ForEach(OcclusionState.allCases, id: \.self) { o in
                                Text(o.rawValue).tag(o)
                            }
                        }
                    }
                    
                    Toggle("Active Toothache / Pain", isOn: $clinicianViewModel.dentalPain)
                        .tint(AppTheme.Colors.coralRed)
                    Toggle("Thermal Sensitivity (Hot / Cold)", isOn: $clinicianViewModel.dentalSensitivity)
                        .tint(AppTheme.Colors.heroOrange)
                    Toggle("Chipped / Fractured Tooth", isOn: $clinicianViewModel.dentalTrauma)
                        .tint(AppTheme.Colors.coralRed)
                    Toggle("Stains / Tartar / Calculus Noted", isOn: $clinicianViewModel.stainsTartar)
                        .tint(AppTheme.Colors.heroOrange)
                }
            }
            
            // Dental Treatments
            HeroCard {
                VStack(alignment: .leading, spacing: AppTheme.Layout.spacing10) {
                    Text("Recommended Dental Interventions")
                        .font(AppTheme.Typography.font(for: .cardTitleSmall))
                    
                    ForEach(DentalInterventionOption.allCases, id: \.self) { opt in
                        Toggle(isOn: Binding(
                            get: { clinicianViewModel.dentalInterventions.contains(opt) },
                            set: { on in
                                if on { clinicianViewModel.dentalInterventions.insert(opt) }
                                else { clinicianViewModel.dentalInterventions.remove(opt) }
                            }
                        )) {
                            Text(opt.rawValue).font(AppTheme.Typography.font(for: .bodyMedium))
                        }
                        .tint(AppTheme.Colors.heroOrange)
                    }
                }
            }
        }
    }
    
    // MARK: - 3. ENT Form Content
    private var entFormContent: some View {
        VStack(spacing: AppTheme.Layout.spacing16) {
            HeroFormSectionHeader(
                title: "Ear, Nose & Throat Examination",
                subtitle: "Otoscopy, audiometry, septum & tonsils",
                iconName: "ear.fill",
                accentColor: AppTheme.Colors.heroBlue
            )
            
            HeroCard {
                VStack(alignment: .leading, spacing: AppTheme.Layout.spacing12) {
                    HStack {
                        Text("Right Ear Otoscopy:")
                            .font(AppTheme.Typography.font(for: .formLabel))
                        Spacer()
                        Picker("Right Ear", selection: $clinicianViewModel.rightEarOtoscopy) {
                            ForEach(EarState.allCases, id: \.self) { e in
                                Text(e.rawValue).tag(e)
                            }
                        }
                    }
                    
                    HStack {
                        Text("Left Ear Otoscopy:")
                            .font(AppTheme.Typography.font(for: .formLabel))
                        Spacer()
                        Picker("Left Ear", selection: $clinicianViewModel.leftEarOtoscopy) {
                            ForEach(EarState.allCases, id: \.self) { e in
                                Text(e.rawValue).tag(e)
                            }
                        }
                    }
                    
                    HStack {
                        Text("Hearing Screening:")
                            .font(AppTheme.Typography.font(for: .formLabel))
                        Spacer()
                        Picker("Hearing", selection: $clinicianViewModel.hearingTest) {
                            ForEach(HearingState.allCases, id: \.self) { h in
                                Text(h.rawValue).tag(h)
                            }
                        }
                    }
                    
                    HStack {
                        Text("Nasal Cavity & Septum:")
                            .font(AppTheme.Typography.font(for: .formLabel))
                        Spacer()
                        Picker("Nasal", selection: $clinicianViewModel.nasalPassage) {
                            ForEach(NasalState.allCases, id: \.self) { n in
                                Text(n.rawValue).tag(n)
                            }
                        }
                    }
                    
                    HStack {
                        Text("Throat & Tonsils:")
                            .font(AppTheme.Typography.font(for: .formLabel))
                        Spacer()
                        Picker("Throat", selection: $clinicianViewModel.throatTonsils) {
                            ForEach(ThroatState.allCases, id: \.self) { t in
                                Text(t.rawValue).tag(t)
                            }
                        }
                    }
                    
                    HStack {
                        Text("Speech & Voice:")
                            .font(AppTheme.Typography.font(for: .formLabel))
                        Spacer()
                        Picker("Speech", selection: $clinicianViewModel.speechVoice) {
                            ForEach(SpeechVoiceState.allCases, id: \.self) { s in
                                Text(s.rawValue).tag(s)
                            }
                        }
                    }
                }
            }
            
            HeroCard {
                VStack(alignment: .leading, spacing: AppTheme.Layout.spacing10) {
                    Text("Recommended ENT Care")
                        .font(AppTheme.Typography.font(for: .cardTitleSmall))
                    
                    ForEach(EntInterventionOption.allCases, id: \.self) { opt in
                        Toggle(isOn: Binding(
                            get: { clinicianViewModel.entInterventions.contains(opt) },
                            set: { on in
                                if on { clinicianViewModel.entInterventions.insert(opt) }
                                else { clinicianViewModel.entInterventions.remove(opt) }
                            }
                        )) {
                            Text(opt.rawValue).font(AppTheme.Typography.font(for: .bodyMedium))
                        }
                        .tint(AppTheme.Colors.heroBlue)
                    }
                }
            }
        }
    }
    
    // MARK: - 4. Dermatology & Hemoglobin Form
    private var dermatologyHbFormContent: some View {
        VStack(spacing: AppTheme.Layout.spacing16) {
            HeroFormSectionHeader(
                title: "Dermatology & Anemia Evaluation",
                subtitle: "Skin conditions, pallor, & blood Hb test",
                iconName: "cross.vial.fill",
                accentColor: AppTheme.Colors.purple
            )
            
            HeroCard {
                VStack(alignment: .leading, spacing: AppTheme.Layout.spacing12) {
                    HStack {
                        Text("Skin Condition:")
                            .font(AppTheme.Typography.font(for: .formLabel))
                        Spacer()
                        Picker("Skin", selection: $clinicianViewModel.skinCondition) {
                            ForEach(SkinState.allCases, id: \.self) { s in
                                Text(s.rawValue).tag(s)
                            }
                        }
                    }
                    
                    HStack {
                        Text("Distribution / Site:")
                            .font(AppTheme.Typography.font(for: .formLabel))
                        Spacer()
                        Picker("Location", selection: $clinicianViewModel.skinLocation) {
                            ForEach(SkinLocationState.allCases, id: \.self) { l in
                                Text(l.rawValue).tag(l)
                            }
                        }
                    }
                    
                    HStack {
                        Text("Pruritus / Parasites:")
                            .font(AppTheme.Typography.font(for: .formLabel))
                        Spacer()
                        Picker("Pruritus", selection: $clinicianViewModel.pruritusParasitic) {
                            ForEach(PruritusState.allCases, id: \.self) { p in
                                Text(p.rawValue).tag(p)
                            }
                        }
                    }
                    
                    Toggle("Active Pruritus / Itching", isOn: $clinicianViewModel.itchingActive)
                        .tint(AppTheme.Colors.purple)
                    Toggle("Pediculosis Capitis / Head Lice", isOn: $clinicianViewModel.headLiceActive)
                        .tint(AppTheme.Colors.purple)
                }
            }
            
            HeroCard {
                VStack(alignment: .leading, spacing: AppTheme.Layout.spacing12) {
                    Text("Anaemia & Haemoglobin Screening")
                        .font(AppTheme.Typography.font(for: .cardTitleSmall))
                    
                    HeroTextField(
                        label: "Hemoglobin Level (g/dL)",
                        placeholder: "12.5",
                        text: $clinicianViewModel.hemoglobinLevel,
                        iconName: "drop.fill"
                    )
                    
                    HStack {
                        Text("Clinical Pallor Sign:")
                            .font(AppTheme.Typography.font(for: .formLabel))
                        Spacer()
                        Picker("Pallor", selection: $clinicianViewModel.pallorSign) {
                            ForEach(PallorSignState.allCases, id: \.self) { p in
                                Text(p.rawValue).tag(p)
                            }
                        }
                    }
                    
                    HStack {
                        Text("Anemia Severity:")
                            .font(AppTheme.Typography.font(for: .formLabel))
                        Spacer()
                        Picker("Anemia", selection: $clinicianViewModel.anemiaSeverity) {
                            ForEach(AnemiaState.allCases, id: \.self) { a in
                                Text(a.rawValue).tag(a)
                            }
                        }
                    }
                }
            }
        }
    }
    
    // MARK: - 5. Spine & Vaccine Form
    private var spineVaccineFormContent: some View {
        VStack(spacing: AppTheme.Layout.spacing16) {
            HeroFormSectionHeader(
                title: "Spine Posture & Immunization",
                subtitle: "Musculoskeletal alignment & routine vaccines",
                iconName: "figure.walk",
                accentColor: AppTheme.Colors.emerald
            )
            
            HeroCard {
                VStack(alignment: .leading, spacing: AppTheme.Layout.spacing12) {
                    HStack {
                        Text("Spine Alignment:")
                            .font(AppTheme.Typography.font(for: .formLabel))
                        Spacer()
                        Picker("Spine", selection: $clinicianViewModel.spinePosture) {
                            ForEach(SpineState.allCases, id: \.self) { s in
                                Text(s.rawValue).tag(s)
                            }
                        }
                    }
                    
                    HStack {
                        Text("Gait & Lower Limb:")
                            .font(AppTheme.Typography.font(for: .formLabel))
                        Spacer()
                        Picker("Gait", selection: $clinicianViewModel.gaitLimb) {
                            ForEach(GaitLimbState.allCases, id: \.self) { g in
                                Text(g.rawValue).tag(g)
                            }
                        }
                    }
                    
                    Toggle("Joint Pain / Tenderness / Swelling", isOn: $clinicianViewModel.jointPain)
                        .tint(AppTheme.Colors.emerald)
                    Toggle("Restricted Range of Motion", isOn: $clinicianViewModel.restrictedMotion)
                        .tint(AppTheme.Colors.emerald)
                }
            }
            
            HeroCard {
                VStack(alignment: .leading, spacing: AppTheme.Layout.spacing12) {
                    Text("Immunization Status Review")
                        .font(AppTheme.Typography.font(for: .cardTitleSmall))
                    
                    HStack {
                        Text("Overall Status for Age:")
                            .font(AppTheme.Typography.font(for: .formLabel))
                        Spacer()
                        Picker("Vaccine Status", selection: $clinicianViewModel.vaccineStatus) {
                            ForEach(VaccineStatusState.allCases, id: \.self) { v in
                                Text(v.rawValue).tag(v)
                            }
                        }
                    }
                    
                    Toggle("Vaccinations Fully Up To Date", isOn: $clinicianViewModel.vaccinationUpToDate)
                        .tint(AppTheme.Colors.emerald)
                    
                    if !clinicianViewModel.vaccinationUpToDate {
                        Text("Select Missed Routine Vaccines:")
                            .font(AppTheme.Typography.font(for: .formLabel))
                            .padding(.top, 4)
                        
                        ForEach(MissedVaccineOption.allCases, id: \.self) { v in
                            Toggle(isOn: Binding(
                                get: { clinicianViewModel.missingVaccines.contains(v) },
                                set: { on in
                                    if on { clinicianViewModel.missingVaccines.insert(v) }
                                    else { clinicianViewModel.missingVaccines.remove(v) }
                                }
                            )) {
                                Text(v.rawValue).font(AppTheme.Typography.font(for: .bodyMedium))
                            }
                            .tint(AppTheme.Colors.heroOrange)
                        }
                    }
                }
            }
        }
    }
    
    // MARK: - 6. Pediatric History & Diagnostic Investigations (Images 1, 2, 5)
    private var historyInvestFormContent: some View {
        VStack(spacing: AppTheme.Layout.spacing16) {
            HeroFormSectionHeader(
                title: "Perinatal & Systemic History",
                subtitle: "Birth history, chronic illness & allergies",
                iconName: "list.bullet.clipboard.fill",
                accentColor: AppTheme.Colors.heroBlue
            )
            
            // Image 2: Birth History
            HeroCard {
                VStack(alignment: .leading, spacing: AppTheme.Layout.spacing12) {
                    Text("Birth & Perinatal History (Image 2)")
                        .font(AppTheme.Typography.font(for: .cardTitleSmall))
                    
                    HStack {
                        Text("Gestational Status:")
                            .font(AppTheme.Typography.font(for: .formLabel))
                        Spacer()
                        Picker("Term", selection: $clinicianViewModel.gestationalAge) {
                            ForEach(GestationalState.allCases, id: \.self) { g in
                                Text(g.rawValue).tag(g)
                            }
                        }
                    }
                    
                    HeroTextField(
                        label: "Birth Weight (kg)",
                        placeholder: "3.0",
                        text: $clinicianViewModel.birthWeightKg,
                        iconName: "scalemass"
                    )
                    
                    Toggle("Incubation / NICU Stay Required", isOn: $clinicianViewModel.incubationStay)
                        .tint(AppTheme.Colors.heroOrange)
                    
                    HStack {
                        Text("Consanguinity:")
                            .font(AppTheme.Typography.font(for: .formLabel))
                        Spacer()
                        Picker("Consanguinity", selection: $clinicianViewModel.consanguinity) {
                            ForEach(ConsanguinityState.allCases, id: \.self) { c in
                                Text(c.rawValue).tag(c)
                            }
                        }
                    }
                    
                    HStack {
                        Text("Parental Myopia:")
                            .font(AppTheme.Typography.font(for: .formLabel))
                        Spacer()
                        Picker("Parental Myopia", selection: $clinicianViewModel.parentalMyopia) {
                            ForEach(ParentalMyopiaState.allCases, id: \.self) { p in
                                Text(p.rawValue).tag(p)
                            }
                        }
                    }
                }
            }
            
            // Image 2 & 5: Systemic Diseases & Allergies
            HeroCard {
                VStack(alignment: .leading, spacing: AppTheme.Layout.spacing10) {
                    Text("Systemic Health Issues (Images 2 & 5)")
                        .font(AppTheme.Typography.font(for: .cardTitleSmall))
                    
                    ForEach(SystemicDiseaseOption.allCases, id: \.self) { d in
                        Toggle(isOn: Binding(
                            get: { clinicianViewModel.systemicDiseases.contains(d) },
                            set: { on in
                                if on { clinicianViewModel.systemicDiseases.insert(d) }
                                else { clinicianViewModel.systemicDiseases.remove(d) }
                            }
                        )) {
                            Text(d.rawValue).font(AppTheme.Typography.font(for: .bodyMedium))
                        }
                        .tint(AppTheme.Colors.heroOrange)
                    }
                    
                    Divider().padding(.vertical, 4)
                    
                    Text("Drug Allergies (Image 5)")
                        .font(AppTheme.Typography.font(for: .cardTitleSmall))
                    
                    ForEach(DrugAllergyOption.allCases, id: \.self) { a in
                        Toggle(isOn: Binding(
                            get: { clinicianViewModel.drugAllergies.contains(a) },
                            set: { on in
                                if on { clinicianViewModel.drugAllergies.insert(a) }
                                else { clinicianViewModel.drugAllergies.remove(a) }
                            }
                        )) {
                            Text(a.rawValue).font(AppTheme.Typography.font(for: .bodyMedium))
                        }
                        .tint(AppTheme.Colors.coralRed)
                    }
                    
                    Divider().padding(.vertical, 4)
                    
                    HStack {
                        Text("Nutritional Status:")
                            .font(AppTheme.Typography.font(for: .formLabel))
                        Spacer()
                        Picker("Nutrition", selection: $clinicianViewModel.nutritionalStatus) {
                            ForEach(NutritionalState.allCases, id: \.self) { n in
                                Text(n.rawValue).tag(n)
                            }
                        }
                    }
                }
            }
            
            // Image 1: General & Specialist Investigations
            HeroFormSectionHeader(
                title: "Diagnostic Lab Investigations Order",
                subtitle: "Maxivision clinical pathology test requisition",
                iconName: "doc.plaintext.fill",
                accentColor: AppTheme.Colors.purple
            )
            
            HeroCard {
                VStack(alignment: .leading, spacing: AppTheme.Layout.spacing10) {
                    Text("Routine Blood & Urine Tests (Image 1)")
                        .font(AppTheme.Typography.font(for: .cardTitleSmall))
                        .foregroundColor(AppTheme.Colors.purple)
                    
                    ForEach(GeneralLabInvestigationOption.allCases, id: \.self) { lab in
                        Toggle(isOn: Binding(
                            get: { clinicianViewModel.orderedGeneralLabs.contains(lab) },
                            set: { on in
                                if on { clinicianViewModel.orderedGeneralLabs.insert(lab) }
                                else { clinicianViewModel.orderedGeneralLabs.remove(lab) }
                            }
                        )) {
                            Text(lab.rawValue).font(AppTheme.Typography.font(for: .bodyMedium))
                        }
                        .tint(AppTheme.Colors.purple)
                    }
                }
            }
            
            HeroCard {
                VStack(alignment: .leading, spacing: AppTheme.Layout.spacing10) {
                    Text("Additional Specialist & Imaging Tests (Image 1)")
                        .font(AppTheme.Typography.font(for: .cardTitleSmall))
                        .foregroundColor(AppTheme.Colors.heroBlue)
                    
                    ForEach(AdditionalTestOption.allCases, id: \.self) { test in
                        Toggle(isOn: Binding(
                            get: { clinicianViewModel.orderedSpecialistTests.contains(test) },
                            set: { on in
                                if on { clinicianViewModel.orderedSpecialistTests.insert(test) }
                                else { clinicianViewModel.orderedSpecialistTests.remove(test) }
                            }
                        )) {
                            Text(test.rawValue).font(AppTheme.Typography.font(for: .bodyMedium))
                        }
                        .tint(AppTheme.Colors.heroBlue)
                    }
                }
            }
        }
    }
    
    // MARK: - 7. Assessment & Referral Summary
    private var summaryAssessmentContent: some View {
        VStack(spacing: AppTheme.Layout.spacing16) {
            HeroFormSectionHeader(
                title: "Clinical Risk & Referral Dispatch",
                subtitle: "Final diagnostic summary & physician sign-off",
                iconName: "checkmark.seal.fill",
                accentColor: AppTheme.Colors.heroOrange
            )
            
            HeroCard {
                VStack(alignment: .leading, spacing: AppTheme.Layout.spacing12) {
                    HStack {
                        Text("Overall Clinical Risk:")
                            .font(AppTheme.Typography.font(for: .formLabel))
                        Spacer()
                        Picker("Risk", selection: $clinicianViewModel.overallRiskLevel) {
                            ForEach(ClinicalRiskLevel.allCases, id: \.self) { r in
                                Text(r.rawValue).tag(r)
                            }
                        }
                    }
                    
                    HStack {
                        Text("Referral Specialty:")
                            .font(AppTheme.Typography.font(for: .formLabel))
                        Spacer()
                        Picker("Referral", selection: $clinicianViewModel.referralSpecialty) {
                            ForEach(ReferralSpecialtyOption.allCases, id: \.self) { r in
                                Text(r.rawValue).tag(r)
                            }
                        }
                    }
                    
                    HeroTextField(
                        label: "Final Clinical Diagnosis",
                        placeholder: "e.g. Myopic Astigmatism OD/OS, Dental Caries",
                        text: $clinicianViewModel.finalDiagnosis,
                        iconName: "cross.fill"
                    )
                    
                    HeroTextField(
                        label: "Doctor Clinical Recommendations",
                        placeholder: "Spectacle prescription, dental restoration, catch-up MMR...",
                        text: $clinicianViewModel.clinicalRecommendations,
                        iconName: "text.alignleft"
                    )
                }
            }
        }
    }
    
    private func advanceToNextTab() {
        switch clinicianViewModel.selectedSpecialtyTab {
        case .vision: clinicianViewModel.selectedSpecialtyTab = .refraction
        case .refraction: clinicianViewModel.selectedSpecialtyTab = .dental
        case .dental: clinicianViewModel.selectedSpecialtyTab = .ent
        case .ent: clinicianViewModel.selectedSpecialtyTab = .dermatology
        case .dermatology: clinicianViewModel.selectedSpecialtyTab = .spineVaccine
        case .spineVaccine: clinicianViewModel.selectedSpecialtyTab = .historyInvest
        case .historyInvest: clinicianViewModel.selectedSpecialtyTab = .summary
        case .summary: break
        }
    }
}
