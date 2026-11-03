// The option lists the clinician form offers, word for word as the Android
// app has them: the server reads these labels, so they stay in English.

enum ScreeningOptions {
    static let ACUITY = [
    "6/6", "6/9", "6/12", "6/18", "6/24", "6/36", "6/60",
    "3/60", "2/60", "1/60", "<6/60",
    "CF @ 1/2 meter", "CF CF (Close to Face)",
    "HM+ (Hand Movements)",
    "PL + PR Accurate", "PL + PR Inaccurate",
    "NLP (No Light Perception)"
    ]

    static let NEAR_VISION = [
    "N6 (Normal)", "N8", "N10", "N12", "N18", "N24", "N36"
    ]

    static let VISION_TEST_CONDITION = [
    "Unaided", "Aided (With Present Glasses)", "Pinhole (PH)"
    ]

    static let COLOR_VISION = ["17/17 (Normal Pass)", "15-16/17 (Borderline)", "<15/17 (Defective Red-Green)", "Total Color Blindness", "Ishihara Partial Deficit", "Uncooperative"]

    // Nutritional status, in the words the physical exam sheet uses and the
    // server reads (NUTRITION_BANDS in clinical.ts). Left empty, the server
    // suggests one from height and weight; the dietician groups children by it.
    static let NUTRITIONAL_STATUS = [
    "Normal", "Wasted", "Severely wasted", "Stunted", "Overweight", "Obese"
    ]

    // Type of dentition, as the oral & dental sheet has it. It decides whether
    // the tooth index is read as dmft (milk teeth) or DMFT (permanent).
    static let DENTITION = ["Primary", "Mixed", "Permanent"]

    static let ORAL_HYGIENE_INDEX = ["Good (Clean)", "Fair (Mild Plaque)", "Poor (Heavy Plaque / Calculus)", "Stains / Calculus Noted"]
    static let FLUOROSIS_STAGE = ["None", "Mild (White Flecks)", "Moderate (Browning)", "Severe (Pitting)"]
    static let DENTAL_TREATMENTS = [
    "Prophylactic Cleaning & Scaling",
    "Fluoride Varnish Application",
    "Pit & Fissure Sealant",
    "Restorative Dental Filling",
    "Pulpectomy / Root Treatment",
    "Tooth Extraction",
    "Orthodontic Referral",
    "Urgent Pediatric Dental Referral"
    ]

    static let HEARING_ACUITY = ["Normal (Whisper test +)", "Mild Hearing Loss", "Moderate Loss", "Severe Loss", "Uncooperative"]
    static let EAR_CANAL_EXAM = ["Normal", "Impacted Cerumen (Wax)", "Otitis Externa", "Otitis Media with Effusion", "Tympanic Perforation", "Retracted Drum"]
    static let NASAL_EXAM = ["Normal", "Allergic Rhinitis", "Deviated Septum (DNS)", "Nasal Polyps", "Hypertrophied Turbinates", "Foreign Body"]
    static let THROAT_TONSILS = ["Normal", "Tonsillar Grade I-II", "Tonsillar Grade III-IV (Enlarged)", "Acute Pharyngitis / Tonsillitis", "Adenoid Facies / Mouth Breathing"]
    static let SPEECH_VOICE = ["Normal Speech", "Hypernasality", "Stuttering / Stammering", "Articulation Disorder"]
    static let ENT_TREATMENTS = [
    "Ear Wax Removal / Cerumenolytic",
    "Antihistamine / Decongestant",
    "Antibiotic Nasal / Ear Drops",
    "Formal Audiometry & Tympanometry",
    "ENT Specialist Referral"
    ]

    static let SKIN_CONDITIONS = ["Normal", "Eczema / Atopic Dermatitis", "Tinea / Fungal Ringworm", "Scabies / Mite Infestation", "Impetigo / Bacterial Infection", "Urticaria / Hives", "Molluscum Contagiosum", "Vitiligo / Hypopigmentation", "Psoriasis", "Alopecia Areata"]
    static let SKIN_LOCATIONS = ["Face & Neck", "Scalp & Hairline", "Flexural (Elbows/Knees)", "Trunk & Back", "Hands & Feet", "Generalized"]
    static let PRURITUS_PARASITIC = ["Absent", "Mild / Intermittent", "Severe / Nocturnal", "Pediculosis Capitis (Lice)", "Scabies Infestation Suspected"]
    static let SKIN_TREATMENTS = [
    "Emollients & Hydrating Ointment",
    "Topical Antifungal Cream",
    "Topical Mild Steroid Cream",
    "Anti-Lice Shampoo & Fine Comb",
    "Oral Antihistamines",
    "Dermatology Specialist Referral"
    ]

    static let POSTURE_ALIGN = ["Normal Spinal Alignment", "Scoliosis Suspected (Adam's Test +)", "Kyphosis / Round Back", "Lordosis / Sway Back", "Shoulder Asymmetry", "Scapular Winging"]
    static let GAIT_LIMB = ["Normal Gait", "Flat Feet (Pes Planus)", "Knock-Knees (Genu Valgum)", "Bow-Legs (Genu Varum)", "In-Toeing / Out-Toeing Gait", "Limping / Antalgic Gait"]
    static let SPINE_TREATMENTS = [
    "Ergonomic & Posture Correction",
    "Physical Therapy & Core Exercises",
    "Arch Support / Orthotic Insoles",
    "Pediatric Orthopaedic Referral"
    ]
    static let JOINT_SYMPTOMS = [
    "Joint Pain / Tenderness",
    "Joint Swelling / Effusion",
    "Restricted Range of Motion",
    "Joint Laxity / Hypermobility"
    ]

    static let VACCINE_STATUS = ["Up to Date for Age", "Partially Vaccinated", "Significantly Delayed / Unvaccinated", "Card Not Available"]
    static let MISSED_VACCINES = ["BCG", "OPV / IPV Polio", "Hepatitis B", "DPT / Pentavalent", "Rotavirus", "PCV", "MMR (Measles, Mumps, Rubella)", "Typhoid", "Varicella (Chickenpox)", "Hepatitis A", "HPV (Adolescents)"]
    static let VACCINE_TREATMENTS = ["Schedule Catch-up Immunization", "PHC / Vaccination Clinic Referral", "Parent Vaccine Counseling"]

    static let PALLOR_SIGNS = ["None (Normal Pigmentation)", "Mild Conjunctival Pallor", "Moderate Conjunctival & Tongue Pallor", "Severe Palmar / Nailbed Pallor"]
    static let HB_TREATMENTS = [
    "Iron & Folic Acid Syrup/Tablets",
    "Deworming (Albendazole Tablet)",
    "Dietary Iron Counseling (Greens, Dates, Jaggery)",
    "Repeat Hb in 30 Days",
    "Pediatric Hematology Referral"
    ]

    static let PRURITUS_SIGNS = [
    "Active Pruritus / Itching",
    "Nocturnal Itching (Scabies)",
    "Scalp Pediculosis / Head Lice",
    "Secondary Excoriation / Crusting"
    ]
}
