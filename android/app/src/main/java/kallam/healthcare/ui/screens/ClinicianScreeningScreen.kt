package kallam.healthcare.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material3.Checkbox
import androidx.compose.material3.Divider
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.unit.dp
import kallam.healthcare.data.ClinicianViewModel
import kallam.healthcare.ui.components.HeroCard
import kallam.healthcare.ui.components.HeroSingleSelectDropdown
import kallam.healthcare.ui.components.HeroMultiSelectDropdown
import kallam.healthcare.ui.components.HeroFormSectionHeader
import kallam.healthcare.ui.components.Notice
import kallam.healthcare.ui.components.PrimaryGradientButton
import kallam.healthcare.ui.components.StatusBarSpacer
import kallam.healthcare.ui.theme.HeroBlue
import kallam.healthcare.ui.theme.HeroOrange

/**
 * A flag in words, and in a colour that means the same thing.
 */
@Composable
private fun flagColour(flag: String) = when (flag) {
    "ALERT" -> MaterialTheme.colorScheme.error
    "WATCH" -> HeroOrange
    else -> HeroBlue
}

private fun flagWord(flag: String) = when (flag) {
    "GOOD" -> "Normal"
    "WATCH" -> "Needs watching"
    "ALERT" -> "Needs attention"
    else -> flag.lowercase().replaceFirstChar { c -> c.uppercase() }
}

// ─── CLINICAL CONSTANTS FROM SPECIALIST DOCTORS (IMAGES 1, 2, 3, 4, 5) ───

// Visual Acuity (Snellen & Low Vision Scale - Image 3)
private val ACUITY = listOf(
    "6/6", "6/9", "6/12", "6/18", "6/24", "6/36", "6/60",
    "3/60", "2/60", "1/60", "<6/60",
    "CF @ 1/2 meter", "CF CF (Close to Face)",
    "HM+ (Hand Movements)",
    "PL + PR Accurate", "PL + PR Inaccurate",
    "NLP (No Light Perception)"
)

// Near Vision Scale (Image 3)
private val NEAR_VISION = listOf(
    "N6 (Normal)", "N8", "N10", "N12", "N18", "N24", "N36"
)

// Testing Condition (Image 3)
private val VISION_TEST_CONDITION = listOf(
    "Unaided", "Aided (With Present Glasses)", "Pinhole (PH)"
)

// External Anterior Symptoms / Signs (Image 3)
private val EXTERNAL_SIGNS = listOf(
    "Ptosis (Lid Droop)",
    "Swelling / Edema",
    "Redness / Congestion",
    "Watering / Epiphora",
    "Purulent Discharge",
    "Mucoid Discharge",
    "Foreign Body Sensation"
)

// Anterior Segment Examination (Image 4)
private val EYE_LASHES = listOf("Normal", "Distichiasis (Double Row)", "Trichiasis (Inward Growth)", "Madarosis (Lash Loss)", "Other Abnormality")
private val EYE_LIDS = listOf("Normal", "Ptosis (Drooping)", "Entropion (Inward Turning)", "Ectropion (Outward Turning)", "Blepharitis / Stye", "Chalazion", "Other Abnormality")
private val CONJUNCTIVA = listOf("Normal", "Congestion / Redness", "Dryness", "Itching / Allergic", "Purulent Discharge", "Mucoid Discharge", "Bitot's Spots", "Other Abnormality")
private val SCLERA = listOf("Normal", "Jaundice / Icterus", "Scleral Congestion", "Episcleritis", "Other Abnormality")
private val CORNEA = listOf("Normal / Clear", "Congestion / Opacity", "Foreign Body / Abrasion", "Corneal Ulcer", "Keratoconus", "Other Abnormality")
private val ANTERIOR_CHAMBER = listOf("Normal / Quiet", "Shallow AC", "Deep AC", "Cells / Flare (+)", "Hyphema", "Hypopyon")
private val IRIS = listOf("Normal", "Coloboma", "Heterochromia", "Synechiae", "Atrophy", "Other Abnormality")
private val PUPIL_SIZE = listOf("Normal (3-5mm)", "Dilated (Mydriasis)", "Constricted (Miosis)", "Anisocoria (Unequal)")
private val PUPIL_LIGHT_REACTION = listOf("Normal / Brisk", "Sluggish", "Non-Reactive to Light", "Afferent Pupillary Defect (RAPD)")
private val EYE_LENS = listOf("Normal / Clear", "Congenital Cataract", "Cataractous Opacity", "Subluxation / Dislocated", "Aphakia", "Pseudophakia (IOL)")

// Posterior Segment / Fundus Examination (Image 4)
private val VITREOUS = listOf("Normal / Clear", "Vitreous Floaters", "Vitreous Hemorrhage", "Asteroid Hyalosis")
private val OPTIC_DISC = listOf("Normal Pink (C:D 0.3)", "Pale / Optic Atrophy", "Papilledema / Swollen", "Cupping (C:D > 0.5)")
private val MACULA = listOf("Normal Foveal Reflex", "Dull Reflex", "Macular Edema", "Macular Scar", "Cherry-Red Spot")
private val RETINA = listOf("Normal Background", "Retinal Hemorrhages", "Hard Exudates", "ROP Retinopathy Signs", "Retinitis Pigmentosa", "Retinal Detachment / Tear")
private val BLOOD_VESSELS = listOf("Normal (A:V 2:3)", "Tortuous / Dilated", "Attenuated / Narrow", "Neovascularization")

