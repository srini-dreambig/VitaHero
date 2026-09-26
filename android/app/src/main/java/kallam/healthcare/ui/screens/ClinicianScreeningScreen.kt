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

/** Snellen acuities, in the order clinical.ts ranks them. */
private val ACUITY = listOf("6/6", "6/9", "6/12", "6/18", "6/24", "6/36", "6/60", "<6/60")
private val GLASSES_STATUS = listOf("none", "prescribed", "not worn", "broken")
private val COLOR_VISION = listOf("normal", "red-green deficit", "uncooperative")
private val EYE_EXTERNAL = listOf("normal", "conjunctivitis", "discharge", "ptosis")
private val VISION_TREATMENTS = listOf("Refraction Test", "Prescription Glasses", "Eye Drops", "Ophthalmologist Referral")

private val GUMS = listOf("healthy", "bleeding", "swollen", "recession")
private val HYGIENE = listOf("good", "fair", "poor")
private val FLUOROSIS = listOf("none", "mild", "moderate", "severe")
private val MALOCCLUSION = listOf("normal", "crowding", "crossbite", "overbite")
private val DENTAL_TREATMENTS = listOf("Cleaning", "Filling", "Extraction", "Orthodontics", "Urgent Visit")

private val HEARING_ACUITY = listOf("normal", "mild loss", "moderate/severe")
private val EAR_EXAM = listOf("normal", "wax impaction", "otitis media", "perforation")
private val NASAL_EXAM = listOf("normal", "allergic rhinitis", "septal deviation", "polyp")
private val THROAT_EXAM = listOf("normal", "tonsillar hypertrophy", "pharyngitis")
private val ENT_TREATMENTS = listOf("Ear Drops / Wax", "Antihistamines", "Antibiotics", "ENT Referral")

private val SKIN_CONDITIONS = listOf("normal", "eczema", "fungal / tinea", "scabies", "impetigo")
private val SKIN_LOCATIONS = listOf("face / neck", "arms / hands", "legs / feet", "trunk")
private val SKIN_TREATMENTS = listOf("Topical Ointment", "Antihistamines", "Medicated Soap", "Dermatology Referral")

private val POSTURE_ALIGN = listOf("normal", "slouching", "scoliosis suspected", "kyphosis")
private val GAIT_LIMB = listOf("normal", "limp", "flat feet", "knock-knees")
private val SPINE_TREATMENTS = listOf("Posture Guidance", "Physical Therapy", "Orthotics", "Orthopaedic Referral")

private val VACCINE_STATUS = listOf("up to date", "partially completed", "significantly delayed")
private val MISSED_VACCINES = listOf("MMR", "DPT / Tetanus", "Polio", "Hepatitis B", "Typhoid")
private val VACCINE_TREATMENTS = listOf("Schedule Catch-up", "PHC Referral", "Parent Counseling")

private val PALLOR = listOf("none", "mild conjunctival", "moderate", "severe palmar")
private val HB_TREATMENTS = listOf("Iron Supplement", "Dietary Counseling", "Deworming", "Pediatrician Referral")

/**
 * One child's screening, scoped to the clinician's own specialty.
 *
 * The form is not decided here. `form.checks` arrives already narrowed — by
 * what the camp offers, by what the guardian consented to, and by the
 * specialty behind this clinician's camp assignment — so a dentist is given
 * the dental check and nothing else, and the server refuses anything outside
 * that list even if a stale build were to send it.
 *
 * The field names below are the ones clinical.ts reads. They are not
 * cosmetic: rename one and the finding silently becomes "not recorded" —
 * captured at the camp, stored, released, and shown to the parent as NOT
 * MEASURED with no error on either side.
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

    // checkType -> field name -> value, all as text; the view model converts
    // "true"/"false" back to real booleans on the way out.
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
            // Nothing may be recorded without it, so this replaces the form
            // rather than sitting above one a clinician could still fill in.
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
                                style = MaterialTheme.typography.titleSmall,
                                fontWeight = FontWeight.SemiBold,
                            )
                            // What is already on file for this check.
                            //
                            // Without it a clinician reopening a child sees an
                            // empty form and no sign that anything was ever
                            // recorded \u2014 which reads as "nothing taken yet" and
                            // invites a second round of the same measurements.
                            val existing = f.findings.firstOrNull {
                                it.checkType == check && it.flag != "NOT_MEASURED"
                            }
                            if (existing != null) {
                                val reason =
                                    if (existing.rationale.isBlank()) ""
                                    else " \u2014 ${existing.rationale}"
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
                // A child on the list who did not turn up.
                //
                // Recorded here rather than left blank: "not screened" and
                // "absent on the day" look identical on a roster, and only one
                // of them is somebody still to be found.
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
                // Hoisted: the button takes a no-argument lambda, and nesting
                // the map's own (_, v) inside it reads as though the button
                // took a parameter.
                val onSave: () -> Unit = {
                    clinician.save(campId, kidId, snapshot(values), note = "")
                }
                PrimaryGradientButton(
                    text = if (busy) "Saving…" else "Save",
                    onClick = onSave,
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp),
                    enabled = !busy && f.checks.isNotEmpty(),
                )
                Spacer(Modifier.height(10.dp))
                Text(
                    "A supervising physician reviews what you record before the child's "
                        + "parent can see it.",
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
 * The fields for one check.
 *
 * Every key here is read by clinical.ts by exactly this name.
 */
