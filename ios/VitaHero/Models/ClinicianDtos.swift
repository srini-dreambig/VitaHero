//
//  ClinicianDtos.swift
//  VitaHero
//
//  Created for VitaHero (KidHero Health) iOS Platform.
//

import Foundation

public struct ClinicianCampDto: Identifiable, Codable {
    public var id: String = ""
    public var title: String = ""
    public var schoolName: String = ""
    public var date: String = ""
    public var staffRole: String = ""
    public var participants: Int = 0
    public var screened: Int = 0
    public var awaitingReview: Int = 0
    public var status: String = ""
    
    public init(
        id: String = "",
        title: String = "",
        schoolName: String = "",
        date: String = "",
        staffRole: String = "",
        participants: Int = 0,
        screened: Int = 0,
        awaitingReview: Int = 0,
        status: String = ""
    ) {
        self.id = id
        self.title = title
        self.schoolName = schoolName
        self.date = date
        self.staffRole = staffRole
        self.participants = participants
        self.screened = screened
        self.awaitingReview = awaitingReview
        self.status = status
    }
}

public struct ClinicianCampsDto: Codable {
    public var camps: [ClinicianCampDto] = []
}

public struct CampChildDto: Identifiable, Codable {
    public var id: String { kidId }
    public var kidId: String = ""
    public var name: String = ""
    public var grade: String = ""
    public var section: String = ""
    public var gender: String = ""
    public var age: Int? = nil
    public var studentRef: String = ""
    public var consentStatus: String = "PENDING"
    public var attendance: String = "UNKNOWN"
    public var status: String = "NOT_SCREENED"
    
    public init(
        kidId: String = "",
        name: String = "",
        grade: String = "",
        section: String = "",
        gender: String = "",
        age: Int? = nil,
        studentRef: String = "",
        consentStatus: String = "PENDING",
        attendance: String = "UNKNOWN",
        status: String = "NOT_SCREENED"
    ) {
        self.kidId = kidId
        self.name = name
        self.grade = grade
        self.section = section
        self.gender = gender
        self.age = age
        self.studentRef = studentRef
        self.consentStatus = consentStatus
        self.attendance = attendance
        self.status = status
    }
}

public struct CampCanDto: Codable {
    public var schedule: Bool = false
    public var screen: Bool = false
    public var review: Bool = false
    
    public init(schedule: Bool = false, screen: Bool = false, review: Bool = false) {
        self.schedule = schedule
        self.screen = screen
        self.review = review
    }
}

public struct CampRosterDto: Codable {
    public var participants: [CampChildDto] = []
    public var can: CampCanDto = CampCanDto()
    
    public init(participants: [CampChildDto] = [], can: CampCanDto = CampCanDto()) {
        self.participants = participants
        self.can = can
    }
}

public struct ScreeningChildDto: Codable {
    public var kidId: String = ""
    public var name: String = ""
    public var grade: String = ""
    public var section: String = ""
    public var gender: String = ""
    public var age: Int? = nil
    public var studentRef: String = ""
    
    public init(
        kidId: String = "",
        name: String = "",
        grade: String = "",
        section: String = "",
        gender: String = "",
        age: Int? = nil,
        studentRef: String = ""
    ) {
        self.kidId = kidId
        self.name = name
        self.grade = grade
        self.section = section
        self.gender = gender
        self.age = age
        self.studentRef = studentRef
    }
}

public struct ScreeningFormDto: Codable {
    public var child: ScreeningChildDto = ScreeningChildDto()
    public var consentStatus: String = "PENDING"
    public var attendance: String = "UNKNOWN"
    public var status: String = "NOT_SCREENED"
    public var checks: [String] = []
    public var excludedByConsent: [String] = []
    public var otherSpecialties: [String] = []
    public var specialty: String = ""
    
    public init(
        child: ScreeningChildDto = ScreeningChildDto(),
        consentStatus: String = "PENDING",
        attendance: String = "UNKNOWN",
        status: String = "NOT_SCREENED",
        checks: [String] = [],
        excludedByConsent: [String] = [],
        otherSpecialties: [String] = [],
        specialty: String = ""
    ) {
        self.child = child
        self.consentStatus = consentStatus
        self.attendance = attendance
        self.status = status
        self.checks = checks
        self.excludedByConsent = excludedByConsent
        self.otherSpecialties = otherSpecialties
        self.specialty = specialty
    }
}

// ─── CLINICAL ENUMS & SPECIALIST DATA MODELS ───────────────────────

public struct ClinicianStudentDto: Identifiable, Codable {
    public enum ScreeningStatus: String, Codable {
        case pending = "PENDING"
        case completed = "COMPLETED"
        case referred = "REFERRED"
    }
    
    public var id: String
    public var studentName: String
    public var age: Int
    public var gender: String
    public var gradeClass: String
    public var schoolName: String
    public var rollNumber: String
    public var guardianName: String
    public var guardianPhone: String
    public var status: ScreeningStatus
    public var lastScreenedDate: String
    public var flags: [String]
    