// Alignment, Motility, Tonometry & Color Vision (Images 3, 4, 5)
private val OCULAR_MOTILITY = listOf("Full in all 9 Gazes", "Restricted Elevation", "Restricted Depression", "Restricted Abduction", "Restricted Adduction", "Nystagmus")
private val SQUINT_ALIGNMENT = listOf("Normal (Orthophoria)", "Esotropia (Crossed-In)", "Exotropia (Turned-Out)", "Alternating Squint", "Hypertropia", "Hypotropia", "Phoria / Latent Squint")
private val COLOR_VISION = listOf("17/17 (Normal Pass)", "15-16/17 (Borderline)", "<15/17 (Defective Red-Green)", "Total Color Blindness", "Ishihara Partial Deficit", "Uncooperative")
private val GONIOSCOPY = listOf("Grade 4 (Open Angle)", "Grade 3 Open", "Grade 2 Narrow", "Grade 1 Narrow", "Closed Angle")
private val DOMINANT_EYE = listOf("Right Eye (RE)", "Left Eye (LE)")
private val DILATATION_STATUS = listOf("No (Undilated)", "Yes - Tropicamide + Phenylephrine", "Yes - Cyclopentolate 1%", "Yes - Homatropine 2%", "Yes - Atropine 1%")
private val GLASSES_STATUS = listOf("None (Emmetropic)", "Wearing Prescribed Glasses (<1 yr)", "Wearing Glasses (1-2 yrs)", "Wearing Glasses (>2 yrs)", "Glasses Broken / Outdated", "Refraction Needed")

// Vision Interventions & Treatments (Images 3, 4)
private val VISION_TREATMENTS = listOf(
    "Rx Prescribed (Eye Drops / Medications)",
    "Glasses Prescribed (Spectacle Correction)",
    "Refraction Needed / Schedule Formal Exam",
    "Pediatric Ophthalmologist Referral",
    "Amblyopia Patching Therapy",
    "Lubricating / Artificial Tear Drops",
    "Anti-Allergic Eye Drops",
    "Antibiotic Eye Drops",
    "Vision Hygiene & Screen Time Guidance"
)

// Image 1: Ocular Investigations
private val OCULAR_INVESTIGATIONS = listOf(
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
)

// Image 1: General & Blood Investigations
private val GENERAL_INVESTIGATIONS = listOf(
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
)

// Image 1: Additional Diagnostic & Specialized Tests
private val ADDITIONAL_INVESTIGATIONS = listOf(
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
)

// Image 2: Birth & Perinatal History
private val GESTATIONAL_AGE = listOf("Full Term (37-40 weeks)", "Premature (<37 weeks)", "Post-term (>40 weeks)")
private val CONSANGUINITY_MARRIAGE = listOf("Non-Consanguineous", "Consanguineous Marriage (Parents Related)")
private val PARENTAL_MYOPIA = listOf("No Family History", "One Parent Myopic", "Both Parents Myopic", "High Myopia / Eye Disorder in Family")

// Image 2 & 5: Systemic Health Issues
private val SYSTEMIC_DISEASES = listOf(
    "Diabetes Mellitus (DM)",
    "Hypertension (HTN)",
    "CVA (Stroke / Neurological)",
    "Asthma / Respiratory",
    "Heart Disease / Congenital",
    "Polio",
    "Paralysis / Cerebral Palsy",
    "Epilepsy / Seizures"
)

// Image 5: Drug Allergies
private val ALLERGIES_LIST = listOf(
    "Nil Known Drug Allergies",
    "Penicillin",
    "Xylocaine (Lidocaine)",
    "Sulpha Drugs",
    "Atropine",
    "Drosyn (Phenylephrine)",
    "NSAIDs / Aspirin",
    "Other Allergies"
)

// Image 5: Current Treatment & Medications
private val CURRENT_TREATMENTS = listOf(
    "None",
    "Anticoagulants",
    "Insulin Therapy",
    "Antipsychotics / Neurological",
    "Anti-hypertensives",
    "Bronchodilators / Inhalers",
    "Other Medications"
)

// Image 5: Nutritional Screening
private val NUTRITIONAL_STATUS = listOf(
    "Normal / Well-Nourished",
    "Mild Malnutrition",
    "Severe Malnutrition",
    "Underweight for Age",
    "Overweight / Obese",
    "Stunted Growth"
)

// Dental Specialist Clinical Options
private val GUMS_CONDITION = listOf("Healthy", "Gingivitis / Redness", "Bleeding Gums", "Swollen / Abscess", "Gingival Recession")
private val ORAL_HYGIENE_INDEX = listOf("Good (Clean)", "Fair (Mild Plaque)", "Poor (Heavy Plaque / Calculus)", "Stains / Calculus Noted")
private val FLUOROSIS_STAGE = listOf("None", "Mild (White Flecks)", "Moderate (Browning)", "Severe (Pitting)")
private val OCCLUSION_ALIGNMENT = listOf("Normal Class I", "Class II Overbite", "Class III Underbite", "Crowding", "Crossbite", "Open Bite", "Spacing")
private val DENTAL_SYMPTOMS = listOf(
    "Reports Toothache / Pain",
    "Hot / Cold Sensitivity",
    "Chipped / Fractured Tooth",
    "Food Lodging / Impaction",
    "Loose / Mobile Tooth",
    "Stains / Tartar / Calculus Noted"
)
private val DENTAL_HABITS = listOf("None", "Thumb Sucking", "Tongue Thrusting", "Mouth Breathing", "Bruxism (Teeth Grinding)")
private val DENTAL_TREATMENTS = listOf(
    "Prophylactic Cleaning & Scaling",
    "Fluoride Varnish Application",
    "Pit & Fissure Sealant",
    "Restorative Dental Filling",
    "Pulpectomy / Root Treatment",
    "Tooth Extraction",
    "Orthodontic Referral",
    "Urgent Pediatric Dental Referral"
)

