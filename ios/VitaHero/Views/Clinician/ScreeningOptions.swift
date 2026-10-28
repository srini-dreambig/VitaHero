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

    static let EXTERNAL_EXAM = ["Normal", "Conjunctivitis", "Discharge", "Ptosis"]

    static let EXTERNAL_SIGNS = [
    "Ptosis (Lid Droop)",
    "Swelling / Edema",
    "Redness / Congestion",
    "Watering / Epiphora",
    "Purulent Discharge",
    "Mucoid Discharge",
    "Foreign Body Sensation"
    ]

    static let EYE_LASHES = ["Normal", "Distichiasis (Double Row)", "Trichiasis (Inward Growth)", "Madarosis (Lash Loss)", "Other Abnormality"]
    static let EYE_LIDS = ["Normal", "Ptosis (Drooping)", "Entropion (Inward Turning)", "Ectropion (Outward Turning)", "Blepharitis / Stye", "Chalazion", "Other Abnormality"]
    static let CONJUNCTIVA = ["Normal", "Congestion / Redness", "Dryness", "Itching / Allergic", "Purulent Discharge", "Mucoid Discharge", "Bitot's Spots", "Other Abnormality"]
    static let SCLERA = ["Normal", "Jaundice / Icterus", "Scleral Congestion", "Episcleritis", "Other Abnormality"]
    static let CORNEA = ["Normal / Clear", "Congestion / Opacity", "Foreign Body / Abrasion", "Corneal Ulcer", "Keratoconus", "Other Abnormality"]
    static let ANTERIOR_CHAMBER = ["Normal / Quiet", "Shallow AC", "Deep AC", "Cells / Flare (+)", "Hyphema", "Hypopyon"]
    static let IRIS = ["Normal", "Coloboma", "Heterochromia", "Synechiae", "Atrophy", "Other Abnormality"]
    static let PUPIL_SIZE = ["Normal (3-5mm)", "Dilated (Mydriasis)", "Constricted (Miosis)", "Anisocoria (Unequal)"]
    static let PUPIL_LIGHT_REACTION = ["Normal / Brisk", "Sluggish", "Non-Reactive to Light", "Afferent Pupillary Defect (RAPD)"]
    static let EYE_LENS = ["Normal / Clear", "Congenital Cataract", "Cataractous Opacity", "Subluxation / Dislocated", "Aphakia", "Pseudophakia (IOL)"]

    static let VITREOUS = ["Normal / Clear", "Vitreous Floaters", "Vitreous Hemorrhage", "Asteroid Hyalosis"]
    static let OPTIC_DISC = ["Normal Pink (C:D 0.3)", "Pale / Optic Atrophy", "Papilledema / Swollen", "Cupping (C:D > 0.5)"]
    static let MACULA = ["Normal Foveal Reflex", "Dull Reflex", "Macular Edema", "Macular Scar", "Cherry-Red Spot"]
    static let RETINA = ["Normal Background", "Retinal Hemorrhages", "Hard Exudates", "ROP Retinopathy Signs", "Retinitis Pigmentosa", "Retinal Detachment / Tear"]
    static let BLOOD_VESSELS = ["Normal (A:V 2:3)", "Tortuous / Dilated", "Attenuated / Narrow", "Neovascularization"]

    static let OCULAR_MOTILITY = ["Full in all 9 Gazes", "Restricted Elevation", "Restricted Depression", "Restricted Abduction", "Restricted Adduction", "Nystagmus"]
    static let SQUINT_ALIGNMENT = ["Normal (Orthophoria)", "Esotropia (Crossed-In)", "Exotropia (Turned-Out)", "Alternating Squint", "Hypertropia", "Hypotropia", "Phoria / Latent Squint"]
    static let COLOR_VISION = ["17/17 (Normal Pass)", "15-16/17 (Borderline)", "<15/17 (Defective Red-Green)", "Total Color Blindness", "Ishihara Partial Deficit", "Uncooperative"]
    static let GONIOSCOPY = ["Grade 4 (Open Angle)", "Grade 3 Open", "Grade 2 Narrow", "Grade 1 Narrow", "Closed Angle"]
    static let DOMINANT_EYE = ["Right Eye (RE)", "Left Eye (LE)"]
    static let DILATATION_STATUS = ["No (Undilated)", "Yes - Tropicamide + Phenylephrine", "Yes - Cyclopentolate 1%", "Yes - Homatropine 2%", "Yes - Atropine 1%"]
    static let GLASSES_STATUS = ["None (Emmetropic)", "Wearing Prescribed Glasses (<1 yr)", "Wearing Glasses (1-2 yrs)", "Wearing Glasses (>2 yrs)", "Glasses Broken / Outdated", "Refraction Needed"]

    static let VISION_TREATMENTS = [
    "Rx Prescribed (Eye Drops / Medications)",
    "Glasses Prescribed (Spectacle Correction)",
    "Refraction Needed / Schedule Formal Exam",
    "Pediatric Ophthalmologist Referral",
    "Amblyopia Patching Therapy",
    "Lubricating / Artificial Tear Drops",
    "Anti-Allergic Eye Drops",
    "Antibiotic Eye Drops",
    "Vision Hygiene & Screen Time Guidance"
    ]

    static let OCULAR_INVESTIGATIONS = [
    "Keratometry",
    "A - Scan",
    "ORA WaveTech",
    "Orbscan",
    "Aberrometry",
    "Specular Microscopy",
    "Ant. OCT (Anterior Segment OCT)",
    "Post. OCT (Posterior / Macular OCT)",
    "B - Scan (Ultrasound)",
    "FFA (Fundus Fluorescein Angiography)",
    "HVF (Humphrey Visual Field)",
    "CCT (Central Corneal Thickness)"
    ]

    static let GENERAL_INVESTIGATIONS = [
    "CBP (Complete Blood Picture)",
    "ESR",
    "RBS (Random Blood Sugar)",
    "FBS (Fasting Blood Sugar)",
    "PLBS / PPBS (Post Lunch Blood Sugar)",
    "HbA1c",
    "Blood Urea",
    "Serum Creatinine",
    "Lipid Profile",
    "CUE (Complete Urine Examination)",
    "ECG",
    "BT, CT (Bleeding Time, Clotting Time)",
    "PT / INR",
    "HIV (I & II)",
    "HBsAg",
    "HCV"
    ]

    static let ADDITIONAL_INVESTIGATIONS = [
    "Serum Electrolytes",
    "Liver Function Test (LFT)",
    "Thyroid Profile (T3, T4, TSH)",
    "Mantoux (Tuberculin Skin Test)",
    "QuantiFERON TB Gold",
    "TB IgG & IgM",
    "TORCH IgG & IgM",
    "Serum ACE",
    "ANA Profile",
    "RA Factor",
    "CRP",
    "ANCA",
    "X-Ray Chest (PA View)",
    "CT Brain / Orbit",
    "MRI Brain / Orbit",
    "Blood Group & Rh Type",
    "Coagulation Profile"
    ]

    static let GESTATIONAL_AGE = ["Full Term (37-40 weeks)", "Premature (<37 weeks)", "Post-term (>40 weeks)"]
    static let CONSANGUINITY_MARRIAGE = ["Non-Consanguineous", "Consanguineous Marriage (Parents Related)"]
    static let PARENTAL_MYOPIA = ["No Family History", "One Parent Myopic", "Both Parents Myopic", "High Myopia / Eye Disorder in Family"]

    static let SYSTEMIC_DISEASES = [
    "Diabetes Mellitus (DM)",
    "Hypertension (HTN)",
    "CVA (Stroke / Neurological)",
    "Asthma / Respiratory",
    "Heart Disease / Congenital",
    "Polio",
    "Paralysis / Cerebral Palsy",
    "Epilepsy / Seizures"
    ]

    static let ALLERGIES_LIST = [
    "Nil Known Drug Allergies",
    "Penicillin",
    "Xylocaine (Lidocaine)",
    "Sulpha Drugs",
    "Atropine",
    "Drosyn (Phenylephrine)",
    "NSAIDs / Aspirin",
    "Other Allergies"
    ]

    static let CURRENT_TREATMENTS = [
    "None",
    "Anticoagulants",
    "Insulin Therapy",
    "Antipsychotics / Neurological",
    "Anti-hypertensives",
    "Bronchodilators / Inhalers",
    "Other Medications"
    ]

    static let NUTRITIONAL_STATUS = [
    "Normal / Well-Nourished",
    "Mild Malnutrition",
    "Severe Malnutrition",
    "Underweight for Age",
    "Overweight / Obese",
    "Stunted Growth"
    ]

    static let GUMS_CONDITION = ["Healthy", "Gingivitis / Redness", "Bleeding Gums", "Swollen / Abscess", "Gingival Recession"]
    static let ORAL_HYGIENE_INDEX = ["Good (Clean)", "Fair (Mild Plaque)", "Poor (Heavy Plaque / Calculus)", "Stains / Calculus Noted"]
    static let FLUOROSIS_STAGE = ["None", "Mild (White Flecks)", "Moderate (Browning)", "Severe (Pitting)"]
    static let OCCLUSION_ALIGNMENT = ["Normal Class I", "Class II Overbite", "Class III Underbite", "Crowding", "Crossbite", "Open Bite", "Spacing"]
    static let DENTAL_SYMPTOMS = [
    "Reports Toothache / Pain",
    "Hot / Cold Sensitivity",
    "Chipped / Fractured Tooth",
    "Food Lodging / Impaction",
    "Loose / Mobile Tooth",
    "Stains / Tartar / Calculus Noted"
    ]
    static let DENTAL_HABITS = ["None", "Thumb Sucking", "Tongue Thrusting", "Mouth Breathing", "Bruxism (Teeth Grinding)"]
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