    public init(
        id: String = UUID().uuidString,
        studentName: String = "",
        age: Int = 10,
        gender: String = "Male",
        gradeClass: String = "5th",
        schoolName: String = "St. Jude Academy",
        rollNumber: String = "101",
        guardianName: String = "",
        guardianPhone: String = "",
        status: ScreeningStatus = .pending,
        lastScreenedDate: String = "Pending",
        flags: [String] = []
    ) {
        self.id = id
        self.studentName = studentName
        self.age = age
        self.gender = gender
        self.gradeClass = gradeClass
        self.schoolName = schoolName
        self.rollNumber = rollNumber
        self.guardianName = guardianName
        self.guardianPhone = guardianPhone
        self.status = status
        self.lastScreenedDate = lastScreenedDate
        self.flags = flags
    }
}

// 1. Ophthalmology Enums (Image 1, 2, 3, 4, 5)
public enum SnellenAcuity: String, CaseIterable, Codable {
    case sixSix = "6/6 (Normal)"
    case sixNine = "6/9"
    case sixTwelve = "6/12"
    case sixEighteen = "6/18"
    case sixTwentyFour = "6/24"
    case sixThirtySix = "6/36"
    case sixSixty = "6/60"
    case threeSixty = "3/60"
    case twoSixty = "2/60"
    case oneSixty = "1/60"
    case cfHalfMeter = "CF @ 1/2 meter"
    case cfClose = "CF CF (Close to Face)"
    case handMovements = "HM+ (Hand Movements)"
    case plPrAccurate = "PL + PR Accurate"
    case plPrInaccurate = "PL + PR Inaccurate"
    case nlp = "NLP (No Light Perception)"
}

public enum NearVisionAcuity: String, CaseIterable, Codable {
    case n6 = "N6 (Normal)"
    case n8 = "N8"
    case n10 = "N10"
    case n12 = "N12"
    case n18 = "N18"
    case n24 = "N24"
    case n36 = "N36"
}

public enum VisualTestingCondition: String, CaseIterable, Codable {
    case unaided = "Unaided"
    case aided = "Aided (With Glasses)"
    case pinhole = "Pinhole (PH)"
}

public enum EyeLashesState: String, CaseIterable, Codable {
    case normal = "Normal"
    case trichiasis = "Trichiasis (Inward)"
    case distichiasis = "Distichiasis (Double row)"
    case madarosis = "Madarosis (Lash loss)"
    case abnormal = "Other Abnormality"
}

public enum EyeLidsState: String, CaseIterable, Codable {
    case normal = "Normal"
    case ptosis = "Ptosis (Drooping)"
    case blepharitis = "Blepharitis / Stye"
    case chalazion = "Chalazion"
    case entropion = "Entropion"
    case ectropion = "Ectropion"
    case swelling = "Swelling / Edema"
}

public enum EyeConjunctivaState: String, CaseIterable, Codable {
    case normal = "Normal"
    case congestion = "Congestion / Redness"
    case dischargePurulent = "Purulent Discharge"
    case dischargeMucoid = "Mucoid Discharge"
    case allergic = "Allergic Papillae"
    case dryness = "Dryness / Xerosis"
    case bitotsSpots = "Bitot's Spots (Vit A Deficit)"
}

public enum EyeScleraState: String, CaseIterable, Codable {
    case normal = "Normal"
    case icterus = "Jaundice / Icterus"
    case congestion = "Scleral Congestion"
    case episcleritis = "Episcleritis"
}

public enum EyeCorneaState: String, CaseIterable, Codable {
    case clear = "Clear / Normal"
    case opacity = "Corneal Opacity"
    case ulcer = "Corneal Ulcer"
    case foreignBody = "Foreign Body / Abrasion"
    case keratoconus = "Keratoconus"
}

public enum EyeAnteriorChamberState: String, CaseIterable, Codable {
    case normal = "Normal / Quiet"
    case shallow = "Shallow AC"
    case deep = "Deep AC"
    case cellsFlare = "Cells / Flare (+)"
    case hyphema = "Hyphema"
}

public enum EyeIrisState: String, CaseIterable, Codable {
    case normal = "Normal"
    case coloboma = "Coloboma"
    case heterochromia = "Heterochromia"
    case synechiae = "Synechiae"
}

public enum EyePupilState: String, CaseIterable, Codable {
    case normal3mm = "Normal (3-5mm) Brisk"
    case dilated = "Dilated (Mydriasis)"
    case constricted = "Constricted (Miosis)"
    case anisocoria = "Anisocoria (Unequal)"
    case sluggish = "Sluggish Reaction"
    case rapd = "Afferent Defect (RAPD)"
}

public enum EyeLensState: String, CaseIterable, Codable {
    case clear = "Clear / Normal"
    case cataract = "Cataractous Opacity"
    case congenitalCataract = "Congenital Cataract"
    case subluxation = "Subluxation / Dislocated"
    case pseudophakic = "Pseudophakic (IOL)"
    case aphakic = "Aphakic"
}

public enum PosteriorVitreousState: String, CaseIterable, Codable {
    case clear = "Clear / Normal"
    case floaters = "Vitreous Floaters"
    case hemorrhage = "Vitreous Hemorrhage"
    case asteroid = "Asteroid Hyalosis"
}

public enum OpticDiscState: String, CaseIterable, Codable {
    case normalPink = "Normal Pink (C:D 0.3)"
    case paleAtrophy = "Pale / Optic Atrophy"
    case papilledema = "Papilledema / Swollen"
    case cupping = "Cupping (C:D > 0.5)"
}