// ENT Specialist Clinical Options
private val HEARING_ACUITY = listOf("Normal (Whisper test +)", "Mild Hearing Loss", "Moderate Loss", "Severe Loss", "Uncooperative")
private val EAR_CANAL_EXAM = listOf("Normal", "Impacted Cerumen (Wax)", "Otitis Externa", "Otitis Media with Effusion", "Tympanic Perforation", "Retracted Drum")
private val NASAL_EXAM = listOf("Normal", "Allergic Rhinitis", "Deviated Septum (DNS)", "Nasal Polyps", "Hypertrophied Turbinates", "Foreign Body")
private val THROAT_TONSILS = listOf("Normal", "Tonsillar Grade I-II", "Tonsillar Grade III-IV (Enlarged)", "Acute Pharyngitis / Tonsillitis", "Adenoid Facies / Mouth Breathing")
private val SPEECH_VOICE = listOf("Normal Speech", "Hypernasality", "Stuttering / Stammering", "Articulation Disorder")
private val ENT_TREATMENTS = listOf(
    "Ear Wax Removal / Cerumenolytic",
    "Antihistamine / Decongestant",
    "Antibiotic Nasal / Ear Drops",
    "Formal Audiometry & Tympanometry",
    "ENT Specialist Referral"
)

// Dermatology Specialist Clinical Options
private val SKIN_CONDITIONS = listOf("Normal", "Eczema / Atopic Dermatitis", "Tinea / Fungal Ringworm", "Scabies / Mite Infestation", "Impetigo / Bacterial Infection", "Urticaria / Hives", "Molluscum Contagiosum", "Vitiligo / Hypopigmentation", "Psoriasis", "Alopecia Areata")
private val SKIN_LOCATIONS = listOf("Face & Neck", "Scalp & Hairline", "Flexural (Elbows/Knees)", "Trunk & Back", "Hands & Feet", "Generalized")
private val PRURITUS_PARASITIC = listOf("Absent", "Mild / Intermittent", "Severe / Nocturnal", "Pediculosis Capitis (Lice)", "Scabies Infestation Suspected")
private val SKIN_TREATMENTS = listOf(
    "Emollients & Hydrating Ointment",
    "Topical Antifungal Cream",
    "Topical Mild Steroid Cream",
    "Anti-Lice Shampoo & Fine Comb",
    "Oral Antihistamines",
    "Dermatology Specialist Referral"
)

// Musculoskeletal Specialist Clinical Options
private val POSTURE_ALIGN = listOf("Normal Spinal Alignment", "Scoliosis Suspected (Adam's Test +)", "Kyphosis / Round Back", "Lordosis / Sway Back", "Shoulder Asymmetry", "Scapular Winging")
private val GAIT_LIMB = listOf("Normal Gait", "Flat Feet (Pes Planus)", "Knock-Knees (Genu Valgum)", "Bow-Legs (Genu Varum)", "In-Toeing / Out-Toeing Gait", "Limping / Antalgic Gait")
private val SPINE_TREATMENTS = listOf(
    "Ergonomic & Posture Correction",
    "Physical Therapy & Core Exercises",
    "Arch Support / Orthotic Insoles",
    "Pediatric Orthopaedic Referral"
)
private val JOINT_SYMPTOMS = listOf(
    "Joint Pain / Tenderness",
    "Joint Swelling / Effusion",
    "Restricted Range of Motion",
    "Joint Laxity / Hypermobility"
)

// Immunisation & General Health Clinical Options
private val VACCINE_STATUS = listOf("Up to Date for Age", "Partially Vaccinated", "Significantly Delayed / Unvaccinated", "Card Not Available")
private val MISSED_VACCINES = listOf("BCG", "OPV / IPV Polio", "Hepatitis B", "DPT / Pentavalent", "Rotavirus", "PCV", "MMR (Measles, Mumps, Rubella)", "Typhoid", "Varicella (Chickenpox)", "Hepatitis A", "HPV (Adolescents)")
private val VACCINE_TREATMENTS = listOf("Schedule Catch-up Immunization", "PHC / Vaccination Clinic Referral", "Parent Vaccine Counseling")

// Haemoglobin & Anaemia Clinical Options
private val PALLOR_SIGNS = listOf("None (Normal Pigmentation)", "Mild Conjunctival Pallor", "Moderate Conjunctival & Tongue Pallor", "Severe Palmar / Nailbed Pallor")
private val HB_TREATMENTS = listOf(
    "Iron & Folic Acid Syrup/Tablets",
    "Deworming (Albendazole Tablet)",
    "Dietary Iron Counseling (Greens, Dates, Jaggery)",
    "Repeat Hb in 30 Days",
    "Pediatric Hematology Referral"
)

/**
 * One child's screening, scoped to the clinician's own specialty.
 */
