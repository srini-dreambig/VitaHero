import Foundation
import Combine
import SwiftUI

/// ClinicianViewModel manages clinical pediatric roster, multi-specialty screening, and instant sync.
@MainActor
final class ClinicianViewModel: ObservableObject {
    // MARK: - Roster State
    @Published var students: [ClinicianStudentDto] = []
    @Published var selectedStudent: ClinicianStudentDto? = nil
    @Published var searchQuery: String = ""
    @Published var selectedFilter: ScreeningFilter = .all
    @Published var selectedSpecialtyTab: SpecialtyTab = .vision
    @Published var isLoadingRoster: Bool = false
    @Published var isSubmittingRecord: Bool = false
    @Published var submissionSuccessMessage: String? = nil
    @Published var errorMessage: String? = nil
    
    // MARK: - Clinical Screening Examination Form State
    
    // 1. Pediatric Ophthalmology (Bilateral OD / OS) - Images 1, 3, 4, 5
    @Published var odAcuity: SnellenAcuity = .sixSix
    @Published var osAcuity: SnellenAcuity = .sixSix
    @Published var odNearVision: NearVisionAcuity = .n6
    @Published var osNearVision: NearVisionAcuity = .n6
    @Published var testingCondition: VisualTestingCondition = .unaided
    
    @Published var odLashes: EyeLashesState = .normal
    @Published var osLashes: EyeLashesState = .normal
    @Published var odLids: EyeLidsState = .normal
    @Published var osLids: EyeLidsState = .normal
    @Published var odConjunctiva: EyeConjunctivaState = .normal
    @Published var osConjunctiva: EyeConjunctivaState = .normal
    @Published var odSclera: EyeScleraState = .normal
    @Published var osSclera: EyeScleraState = .normal
    @Published var odCornea: EyeCorneaState = .clear
    @Published var osCornea: EyeCorneaState = .clear
    @Published var odAc: EyeAnteriorChamberState = .normal
    @Published var osAc: EyeAnteriorChamberState = .normal
    @Published var odIris: EyeIrisState = .normal
    @Published var osIris: EyeIrisState = .normal
    @Published var odPupil: EyePupilState = .normal3mm
    @Published var osPupil: EyePupilState = .normal3mm
    @Published var odLens: EyeLensState = .clear
    @Published var osLens: EyeLensState = .clear
    
    // Posterior Segment / Fundus Examination (Image 4)
    @Published var odVitreous: PosteriorVitreousState = .clear
    @Published var osVitreous: PosteriorVitreousState = .clear
    @Published var odOpticDisc: OpticDiscState = .normalPink
    @Published var osOpticDisc: OpticDiscState = .normalPink
    @Published var odMacula: MaculaState = .normalFoveal
    @Published var osMacula: MaculaState = .normalFoveal
    @Published var odRetina: RetinaState = .normal
    @Published var osRetina: RetinaState = .normal
    @Published var odBloodVessels: EyeBloodVesselsState = .normal
    @Published var osBloodVessels: EyeBloodVesselsState = .normal
    
    // Alignment, Motility, Tonometry & Color Vision (Images 3, 4, 5)
    @Published var ocularMotility: OcularMotilityState = .full
    @Published var squintAlignment: SquintState = .normalOrthophoria
    @Published var colorVision: IshiharaColorVisionState = .normalPass
    @Published var gonioscopy: GonioscopyState = .grade4Open
    @Published var dominantEye: DominantEyeState = .right
    @Published var dilatation: DilatationState = .no
    @Published var dilatationTime: String = ""
    @Published var glassesStatus: GlassesStatusState = .none
    
    @Published var rightNctIop: String = "15"
    @Published var leftNctIop: String = "15"
    @Published var rightApplanationIop: String = ""
    @Published var leftApplanationIop: String = ""
    
    @Published var externalSigns: Set<String> = []
    
    // Present & New Glasses Prescriptions (Image 5)
    @Published var presentGlassesOd = GlassesPrescriptionDto()
    @Published var presentGlassesOs = GlassesPrescriptionDto()
    @Published var newGlassesOd = GlassesPrescriptionDto()
    @Published var newGlassesOs = GlassesPrescriptionDto()
    
    // Ocular Diagnostic Investigations Ordered (Image 1)
    @Published var ocularInvestigations: Set<OcularInvestigationOption> = []
    @Published var visionInterventions: Set<EyeInterventionOption> = []
    