public enum MaculaState: String, CaseIterable, Codable {
    case normalFoveal = "Normal Foveal Reflex"
    case dullReflex = "Dull Reflex"
    case edema = "Macular Edema"
    case scar = "Macular Scar"
    case cherryRed = "Cherry-Red Spot"
}

public enum RetinaState: String, CaseIterable, Codable {
    case normal = "Normal Background"
    case hemorrhages = "Retinal Hemorrhages"
    case exudates = "Hard Exudates"
    case ropSigns = "ROP Retinopathy Signs"
    case pigmentary = "Retinitis Pigmentosa"
    case detachment = "Retinal Detachment / Tear"
}

public enum EyeBloodVesselsState: String, CaseIterable, Codable {
    case normal = "Normal (A:V 2:3)"
    case tortuous = "Tortuous / Dilated"
    case attenuated = "Attenuated / Narrow"
    case neovascular = "Neovascularization"
}

public enum OcularMotilityState: String, CaseIterable, Codable {
    case full = "Full in all 9 Gazes"
    case restrictedElevation = "Restricted Elevation"
    case restrictedDepression = "Restricted Depression"
    case restrictedAbduction = "Restricted Abduction"
    case restrictedAdduction = "Restricted Adduction"
    case nystagmus = "Nystagmus"
}

public enum SquintState: String, CaseIterable, Codable {
    case normalOrthophoria = "Normal (Orthophoria)"
    case esotropia = "Esotropia (Crossed-In)"
    case exotropia = "Exotropia (Turned-Out)"
    case alternating = "Alternating Squint"
    case hypertropia = "Hypertropia"
    case phoria = "Phoria / Latent Squint"
}

public enum IshiharaColorVisionState: String, CaseIterable, Codable {
    case normalPass = "17/17 (Normal Pass)"
    case borderline = "15-16/17 (Borderline)"
    case redGreenDeficit = "<15/17 (Defective Red-Green)"
    case totalColorBlindness = "Total Color Blindness"
    case uncooperative = "Uncooperative"
}

public enum GlassesStatusState: String, CaseIterable, Codable {
    case none = "None (Emmetropic)"
    case wearingLessOneYear = "Wearing Glasses (<1 year)"
    case wearingOneTwoYears = "Wearing Glasses (1-2 years)"
    case wearingMoreTwoYears = "Wearing Glasses (>2 years)"
    case broken = "Broken / Outdated Glasses"
    case refractionNeeded = "Refraction Needed"
}

public enum GonioscopyState: String, CaseIterable, Codable {
    case grade4Open = "Grade 4 (Open Angle)"
    case grade3Open = "Grade 3 (Open Angle)"
    case grade2Narrow = "Grade 2 (Narrow Angle)"
    case grade1Narrow = "Grade 1 (Narrow Angle)"
    case closed = "Closed Angle"
}

public enum DilatationState: String, CaseIterable, Codable {
    case no = "No (Undilated)"
    case tropicamide = "Yes - Tropicamide + Phenylephrine"
    case cyclopentolate = "Yes - Cyclopentolate 1%"
    case homatropine = "Yes - Homatropine 2%"
    case atropine = "Yes - Atropine 1%"
}

public enum DominantEyeState: String, CaseIterable, Codable {
    case right = "Right Eye (RE)"
    case left = "Left Eye (LE)"
}

public enum EyeInterventionOption: String, CaseIterable, Codable {
    case rxPrescribed = "Rx Prescribed (Eye Drops)"
    case glassesPrescribed = "Glasses Prescribed"
    case refraction = "Refraction Needed"
    case pediatricReferral = "Pediatric Ophthalmologist Referral"
    case amblyopiaPatching = "Amblyopia Patching Therapy"
    case lubricatingDrops = "Lubricating Eye Drops"
    case antiAllergicDrops = "Anti-Allergic Eye Drops"
    case antibioticDrops = "Antibiotic Eye Drops"
    case screenTimeGuidance = "Screen Time & Vision Hygiene"
}

// Image 1: Diagnostic Investigation Options
public enum OcularInvestigationOption: String, CaseIterable, Codable {
    case keratometry = "Keratometry"
    case aScan = "A - Scan"
    case oraWavetech = "ORA WaveTech"
    case orbscan = "Orbscan"
    case aberrometry = "Aberrometry"
    case specularMicroscopy = "Specular Microscopy"
    case antOct = "Ant. OCT"
    case postOct = "Post. OCT"
    case bScan = "B - Scan"
    case ffa = "FFA"
    case hvf = "HVF"
    case cct = "CCT"
}

public enum GeneralLabInvestigationOption: String, CaseIterable, Codable {
    case cbp = "CBP (Complete Blood Picture)"
    case esr = "ESR"
    case rbs = "RBS"
    case fbs = "FBS"
    case plbs = "PLBS"
    case hba1c = "HbA1c"
    case bloodUrea = "Blood Urea"
    case serumCreatinine = "Serum Creatinine"
    case lipidProfile = "Lipid Profile"
    case cue = "CUE (Urine Routine)"
    case ecg = "ECG"
    case btCt = "BT, CT"
    case ptInr = "PT / INR"
    case hiv = "HIV (I & II)"
    case hbsag = "HBsAg"
    case hcv = "HCV"
}