@Composable
fun ClinicianScreeningScreen(
    campId: String,
    kidId: String,
    clinician: ClinicianViewModel,
    onBack: () -> Unit,
) {
    val form by clinician.form.collectAsState()
    val busy by clinician.busy.collectAsState()
    val message by clinician.message.collectAsState()
    val saved by clinician.saved.collectAsState()

    val values = remember(kidId) { mutableStateMapOf<String, MutableMap<String, String>>() }
    fun fields(check: String): MutableMap<String, String> =
        values.getOrPut(check) { mutableStateMapOf() }

    LaunchedEffect(campId, kidId) { clinician.openChild(campId, kidId) }
    LaunchedEffect(saved) { if (saved) onBack() }

    val f = form
    LazyColumn(Modifier.fillMaxSize()) {
        item {
            StatusBarSpacer()
            Row(
                Modifier.fillMaxWidth().padding(8.dp, 8.dp, 20.dp, 0.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                IconButton(onClick = { clinician.closeChild(); onBack() }) {
                    Icon(Icons.AutoMirrored.Outlined.ArrowBack, contentDescription = "Back")
                }
                Column(Modifier.weight(1f)) {
                    Text(
                        f?.child?.name ?: "…",
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold,
                    )
                    if (f != null) {
                        Text(
                            listOfNotNull(
                                listOf(f.child.grade, f.child.section)
                                    .filter { it.isNotBlank() }.joinToString(" ").ifBlank { null },
                                f.child.gender.ifBlank { null },
                                f.child.age?.let { "$it years" },
                            ).joinToString(" · "),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }
            Spacer(Modifier.height(12.dp))
        }

        if (f == null) {
            item {
                Text(
                    if (busy) "Opening…" else message.ifBlank { "Could not open this form." },
                    Modifier.padding(20.dp),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        } else if (f.consentStatus != "GRANTED" && f.consentStatus != "PAPER") {
            item {
                Notice(
                    if (f.consentStatus == "DECLINED")
                        "This guardian declined consent for this camp. Nothing can be recorded."
                    else "No consent on file for this child yet. Nothing can be recorded.",
                    error = true,
                )
            }
        } else {
            item {
                if (f.specialty.isNotBlank()) {
                    Notice(
                        "${f.specialty}: " + f.checks.joinToString(", ").ifBlank { "nothing to record here" } +
                            if (f.otherSpecialties.isNotEmpty())
                                ". ${f.otherSpecialties.joinToString(", ")} " +
                                    (if (f.otherSpecialties.size == 1) "is" else "are") +
                                    " another clinician's at this camp."
                            else "",
                        error = false,
                    )
                }
                if (f.excludedByConsent.isNotEmpty()) {
                    Notice(
                        "Consent excludes: ${f.excludedByConsent.joinToString(", ")}.",
                        error = false,
                    )
                }
                if (message.isNotBlank()) Notice(message, error = true)
            }

            if (f.attendance == "ABSENT") {
                item {
                    Notice(
                        "${f.child.name} is marked ABSENT for this camp session. No screening examinations or options need to be selected.",
                        error = false
                    )
                }
                item {
                    val markPresent: () -> Unit = {
                        clinician.markAttendance(campId, kidId, "PRESENT")
                    }
                    TextButton(onClick = markPresent, modifier = Modifier.padding(horizontal = 12.dp)) {
                        Text("Mark Present instead")
                    }
                }
                item {
                    Spacer(Modifier.height(10.dp))
                    val onConfirmAbsent: () -> Unit = {
                        clinician.save(campId, kidId, emptyMap(), note = "Student absent")
                    }
                    PrimaryGradientButton(
                        text = "Confirm Absent & Close",
                        onClick = onConfirmAbsent,
                        modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp),
                        enabled = !busy,
                    )
                    Spacer(Modifier.height(28.dp))
                }
            } else {
                for (check in f.checks) {
                    item(key = check) {
                        HeroCard(Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 7.dp)) {
                            Column(Modifier.padding(16.dp)) {
                                Text(
                                    check,
                                    style = MaterialTheme.typography.titleMedium,
                                    fontWeight = FontWeight.Bold,
                                )
                                val existing = f.findings.firstOrNull {
                                    it.checkType == check && it.flag != "NOT_MEASURED"
                                }
                                if (existing != null) {
                                    val reason =
                                        if (existing.rationale.isBlank()) ""
                                        else " — ${existing.rationale}"
                                    Spacer(Modifier.height(4.dp))
                                    Text(
                                        "Recorded: ${flagWord(existing.flag)}$reason",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = flagColour(existing.flag),
                                    )
                                }
                                Spacer(Modifier.height(10.dp))
                                CheckFields(check, fields(check))
                            }
                        }
                    }
                }

                // Universal Pediatric History & Diagnostic Investigations Requisition Card
                item(key = "history_investigations") {
                    HeroCard(Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 7.dp)) {
                        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                            HeroFormSectionHeader(
                                "Birth History & Co-morbidities (Images 2 & 5)",
                                subtitle = "Perinatal history, chronic illness & allergies"
                            )
                            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                ChoiceField("Gestational Status", GESTATIONAL_AGE, fields("Systemic"), "gestationalAge", Modifier.weight(1f))
                                NumberField("Birth Weight (kg)", fields("Systemic"), "birthWeightKg", Modifier.weight(1f))
                            }
                            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                ChoiceField("Consanguinity", CONSANGUINITY_MARRIAGE, fields("Systemic"), "consanguinity", Modifier.weight(1f))
                                ChoiceField("Parental Myopia", PARENTAL_MYOPIA, fields("Systemic"), "parentalMyopia", Modifier.weight(1f))
                            }
                            ToggleField("Incubation / NICU Stay Required", fields("Systemic"), "incubationStay")

                            Spacer(Modifier.height(4.dp))
                            HeroFormSectionHeader("Systemic Health Issues & Allergies")
                            MultiChoiceField(SYSTEMIC_DISEASES, fields("Systemic"), "systemicDiseases", label = "Systemic Diseases (DM, Polio, Paralysis...)")
                            MultiChoiceField(ALLERGIES_LIST, fields("Systemic"), "drugAllergies", label = "Drug Allergies (Penicillin, Xylocaine, Sulpha...)")
                            MultiChoiceField(CURRENT_TREATMENTS, fields("Systemic"), "currentTreatments", label = "Current Medications (Insulin, Anticoagulants...)")
                            ChoiceField("Nutritional Screening", NUTRITIONAL_STATUS, fields("Systemic"), "nutritionalStatus", Modifier.fillMaxWidth())

                            Spacer(Modifier.height(4.dp))
                            HeroFormSectionHeader(
                                "Diagnostic Lab Requisition Orders (Image 1)",
                                subtitle = "Maxivision clinical pathology & imaging tests"
                            )
                            MultiChoiceField(GENERAL_INVESTIGATIONS, fields("Investigations"), "generalLabs", label = "Routine Blood & Urine Tests (CBP, RBS, HbA1c...)")
                            MultiChoiceField(ADDITIONAL_INVESTIGATIONS, fields("Investigations"), "specialistTests", label = "Specialist & Imaging (LFT, Thyroid, Mantoux, MRI...)")
                        }
                    }
                }

                item {
                    val markAbsent: () -> Unit = {
                        clinician.markAttendance(campId, kidId, "ABSENT")
                    }
                    TextButton(onClick = markAbsent, modifier = Modifier.padding(horizontal = 12.dp)) {
                        Text("Child is absent today")
                    }
                }

                item {
                    Spacer(Modifier.height(10.dp))
                    val onSave: () -> Unit = {
                        clinician.save(campId, kidId, snapshot(values), note = "")
                    }
                    PrimaryGradientButton(
                        text = if (busy) "Saving…" else "Save Screening Record",
                        onClick = onSave,
                        modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp),
                        enabled = !busy && f.checks.isNotEmpty(),
                    )
                    Spacer(Modifier.height(10.dp))
                    Text(
                        "A supervising physician reviews what you record before the child's parent can see it.",
                        Modifier.padding(horizontal = 20.dp),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Spacer(Modifier.height(28.dp))
                }
            }
        }
    }
}