    @Published var provisionalDiagnosis: String = ""
    @Published var planOfCare: String = ""
    @Published var finalDiagnosis: String = ""
    @Published var visionNotes: String = ""
    
    // 2. Dental Screening
    @Published var cariesCount: String = "0"
    @Published var missingCount: String = "0"
    @Published var filledCount: String = "0"
    @Published var dentalCaries: DentalCariesState = .none
    @Published var dentalHygiene: OralHygieneState = .good
    @Published var dentalFluorosis: FluorosisState = .none
    @Published var dentalOcclusion: OcclusionState = .normalClassI
    @Published var dentalPain: Bool = false
    @Published var dentalSensitivity: Bool = false
    @Published var dentalTrauma: Bool = false
    @Published var stainsTartar: Bool = false
    @Published var dentalHabits: Set<String> = []
    @Published var dentalInterventions: Set<DentalInterventionOption> = []
    @Published var dentalNotes: String = ""
    
    // 3. ENT Screening
    @Published var rightEarOtoscopy: EarState = .normal
    @Published var leftEarOtoscopy: EarState = .normal
    @Published var rightHearingAcuity: HearingState = .passed
    @Published var leftHearingAcuity: HearingState = .passed
    @Published var hearingTest: HearingState = .passed
    @Published var nasalPassage: NasalState = .clear
    @Published var throatTonsils: ThroatState = .normal
    @Published var speechVoice: SpeechVoiceState = .normal
    @Published var entInterventions: Set<EntInterventionOption> = []
    @Published var entNotes: String = ""
    
    // 4. Dermatology & General Health
    @Published var skinCondition: SkinState = .healthy
    @Published var skinLocation: SkinLocationState = .generalized
    @Published var pruritusParasitic: PruritusState = .absent
    @Published var itchingActive: Bool = false
    @Published var headLiceActive: Bool = false
    @Published var skinInterventions: Set<SkinInterventionOption> = []
    @Published var skinLesionDescription: String = ""
    
    // 5. Spine & Musculoskeletal
    @Published var spinePosture: SpineState = .normal
    @Published var gaitLimb: GaitLimbState = .normal
    @Published var jointPain: Bool = false
    @Published var restrictedMotion: Bool = false
    @Published var spineInterventions: Set<SpineInterventionOption> = []
    
    // 6. Haemoglobin & Immunisation
    @Published var hemoglobinLevel: String = "12.5"
    @Published var pallorSign: PallorSignState = .none
    @Published var anemiaSeverity: AnemiaState = .normal
    @Published var hbInterventions: Set<AnemiaInterventionOption> = []
    @Published var vaccineStatus: VaccineStatusState = .upToDate
    @Published var vaccinationUpToDate: Bool = true
    @Published var missingVaccines: Set<MissedVaccineOption> = []
    @Published var vaccineInterventions: Set<VaccineInterventionOption> = []
    
    // 7. Pediatric Systemic & Birth History & Investigations (Images 1, 2, 5)
    @Published var gestationalAge: GestationalState = .fullTerm
    @Published var birthWeightKg: String = "3.1"
    @Published var incubationStay: Bool = false
    @Published var consanguinity: ConsanguinityState = .nonConsanguineous
    @Published var parentalMyopia: ParentalMyopiaState = .none
    @Published var systemicDiseases: Set<SystemicDiseaseOption> = []
    @Published var drugAllergies: Set<DrugAllergyOption> = []
    @Published var currentTreatments: Set<TreatmentMedicationOption> = []
    @Published var nutritionalStatus: NutritionalState = .normal
    @Published var orderedGeneralLabs: Set<GeneralLabInvestigationOption> = []
    @Published var orderedSpecialistTests: Set<AdditionalTestOption> = []
    
    // 8. Final Clinical Assessment & Referral
    @Published var overallRiskLevel: ClinicalRiskLevel = .low
    @Published var referralSpecialty: ReferralSpecialtyOption = .none
    @Published var clinicalRecommendations: String = ""
    
    private let apiService: ApiService
    private var cancellables = Set<AnyCancellable>()
    
    init(apiService: ApiService = .shared) {
        self.apiService = apiService
        loadRoster()
    }
    
    // MARK: - Enums & Filters
    enum ScreeningFilter: String, CaseIterable, Identifiable {
        case all = "All Students"
        case pending = "Pending"
        case completed = "Completed"
        case referred = "Referred"
        