public enum AdditionalTestOption: String, CaseIterable, Codable {
    case serumElectrolytes = "Serum Electrolytes"
    case lft = "Liver Function Test (LFT)"
    case thyroid = "T3, T4, TSH"
    case mantoux = "Mantoux"
    case quantiferon = "QuantiFERON TB Gold"
    case tbIggIgm = "TB IgG & IgM"
    case torch = "TORCH IgG & IgM"
    case serumAce = "Serum ACE"
    case ana = "ANA Profile"
    case raFactor = "RA Factor"
    case crp = "CRP"
    case anca = "ANCA"
    case xrayChest = "X-Ray Chest"
    case ctBrainOrbit = "CT Brain / Orbit"
    case mriBrainOrbit = "MRI Brain / Orbit"
    case bloodGroup = "Blood Group"
    case coagulation = "Coagulation Profile"
}

// Image 2 & 5: Systemic & Perinatal History Options
public enum GestationalState: String, CaseIterable, Codable {
    case fullTerm = "Full Term (37-40 weeks)"
    case premature = "Premature (<37 weeks)"
    case postTerm = "Post-term (>40 weeks)"
}

public enum ConsanguinityState: String, CaseIterable, Codable {
    case nonConsanguineous = "Non-Consanguineous"
    case consanguineous = "Consanguineous Marriage"
}

public enum ParentalMyopiaState: String, CaseIterable, Codable {
    case none = "No Family History"
    case oneParent = "One Parent Myopic"
    case bothParents = "Both Parents Myopic"
    case familyGlaucoma = "Family Glaucoma / Retinal Disorder"
}

public enum SystemicDiseaseOption: String, CaseIterable, Codable {
    case diabetes = "Diabetes Mellitus (DM)"
    case hypertension = "Hypertension (HTN)"
    case cva = "CVA (Stroke)"
    case asthma = "Asthma"
    case heartDisease = "Heart Disease"
    case polio = "Polio"
    case paralysis = "Paralysis / Cerebral Palsy"
    case epilepsy = "Epilepsy / Seizures"
}

public enum DrugAllergyOption: String, CaseIterable, Codable {
    case nil = "Nil Known Drug Allergies"
    case penicillin = "Penicillin"
    case xylocaine = "Xylocaine (Lidocaine)"
    case sulpha = "Sulpha Drugs"
    case atropine = "Atropine"
    case drosyn = "Drosyn (Phenylephrine)"
    case nsaids = "NSAIDs / Aspirin"
    case others = "Other Drug Allergies"
}

public enum TreatmentMedicationOption: String, CaseIterable, Codable {
    case none = "None"
    case anticoagulants = "Anticoagulants"
    case insulin = "Insulin"
    case antipsychotics = "Antipsychotics"
    case antiHypertensives = "Anti-hypertensives"
    case inhalers = "Inhalers / Bronchodilators"
    case others = "Other Medications"
}

public enum NutritionalState: String, CaseIterable, Codable {
    case normal = "Normal / Well-Nourished"
    case mildMalnutrition = "Mild Malnutrition"
    case severeMalnutrition = "Severe Malnutrition"
    case underweight = "Underweight for Age"
    case overweight = "Overweight / Obese"
    case stunted = "Stunted Growth"
}

// 2. Dental Enums
public enum DentalCariesState: String, CaseIterable, Codable {
    case none = "0 (Healthy)"
    case mild = "1-2 (Mild Caries)"
    case moderate = "3-4 (Moderate)"
    case severe = "5+ (Severe)"
}

public enum OralHygieneState: String, CaseIterable, Codable {
    case good = "Good (Clean)"
    case fair = "Fair (Mild Plaque)"
    case poor = "Poor (Calculus/Debris)"
}

public enum FluorosisState: String, CaseIterable, Codable {
    case none = "None"
    case mild = "Mild (White Flecks)"
    case moderate = "Moderate (Browning)"
    case severe = "Severe (Pitting)"
}

public enum OcclusionState: String, CaseIterable, Codable {
    case normalClassI = "Normal Class I"
    case classIIOverbite = "Class II Overbite"
    case classIIIUnderbite = "Class III Underbite"
    case crowding = "Crowding"
    case crossbite = "Crossbite"
    case openBite = "Open Bite"
}

public enum DentalInterventionOption: String, CaseIterable, Codable {
    case cleaning = "Prophylactic Cleaning & Scaling"
    case fluoride = "Fluoride Varnish Application"
    case sealant = "Pit & Fissure Sealant"
    case filling = "Restorative Dental Filling"
    case pulpectomy = "Pulpectomy / Root Treatment"
    case extraction = "Tooth Extraction"
    case orthoReferral = "Orthodontic Referral"
    case urgentReferral = "Urgent Pediatric Dental Referral"
}

// 3. ENT Enums
public enum EarState: String, CaseIterable, Codable {
    case normal = "Normal"
    case wax = "Impacted Cerumen (Wax)"
    case otitisMedia = "Otitis Media with Effusion"
    case otitisExterna = "Otitis Externa"
    case perforation = "Tympanic Perforation"
    case retracted = "Retracted Drum"
}