@Composable
private fun CheckFields(check: String, fields: MutableMap<String, String>) {
    when (check) {
        "Height & weight" -> Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            NumberField("Height (cm)", fields, "heightCm", Modifier.weight(1f))
            NumberField("Weight (kg)", fields, "weightKg", Modifier.weight(1f))
        }
        "Vision" -> Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            HeroFormSectionHeader("Visual Acuity (Snellen)")
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                ChoiceField("Left eye", ACUITY, fields, "leftAcuity", Modifier.weight(1f))
                ChoiceField("Right eye", ACUITY, fields, "rightAcuity", Modifier.weight(1f))
            }
            Spacer(Modifier.height(2.dp))
            HeroFormSectionHeader("Eye Health & Alignment")
            ChoiceField("Glasses Status", GLASSES_STATUS, fields, "glassesWorn", Modifier.fillMaxWidth())
            ChoiceField("Color Vision", COLOR_VISION, fields, "colorVision", Modifier.fillMaxWidth())
            ChoiceField("External Anterior Exam", EYE_EXTERNAL, fields, "externalExam", Modifier.fillMaxWidth())
            ToggleField("Strabismus / Squint noted", fields, "squint")

            Spacer(Modifier.height(2.dp))
            HeroFormSectionHeader("Recommended Interventions")
            MultiChoiceField(VISION_TREATMENTS, fields, "treatmentsRecommended", label = "")
        }
        "Dental" -> Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            HeroFormSectionHeader("Tooth Index (dmft/DMFT)")
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                NumberField("Carious", fields, "cariesCount", Modifier.weight(1f))
                NumberField("Missing", fields, "missingCount", Modifier.weight(1f))
                NumberField("Filled", fields, "filledCount", Modifier.weight(1f))
            }

            Spacer(Modifier.height(2.dp))
            HeroFormSectionHeader("Gums & Oral Hygiene")
            ChoiceField("Gums Condition", GUMS, fields, "gums", Modifier.fillMaxWidth())
            ChoiceField("Oral Hygiene Index", HYGIENE, fields, "hygiene", Modifier.fillMaxWidth())
            ToggleField("Stains / Tartar / Calculus noted", fields, "stainsTartar")

            Spacer(Modifier.height(2.dp))
            HeroFormSectionHeader("Enamel & Alignment")
            ChoiceField("Dental Fluorosis", FLUOROSIS, fields, "fluorosis", Modifier.fillMaxWidth())
            ChoiceField("Occlusion / Alignment", MALOCCLUSION, fields, "malocclusion", Modifier.fillMaxWidth())

            Spacer(Modifier.height(2.dp))
            HeroFormSectionHeader("Symptoms & Trauma")
            ToggleField("Reports Toothache / Pain", fields, "pain")
            ToggleField("Hot/Cold Sensitivity", fields, "sensitivity")
            ToggleField("Chipped / Fractured Tooth", fields, "trauma")

            Spacer(Modifier.height(2.dp))
            HeroFormSectionHeader("Recommended Treatment")
            MultiChoiceField(DENTAL_TREATMENTS, fields, "treatmentNeeded", label = "")
        }
        "ENT" -> Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            HeroFormSectionHeader("Hearing Screening")
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                ChoiceField("Left Ear", HEARING_ACUITY, fields, "leftHearing", Modifier.weight(1f))
                ChoiceField("Right Ear", HEARING_ACUITY, fields, "rightHearing", Modifier.weight(1f))
            }
            Spacer(Modifier.height(2.dp))
            HeroFormSectionHeader("Clinical Examination")
            ChoiceField("Ear Canals / Tympanic", EAR_EXAM, fields, "earExam", Modifier.fillMaxWidth())
            ChoiceField("Nasal Cavity", NASAL_EXAM, fields, "nasalExam", Modifier.fillMaxWidth())
            ChoiceField("Throat & Tonsils", THROAT_EXAM, fields, "throatExam", Modifier.fillMaxWidth())

            Spacer(Modifier.height(2.dp))
            HeroFormSectionHeader("Recommended ENT Care")
            MultiChoiceField(ENT_TREATMENTS, fields, "entTreatment", label = "")
        }
        "Skin" -> Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            HeroFormSectionHeader("Dermatological Exam")
            ChoiceField("Primary Skin Finding", SKIN_CONDITIONS, fields, "skinCondition", Modifier.fillMaxWidth())
            ChoiceField("Lesion Distribution / Location", SKIN_LOCATIONS, fields, "skinLocation", Modifier.fillMaxWidth())

            Spacer(Modifier.height(2.dp))
            HeroFormSectionHeader("Symptoms & Parasitic Screening")
            ToggleField("Pruritus / Active Itching", fields, "itching")
            ToggleField("Scalp Pediculosis / Head Lice", fields, "lice")

            Spacer(Modifier.height(2.dp))
            HeroFormSectionHeader("Recommended Interventions")
            MultiChoiceField(SKIN_TREATMENTS, fields, "skinTreatment", label = "")
        }
        "Spine" -> Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            HeroFormSectionHeader("Musculoskeletal Assessment")
            ChoiceField("Spinal Posture & Alignment", POSTURE_ALIGN, fields, "posture", Modifier.fillMaxWidth())
            ChoiceField("Gait & Lower Limb Assessment", GAIT_LIMB, fields, "gaitLimb", Modifier.fillMaxWidth())

            Spacer(Modifier.height(2.dp))
            HeroFormSectionHeader("Functional Symptoms")
            ToggleField("Joint Pain or Swelling", fields, "jointPain")
            ToggleField("Restricted Range of Motion", fields, "restrictedMotion")

            Spacer(Modifier.height(2.dp))
            HeroFormSectionHeader("Recommended Interventions")
            MultiChoiceField(SPINE_TREATMENTS, fields, "spineTreatment", label = "")
        }
        "Immunisation review" -> Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            HeroFormSectionHeader("Immunization Status")
            ChoiceField("Overall Vaccine Status", VACCINE_STATUS, fields, "vaccineStatus", Modifier.fillMaxWidth())

            Spacer(Modifier.height(2.dp))
            HeroFormSectionHeader("Missed Routine Immunizations")
            MultiChoiceField(MISSED_VACCINES, fields, "missedVaccines", label = "")

            Spacer(Modifier.height(2.dp))
            HeroFormSectionHeader("Recommended Action")
            MultiChoiceField(VACCINE_TREATMENTS, fields, "vaccineTreatment", label = "")
        }
        "Haemoglobin" -> Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            HeroFormSectionHeader("Anaemia Screening")
            NumberField("Haemoglobin Level (g/dL)", fields, "hb", Modifier.fillMaxWidth())
            ChoiceField("Clinical Pallor Sign", PALLOR, fields, "pallor", Modifier.fillMaxWidth())

            Spacer(Modifier.height(2.dp))
            HeroFormSectionHeader("Recommended Anaemia Management")
            MultiChoiceField(HB_TREATMENTS, fields, "hbTreatment", label = "")
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

private fun formatOptionLabel(option: String): String {
    if (option.startsWith("<") || option.contains("6/")) return option
    return option.split(" ").joinToString(" ") { word ->
        if (word == "/" || word == "&") word
        else word.replaceFirstChar { if (it.isLowerCase()) it.titlecase() else it.toString() }
    }
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

/** A plain copy of the live field map, taken at the moment Save is pressed. */
private fun snapshot(
    values: Map<String, MutableMap<String, String>>,
): Map<String, Map<String, String>> = values.mapValues { entry -> entry.value.toMap() }