        var id: String { rawValue }
    }
    
    enum SpecialtyTab: String, CaseIterable, Identifiable {
        case vision = "Vision"
        case refraction = "Refraction & Glasses"
        case dental = "Dental"
        case ent = "ENT"
        case dermatology = "Skin & Hb"
        case spineVaccine = "Spine & Vaccines"
        case historyInvest = "History & Labs"
        case summary = "Assessment"
        
        var id: String { rawValue }
        
        var icon: String {
            switch self {
            case .vision: return "eye.fill"
            case .refraction: return "eyeglasses"
            case .dental: return "mouth.fill"
            case .ent: return "ear.fill"
            case .dermatology: return "cross.vial.fill"
            case .spineVaccine: return "figure.walk"
            case .historyInvest: return "list.bullet.clipboard.fill"
            case .summary: return "checkmark.seal.fill"
            }
        }
    }
    
    // MARK: - Filtered Students
    var filteredStudents: [ClinicianStudentDto] {
        students.filter { student in
            let matchesQuery = searchQuery.isEmpty ||
                student.studentName.localizedCaseInsensitiveContains(searchQuery) ||
                student.rollNumber.localizedCaseInsensitiveContains(searchQuery) ||
                student.schoolName.localizedCaseInsensitiveContains(searchQuery)
            
            let matchesFilter: Bool
            switch selectedFilter {
            case .all: matchesFilter = true
            case .pending: matchesFilter = student.status == .pending
            case .completed: matchesFilter = student.status == .completed
            case .referred: matchesFilter = student.status == .referred
            }
            
            return matchesQuery && matchesFilter
        }
    }
    
    // MARK: - Methods
    func loadRoster() {
        isLoadingRoster = true
        Task {
            do {
                let fetched = try await apiService.fetchClinicianRoster()
                self.students = fetched
                self.isLoadingRoster = false
            } catch {
                self.errorMessage = error.localizedDescription
                self.isLoadingRoster = false
            }
        }
    }
    
    func selectStudent(_ student: ClinicianStudentDto) {
        self.selectedStudent = student
        resetFormState()
    }
    
    func resetFormState() {
        odAcuity = .sixSix
        osAcuity = .sixSix
        odNearVision = .n6
        osNearVision = .n6
        testingCondition = .unaided
        
        odLashes = .normal
        osLashes = .normal
        odLids = .normal
        osLids = .normal
        odConjunctiva = .normal
        osConjunctiva = .normal
        odSclera = .normal
        osSclera = .normal
        odCornea = .clear
        osCornea = .clear
        odAc = .normal
        osAc = .normal
        odIris = .normal
        osIris = .normal
        odPupil = .normal3mm
        osPupil = .normal3mm
        odLens = .clear
        osLens = .clear
        
        odVitreous = .clear
        osVitreous = .clear
        odOpticDisc = .normalPink
        osOpticDisc = .normalPink
        odMacula = .normalFoveal
        osMacula = .normalFoveal
        odRetina = .normal
        osRetina = .normal
        odBloodVessels = .normal
        osBloodVessels = .normal
        
        ocularMotility = .full
        squintAlignment = .normalOrthophoria
        colorVision = .normalPass
        gonioscopy = .grade4Open
        dominantEye = .right
        dilatation = .no
        dilatationTime = ""
        glassesStatus = .none
        
        rightNctIop = "15"
        leftNctIop = "15"
        rightApplanationIop = ""
        leftApplanationIop = ""
        
        externalSigns.removeAll()
        presentGlassesOd = GlassesPrescriptionDto()
        presentGlassesOs = GlassesPrescriptionDto()
        newGlassesOd = GlassesPrescriptionDto()
        newGlassesOs = GlassesPrescriptionDto()
        ocularInvestigations.removeAll()
        visionInterventions.removeAll()
        provisionalDiagnosis = ""
        planOfCare = ""
        finalDiagnosis = ""
        visionNotes = ""
        
        cariesCount = "0"
        missingCount = "0"
        filledCount = "0"
        dentalCaries = .none
        dentalHygiene = .good
        dentalFluorosis = .none
        dentalOcclusion = .normalClassI
        dentalPain = false
        dentalSensitivity = false
        dentalTrauma = false
        stainsTartar = false
        dentalHabits.removeAll()
        dentalInterventions.removeAll()
        dentalNotes = ""
        
        rightEarOtoscopy = .normal
        leftEarOtoscopy = .normal
        rightHearingAcuity = .passed
        leftHearingAcuity = .passed
        hearingTest = .passed
        nasalPassage = .clear
        throatTonsils = .normal
        speechVoice = .normal
        entInterventions.removeAll()
        entNotes = ""
        
        skinCondition = .healthy
        skinLocation = .generalized
        pruritusParasitic = .absent
        itchingActive = false
        headLiceActive = false
        skinInterventions.removeAll()
        skinLesionDescription = ""
        
        spinePosture = .normal
        gaitLimb = .normal
        jointPain = false
        restrictedMotion = false
        spineInterventions.removeAll()
        
        hemoglobinLevel = "12.5"
        pallorSign = .none
        anemiaSeverity = .normal
        hbInterventions.removeAll()
        vaccineStatus = .upToDate
        vaccinationUpToDate = true
        missingVaccines.removeAll()
        vaccineInterventions.removeAll()
        
        gestationalAge = .fullTerm
        birthWeightKg = "3.1"
        incubationStay = false
        consanguinity = .nonConsanguineous
        parentalMyopia = .none
        systemicDiseases.removeAll()
        drugAllergies.removeAll()
        currentTreatments.removeAll()
        nutritionalStatus = .normal
        orderedGeneralLabs.removeAll()
        orderedSpecialistTests.removeAll()
        
        overallRiskLevel = .low
        referralSpecialty = .none
        clinicalRecommendations = ""
        submissionSuccessMessage = nil
    }
    