public enum HearingState: String, CaseIterable, Codable {
    case passed = "Normal (Whisper test +)"
    case mildLoss = "Mild Hearing Loss"
    case moderateLoss = "Moderate Loss"
    case severeLoss = "Severe Loss"
    case uncooperative = "Uncooperative"
}

public enum NasalState: String, CaseIterable, Codable {
    case clear = "Normal / Clear"
    case allergicRhinitis = "Allergic Rhinitis"
    case deviatedSeptum = "Deviated Septum (DNS)"
    case polyps = "Nasal Polyps"
    case hypertrophiedTurbinates = "Hypertrophied Turbinates"
    case foreignBody = "Foreign Body"
}

public enum ThroatState: String, CaseIterable, Codable {
    case normal = "Normal"
    case tonsilsGrade12 = "Tonsillar Grade I-II"
    case tonsilsGrade34 = "Tonsillar Grade III-IV (Enlarged)"
    case pharyngitis = "Acute Pharyngitis / Tonsillitis"
    case adenoidFacies = "Adenoid Facies / Mouth Breathing"
}

public enum SpeechVoiceState: String, CaseIterable, Codable {
    case normal = "Normal Speech"
    case hypernasality = "Hypernasality"
    case stuttering = "Stuttering / Stammering"
    case articulation = "Articulation Disorder"
}

public enum EntInterventionOption: String, CaseIterable, Codable {
    case waxRemoval = "Ear Wax Removal / Cerumenolytic"
    case antihistamines = "Antihistamine / Decongestant"
    case antibioticDrops = "Antibiotic Nasal / Ear Drops"
    case audiometry = "Formal Audiometry & Tympanometry"
    case entReferral = "ENT Specialist Referral"
}

// 4. Dermatology Enums
public enum SkinState: String, CaseIterable, Codable {
    case healthy = "Healthy / Normal"
    case eczema = "Eczema / Atopic Dermatitis"
    case tinea = "Tinea / Fungal Ringworm"
    case scabies = "Scabies / Mite Infestation"
    case impetigo = "Impetigo / Bacterial Infection"
    case urticaria = "Urticaria / Hives"
    case molluscum = "Molluscum Contagiosum"
    case vitiligo = "Vitiligo / Hypopigmentation"
    case psoriasis = "Psoriasis"
    case alopecia = "Alopecia Areata"
}

public enum SkinLocationState: String, CaseIterable, Codable {
    case faceNeck = "Face & Neck"
    case scalp = "Scalp & Hairline"
    case flexural = "Flexural (Elbows/Knees)"
    case trunk = "Trunk & Back"
    case handsFeet = "Hands & Feet"
    case generalized = "Generalized"
}

public enum PruritusState: String, CaseIterable, Codable {
    case absent = "Absent"
    case mild = "Mild / Intermittent"
    case severe = "Severe / Nocturnal"
    case lice = "Pediculosis Capitis (Lice)"
    case scabies = "Scabies Infestation Suspected"
}

public enum SkinInterventionOption: String, CaseIterable, Codable {
    case emollients = "Emollients & Hydrating Ointment"
    case antifungal = "Topical Antifungal Cream"
    case steroid = "Topical Mild Steroid Cream"
    case antiLice = "Anti-Lice Shampoo & Fine Comb"
    case oralAntihistamines = "Oral Antihistamines"
    case dermReferral = "Dermatology Specialist Referral"
}

// 5. Spine & Musculoskeletal Enums
public enum SpineState: String, CaseIterable, Codable {
    case normal = "Normal Spinal Alignment"
    case scoliosis = "Scoliosis Suspected (Adam's +)"
    case kyphosis = "Kyphosis / Round Back"
    case lordosis = "Lordosis / Sway Back"
    case shoulderAsymmetry = "Shoulder Asymmetry"
}

public enum GaitLimbState: String, CaseIterable, Codable {
    case normal = "Normal Gait"
    case flatFeet = "Flat Feet (Pes Planus)"
    case knockKnees = "Knock-Knees (Genu Valgum)"
    case bowLegs = "Bow-Legs (Genu Varum)"
    case inOutToeing = "In-Toeing / Out-Toeing Gait"
    case limping = "Limping / Antalgic Gait"
}

public enum SpineInterventionOption: String, CaseIterable, Codable {
    case posture = "Ergonomic & Posture Correction"
    case therapy = "Physical Therapy & Core Exercises"
    case archSupport = "Arch Support / Orthotic Insoles"
    case orthoReferral = "Pediatric Orthopaedic Referral"
}

// 6. Vaccines & Anemia Enums
public enum VaccineStatusState: String, CaseIterable, Codable {
    case upToDate = "Up to Date for Age"
    case partially = "Partially Vaccinated"
    case delayed = "Significantly Delayed / Unvaccinated"
    case cardMissing = "Card Not Available"
}

public enum MissedVaccineOption: String, CaseIterable, Codable {
    case bcg = "BCG"
    case polio = "OPV / IPV Polio"
    case hepB = "Hepatitis B"
    case dpt = "DPT / Pentavalent"
    case rotavirus = "Rotavirus"
    case pcv = "PCV"
    case mmr = "MMR (Measles, Mumps, Rubella)"
    case typhoid = "Typhoid"
    case varicella = "Varicella (Chickenpox)"
    case hepA = "Hepatitis A"
    case hpv = "HPV (Adolescents)"
}