/**
 * World-Class Clinical Examination Form Renderer for all Specialties.
 */
@Composable
private fun CheckFields(check: String, fields: MutableMap<String, String>) {
    when (check) {
        "Height & weight" -> Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            NumberField("Height (cm)", fields, "heightCm", Modifier.weight(1f))
            NumberField("Weight (kg)", fields, "weightKg", Modifier.weight(1f))
        }
        "Vision" -> Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            HeroFormSectionHeader("Visual Acuity (Distant & Near) - Image 3", subtitle = "Snellen distance & near reading metrics per eye")
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                ChoiceField("Distance OD (Right)", ACUITY, fields, "rightAcuity", Modifier.weight(1f))
                ChoiceField("Distance OS (Left)", ACUITY, fields, "leftAcuity", Modifier.weight(1f))
            }
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                ChoiceField("Near OD (Right)", NEAR_VISION, fields, "rightNearVision", Modifier.weight(1f))
                ChoiceField("Near OS (Left)", NEAR_VISION, fields, "leftNearVision", Modifier.weight(1f))
            }
            ChoiceField("Testing Condition", VISION_TEST_CONDITION, fields, "testingCondition", Modifier.fillMaxWidth())

            Spacer(Modifier.height(2.dp))
            HeroFormSectionHeader("External Anterior Symptoms / Signs (Image 3)")
            MultiChoiceField(EXTERNAL_SIGNS, fields, "externalSigns", label = "Select External Signs (Ptosis, Swelling, Watering...)")

            Spacer(Modifier.height(2.dp))
            HeroFormSectionHeader("Present Glasses Prescription (Image 5)")
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                SimpleTextField("OD Sph", fields, "presentOdSph", Modifier.weight(1f), placeholder = "-1.50")
                SimpleTextField("OD Cyl", fields, "presentOdCyl", Modifier.weight(1f), placeholder = "-0.50")
                SimpleTextField("OD Axi", fields, "presentOdAxi", Modifier.weight(1f), placeholder = "180")
                SimpleTextField("OD CVA", fields, "presentOdCva", Modifier.weight(1f), placeholder = "6/6")
            }
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                SimpleTextField("OS Sph", fields, "presentOsSph", Modifier.weight(1f), placeholder = "-1.75")
                SimpleTextField("OS Cyl", fields, "presentOsCyl", Modifier.weight(1f), placeholder = "-0.50")
                SimpleTextField("OS Axi", fields, "presentOsAxi", Modifier.weight(1f), placeholder = "175")
                SimpleTextField("OS CVA", fields, "presentOsCva", Modifier.weight(1f), placeholder = "6/6")
            }

            Spacer(Modifier.height(2.dp))
            HeroFormSectionHeader("New Glasses Prescription (Image 5)")
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                SimpleTextField("OD UVA", fields, "newOdUva", Modifier.weight(1f), placeholder = "6/18")
                SimpleTextField("OD Sph", fields, "newOdSph", Modifier.weight(1f), placeholder = "-2.00")
                SimpleTextField("OD Cyl", fields, "newOdCyl", Modifier.weight(1f), placeholder = "-0.75")
                SimpleTextField("OD Axi", fields, "newOdAxi", Modifier.weight(1f), placeholder = "180")
                SimpleTextField("OD CVA", fields, "newOdCva", Modifier.weight(1f), placeholder = "6/6")
            }
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                SimpleTextField("OS UVA", fields, "newOsUva", Modifier.weight(1f), placeholder = "6/24")
                SimpleTextField("OS Sph", fields, "newOsSph", Modifier.weight(1f), placeholder = "-2.25")
                SimpleTextField("OS Cyl", fields, "newOsCyl", Modifier.weight(1f), placeholder = "-0.75")
                SimpleTextField("OS Axi", fields, "newOsAxi", Modifier.weight(1f), placeholder = "175")
                SimpleTextField("OS CVA", fields, "newOsCva", Modifier.weight(1f), placeholder = "6/6")
            }

            Spacer(Modifier.height(2.dp))
            HeroFormSectionHeader("Tonometry & Dilatation (Image 5)")
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                NumberField("NCT IOP RE (mmHg)", fields, "rightNctIop", Modifier.weight(1f))
                NumberField("NCT IOP LE (mmHg)", fields, "leftNctIop", Modifier.weight(1f))
            }
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                ChoiceField("Dominant Eye", DOMINANT_EYE, fields, "dominantEye", Modifier.weight(1f))
                ChoiceField("Dilatation Status", DILATATION_STATUS, fields, "dilatation", Modifier.weight(1f))
            }
            SimpleTextField("Dilatation Time", fields, "dilatationTime", Modifier.fillMaxWidth(), placeholder = "e.g. 10:30 AM")

            Spacer(Modifier.height(2.dp))
            HeroFormSectionHeader("Anterior Segment Examination (Image 4)", subtitle = "Lashes, Lids, Conjunctiva, Sclera, Cornea, AC, Iris, Pupil & Lens")
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                ChoiceField("Eyelashes (OD)", EYE_LASHES, fields, "rightLashes", Modifier.weight(1f))
                ChoiceField("Eyelashes (OS)", EYE_LASHES, fields, "leftLashes", Modifier.weight(1f))
            }
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                ChoiceField("Eyelid (OD)", EYE_LIDS, fields, "rightLid", Modifier.weight(1f))
                ChoiceField("Eyelid (OS)", EYE_LIDS, fields, "leftLid", Modifier.weight(1f))
            }
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                ChoiceField("Conjunctiva (OD)", CONJUNCTIVA, fields, "rightConjunctiva", Modifier.weight(1f))
                ChoiceField("Conjunctiva (OS)", CONJUNCTIVA, fields, "leftConjunctiva", Modifier.weight(1f))
            }
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                ChoiceField("Sclera (OD)", SCLERA, fields, "rightSclera", Modifier.weight(1f))
                ChoiceField("Sclera (OS)", SCLERA, fields, "leftSclera", Modifier.weight(1f))
            }
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                ChoiceField("Cornea (OD)", CORNEA, fields, "rightCornea", Modifier.weight(1f))
                ChoiceField("Cornea (OS)", CORNEA, fields, "leftCornea", Modifier.weight(1f))
            }
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                ChoiceField("Anterior Chamber (OD)", ANTERIOR_CHAMBER, fields, "rightAc", Modifier.weight(1f))
                ChoiceField("Anterior Chamber (OS)", ANTERIOR_CHAMBER, fields, "leftAc", Modifier.weight(1f))
            }
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                ChoiceField("Iris (OD)", IRIS, fields, "rightIris", Modifier.weight(1f))
                ChoiceField("Iris (OS)", IRIS, fields, "leftIris", Modifier.weight(1f))
            }
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                ChoiceField("Pupil Size", PUPIL_SIZE, fields, "pupilSize", Modifier.weight(1f))
                ChoiceField("Light Reaction", PUPIL_LIGHT_REACTION, fields, "pupilReaction", Modifier.weight(1f))
            }
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                ChoiceField("Crystalline Lens (OD)", EYE_LENS, fields, "rightLens", Modifier.weight(1f))
                ChoiceField("Crystalline Lens (OS)", EYE_LENS, fields, "leftLens", Modifier.weight(1f))
            }

            Spacer(Modifier.height(2.dp))
            HeroFormSectionHeader("Posterior Segment / Fundus Examination (Image 4)", subtitle = "Vitreous, Optic Disc, Macula, Retina & Blood Vessels")
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                ChoiceField("Optic Disc (OD)", OPTIC_DISC, fields, "rightOpticDisc", Modifier.weight(1f))
                ChoiceField("Optic Disc (OS)", OPTIC_DISC, fields, "leftOpticDisc", Modifier.weight(1f))
            }
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                ChoiceField("Macula & Fovea (OD)", MACULA, fields, "rightMacula", Modifier.weight(1f))
                ChoiceField("Macula & Fovea (OS)", MACULA, fields, "leftMacula", Modifier.weight(1f))
            }
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                ChoiceField("Background Retina (OD)", RETINA, fields, "rightRetina", Modifier.weight(1f))
                ChoiceField("Background Retina (OS)", RETINA, fields, "leftRetina", Modifier.weight(1f))
            }
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                ChoiceField("Blood Vessels (OD)", BLOOD_VESSELS, fields, "rightVessels", Modifier.weight(1f))
                ChoiceField("Blood Vessels (OS)", BLOOD_VESSELS, fields, "leftVessels", Modifier.weight(1f))
            }

            Spacer(Modifier.height(2.dp))
            HeroFormSectionHeader("Motility, Alignment, Gonioscopy & Color Vision")
            ChoiceField("Ocular Motility (9 Gazes)", OCULAR_MOTILITY, fields, "ocularMotility", Modifier.fillMaxWidth())
            ChoiceField("Ocular Alignment / Squint", SQUINT_ALIGNMENT, fields, "squintAlignment", Modifier.fillMaxWidth())
            ChoiceField("Color Vision (Ishihara /17)", COLOR_VISION, fields, "colorVision", Modifier.fillMaxWidth())
            ChoiceField("Gonioscopy Angle", GONIOSCOPY, fields, "gonioscopy", Modifier.fillMaxWidth())
            ChoiceField("Glasses Status", GLASSES_STATUS, fields, "glassesWorn", Modifier.fillMaxWidth())
            ToggleField("Strabismus / Squint Noted", fields, "squint")

            Spacer(Modifier.height(2.dp))
            HeroFormSectionHeader("Ocular Diagnostic Investigations (Image 1)")
            MultiChoiceField(OCULAR_INVESTIGATIONS, fields, "ocularInvestigations", label = "Order Ocular Tests (Keratometry, A-Scan, OCT, FFA...)")

            Spacer(Modifier.height(2.dp))
            HeroFormSectionHeader("Recommended Vision Interventions (Images 3, 4)")
            MultiChoiceField(VISION_TREATMENTS, fields, "treatmentsRecommended", label = "Select Vision Interventions")

            Spacer(Modifier.height(2.dp))
            HeroFormSectionHeader("Diagnosis & Plan of Care (Image 4)")
            SimpleTextField("Provisional Diagnosis", fields, "provisionalDiagnosis", Modifier.fillMaxWidth(), placeholder = "e.g. Myopic Astigmatism OD/OS")
            SimpleTextField("Plan of Care", fields, "planOfCare", Modifier.fillMaxWidth(), placeholder = "Corrective glasses, repeat exam in 6 months...")
            SimpleTextField("Final Diagnosis", fields, "finalDiagnosis", Modifier.fillMaxWidth(), placeholder = "e.g. Simple Myopia OD -2.00, OS -2.25")
        }
        "Dental" -> Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            HeroFormSectionHeader("Tooth Index (dmft / DMFT)")
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                NumberField("Carious (Decayed)", fields, "cariesCount", Modifier.weight(1f))
                NumberField("Missing", fields, "missingCount", Modifier.weight(1f))
                NumberField("Filled", fields, "filledCount", Modifier.weight(1f))
            }

            Spacer(Modifier.height(2.dp))
            HeroFormSectionHeader("Gums & Periodontium")
            MultiChoiceField(GUMS_CONDITION, fields, "gums", label = "Gums Condition (Healthy, Bleeding, Swollen, Recession...)")
            ChoiceField("Oral Hygiene Index", ORAL_HYGIENE_INDEX, fields, "hygiene", Modifier.fillMaxWidth())

            Spacer(Modifier.height(2.dp))
            HeroFormSectionHeader("Enamel, Alignment & Occlusion")
            ChoiceField("Dental Fluorosis", FLUOROSIS_STAGE, fields, "fluorosis", Modifier.fillMaxWidth())
            MultiChoiceField(OCCLUSION_ALIGNMENT, fields, "malocclusion", label = "Occlusion & Alignment (Normal, Crowding, Crossbite...)")

            Spacer(Modifier.height(2.dp))
            HeroFormSectionHeader("Symptoms, Trauma & Habits")
            MultiChoiceField(
                options = DENTAL_SYMPTOMS,
                fields = fields,
                key = "dentalSymptoms",
                label = "Symptoms & Dental Trauma (Toothache, Sensitivity, Fractures...)",
                onCustomSelect = { set ->
                    fields["dentalSymptoms"] = set.joinToString(",")
                    fields["pain"] = if (set.any { it.contains("Toothache", ignoreCase = true) }) "true" else "false"
                    fields["sensitivity"] = if (set.any { it.contains("Sensitivity", ignoreCase = true) }) "true" else "false"
                    fields["trauma"] = if (set.any { it.contains("Chipped", ignoreCase = true) }) "true" else "false"
                    fields["stainsTartar"] = if (set.any { it.contains("Stains", ignoreCase = true) }) "true" else "false"
                }
            )
            MultiChoiceField(DENTAL_HABITS, fields, "dentalHabits", label = "Oral Habits (Thumb sucking, mouth breathing...)")

            Spacer(Modifier.height(2.dp))
            HeroFormSectionHeader("Recommended Dental Treatment")
            MultiChoiceField(DENTAL_TREATMENTS, fields, "treatmentNeeded", label = "Select Dental Treatments")
        }
        "ENT" -> Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            HeroFormSectionHeader("Hearing Acuity Screening")
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                ChoiceField("Left Ear Acuity", HEARING_ACUITY, fields, "leftHearing", Modifier.weight(1f))
                ChoiceField("Right Ear Acuity", HEARING_ACUITY, fields, "rightHearing", Modifier.weight(1f))
            }

            Spacer(Modifier.height(2.dp))
            HeroFormSectionHeader("Clinical ENT Examination")
            MultiChoiceField(EAR_CANAL_EXAM, fields, "earExam", label = "Ear Canals & Tympanic Membrane Findings")
            MultiChoiceField(NASAL_EXAM, fields, "nasalExam", label = "Nasal Cavity & Septum Findings")
            MultiChoiceField(THROAT_TONSILS, fields, "throatExam", label = "Throat, Tonsils & Adenoids Findings")
            ChoiceField("Speech & Voice", SPEECH_VOICE, fields, "speechVoice", Modifier.fillMaxWidth())

            Spacer(Modifier.height(2.dp))
            HeroFormSectionHeader("Recommended ENT Interventions")
            MultiChoiceField(ENT_TREATMENTS, fields, "entTreatment", label = "Select ENT Interventions")
        }
        "Skin" -> Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            HeroFormSectionHeader("Dermatological Examination")
            MultiChoiceField(SKIN_CONDITIONS, fields, "skinCondition", label = "Primary Skin Condition & Findings")
            MultiChoiceField(SKIN_LOCATIONS, fields, "skinLocation", label = "Lesion Distribution & Body Sites")

            Spacer(Modifier.height(2.dp))
            HeroFormSectionHeader("Symptoms & Parasitic Screening")
            MultiChoiceField(
                options = listOf(
                    "Active Pruritus / Itching",
                    "Nocturnal Itching (Scabies)",
                    "Scalp Pediculosis / Head Lice",
                    "Secondary Excoriation / Crusting"
                ),
                fields = fields,
                key = "pruritus",
                label = "Symptoms & Parasitic Signs (Itching, Lice...)",
                onCustomSelect = { set ->
                    fields["pruritus"] = set.joinToString(",")
                    fields["itching"] = if (set.any { it.contains("Itching", ignoreCase = true) }) "true" else "false"
                    fields["lice"] = if (set.any { it.contains("Lice", ignoreCase = true) }) "true" else "false"
                }
            )

            Spacer(Modifier.height(2.dp))
            HeroFormSectionHeader("Recommended Dermatological Care")
            MultiChoiceField(SKIN_TREATMENTS, fields, "skinTreatment", label = "Select Dermatological Treatments")
        }
        "Spine" -> Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            HeroFormSectionHeader("Musculoskeletal & Posture Assessment")
            MultiChoiceField(POSTURE_ALIGN, fields, "posture", label = "Spinal Posture & Alignment (Slouching, Scoliosis...)")
            MultiChoiceField(GAIT_LIMB, fields, "gaitLimb", label = "Gait & Lower Limb Assessment (Flat Feet, Knock-knees...)")

            Spacer(Modifier.height(2.dp))
            HeroFormSectionHeader("Functional Symptoms & Joint Exam")
            MultiChoiceField(
                options = JOINT_SYMPTOMS,
                fields = fields,
                key = "jointSymptoms",
                label = "Joint Symptoms & ROM (Pain, Swelling, Restricted Motion...)",
                onCustomSelect = { set ->
                    fields["jointSymptoms"] = set.joinToString(",")
                    fields["jointPain"] = if (set.any { it.contains("Pain", ignoreCase = true) }) "true" else "false"
                    fields["restrictedMotion"] = if (set.any { it.contains("Restricted", ignoreCase = true) }) "true" else "false"
                }
            )

            Spacer(Modifier.height(2.dp))
            HeroFormSectionHeader("Recommended Musculoskeletal Interventions")
            MultiChoiceField(SPINE_TREATMENTS, fields, "spineTreatment", label = "Select Orthopaedic Interventions")
        }
        "Immunisation review" -> Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            HeroFormSectionHeader("Immunization Status Review")
            ChoiceField("Overall Vaccine Status for Age", VACCINE_STATUS, fields, "vaccineStatus", Modifier.fillMaxWidth())

            Spacer(Modifier.height(2.dp))
            HeroFormSectionHeader("Missed Routine Immunizations")
            MultiChoiceField(MISSED_VACCINES, fields, "missedVaccines", label = "Select Missed Routine Vaccines")

            Spacer(Modifier.height(2.dp))
            HeroFormSectionHeader("Recommended Immunization Action")
            MultiChoiceField(VACCINE_TREATMENTS, fields, "vaccineTreatment", label = "Select Recommended Action")
        }
        "Haemoglobin" -> Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            HeroFormSectionHeader("Anaemia & Haemoglobin Screening")
            NumberField("Haemoglobin Level (g/dL)", fields, "hb", Modifier.fillMaxWidth())
            ChoiceField("Clinical Pallor Sign", PALLOR_SIGNS, fields, "pallor", Modifier.fillMaxWidth())

            Spacer(Modifier.height(2.dp))
            HeroFormSectionHeader("Recommended Anaemia Management")
            MultiChoiceField(HB_TREATMENTS, fields, "hbTreatment", label = "Select Anaemia Interventions")
        }
        else -> Text(
            "This check has no form in the app yet. Record it in the console.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

@Composable
private fun SimpleTextField(
    label: String,
    fields: MutableMap<String, String>,
    key: String,
    modifier: Modifier = Modifier,
    placeholder: String = ""
) {
    OutlinedTextField(
        value = fields[key] ?: "",
        onValueChange = { fields[key] = it },
        modifier = modifier,
        label = { Text(label) },
        placeholder = if (placeholder.isNotBlank()) { { Text(placeholder) } } else null,
        singleLine = true,
        shape = RoundedCornerShape(12.dp),
        colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = HeroOrange),
    )
}