    func submitScreeningRecord() async -> Bool {
        guard let student = selectedStudent else { return false }
        isSubmittingRecord = true
        errorMessage = nil
        
        let visionRecord = VisionScreeningDto(
            odLashes: odLashes.rawValue,
            osLashes: osLashes.rawValue,
            odLids: odLids.rawValue,
            osLids: osLids.rawValue,
            odConjunctiva: odConjunctiva.rawValue,
            osConjunctiva: osConjunctiva.rawValue,
            odSclera: odSclera.rawValue,
            osSclera: osSclera.rawValue,
            odCornea: odCornea.rawValue,
            osCornea: osCornea.rawValue,
            odAc: odAc.rawValue,
            osAc: osAc.rawValue,
            odIris: odIris.rawValue,
            osIris: osIris.rawValue,
            odPupil: odPupil.rawValue,
            osPupil: osPupil.rawValue,
            odLens: odLens.rawValue,
            osLens: osLens.rawValue,
            odVisualAcuity: odAcuity.rawValue,
            osVisualAcuity: osAcuity.rawValue,
            odNearVision: odNearVision.rawValue,
            osNearVision: osNearVision.rawValue,
            testingCondition: testingCondition.rawValue,
            colorVision: colorVision.rawValue,
            squintAlignment: squintAlignment.rawValue,
            ocularMotility: ocularMotility.rawValue,
            gonioscopy: gonioscopy.rawValue,
            dominantEye: dominantEye.rawValue,
            dilatation: dilatation.rawValue,
            dilatationTime: dilatationTime,
            rightNctIop: rightNctIop,
            leftNctIop: leftNctIop,
            rightApplanationIop: rightApplanationIop,
            leftApplanationIop: leftApplanationIop,
            externalSigns: Array(externalSigns),
            ocularInvestigations: Array(ocularInvestigations).map { $0.rawValue },
            interventions: Array(visionInterventions).map { $0.rawValue },
            presentGlassesOd: presentGlassesOd,
            presentGlassesOs: presentGlassesOs,
            newGlassesOd: newGlassesOd,
            newGlassesOs: newGlassesOs,
            provisionalDiagnosis: provisionalDiagnosis,
            planOfCare: planOfCare,
            finalDiagnosis: finalDiagnosis,
            notes: visionNotes
        )
        
        let dentalRecord = DentalScreeningDto(
            cariesCount: Int(cariesCount) ?? 0,
            missingCount: Int(missingCount) ?? 0,
            filledCount: Int(filledCount) ?? 0,
            caries: dentalCaries.rawValue,
            oralHygiene: dentalHygiene.rawValue,
            gums: "",
            malocclusion: dentalOcclusion.rawValue,
            fluorosis: dentalFluorosis.rawValue,
            pain: dentalPain,
            sensitivity: dentalSensitivity,
            trauma: dentalTrauma,
            stainsTartar: stainsTartar,
            oralHabits: Array(dentalHabits),
            interventions: Array(dentalInterventions).map { $0.rawValue },
            notes: dentalNotes
        )
        
        let entRecord = EntScreeningDto(
            rightEarOtoscopy: rightEarOtoscopy.rawValue,
            leftEarOtoscopy: leftEarOtoscopy.rawValue,
            rightHearingAcuity: rightHearingAcuity.rawValue,
            leftHearingAcuity: leftHearingAcuity.rawValue,
            hearingTest: hearingTest.rawValue,
            nasalPassage: nasalPassage.rawValue,
            throatTonsils: throatTonsils.rawValue,
            speechVoice: speechVoice.rawValue,
            interventions: Array(entInterventions).map { $0.rawValue },
            notes: entNotes
        )
        
        let generalHealthRecord = GeneralHealthDto(
            gestationalAge: gestationalAge.rawValue,
            birthWeightKg: birthWeightKg,
            incubationStay: incubationStay,
            consanguinity: consanguinity.rawValue,
            parentalMyopia: parentalMyopia.rawValue,
            systemicDiseases: Array(systemicDiseases).map { $0.rawValue },
            drugAllergies: Array(drugAllergies).map { $0.rawValue },
            currentTreatments: Array(currentTreatments).map { $0.rawValue },
            nutritionalStatus: nutritionalStatus.rawValue,
            skinCondition: skinCondition.rawValue,
            skinLocation: skinLocation.rawValue,
            pruritusParasitic: pruritusParasitic.rawValue,
            skinNotes: skinLesionDescription,
            skinInterventions: Array(skinInterventions).map { $0.rawValue },
            spinePosture: spinePosture.rawValue,
            gaitLimb: gaitLimb.rawValue,
            jointPain: jointPain,
            restrictedMotion: restrictedMotion,
            spineInterventions: Array(spineInterventions).map { $0.rawValue },
            hemoglobin: Double(hemoglobinLevel) ?? 12.5,
            pallorSign: pallorSign.rawValue,
            anemiaStatus: anemiaSeverity.rawValue,
            hbInterventions: Array(hbInterventions).map { $0.rawValue },
            vaccinationUpToDate: vaccinationUpToDate,
            vaccineStatus: vaccineStatus.rawValue,
            missingVaccines: Array(missingVaccines).map { $0.rawValue },
            vaccineInterventions: Array(vaccineInterventions).map { $0.rawValue },
            orderedGeneralLabs: Array(orderedGeneralLabs).map { $0.rawValue },
            orderedSpecialistTests: Array(orderedSpecialistTests).map { $0.rawValue }
        )
        
        let fullRecord = CompleteScreeningRecordDto(
            studentId: student.id,
            studentName: student.studentName,
            schoolName: student.schoolName,
            gradeClass: student.gradeClass,
            date: ISO8601DateFormatter().string(from: Date()),
            vision: visionRecord,
            dental: dentalRecord,
            ent: entRecord,
            general: generalHealthRecord,
            riskLevel: overallRiskLevel.rawValue,
            referralRequired: referralSpecialty != .none,
            referralSpecialty: referralSpecialty.rawValue,
            recommendations: clinicalRecommendations
        )
        
        do {
            let result = try await apiService.submitScreeningRecord(fullRecord)
            if result {
                if let index = students.firstIndex(where: { $0.id == student.id }) {
                    let newStatus: ClinicianStudentDto.ScreeningStatus = (referralSpecialty != .none) ? .referred : .completed
                    students[index] = ClinicianStudentDto(
                        id: student.id,
                        studentName: student.studentName,
                        age: student.age,
                        gender: student.gender,
                        gradeClass: student.gradeClass,
                        schoolName: student.schoolName,
                        rollNumber: student.rollNumber,
                        guardianName: student.guardianName,
                        guardianPhone: student.guardianPhone,
                        status: newStatus,
                        lastScreenedDate: "Today",
                        flags: (referralSpecialty != .none) ? ["Referred: \(referralSpecialty.rawValue)"] : []
                    )
                }
                self.submissionSuccessMessage = "Clinical screening record saved successfully!"
                self.isSubmittingRecord = false
                return true
            } else {
                self.errorMessage = "Failed to store clinical record."
                self.isSubmittingRecord = false
                return false
            }
        } catch {
            self.errorMessage = error.localizedDescription
            self.isSubmittingRecord = false
            return false
        }
    }
}