public enum VaccineInterventionOption: String, CaseIterable, Codable {
    case scheduleCatchup = "Schedule Catch-up Immunization"
    case clinicReferral = "PHC / Vaccination Clinic Referral"
    case counseling = "Parent Vaccine Counseling"
}

public enum AnemiaState: String, CaseIterable, Codable {
    case normal = "Normal (≥11.5 g/dL)"
    case mild = "Mild Anaemia (11.0-11.4)"
    case moderate = "Moderate Anaemia (8.0-10.9)"
    case severe = "Severe Anaemia (<8.0 g/dL)"
}

public enum PallorSignState: String, CaseIterable, Codable {
    case none = "None (Normal Pigmentation)"
    case mildConjunctival = "Mild Conjunctival Pallor"
    case moderateTongue = "Moderate Conjunctival & Tongue Pallor"
    case severePalmar = "Severe Palmar / Nailbed Pallor"
}

public enum AnemiaInterventionOption: String, CaseIterable, Codable {
    case ironSyrup = "Iron & Folic Acid Syrup/Tablets"
    case deworming = "Deworming (Albendazole Tablet)"
    case dietaryCounseling = "Dietary Iron Counseling"
    case repeatHb = "Repeat Hb in 30 Days"
    case hematologyReferral = "Pediatric Hematology Referral"
}

public enum ClinicalRiskLevel: String, CaseIterable, Codable {
    case low = "Low Risk (Routine)"
    case moderate = "Moderate (Watchlist)"
    case high = "High Risk (Immediate Follow-up)"
}

public enum ReferralSpecialtyOption: String, CaseIterable, Codable {
    case none = "None"
    case ophthalmology = "Ophthalmology"
    case dentistry = "Dentistry"
    case ent = "ENT"
    case dermatology = "Dermatology"
    case orthopaedics = "Orthopaedics"
    case pediatrics = "Paediatrics / General Medicine"
}

// ─── GLASSES PRESCRIPTION DTO (Image 5) ───────────────────────────

public struct GlassesPrescriptionDto: Codable {
    public var sphere: String = ""
    public var cylinder: String = ""
    public var axis: String = ""
    public var add: String = ""
    public var cva: String = ""
    public var uva: String = ""
    
    public init(
        sphere: String = "",
        cylinder: String = "",
        axis: String = "",
        add: String = "",
        cva: String = "",
        uva: String = ""
    ) {
        self.sphere = sphere
        self.cylinder = cylinder
        self.axis = axis
        self.add = add
        self.cva = cva
        self.uva = uva
    }
}

// ─── SPECIALTY SCREENING DTOs ─────────────────────────────────────

public struct VisionScreeningDto: Codable {
    public var odLashes: String = ""
    public var osLashes: String = ""
    public var odLids: String = ""
    public var osLids: String = ""
    public var odConjunctiva: String = ""
    public var osConjunctiva: String = ""
    public var odSclera: String = ""
    public var osSclera: String = ""
    public var odCornea: String = ""
    public var osCornea: String = ""
    public var odAc: String = ""
    public var osAc: String = ""
    public var odIris: String = ""
    public var osIris: String = ""
    public var odPupil: String = ""
    public var osPupil: String = ""
    public var odLens: String = ""
    public var osLens: String = ""
    
    public var odVisualAcuity: String = ""
    public var osVisualAcuity: String = ""
    public var odNearVision: String = ""
    public var osNearVision: String = ""
    public var testingCondition: String = ""
    
    public var colorVision: String = ""
    public var squintAlignment: String = ""
    public var ocularMotility: String = ""
    public var gonioscopy: String = ""
    public var dominantEye: String = ""
    public var dilatation: String = ""
    public var dilatationTime: String = ""
    
    public var rightNctIop: String = ""
    public var leftNctIop: String = ""
    public var rightApplanationIop: String = ""
    public var leftApplanationIop: String = ""
    
    public var externalSigns: [String] = []
    public var ocularInvestigations: [String] = []
    public var interventions: [String] = []
    
    public var presentGlassesOd: GlassesPrescriptionDto = GlassesPrescriptionDto()
    public var presentGlassesOs: GlassesPrescriptionDto = GlassesPrescriptionDto()
    public var newGlassesOd: GlassesPrescriptionDto = GlassesPrescriptionDto()
    public var newGlassesOs: GlassesPrescriptionDto = GlassesPrescriptionDto()
    
    public var provisionalDiagnosis: String = ""
    public var planOfCare: String = ""
    public var finalDiagnosis: String = ""
    public var notes: String = ""
    