@Composable
private fun NumberField(
    label: String,
    fields: MutableMap<String, String>,
    key: String,
    modifier: Modifier = Modifier,
) {
    OutlinedTextField(
        value = fields[key] ?: "",
        onValueChange = { fields[key] = it.filter { c -> c.isDigit() || c == '.' } },
        modifier = modifier,
        label = { Text(label) },
        singleLine = true,
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
        shape = RoundedCornerShape(12.dp),
        colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = HeroOrange),
    )
}

/** Standardized Single-Select Dropdown Field. */
@Composable
private fun ChoiceField(
    label: String,
    options: List<String>,
    fields: MutableMap<String, String>,
    key: String,
    modifier: Modifier = Modifier,
) {
    HeroSingleSelectDropdown(
        label = label,
        options = options,
        selected = fields[key] ?: "",
        onSelect = { fields[key] = it },
        modifier = modifier
    )
}

@Composable
private fun ToggleField(label: String, fields: MutableMap<String, String>, key: String) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Checkbox(
            checked = fields[key] == "true",
            onCheckedChange = { fields[key] = if (it) "true" else "false" },
        )
        Text(label, style = MaterialTheme.typography.bodyMedium)
    }
}

/** Standardized Multi-Select Dropdown Field. */
@Composable
private fun MultiChoiceField(
    options: List<String>,
    fields: MutableMap<String, String>,
    key: String,
    modifier: Modifier = Modifier,
    label: String = "Recommended Interventions",
    onCustomSelect: ((Set<String>) -> Unit)? = null
) {
    val selectedSet = remember(fields[key]) {
        (fields[key] ?: "").split(",").map { it.trim() }.filter { it.isNotBlank() }.toSet()
    }
    HeroMultiSelectDropdown(
        label = label,
        options = options,
        selected = selectedSet,
        onSelect = { newSet ->
            if (onCustomSelect != null) {
                onCustomSelect(newSet)
            } else {
                fields[key] = newSet.joinToString(",")
            }
        },
        modifier = modifier
    )
}

private fun snapshot(
    values: Map<String, MutableMap<String, String>>,
): Map<String, Map<String, String>> = values.mapValues { entry -> entry.value.toMap() }
