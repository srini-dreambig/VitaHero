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
 *
 * The server's vocabulary is GOOD / WATCH / ALERT. Shown raw it reads as
 * shouting, and shown in one colour it reads as decoration \u2014 a clinician
 * glancing at a card needs to see at once whether the last person to look at
 * this child found something.
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

// Clinical Snellen Acuities & Visual Acuity Scale
private val ACUITY = listOf("6/6", "6/9", "6/12", "6/18", "6/24", "6/36", "6/60", "<6/60", "CF (Counting Fingers)", "HM (Hand Movements)", "LP (Light Perception)", "NLP (No Light Perception)")
private val EYE_LASHES = listOf("Normal", "Distichiasis (Double Row)", "Trichiasis (Inward Growth)", "Madarosis (Lash Loss)", "Other Abnormality")
private val EYE_LIDS = listOf("Normal", "Ptosis (Drooping)", "Entropion (Inward Turning)", "Ectropion (Outward Turning)", "Blepharitis / Stye", "Chalazion", "Other Abnormality")
private val CONJUNCTIVA = listOf("Normal", "Congestion / Redness", "Dryness", "Itching / Allergic", "Purulent Discharge", "Mucoid Discharge", "Bitot's Spots", "Other Abnormality")
private val SCLERA = listOf("Normal", "Jaundice / Icterus", "Scleral Congestion", "Episcleritis", "Other Abnormality")
private val CORNEA = listOf("Normal", "Congestion / Opacity", "Foreign Body / Abrasion", "Corneal Ulcer", "Keratoconus", "Other Abnormality")
private val IRIS = listOf("Normal", "Coloboma", "Heterochromia", "Synechiae", "Other Abnormality")
private val PUPIL_SIZE = listOf("Normal (3-5mm)", "Dilated (Mydriasis)", "Constricted (Miosis)", "Anisocoria (Unequal)")
private val PUPIL_LIGHT_REACTION = listOf("Normal / Brisk", "Sluggish", "Non-Reactive to Light", "Afferent Pupillary Defect (RAPD)")
private val COLOR_VISION = listOf("Normal", "Defective (Red-Green)", "Total Color Blindness", "Ishihara Partial Deficit", "Uncooperative")
private val GLASSES_STATUS = listOf("None (Emmetropic)", "Wearing Prescribed Glasses", "Not Wearing Prescribed Glasses", "Glasses Broken / Outdated", "Refraction Needed")
private val SQUINT_ALIGNMENT = listOf("Normal (Orthophoria)", "Esotropia (Crossed-In)", "Exotropia (Turned-Out)", "Hypertropia", "Phoria / Latent Squint")
private val VISION_TREATMENTS = listOf(
    "Refraction & Prescription Glasses",
    "Pediatric Ophthalmologist Referral",
    "Amblyopia Patching Therapy",
    "Lubricating Eye Drops",
    "Anti-Allergic Eye Drops",
    "Antibiotic Eye Drops",
    "Vision Hygiene & Screen Time Guidance"
)

// Dental Specialist Clinical Options
private val GUMS_CONDITION = listOf("Healthy", "Gingivitis / Redness", "Bleeding Gums", "Swollen / Abscess", "Gingival Recession")
private val ORAL_HYGIENE_INDEX = listOf("Good (Clean)", "Fair (Mild Plaque)", "Poor (Heavy Plaque / Calculus)")
private val FLUOROSIS_STAGE = listOf("None", "Mild (White Flecks)", "Moderate (Browning)", "Severe (Pitting)")
private val OCCLUSION_ALIGNMENT = listOf("Normal Class I", "Class II Overbite", "Class III Underbite", "Crowding", "Crossbite", "Open Bite")
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
private val ENT_TREATMENTS = listOf(
    "Ear Wax Removal / Cerumenolytic",
    "Antihistamine / Decongestant",
    "Antibiotic Nasal / Ear Drops",
    "Formal Audiometry & Tympanometry",
    "ENT Specialist Referral"
)