    public init(
        odLashes: String = "",
        osLashes: String = "",
        odLids: String = "",
        osLids: String = "",
        odConjunctiva: String = "",
        osConjunctiva: String = "",
        odSclera: String = "",
        osSclera: String = "",
        odCornea: String = "",
        osCornea: String = "",
        odAc: String = "",
        osAc: String = "",
        odIris: String = "",
        osIris: String = "",
        odPupil: String = "",
        osPupil: String = "",
        odLens: String = "",
        osLens: String = "",
        odVisualAcuity: String = "",
        osVisualAcuity: String = "",
        odNearVision: String = "",
        osNearVision: String = "",
        testingCondition: String = "",
        colorVision: String = "",
        squintAlignment: String = "",
        ocularMotility: String = "",
        gonioscopy: String = "",
        dominantEye: String = "",
        dilatation: String = "",
        dilatationTime: String = "",
        rightNctIop: String = "",
        leftNctIop: String = "",
        rightApplanationIop: String = "",
        leftApplanationIop: String = "",
        externalSigns: [String] = [],
        ocularInvestigations: [String] = [],
        interventions: [String] = [],
        presentGlassesOd: GlassesPrescriptionDto = GlassesPrescriptionDto(),
        presentGlassesOs: GlassesPrescriptionDto = GlassesPrescriptionDto(),
        newGlassesOd: GlassesPrescriptionDto = GlassesPrescriptionDto(),
        newGlassesOs: GlassesPrescriptionDto = GlassesPrescriptionDto(),
        provisionalDiagnosis: String = "",
        planOfCare: String = "",
        finalDiagnosis: String = "",
        notes: String = ""
    ) {
        self.odLashes = odLashes
        self.osLashes = osLashes
        self.odLids = odLids
        self.osLids = osLids
        self.odConjunctiva = odConjunctiva
        self.osConjunctiva = osConjunctiva
        self.odSclera = odSclera
        self.osSclera = osSclera
        self.odCornea = odCornea
        self.osCornea = osCornea
        self.odAc = odAc
        self.osAc = osAc
        self.odIris = odIris
        self.osIris = osIris
        self.odPupil = odPupil
        self.osPupil = osPupil
        self.odLens = odLens
        self.osLens = osLens
        self.odVisualAcuity = odVisualAcuity
        self.osVisualAcuity = osVisualAcuity
        self.odNearVision = odNearVision
        self.osNearVision = osNearVision
        self.testingCondition = testingCondition
        self.colorVision = colorVision
        self.squintAlignment = squintAlignment
        self.ocularMotility = ocularMotility
        self.gonioscopy = gonioscopy
        self.dominantEye = dominantEye
        self.dilatation = dilatation
        self.dilatationTime = dilatationTime
        self.rightNctIop = rightNctIop
        self.leftNctIop = leftNctIop
        self.rightApplanationIop = rightApplanationIop
        self.leftApplanationIop = leftApplanationIop
        self.externalSigns = externalSigns
        self.ocularInvestigations = ocularInvestigations
        self.interventions = interventions
        self.presentGlassesOd = presentGlassesOd
        self.presentGlassesOs = presentGlassesOs
        self.newGlassesOd = newGlassesOd
        self.newGlassesOs = newGlassesOs
        self.provisionalDiagnosis = provisionalDiagnosis
        self.planOfCare = planOfCare
        self.finalDiagnosis = finalDiagnosis
        self.notes = notes
    }
}

public struct DentalScreeningDto: Codable {
    public var cariesCount: Int = 0
    public var missingCount: Int = 0
    public var filledCount: Int = 0
    public var caries: String = ""
    public var oralHygiene: String = ""
    public var gums: String = ""
    public var malocclusion: String = ""
    public var fluorosis: String = ""
    public var pain: Bool = false
    public var sensitivity: Bool = false
    public var trauma: Bool = false
    public var stainsTartar: Bool = false
    public var oralHabits: [String] = []
    public var interventions: [String] = []
    public var notes: String = ""
    
    public init(
        cariesCount: Int = 0,
        missingCount: Int = 0,
        filledCount: Int = 0,
        caries: String = "",
        oralHygiene: String = "",
        gums: String = "",
        malocclusion: String = "",
        fluorosis: String = "",
        pain: Bool = false,
        sensitivity: Bool = false,
        trauma: Bool = false,
        stainsTartar: Bool = false,
        oralHabits: [String] = [],
        interventions: [String] = [],
        notes: String = ""
    ) {
        self.cariesCount = cariesCount
        self.missingCount = missingCount
        self.filledCount = filledCount
        self.caries = caries
        self.oralHygiene = oralHygiene
        self.gums = gums
        self.malocclusion = malocclusion
        self.fluorosis = fluorosis
        self.pain = pain
        self.sensitivity = sensitivity
        self.trauma = trauma
        self.stainsTartar = stainsTartar
        self.oralHabits = oralHabits
        self.interventions = interventions
        self.notes = notes
    }
}

public struct EntScreeningDto: Codable {
    public var rightEarOtoscopy: String = ""
    public var leftEarOtoscopy: String = ""
    public var rightHearingAcuity: String = ""
    public var leftHearingAcuity: String = ""
    public var hearingTest: String = ""
    public var nasalPassage: String = ""
    public var throatTonsils: String = ""
    public var speechVoice: String = ""
    public var interventions: [String] = []
    public var notes: String = ""
    
    public init(
        rightEarOtoscopy: String = "",
        leftEarOtoscopy: String = "",
        rightHearingAcuity: String = "",
        leftHearingAcuity: String = "",
        hearingTest: String = "",
        nasalPassage: String = "",
        throatTonsils: String = "",
        speechVoice: String = "",
        interventions: [String] = [],
        notes: String = ""
    ) {
        self.rightEarOtoscopy = rightEarOtoscopy
        self.leftEarOtoscopy = leftEarOtoscopy
        self.rightHearingAcuity = rightHearingAcuity
        self.leftHearingAcuity = leftHearingAcuity
        self.hearingTest = hearingTest
        self.nasalPassage = nasalPassage
        self.throatTonsils = throatTonsils
        self.speechVoice = speechVoice
        self.interventions = interventions
        self.notes = notes
    }
}

