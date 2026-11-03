package kallam.healthcare.ui.screens

import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.selection.toggleable
import androidx.compose.material3.Checkbox
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import kallam.healthcare.data.ClinicianViewModel
import kallam.healthcare.data.ScreeningChildDto
import kallam.healthcare.data.WhoBmi
import kallam.healthcare.ui.components.AppCard
import kallam.healthcare.ui.components.AppScreenHeader
import kallam.healthcare.ui.components.AppTextButton
import kallam.healthcare.ui.components.AppTextField
import kallam.healthcare.ui.components.GrowthChartsPanel
import kallam.healthcare.ui.components.HeroSingleSelectDropdown
import kallam.healthcare.ui.components.HeroMultiSelectDropdown
import kallam.healthcare.ui.components.HeroFormSectionHeader
import kallam.healthcare.ui.components.Notice
import kallam.healthcare.ui.components.PrimaryGradientButton
import kallam.healthcare.ui.components.StatusBarSpacer
import kallam.healthcare.ui.components.Tone
import kallam.healthcare.ui.components.color
import kallam.healthcare.ui.theme.AppSpacing

/**
 * A flag in words, and in a colour that means the same thing.
 */
private fun flagTone(flag: String) = when (flag) {
    "ALERT" -> Tone.Alert
    "WATCH" -> Tone.Watch
    else -> Tone.Good
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

// Near Vision Scale (Image 3). N6 is a child reading normal print.
private val NEAR_VISION = listOf("N6 (Normal)", "N8", "N10", "N12", "N18", "N24", "N36")

// The lens a prescription is for, as on the glasses slip.
private val LENS_TYPE = listOf("Distance", "Near", "Bifocals", "Progressive")

// Testing Condition (Image 3)
private val VISION_TEST_CONDITION = listOf(
    "Unaided", "Aided (With Present Glasses)", "Pinhole (PH)"
)

// Colour vision (Ishihara)
private val COLOR_VISION = listOf("17/17 (Normal Pass)", "15-16/17 (Borderline)", "<15/17 (Defective Red-Green)", "Total Color Blindness", "Ishihara Partial Deficit", "Uncooperative")

// Nutritional status, in the words the physical exam sheet uses and the
// server reads (NUTRITION_BANDS in clinical.ts). Left empty, the server
// suggests one from height and weight; the dietician groups children by it.
private val NUTRITIONAL_STATUS = listOf("Normal", "Wasted", "Severely wasted", "Stunted", "Overweight", "Obese")

// Type of dentition, as the oral & dental sheet has it. It decides whether
// the tooth index is read as dmft (milk teeth) or DMFT (permanent).
private val DENTITION = listOf("Primary", "Mixed", "Permanent")

// Dental Specialist Clinical Options
private val ORAL_HYGIENE_INDEX = listOf("Good (Clean)", "Fair (Mild Plaque)", "Poor (Heavy Plaque / Calculus)", "Stains / Calculus Noted")
private val FLUOROSIS_STAGE = listOf("None", "Mild (White Flecks)", "Moderate (Browning)", "Severe (Pitting)")
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
 * The fields each check cannot be saved without, by the keys clinical.ts
 * reads. Mirrors REQUIRED_FIELDS on the server, which refuses the same gaps;
 * checking here first means the clinician hears it before the request, by name.
 */
private val REQUIRED_FIELDS: Map<String, List<Pair<String, String>>> = mapOf(
    "Height & weight" to listOf("heightCm" to "Height", "weightKg" to "Weight"),
    "Vision" to listOf("rightAcuity" to "Right eye", "leftAcuity" to "Left eye"),
    "Dental" to listOf("cariesCount" to "Carious count", "hygiene" to "Oral hygiene"),
    "Haemoglobin" to listOf("hb" to "Haemoglobin"),
    "ENT" to listOf("rightHearing" to "Right ear", "leftHearing" to "Left ear"),
    "Skin" to listOf("skinCondition" to "Primary skin finding"),
    "Spine" to listOf("posture" to "Posture", "gaitLimb" to "Gait & lower limb"),
    "Immunisation review" to listOf("vaccineStatus" to "Vaccine status"),
)

/** Set on a check the clinician could not do; its reason travels as the note. */
private const val NOT_DONE = "__notDone"
private const val NOT_DONE_REASON = "__reason"

/**
 * What still stops this form being saved, one line per check, or empty.
 *
 * A check is done in full, or marked could not be done with a reason. One
 * left untouched only passes when it was already recorded earlier.
 */
private fun screeningGaps(
    checks: List<String>,
    values: Map<String, Map<String, String>>,
    alreadyRecorded: Set<String>,
): List<String> = checks.mapNotNull { check ->
    val fields = values[check].orEmpty()
    if (fields[NOT_DONE] == "true") {
        return@mapNotNull if (fields[NOT_DONE_REASON].isNullOrBlank())
            "$check: say why it could not be done" else null
    }
    val touched = fields.any { (k, v) -> !k.startsWith("__") && v.isNotBlank() && v != "false" }
    if (!touched && check in alreadyRecorded) return@mapNotNull null
    val missing = REQUIRED_FIELDS[check].orEmpty()
        .filter { (k, _) -> fields[k].isNullOrBlank() }
        .map { it.second }
    when {
        missing.isNotEmpty() -> "$check: ${missing.joinToString(", ")}"
        !touched -> "$check: nothing recorded"
        else -> null
    }
}

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
    var gapMessage by remember(kidId) { mutableStateOf("") }
    fun fields(check: String): MutableMap<String, String> =
        values.getOrPut(check) { mutableStateMapOf() }

    LaunchedEffect(campId, kidId) { clinician.openChild(campId, kidId) }
    LaunchedEffect(saved) { if (saved) onBack() }

    val f = form
    LazyColumn(Modifier.fillMaxSize()) {
        item {
            StatusBarSpacer()
            AppScreenHeader(
                title = f?.child?.name ?: "…",
                subtitle = f?.let {
                    listOfNotNull(
                        listOf(it.child.grade, it.child.section)
                            .filter { s -> s.isNotBlank() }.joinToString(" ").ifBlank { null },
                        it.child.gender.ifBlank { null },
                        it.child.age?.let { a -> "$a years" },
                    ).joinToString(" · ")
                },
                onBack = { clinician.closeChild(); onBack() },
            )
            Spacer(Modifier.height(AppSpacing.sm))
        }

        if (f == null) {
            item {
                Text(
                    if (busy) "Opening…" else message.ifBlank { "Could not open this form." },
                    Modifier.padding(AppSpacing.xl),
                    style = MaterialTheme.typography.bodyMedium,
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
                if (gapMessage.isNotBlank()) Notice(gapMessage, error = true)
                Text(
                    "Fields marked * are required. A check that cannot be done is marked as such, with the reason.",
                    Modifier.padding(horizontal = AppSpacing.xl, vertical = AppSpacing.xs),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            // The parent's illness log. History to weigh, not a finding.
            val history = f.illnessHistory
            if (history != null && history.events.isNotEmpty()) {
                item(key = "illness_history") {
                    AppCard(Modifier.padding(horizontal = AppSpacing.xl, vertical = AppSpacing.xs + AppSpacing.xxs)) {
                        Column(verticalArrangement = Arrangement.spacedBy(AppSpacing.sm)) {
                            Text(
                                "Illness logged by the family",
                                style = MaterialTheme.typography.titleMedium,
                                color = MaterialTheme.colorScheme.onSurface,
                            )
                            if (history.caution.isNotBlank()) {
                                Text(history.caution, style = MaterialTheme.typography.bodySmall)
                            }
                            for (e in history.events.take(10)) {
                                val dates = if (e.endedOn.isBlank()) e.startedOn else "${e.startedOn} to ${e.endedOn}"
                                val extras = listOfNotNull(
                                    e.severity.lowercase(),
                                    if (e.sawDoctor) "saw a doctor" else null,
                                    if (e.missedSchool) "missed school" else null,
                                ).joinToString(", ")
                                val note = if (e.note.isBlank()) "" else " — ${e.note}"
                                Text(
                                    "$dates: ${e.symptom} ($extras)$note",
                                    style = MaterialTheme.typography.bodyMedium,
                                )
                            }
                            if (history.events.size > 10) {
                                Text(
                                    "and ${history.events.size - 10} earlier",
                                    style = MaterialTheme.typography.bodySmall,
                                )
                            }
                        }
                    }
                }
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
                    // A TextButton pads its own label by 12, so 8 here puts the
                    // words on the 20dp screen margin.
                    AppTextButton("Mark Present instead", onClick = markPresent, modifier = Modifier.padding(horizontal = AppSpacing.sm))
                }
                item {
                    Spacer(Modifier.height(AppSpacing.md))
                    val onConfirmAbsent: () -> Unit = {
                        clinician.save(campId, kidId, emptyMap(), note = "Student absent")
                    }
                    PrimaryGradientButton(
                        text = "Confirm Absent & Close",
                        onClick = onConfirmAbsent,
                        modifier = Modifier.fillMaxWidth().padding(horizontal = AppSpacing.xl),
                        enabled = !busy,
                    )
                    Spacer(Modifier.height(AppSpacing.xxxl))
                }
            } else {
                for (check in f.checks) {
                    item(key = check) {
                        AppCard(Modifier.padding(horizontal = AppSpacing.xl, vertical = AppSpacing.xs + AppSpacing.xxs)) {
                            Text(
                                check,
                                style = MaterialTheme.typography.titleMedium,
                                color = MaterialTheme.colorScheme.onSurface,
                            )
                            val existing = f.findings.firstOrNull {
                                it.checkType == check && it.flag != "NOT_MEASURED"
                            }
                            if (existing != null) {
                                val reason =
                                    if (existing.rationale.isBlank()) ""
                                    else " — ${existing.rationale}"
                                Spacer(Modifier.height(AppSpacing.xs))
                                Text(
                                    "Recorded: ${flagWord(existing.flag)}$reason",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = flagTone(existing.flag).color(),
                                )
                            }
                            Spacer(Modifier.height(AppSpacing.xs))
                            ToggleField("Could not be done", fields(check), NOT_DONE)
                            Spacer(Modifier.height(AppSpacing.xs))
                            if (fields(check)[NOT_DONE] == "true") {
                                SimpleTextField(
                                    "Why it could not be done *", fields(check), NOT_DONE_REASON,
                                    Modifier.fillMaxWidth(),
                                    placeholder = "e.g. child unwell, equipment not available",
                                )
                                Spacer(Modifier.height(AppSpacing.sm))
                                // Still open: pallor seen without an Hb
                                // meter is still a finding, and it is kept.
                                Text(
                                    "Record anything you did see",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                                Spacer(Modifier.height(AppSpacing.sm))
                            }
                            CheckFields(check, fields(check), f.child)
                        }
                    }
                }

                item {
                    val markAbsent: () -> Unit = {
                        clinician.markAttendance(campId, kidId, "ABSENT")
                    }
                    // A TextButton pads its own label by 12, so 8 here puts the
                    // words on the 20dp screen margin.
                    AppTextButton("Child is absent today", onClick = markAbsent, modifier = Modifier.padding(horizontal = AppSpacing.sm))
                }

                item {
                    Spacer(Modifier.height(AppSpacing.md))
                    val onSave: () -> Unit = {
                        val recorded = f.findings
                            .filter { it.flag != "NOT_MEASURED" || it.note.isNotBlank() }
                            .map { it.checkType }.toSet()
                        val gaps = screeningGaps(f.checks, snapshot(values), recorded)
                        gapMessage = if (gaps.isEmpty()) "" else
                            "Not saved. Still required — " + gaps.joinToString("; ") +
                                ". Fill these in, or tick Could not be done and give the reason."
                        if (gaps.isEmpty()) clinician.save(campId, kidId, snapshot(values), note = "")
                    }
                    // Said again here: Save sits at the foot of a long form, and
                    // the notice at the top is out of sight when it is tapped.
                    if (gapMessage.isNotBlank()) Notice(gapMessage, error = true)
                    else if (message.isNotBlank()) Notice(message, error = true)
                    PrimaryGradientButton(
                        text = if (busy) "Saving…" else "Save Screening Record",
                        onClick = onSave,
                        modifier = Modifier.fillMaxWidth().padding(horizontal = AppSpacing.xl),
                        enabled = !busy && f.checks.isNotEmpty(),
                    )
                    Spacer(Modifier.height(AppSpacing.md))
                    Text(
                        "Saved findings reach the child's parent straight away. Other doctors' checks stay to do until they record them.",
                        Modifier.padding(horizontal = AppSpacing.xl),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Spacer(Modifier.height(AppSpacing.xxxl))
                }
            }
        }
    }
}

/**
 * World-Class Clinical Examination Form Renderer for all Specialties.
 */
@Composable
private fun CheckFields(check: String, fields: MutableMap<String, String>, child: ScreeningChildDto) {
    when (check) {
        // Physical growth assessment: height, weight, BMI for age and the
        // nutritional status. Left blank, the status is the WHO reading the
        // server makes from the same numbers when the record is saved.
        "Height & weight" -> Column(verticalArrangement = Arrangement.spacedBy(AppSpacing.md)) {
            Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(AppSpacing.sm)) {
                NumberField("Height (cm) *", fields, "heightCm", Modifier.weight(1f))
                NumberField("Weight (kg) *", fields, "weightKg", Modifier.weight(1f))
            }
            // BMI for age, live as the numbers are typed, with the WHO status.
            val who = WhoBmi.forChild(
                fields["heightCm"]?.toDoubleOrNull() ?: 0.0,
                fields["weightKg"]?.toDoubleOrNull() ?: 0.0,
                child.gender, child.dob, child.age,
            )
            if (who != null) {
                GrowthChartsPanel(who, null, Modifier.fillMaxWidth(), bmiOnly = true)
            } else if (child.age == null && child.dob.isBlank()) {
                Text(
                    "No age or date of birth on record, so BMI for age cannot be read.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            ChoiceField(
                "Nutritional status (blank = WHO reading)", NUTRITIONAL_STATUS, fields, "nutritionalStatus",
                Modifier.fillMaxWidth(),
            )
        }
        "Vision" -> Column(verticalArrangement = Arrangement.spacedBy(AppSpacing.md)) {
            HeroFormSectionHeader("Visual acuity", subtitle = "Distance (Snellen), each eye")
            Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(AppSpacing.sm)) {
                ChoiceField("Right eye (OD) *", ACUITY, fields, "rightAcuity", Modifier.weight(1f))
                ChoiceField("Left eye (OS) *", ACUITY, fields, "leftAcuity", Modifier.weight(1f))
            }

            Spacer(Modifier.height(AppSpacing.xxs))
            HeroFormSectionHeader("Near vision", subtitle = "Near chart, each eye (N6 = normal print)")
            Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(AppSpacing.sm)) {
                ChoiceField("Right eye (OD)", NEAR_VISION, fields, "rightNearVision", Modifier.weight(1f))
                ChoiceField("Left eye (OS)", NEAR_VISION, fields, "leftNearVision", Modifier.weight(1f))
            }
            ChoiceField("Testing condition", VISION_TEST_CONDITION, fields, "testingCondition", Modifier.fillMaxWidth())

            Spacer(Modifier.height(AppSpacing.xxs))
            HeroFormSectionHeader("Present glasses prescription", subtitle = "Only if the child already wears glasses")
            PrescriptionTable("present", fields)

            Spacer(Modifier.height(AppSpacing.xxs))
            HeroFormSectionHeader("New glasses prescription")
            FieldRow {
                SimpleTextField("Unaided V/A, right (OD)", fields, "newOdUva", Modifier.weight(1f), placeholder = "6/18")
                SimpleTextField("Unaided V/A, left (OS)", fields, "newOsUva", Modifier.weight(1f), placeholder = "6/24")
            }
            PrescriptionTable("new", fields)

            Spacer(Modifier.height(AppSpacing.xxs))
            HeroFormSectionHeader("Colour vision")
            ChoiceField("Colour vision (Ishihara /17)", COLOR_VISION, fields, "colorVision", Modifier.fillMaxWidth())

            Spacer(Modifier.height(AppSpacing.xxs))
            HeroFormSectionHeader("Any other complaints")
            SimpleTextField("Any other complaints, if present", fields, "otherComplaints", Modifier.fillMaxWidth(), placeholder = "e.g. headache after reading, watering")
        }
        // Oral & dental, as the sheet has it: tooth index, oral hygiene index,
        // enamel, alignment & occlusion, the treatment plan and any other complaints.
        "Dental" -> Column(verticalArrangement = Arrangement.spacedBy(AppSpacing.md)) {
            HeroFormSectionHeader("Tooth index (dmft / DMFT)")
            ChoiceField("Type of dentition", DENTITION, fields, "dentition", Modifier.fillMaxWidth())
            Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(AppSpacing.sm)) {
                NumberField("Decayed *", fields, "cariesCount", Modifier.weight(1f))
                NumberField("Missing", fields, "missingCount", Modifier.weight(1f))
                NumberField("Filled", fields, "filledCount", Modifier.weight(1f))
            }

            Spacer(Modifier.height(AppSpacing.xxs))
            HeroFormSectionHeader("Oral hygiene index")
            ChoiceField("Oral hygiene *", ORAL_HYGIENE_INDEX, fields, "hygiene", Modifier.fillMaxWidth())

            Spacer(Modifier.height(AppSpacing.xxs))
            HeroFormSectionHeader("Enamel, alignment & occlusion")
            ChoiceField("Dental fluorosis", FLUOROSIS_STAGE, fields, "fluorosis", Modifier.fillMaxWidth())

            Spacer(Modifier.height(AppSpacing.xxs))
            HeroFormSectionHeader("Treatment plan")
            MultiChoiceField(DENTAL_TREATMENTS, fields, "treatmentNeeded", label = "Select dental interventions")

            Spacer(Modifier.height(AppSpacing.xxs))
            HeroFormSectionHeader("Any other complaints")
            SimpleTextField("Any other complaints, if present", fields, "otherComplaints", Modifier.fillMaxWidth(), placeholder = "e.g. bleeding gums, bad breath")
        }
        "ENT" -> Column(verticalArrangement = Arrangement.spacedBy(AppSpacing.md)) {
            HeroFormSectionHeader("Hearing Acuity Screening")
            Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(AppSpacing.sm)) {
                ChoiceField("Left Ear Acuity *", HEARING_ACUITY, fields, "leftHearing", Modifier.weight(1f))
                ChoiceField("Right Ear Acuity *", HEARING_ACUITY, fields, "rightHearing", Modifier.weight(1f))
            }

            Spacer(Modifier.height(AppSpacing.xxs))
            HeroFormSectionHeader("Clinical ENT Examination")
            MultiChoiceField(EAR_CANAL_EXAM, fields, "earExam", label = "Ear Canals & Tympanic Membrane Findings")
            MultiChoiceField(NASAL_EXAM, fields, "nasalExam", label = "Nasal Cavity & Septum Findings")
            MultiChoiceField(THROAT_TONSILS, fields, "throatExam", label = "Throat, Tonsils & Adenoids Findings")
            ChoiceField("Speech & Voice", SPEECH_VOICE, fields, "speechVoice", Modifier.fillMaxWidth())

            Spacer(Modifier.height(AppSpacing.xxs))
            HeroFormSectionHeader("Recommended ENT Interventions")
            MultiChoiceField(ENT_TREATMENTS, fields, "entTreatment", label = "Select ENT Interventions")
        }
        "Skin" -> Column(verticalArrangement = Arrangement.spacedBy(AppSpacing.md)) {
            HeroFormSectionHeader("Dermatological Examination")
            MultiChoiceField(SKIN_CONDITIONS, fields, "skinCondition", label = "Primary Skin Condition & Findings *")
            MultiChoiceField(SKIN_LOCATIONS, fields, "skinLocation", label = "Lesion Distribution & Body Sites")

            Spacer(Modifier.height(AppSpacing.xxs))
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

            Spacer(Modifier.height(AppSpacing.xxs))
            HeroFormSectionHeader("Recommended Dermatological Care")
            MultiChoiceField(SKIN_TREATMENTS, fields, "skinTreatment", label = "Select Dermatological Treatments")
        }
        "Spine" -> Column(verticalArrangement = Arrangement.spacedBy(AppSpacing.md)) {
            HeroFormSectionHeader("Musculoskeletal & Posture Assessment")
            MultiChoiceField(POSTURE_ALIGN, fields, "posture", label = "* Spinal Posture & Alignment (Slouching, Scoliosis...)")
            MultiChoiceField(GAIT_LIMB, fields, "gaitLimb", label = "* Gait & Lower Limb Assessment (Flat Feet, Knock-knees...)")

            Spacer(Modifier.height(AppSpacing.xxs))
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

            Spacer(Modifier.height(AppSpacing.xxs))
            HeroFormSectionHeader("Recommended Musculoskeletal Interventions")
            MultiChoiceField(SPINE_TREATMENTS, fields, "spineTreatment", label = "Select Orthopaedic Interventions")
        }
        "Immunisation review" -> Column(verticalArrangement = Arrangement.spacedBy(AppSpacing.md)) {
            HeroFormSectionHeader("Immunization Status Review")
            ChoiceField("Overall Vaccine Status for Age *", VACCINE_STATUS, fields, "vaccineStatus", Modifier.fillMaxWidth())

            Spacer(Modifier.height(AppSpacing.xxs))
            HeroFormSectionHeader("Missed Routine Immunizations")
            MultiChoiceField(MISSED_VACCINES, fields, "missedVaccines", label = "Select Missed Routine Vaccines")

            Spacer(Modifier.height(AppSpacing.xxs))
            HeroFormSectionHeader("Recommended Immunization Action")
            MultiChoiceField(VACCINE_TREATMENTS, fields, "vaccineTreatment", label = "Select Recommended Action")
        }
        "Haemoglobin" -> Column(verticalArrangement = Arrangement.spacedBy(AppSpacing.md)) {
            HeroFormSectionHeader("Anaemia & Haemoglobin Screening")
            NumberField("Haemoglobin Level (g/dL) *", fields, "hb", Modifier.fillMaxWidth())
            ChoiceField("Clinical Pallor Sign", PALLOR_SIGNS, fields, "pallor", Modifier.fillMaxWidth())

            Spacer(Modifier.height(AppSpacing.xxs))
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

/** Fields side by side, lined up on their boxes even when one label wraps. */
@Composable
private fun PrescriptionTable(prefix: String, fields: MutableMap<String, String>) {
    // The glasses slip: per eye, distance (D/V) and near (N/V) rows of SPH,
    // CYL, AXIS and V/A. Distance keeps the keys older records use; near adds
    // "Near". One eye to a table, so four boxes fit across a phone.
    listOf("Od" to "Right eye (OD)", "Os" to "Left eye (OS)").forEach { (eye, title) ->
        Text(title, style = MaterialTheme.typography.labelLarge, modifier = Modifier.padding(top = AppSpacing.xs))
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(AppSpacing.xs)) {
            Spacer(Modifier.width(40.dp))
            listOf("SPH", "CYL", "AXIS", "V/A").forEach {
                Text(
                    it,
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.weight(1f),
                )
            }
        }
        listOf(false, true).forEach { near ->
            val n = if (near) "Near" else ""
            Row(
                Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(AppSpacing.xs),
            ) {
                Text(if (near) "N/V" else "D/V", style = MaterialTheme.typography.labelMedium, modifier = Modifier.width(40.dp))
                RxCell(fields, "$prefix$eye${n}Sph", if (near) "+1.00" else "-1.50")
                RxCell(fields, "$prefix$eye${n}Cyl", "-0.50")
                RxCell(fields, "$prefix$eye${n}Axi", "180")
                RxCell(fields, if (near) "$prefix${eye}NearVa" else "$prefix${eye}Cva", if (near) "N6" else "6/6")
            }
        }
    }
    ChoiceField("Lens", LENS_TYPE, fields, "${prefix}LensType", Modifier.fillMaxWidth())
}

/** One box of the prescription table: small, centred, no label of its own. */
@Composable
private fun RowScope.RxCell(fields: MutableMap<String, String>, key: String, placeholder: String) {
    val style = MaterialTheme.typography.bodyMedium.copy(
        textAlign = TextAlign.Center,
        color = MaterialTheme.colorScheme.onSurface,
    )
    BasicTextField(
        value = fields[key] ?: "",
        onValueChange = { fields[key] = it },
        singleLine = true,
        textStyle = style,
        cursorBrush = SolidColor(MaterialTheme.colorScheme.primary),
        modifier = Modifier
            .weight(1f)
            .padding(vertical = AppSpacing.xxs),
        decorationBox = { inner ->
            Box(
                Modifier
                    .fillMaxWidth()
                    .heightIn(min = 44.dp)
                    .border(1.dp, MaterialTheme.colorScheme.outline, RoundedCornerShape(8.dp))
                    .padding(horizontal = 4.dp),
                contentAlignment = Alignment.Center,
            ) {
                if ((fields[key] ?: "").isEmpty()) {
                    Text(placeholder, style = style.copy(color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f)))
                }
                inner()
            }
        },
    )
}

@Composable
private fun FieldRow(content: @Composable RowScope.() -> Unit) {
    Row(
        Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.Bottom,
        horizontalArrangement = Arrangement.spacedBy(AppSpacing.sm),
        content = content,
    )
}

/**
 * A free-text field bound to one key of a check. Built on [AppTextField], so
 * the label sits above the box and a row of them lines up on its boxes.
 */
@Composable
private fun SimpleTextField(
    label: String,
    fields: MutableMap<String, String>,
    key: String,
    modifier: Modifier = Modifier,
    placeholder: String = ""
) {
    AppTextField(
        value = fields[key] ?: "",
        onValueChange = { fields[key] = it },
        modifier = modifier,
        label = label,
        placeholder = placeholder.ifBlank { null },
    )
}

/** A decimal field: digits and a point only, on the number keyboard. */
@Composable
private fun NumberField(
    label: String,
    fields: MutableMap<String, String>,
    key: String,
    modifier: Modifier = Modifier,
) {
    AppTextField(
        value = fields[key] ?: "",
        onValueChange = { fields[key] = it.filter { c -> c.isDigit() || c == '.' } },
        modifier = modifier,
        label = label,
        keyboardType = KeyboardType.Decimal,
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
    // The whole row toggles: a screener taps the words, and only the small
    // box used to answer. 48dp tall so it is a full touch target, with the
    // box and the words centred on one line.
    val checked = fields[key] == "true"
    Row(
        Modifier
            .fillMaxWidth()
            .heightIn(min = 48.dp)
            .toggleable(
                value = checked,
                role = Role.Checkbox,
                onValueChange = { fields[key] = if (checked) "false" else "true" },
            ),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Checkbox(checked = checked, onCheckedChange = null)
        Spacer(Modifier.width(AppSpacing.sm))
        Text(label, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurface)
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