// Dermatology Specialist Clinical Options
private val SKIN_CONDITIONS = listOf("Normal", "Eczema / Atopic Dermatitis", "Tinea / Fungal Ringworm", "Scabies / Mite Infestation", "Impetigo / Bacterial Infection", "Urticaria / Hives", "Molluscum Contagiosum", "Vitiligo / Hypopigmentation")
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
private val POSTURE_ALIGN = listOf("Normal Spinal Alignment", "Scoliosis Suspected (Adam's Test +)", "Kyphosis / Round Back", "Lordosis / Sway Back", "Shoulder Asymmetry")
private val GAIT_LIMB = listOf("Normal Gait", "Flat Feet (Pes Planus)", "Knock-Knees (Genu Valgum)", "Bow-Legs (Genu Varum)", "In-Toeing / Out-Toeing Gait", "Limping / Antalgic Gait")
private val SPINE_TREATMENTS = listOf(
    "Ergonomic & Posture Correction",
    "Physical Therapy & Core Exercises",
    "Arch Support / Orthotic Insoles",
    "Pediatric Orthopaedic Referral"
)

// Immunisation & General Health Clinical Options
private val VACCINE_STATUS = listOf("Up to Date for Age", "Partially Vaccinated", "Significantly Delayed / Unvaccinated", "Card Not Available")
private val MISSED_VACCINES = listOf("MMR (Measles, Mumps, Rubella)", "DPT / Tetanus Booster", "OPV / IPV Polio", "Hepatitis B", "Typhoid", "HPV (Adolescents)")
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

            item {
                if (f.attendance != "ABSENT") {
                    val markAbsent: () -> Unit = {
                        clinician.markAttendance(campId, kidId, "ABSENT")
                    }
                    TextButton(onClick = markAbsent, modifier = Modifier.padding(horizontal = 12.dp)) {
                        Text("Child is absent today")
                    }
                } else {
                    Notice("Marked absent for this camp.", error = false)
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
            HeroFormSectionHeader("Visual Acuity (Snellen Chart)", subtitle = "Distant visual acuity per eye")
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                ChoiceField("Right Eye (OD)", ACUITY, fields, "rightAcuity", Modifier.weight(1f))
                ChoiceField("Left Eye (OS)", ACUITY, fields, "leftAcuity", Modifier.weight(1f))
            }

            Spacer(Modifier.height(2.dp))
            HeroFormSectionHeader("External Ocular Examination", subtitle = "Lashes, Lids, Conjunctiva, Sclera, Cornea & Iris")
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
                ChoiceField("Iris (OD)", IRIS, fields, "rightIris", Modifier.weight(1f))
                ChoiceField("Iris (OS)", IRIS, fields, "leftIris", Modifier.weight(1f))
            }

            Spacer(Modifier.height(2.dp))
            HeroFormSectionHeader("Pupil & Light Reflex", subtitle = "Pupillary size & light response")
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                ChoiceField("Pupil Size", PUPIL_SIZE, fields, "pupilSize", Modifier.weight(1f))
                ChoiceField("Light Reaction", PUPIL_LIGHT_REACTION, fields, "pupilReaction", Modifier.weight(1f))
            }

            Spacer(Modifier.height(2.dp))
            HeroFormSectionHeader("Refraction, Alignment & Color Vision")
            ChoiceField("Glasses Status", GLASSES_STATUS, fields, "glassesWorn", Modifier.fillMaxWidth())
            ChoiceField("Ocular Alignment / Squint", SQUINT_ALIGNMENT, fields, "squintAlignment", Modifier.fillMaxWidth())
            ChoiceField("Color Vision (Ishihara)", COLOR_VISION, fields, "colorVision", Modifier.fillMaxWidth())
            ToggleField("Strabismus / Squint Noted", fields, "squint")

            Spacer(Modifier.height(2.dp))
            HeroFormSectionHeader("Recommended Vision Interventions")
            MultiChoiceField(VISION_TREATMENTS, fields, "treatmentsRecommended", label = "Select Interventions")
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
            ChoiceField("Gums Condition", GUMS_CONDITION, fields, "gums", Modifier.fillMaxWidth())
            ChoiceField("Oral Hygiene Index", ORAL_HYGIENE_INDEX, fields, "hygiene", Modifier.fillMaxWidth())
            ToggleField("Stains / Tartar / Calculus Noted", fields, "stainsTartar")

            Spacer(Modifier.height(2.dp))
            HeroFormSectionHeader("Enamel, Alignment & Occlusion")
            ChoiceField("Dental Fluorosis", FLUOROSIS_STAGE, fields, "fluorosis", Modifier.fillMaxWidth())
            ChoiceField("Occlusion & Alignment", OCCLUSION_ALIGNMENT, fields, "malocclusion", Modifier.fillMaxWidth())

            Spacer(Modifier.height(2.dp))
            HeroFormSectionHeader("Symptoms & Dental Trauma")
            ToggleField("Reports Active Toothache / Pain", fields, "pain")
            ToggleField("Hot / Cold Thermal Sensitivity", fields, "sensitivity")
            ToggleField("Chipped / Fractured Tooth", fields, "trauma")

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
            ChoiceField("Ear Canals & Tympanic Membrane", EAR_CANAL_EXAM, fields, "earExam", Modifier.fillMaxWidth())
            ChoiceField("Nasal Cavity & Septum", NASAL_EXAM, fields, "nasalExam", Modifier.fillMaxWidth())
            ChoiceField("Throat, Tonsils & Adenoids", THROAT_TONSILS, fields, "throatExam", Modifier.fillMaxWidth())

            Spacer(Modifier.height(2.dp))
            HeroFormSectionHeader("Recommended ENT Interventions")
            MultiChoiceField(ENT_TREATMENTS, fields, "entTreatment", label = "Select ENT Interventions")
        }
        "Skin" -> Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            HeroFormSectionHeader("Dermatological Examination")
            ChoiceField("Primary Skin Condition", SKIN_CONDITIONS, fields, "skinCondition", Modifier.fillMaxWidth())
            ChoiceField("Lesion Distribution / Site", SKIN_LOCATIONS, fields, "skinLocation", Modifier.fillMaxWidth())

            Spacer(Modifier.height(2.dp))
            HeroFormSectionHeader("Symptoms & Parasitic Screening")
            ChoiceField("Pruritus & Parasitic Screening", PRURITUS_PARASITIC, fields, "pruritus", Modifier.fillMaxWidth())
            ToggleField("Active Pruritus / Itching", fields, "itching")
            ToggleField("Scalp Pediculosis / Head Lice", fields, "lice")

            Spacer(Modifier.height(2.dp))
            HeroFormSectionHeader("Recommended Dermatological Care")
            MultiChoiceField(SKIN_TREATMENTS, fields, "skinTreatment", label = "Select Dermatological Treatments")
        }
        "Spine" -> Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            HeroFormSectionHeader("Musculoskeletal & Posture Assessment")
            ChoiceField("Spinal Posture & Alignment", POSTURE_ALIGN, fields, "posture", Modifier.fillMaxWidth())
            ChoiceField("Gait & Lower Limb Assessment", GAIT_LIMB, fields, "gaitLimb", Modifier.fillMaxWidth())

            Spacer(Modifier.height(2.dp))
            HeroFormSectionHeader("Functional Symptoms & Joint Exam")
            ToggleField("Joint Pain / Tenderness / Swelling", fields, "jointPain")
            ToggleField("Restricted Range of Motion", fields, "restrictedMotion")

            Spacer(Modifier.height(2.dp))
            HeroFormSectionHeader("Recommended Musculoskeletal Interventions")
            MultiChoiceField(SPINE_TREATMENTS, fields, "spineTreatment", label = "Select Orthopaedic Interventions")
        }
        "Immunisation review" -> Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            HeroFormSectionHeader("Immunization Status Review")
            ChoiceField("Overall Vaccine Status for Age", VACCINE_STATUS, fields, "vaccineStatus", Modifier.fillMaxWidth())

            Spacer(Modifier.height(2.dp))
            HeroFormSectionHeader("Missed Routine Immunizations")
            MultiChoiceField(MISSED_VACCINES, fields, "missedVaccines", label = "Select Missed Vaccines")

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
    label: String = "Recommended Interventions"
) {
    val selectedSet = remember(fields[key]) {
        (fields[key] ?: "").split(",").map { it.trim() }.filter { it.isNotBlank() }.toSet()
    }
    HeroMultiSelectDropdown(
        label = label,
        options = options,
        selected = selectedSet,
        onSelect = { newSet -> fields[key] = newSet.joinToString(",") },
        modifier = modifier
    )
}

private fun snapshot(
    values: Map<String, MutableMap<String, String>>,
): Map<String, Map<String, String>> = values.mapValues { entry -> entry.value.toMap() }