public struct GeneralHealthDto: Codable {
    public var gestationalAge: String = ""
    public var birthWeightKg: String = ""
    public var incubationStay: Bool = false
    public var consanguinity: String = ""
    public var parentalMyopia: String = ""
    
    public var systemicDiseases: [String] = []
    public var drugAllergies: [String] = []
    public var currentTreatments: [String] = []
    public var nutritionalStatus: String = ""
    
    public var skinCondition: String = ""
    public var skinLocation: String = ""
    public var pruritusParasitic: String = ""
    public var skinNotes: String = ""
    public var skinInterventions: [String] = []
    
    public var spinePosture: String = ""
    public var gaitLimb: String = ""
    public var jointPain: Bool = false
    public var restrictedMotion: Bool = false
    public var spineInterventions: [String] = []
    
    public var hemoglobin: Double = 12.5
    public var pallorSign: String = ""
    public var anemiaStatus: String = ""
    public var hbInterventions: [String] = []
    
    public var vaccinationUpToDate: Bool = true
    public var vaccineStatus: String = ""
    public var missingVaccines: [String] = []
    public var vaccineInterventions: [String] = []
    
    public var orderedGeneralLabs: [String] = []
    public var orderedSpecialistTests: [String] = []
    
    public init(
        gestationalAge: String = "",
        birthWeightKg: String = "",
        incubationStay: Bool = false,
        consanguinity: String = "",
        parentalMyopia: String = "",
        systemicDiseases: [String] = [],
        drugAllergies: [String] = [],
        currentTreatments: [String] = [],
        nutritionalStatus: String = "",
        skinCondition: String = "",
        skinLocation: String = "",
        pruritusParasitic: String = "",
        skinNotes: String = "",
        skinInterventions: [String] = [],
        spinePosture: String = "",
        gaitLimb: String = "",
        jointPain: Bool = false,
        restrictedMotion: Bool = false,
        spineInterventions: [String] = [],
        hemoglobin: Double = 12.5,
        pallorSign: String = "",
        anemiaStatus: String = "",
        hbInterventions: [String] = [],
        vaccinationUpToDate: Bool = true,
        vaccineStatus: String = "",
        missingVaccines: [String] = [],
        vaccineInterventions: [String] = [],
        orderedGeneralLabs: [String] = [],
        orderedSpecialistTests: [String] = []
    ) {
        self.gestationalAge = gestationalAge
        self.birthWeightKg = birthWeightKg
        self.incubationStay = incubationStay
        self.consanguinity = consanguinity
        self.parentalMyopia = parentalMyopia
        self.systemicDiseases = systemicDiseases
        self.drugAllergies = drugAllergies
        self.currentTreatments = currentTreatments
        self.nutritionalStatus = nutritionalStatus
        self.skinCondition = skinCondition
        self.skinLocation = skinLocation
        self.pruritusParasitic = pruritusParasitic
        self.skinNotes = skinNotes
        self.skinInterventions = skinInterventions
        self.spinePosture = spinePosture
        self.gaitLimb = gaitLimb
        self.jointPain = jointPain
        self.restrictedMotion = restrictedMotion
        self.spineInterventions = spineInterventions
        self.hemoglobin = hemoglobin
        self.pallorSign = pallorSign
        self.anemiaStatus = anemiaStatus
        self.hbInterventions = hbInterventions
        self.vaccinationUpToDate = vaccinationUpToDate
        self.vaccineStatus = vaccineStatus
        self.missingVaccines = missingVaccines
        self.vaccineInterventions = vaccineInterventions
        self.orderedGeneralLabs = orderedGeneralLabs
        self.orderedSpecialistTests = orderedSpecialistTests
    }
}

public struct CompleteScreeningRecordDto: Codable {
    public var studentId: String
    public var studentName: String
    public var schoolName: String
    public var gradeClass: String
    public var date: String
    public var vision: VisionScreeningDto
    public var dental: DentalScreeningDto
    public var ent: EntScreeningDto
    public var general: GeneralHealthDto
    public var riskLevel: String
    public var referralRequired: Bool
    public var referralSpecialty: String
    public var recommendations: String
    
    public init(
        studentId: String = "",
        studentName: String = "",
        schoolName: String = "",
        gradeClass: String = "",
        date: String = "",
        vision: VisionScreeningDto = VisionScreeningDto(),
        dental: DentalScreeningDto = DentalScreeningDto(),
        ent: EntScreeningDto = EntScreeningDto(),
        general: GeneralHealthDto = GeneralHealthDto(),
        riskLevel: String = "Low",
        referralRequired: Bool = false,
        referralSpecialty: String = "None",
        recommendations: String = ""
    ) {
        self.studentId = studentId
        self.studentName = studentName
        self.schoolName = schoolName
        self.gradeClass = gradeClass
        self.date = date
        self.vision = vision
        self.dental = dental
        self.ent = ent
        self.general = general
        self.riskLevel = riskLevel
        self.referralRequired = referralRequired
        self.referralSpecialty = referralSpecialty
        self.recommendations = recommendations
    }
}
