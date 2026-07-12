package com.rork.vitahero.ui.screens

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.ExpandMore
import androidx.compose.material.icons.outlined.MedicalServices
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshots.SnapshotStateMap
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.rork.vitahero.data.DoctorCampDto
import com.rork.vitahero.data.DoctorCampKidDto
import com.rork.vitahero.data.DoctorViewModel
import com.rork.vitahero.data.HealthCheckupDto
import com.rork.vitahero.ui.components.HeroCard
import com.rork.vitahero.ui.components.IconBubble
import com.rork.vitahero.ui.components.PrimaryGradientButton
import com.rork.vitahero.ui.components.StatusBarSpacer
import com.rork.vitahero.ui.theme.FlagAlert
import com.rork.vitahero.ui.theme.FlagGood
import com.rork.vitahero.ui.theme.FlagWatch
import com.rork.vitahero.ui.theme.HeroBlue
import com.rork.vitahero.ui.theme.HeroOrange
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull

// ─── Form field state holder ─────────────────────────────────

private class CheckupFormState {
    // Vitals
    var heightCm: String = ""
    var weightKg: String = ""
    var temperature: String = ""
    var heartRate: String = ""
    var respiratoryRate: String = ""
    var bloodPressureSystolic: String = ""
    var bloodPressureDiastolic: String = ""
    var bmi: String = ""

    // Dental
    var dentalOverall: String = "GOOD"
    var cariesPresent: Boolean = false
    var cariesCount: String = ""
    var gingivitis: Boolean = false
    var oralHygiene: String = "Good"
    var fluorideTreatment: Boolean = false
    var dentalNotes: String = ""

    // Vision
    var visionOverall: String = "GOOD"
    var rightEyeVision: String = ""
    var leftEyeVision: String = ""
    var colorBlindness: String = "Not Tested"
    var squint: Boolean = false
    var glassesNeeded: Boolean = false
    var visionNotes: String = ""

    // Nutrition / General
    var nutritionOverall: String = "GOOD"
    var hemoglobin: String = ""
    var bmiPercentile: String = ""
    var pallor: Boolean = false
    var edema: Boolean = false
    var wasting: Boolean = false
    var stunting: Boolean = false
    var nutritionNotes: String = ""

    // General Physical
    var skinCondition: String = "Normal"
    var lymphNodes: String = "Normal"
    var hearingScreening: String = "Pass"
    var immunizationUpToDate: Boolean = true
    var developmentalMilestone: String = "Normal"
    var generalNotes: String = ""

    // Referral & Summary
    var referralNeeded: Boolean = false
    var referralSpecialty: String = ""
    var referralNotes: String = ""
    var overallSummary: String = ""
    var overallStatus: String = "GOOD"
}

private val HealthFlagOptions = listOf("GOOD", "WATCH", "ALERT")
private val OralHygieneOptions = listOf("Good", "Fair", "Poor")
private val ColorBlindnessOptions = listOf("Not Tested", "Normal", "Deficient")
private val SkinOptions = listOf("Normal", "Scabies", "Fungal Infection", "Eczema", "Other")
private val LymphNodeOptions = listOf("Normal", "Enlarged", "Tender")
private val HearingOptions = listOf("Pass", "Refer", "Not Tested")
private val DevelopmentalOptions = listOf("Normal", "Delayed", "Needs Assessment")
private val ReferralSpecialtyOptions = listOf(
    "", "Paediatrics", "Ophthalmology", "Dental", "ENT",
    "Dermatology", "Nutrition", "Orthopaedics", "General Medicine"
)

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun HealthCheckupFormScreen(
    doctorViewModel: DoctorViewModel,
    kid: DoctorCampKidDto,
    camp: DoctorCampDto,
    doctorSpecialty: String = "",
    onBack: () -> Unit,
    onSubmitted: () -> Unit,
) {
    val state by doctorViewModel.uiState.collectAsState()
    val form = remember { CheckupFormState() }

    // Determine which form sections to show based on doctor specialty
    // Paediatrics / General Paediatrics / blank → all sections
    val showAll = doctorSpecialty.isBlank() ||
        doctorSpecialty.equals("Paediatrics", ignoreCase = true) ||
        doctorSpecialty.equals("General Paediatrics", ignoreCase = true)
    val showVitals = true // Always show vitals
    val showDental = showAll || doctorSpecialty.equals("Dental", ignoreCase = true)
    val showVision = showAll || doctorSpecialty.equals("Ophthalmology", ignoreCase = true)
    val showNutrition = showAll || doctorSpecialty.equals("Nutrition", ignoreCase = true)
    val showGeneral = showAll ||
        doctorSpecialty.equals("ENT", ignoreCase = true) ||
        doctorSpecialty.equals("Dermatology", ignoreCase = true)
    val showReferral = true // Always show referral & summary

    // Pre-fill from existing kid data
    LaunchedEffect(kid.kidId) {
        if (kid.heightCm > 0) form.heightCm = kid.heightCm.toString()
        if (kid.weightKg > 0) form.weightKg = kid.weightKg.toString()
        form.dentalOverall = kid.dental.ifBlank { "GOOD" }
        form.visionOverall = kid.eyesight.ifBlank { "GOOD" }
        form.nutritionOverall = kid.nutrition.ifBlank { "GOOD" }

        // Load existing checkup if any
        doctorViewModel.loadExistingCheckup(kid.kidId, camp.campId) { checkup ->
            if (checkup != null) {
                populateFormFromCheckup(form, checkup)
            }
        }
    }

    var expandedSection by rememberSaveable { mutableStateOf("vitals") }

    LazyColumn(
        modifier = Modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.background),
        contentPadding = PaddingValues(start = 20.dp, end = 20.dp, bottom = 32.dp)
    ) {
        // ── Header ──
        item {
            StatusBarSpacer()
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.padding(vertical = 8.dp)
            ) {
                Box(
                    Modifier.size(44.dp).clip(RoundedCornerShape(12.dp)).clickable(onClick = onBack),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(Icons.AutoMirrored.Outlined.ArrowBack, contentDescription = "Back")
                }
                Spacer(Modifier.width(12.dp))
                Column {
                    Text(
                        kid.name,
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold,
                    )
                    Text(
                        "${kid.age}y · ${kid.gender} · ${kid.grade}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Text(
                        "${camp.campTitle} · ${camp.schoolName}",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }

        // ── Parent info card ──
        item {
            HeroCard {
                Row(
                    Modifier.padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    IconBubble(
                        icon = Icons.Outlined.MedicalServices,
                        tint = HeroBlue,
                        size = 40.dp
                    )
                    Column(Modifier.weight(1f)) {
                        Text(
                            "Parent: ${kid.parentName.ifBlank { "N/A" }}",
                            style = MaterialTheme.typography.bodyMedium,
                            fontWeight = FontWeight.SemiBold,
                        )
                        Text(
                            "Phone: ${kid.parentPhone.ifBlank { "N/A" }}",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }
            Spacer(Modifier.height(16.dp))
        }

        // ── Section: Vitals ──
        if (showVitals) item {
            FormSection(
                title = "Vitals & Anthropometry",
                expanded = expandedSection == "vitals",
                onToggle = { expandedSection = if (expandedSection == "vitals") "" else "vitals" }
            ) {
                NumberField("Height (cm)", form.heightCm) { form.heightCm = it }
                NumberField("Weight (kg)", form.weightKg) { form.weightKg = it }
                NumberField("Temperature (°F)", form.temperature) { form.temperature = it }
                NumberField("Heart Rate (bpm)", form.heartRate) { form.heartRate = it }
                NumberField("Respiratory Rate (/min)", form.respiratoryRate) { form.respiratoryRate = it }
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    NumberField("BP Systolic", form.bloodPressureSystolic, modifier = Modifier.weight(1f)) { form.bloodPressureSystolic = it }
                    NumberField("BP Diastolic", form.bloodPressureDiastolic, modifier = Modifier.weight(1f)) { form.bloodPressureDiastolic = it }
                }
                NumberField("BMI (auto-calc if blank)", form.bmi) { form.bmi = it }
            }
            Spacer(Modifier.height(12.dp))
        }

        // ── Section: Dental ──
        if (showDental) item {
            FormSection(
                title = "Dental Check",
                expanded = expandedSection == "dental",
                onToggle = { expandedSection = if (expandedSection == "dental") "" else "dental" }
            ) {
                HealthFlagSelector("Overall Dental Status", form.dentalOverall) { form.dentalOverall = it }
                ToggleRow("Caries Present", form.cariesPresent) { form.cariesPresent = it }
                if (form.cariesPresent) {
                    NumberField("Number of Caries", form.cariesCount) { form.cariesCount = it }
                }
                ToggleRow("Gingivitis", form.gingivitis) { form.gingivitis = it }
                DropdownField("Oral Hygiene", OralHygieneOptions, form.oralHygiene) { form.oralHygiene = it }
                ToggleRow("Fluoride Treatment Given", form.fluorideTreatment) { form.fluorideTreatment = it }
                TextField("Dental Notes", form.dentalNotes) { form.dentalNotes = it }
            }
            Spacer(Modifier.height(12.dp))
        }

        // ── Section: Vision ──
        if (showVision) item {
            FormSection(
                title = "Vision Screening",
                expanded = expandedSection == "vision",
                onToggle = { expandedSection = if (expandedSection == "vision") "" else "vision" }
            ) {
                HealthFlagSelector("Overall Vision Status", form.visionOverall) { form.visionOverall = it }
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    TextField("Right Eye (6/x)", form.rightEyeVision, modifier = Modifier.weight(1f)) { form.rightEyeVision = it }
                    TextField("Left Eye (6/x)", form.leftEyeVision, modifier = Modifier.weight(1f)) { form.leftEyeVision = it }
                }
                DropdownField("Color Blindness Test", ColorBlindnessOptions, form.colorBlindness) { form.colorBlindness = it }
                ToggleRow("Squint Detected", form.squint) { form.squint = it }
                ToggleRow("Glasses Needed", form.glassesNeeded) { form.glassesNeeded = it }
                TextField("Vision Notes", form.visionNotes) { form.visionNotes = it }
            }
            Spacer(Modifier.height(12.dp))
        }

        // ── Section: Nutrition ──
        if (showNutrition) item {
            FormSection(
                title = "Nutrition & Anaemia",
                expanded = expandedSection == "nutrition",
                onToggle = { expandedSection = if (expandedSection == "nutrition") "" else "nutrition" }
            ) {
                HealthFlagSelector("Overall Nutrition Status", form.nutritionOverall) { form.nutritionOverall = it }
                NumberField("Hemoglobin (g/dL)", form.hemoglobin) { form.hemoglobin = it }
                NumberField("BMI-for-age Percentile", form.bmiPercentile) { form.bmiPercentile = it }
                ToggleRow("Pallor Present", form.pallor) { form.pallor = it }
                ToggleRow("Edema Present", form.edema) { form.edema = it }
                ToggleRow("Wasting (low weight-for-height)", form.wasting) { form.wasting = it }
                ToggleRow("Stunting (low height-for-age)", form.stunting) { form.stunting = it }
                TextField("Nutrition Notes", form.nutritionNotes) { form.nutritionNotes = it }
            }
            Spacer(Modifier.height(12.dp))
        }

        // ── Section: General Physical ──
        if (showGeneral) item {
            FormSection(
                title = "General Physical Examination",
                expanded = expandedSection == "general",
                onToggle = { expandedSection = if (expandedSection == "general") "" else "general" }
            ) {
                DropdownField("Skin Condition", SkinOptions, form.skinCondition) { form.skinCondition = it }
                DropdownField("Lymph Nodes", LymphNodeOptions, form.lymphNodes) { form.lymphNodes = it }
                DropdownField("Hearing Screening", HearingOptions, form.hearingScreening) { form.hearingScreening = it }
                ToggleRow("Immunization Up to Date", form.immunizationUpToDate) { form.immunizationUpToDate = it }
                DropdownField("Developmental Milestone", DevelopmentalOptions, form.developmentalMilestone) { form.developmentalMilestone = it }
                TextField("General Notes", form.generalNotes) { form.generalNotes = it }
            }
            Spacer(Modifier.height(12.dp))
        }

        // ── Section: Referral & Summary ──
        if (showReferral) item {
            FormSection(
                title = "Referral & Summary",
                expanded = expandedSection == "referral",
                onToggle = { expandedSection = if (expandedSection == "referral") "" else "referral" }
            ) {
                HealthFlagSelector("Overall Health Status", form.overallStatus) { form.overallStatus = it }
                ToggleRow("Referral Needed", form.referralNeeded) { form.referralNeeded = it }
                if (form.referralNeeded) {
                    DropdownField("Refer To Specialty", ReferralSpecialtyOptions, form.referralSpecialty) { form.referralSpecialty = it }
                    TextField("Referral Notes", form.referralNotes) { form.referralNotes = it }
                }
                TextField("Overall Summary", form.overallSummary) { form.overallSummary = it }
            }
            Spacer(Modifier.height(20.dp))
        }

        // ── Submit button ──
        item {
            if (state.error != null) {
                Box(
                    Modifier.fillMaxWidth().padding(12.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        state.error!!,
                        style = MaterialTheme.typography.bodyMedium,
                        color = FlagAlert,
                        fontWeight = FontWeight.Medium,
                    )
                }
            }

            if (state.submitSuccess) {
                AnimatedVisibility(visible = true, enter = fadeIn(), exit = fadeOut()) {
                    HeroCard {
                        Row(
                            Modifier.padding(16.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            Icon(Icons.Outlined.CheckCircle, contentDescription = null, tint = FlagGood, modifier = Modifier.size(28.dp))
                            Text(
                                "Checkup saved successfully!",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.SemiBold,
                                color = FlagGood,
                            )
                        }
                    }
                    Spacer(Modifier.height(12.dp))
                }
            }

            PrimaryGradientButton(
                text = if (state.isSubmitting) "Saving..." else "Save Health Checkup",
                enabled = !state.isSubmitting,
                onClick = {
                    val formData = buildFormData(form)
                    val overallStatus = form.overallStatus
                    doctorViewModel.submitCheckup(
                        kidId = kid.kidId,
                        campId = camp.campId,
                        formData = formData,
                        summary = form.overallSummary,
                        referralNeeded = form.referralNeeded,
                        referralNotes = form.referralNotes,
                        overallStatus = overallStatus,
                        onSuccess = { onSubmitted() },
                    )
                },
                modifier = Modifier.fillMaxWidth()
            )
        }
    }
}

// ─── Form building ───────────────────────────────────────────

private fun buildFormData(f: CheckupFormState): Map<String, Any> = mapOf(
    "vitals" to mapOf(
        "height_cm" to f.heightCm,
        "weight_kg" to f.weightKg,
        "temperature" to f.temperature,
        "heart_rate" to f.heartRate,
        "respiratory_rate" to f.respiratoryRate,
        "bp_systolic" to f.bloodPressureSystolic,
        "bp_diastolic" to f.bloodPressureDiastolic,
        "bmi" to f.bmi,
    ),
    "dental" to mapOf(
        "overall_status" to f.dentalOverall,
        "caries_present" to f.cariesPresent,
        "caries_count" to f.cariesCount,
        "gingivitis" to f.gingivitis,
        "oral_hygiene" to f.oralHygiene,
        "fluoride_treatment" to f.fluorideTreatment,
        "notes" to f.dentalNotes,
    ),
    "vision" to mapOf(
        "overall_status" to f.visionOverall,
        "right_eye" to f.rightEyeVision,
        "left_eye" to f.leftEyeVision,
        "color_blindness" to f.colorBlindness,
        "squint" to f.squint,
        "glasses_needed" to f.glassesNeeded,
        "notes" to f.visionNotes,
    ),
    "nutrition" to mapOf(
        "overall_status" to f.nutritionOverall,
        "hemoglobin" to f.hemoglobin,
        "bmi_percentile" to f.bmiPercentile,
        "pallor" to f.pallor,
        "edema" to f.edema,
        "wasting" to f.wasting,
        "stunting" to f.stunting,
        "notes" to f.nutritionNotes,
    ),
    "general" to mapOf(
        "skin_condition" to f.skinCondition,
        "lymph_nodes" to f.lymphNodes,
        "hearing" to f.hearingScreening,
        "immunization_up_to_date" to f.immunizationUpToDate,
        "developmental_milestone" to f.developmentalMilestone,
        "notes" to f.generalNotes,
    ),
    "referral" to mapOf(
        "needed" to f.referralNeeded,
        "specialty" to f.referralSpecialty,
        "notes" to f.referralNotes,
    ),
)

private fun populateFormFromCheckup(f: CheckupFormState, checkup: HealthCheckupDto) {
    val fd = checkup.formData
    val vitals = fd["vitals"] as? JsonObject
    val dental = fd["dental"] as? JsonObject
    val vision = fd["vision"] as? JsonObject
    val nutrition = fd["nutrition"] as? JsonObject
    val general = fd["general"] as? JsonObject
    val referral = fd["referral"] as? JsonObject

    vitals?.let {
        f.heightCm = (it["height_cm"] as? JsonPrimitive)?.contentOrNull ?: f.heightCm
        f.weightKg = (it["weight_kg"] as? JsonPrimitive)?.contentOrNull ?: f.weightKg
        f.temperature = (it["temperature"] as? JsonPrimitive)?.contentOrNull ?: ""
        f.heartRate = (it["heart_rate"] as? JsonPrimitive)?.contentOrNull ?: ""
        f.respiratoryRate = (it["respiratory_rate"] as? JsonPrimitive)?.contentOrNull ?: ""
        f.bloodPressureSystolic = (it["bp_systolic"] as? JsonPrimitive)?.contentOrNull ?: ""
        f.bloodPressureDiastolic = (it["bp_diastolic"] as? JsonPrimitive)?.contentOrNull ?: ""
        f.bmi = (it["bmi"] as? JsonPrimitive)?.contentOrNull ?: ""
    }
    dental?.let {
        f.dentalOverall = (it["overall_status"] as? JsonPrimitive)?.contentOrNull ?: f.dentalOverall
        f.cariesPresent = (it["caries_present"] as? JsonPrimitive)?.contentOrNull == "true"
        f.cariesCount = (it["caries_count"] as? JsonPrimitive)?.contentOrNull ?: ""
        f.gingivitis = (it["gingivitis"] as? JsonPrimitive)?.contentOrNull == "true"
        f.oralHygiene = (it["oral_hygiene"] as? JsonPrimitive)?.contentOrNull ?: f.oralHygiene
        f.fluorideTreatment = (it["fluoride_treatment"] as? JsonPrimitive)?.contentOrNull == "true"
        f.dentalNotes = (it["notes"] as? JsonPrimitive)?.contentOrNull ?: ""
    }
    vision?.let {
        f.visionOverall = (it["overall_status"] as? JsonPrimitive)?.contentOrNull ?: f.visionOverall
        f.rightEyeVision = (it["right_eye"] as? JsonPrimitive)?.contentOrNull ?: ""
        f.leftEyeVision = (it["left_eye"] as? JsonPrimitive)?.contentOrNull ?: ""
        f.colorBlindness = (it["color_blindness"] as? JsonPrimitive)?.contentOrNull ?: f.colorBlindness
        f.squint = (it["squint"] as? JsonPrimitive)?.contentOrNull == "true"
        f.glassesNeeded = (it["glasses_needed"] as? JsonPrimitive)?.contentOrNull == "true"
        f.visionNotes = (it["notes"] as? JsonPrimitive)?.contentOrNull ?: ""
    }
    nutrition?.let {
        f.nutritionOverall = (it["overall_status"] as? JsonPrimitive)?.contentOrNull ?: f.nutritionOverall
        f.hemoglobin = (it["hemoglobin"] as? JsonPrimitive)?.contentOrNull ?: ""
        f.bmiPercentile = (it["bmi_percentile"] as? JsonPrimitive)?.contentOrNull ?: ""
        f.pallor = (it["pallor"] as? JsonPrimitive)?.contentOrNull == "true"
        f.edema = (it["edema"] as? JsonPrimitive)?.contentOrNull == "true"
        f.wasting = (it["wasting"] as? JsonPrimitive)?.contentOrNull == "true"
        f.stunting = (it["stunting"] as? JsonPrimitive)?.contentOrNull == "true"
        f.nutritionNotes = (it["notes"] as? JsonPrimitive)?.contentOrNull ?: ""
    }
    general?.let {
        f.skinCondition = (it["skin_condition"] as? JsonPrimitive)?.contentOrNull ?: f.skinCondition
        f.lymphNodes = (it["lymph_nodes"] as? JsonPrimitive)?.contentOrNull ?: f.lymphNodes
        f.hearingScreening = (it["hearing"] as? JsonPrimitive)?.contentOrNull ?: f.hearingScreening
        f.immunizationUpToDate = (it["immunization_up_to_date"] as? JsonPrimitive)?.contentOrNull != "false"
        f.developmentalMilestone = (it["developmental_milestone"] as? JsonPrimitive)?.contentOrNull ?: f.developmentalMilestone
        f.generalNotes = (it["notes"] as? JsonPrimitive)?.contentOrNull ?: ""
    }
    referral?.let {
        f.referralNeeded = (it["needed"] as? JsonPrimitive)?.contentOrNull == "true"
        f.referralSpecialty = (it["specialty"] as? JsonPrimitive)?.contentOrNull ?: ""
        f.referralNotes = (it["notes"] as? JsonPrimitive)?.contentOrNull ?: ""
    }
    f.overallSummary = checkup.summary
    f.overallStatus = checkup.overallStatus
}

// ─── Reusable form components ────────────────────────────────

@Composable
private fun FormSection(
    title: String,
    expanded: Boolean,
    onToggle: () -> Unit,
    content: @Composable () -> Unit,
) {
    HeroCard(modifier = Modifier.clickable(onClick = onToggle)) {
        Column {
            Row(
                Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 14.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    title,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.weight(1f),
                )
                Icon(
                    Icons.Outlined.ExpandMore,
                    contentDescription = null,
                    tint = HeroOrange,
                    modifier = Modifier
                        .size(24.dp)
                        .rotate(if (expanded) 180f else 0f),
                )
            }
            AnimatedVisibility(
                visible = expanded,
                enter = expandVertically() + fadeIn(),
                exit = shrinkVertically() + fadeOut(),
            ) {
                Column(
                    Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    content()
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DropdownField(
    label: String,
    options: List<String>,
    value: String,
    onValueChange: (String) -> Unit,
) {
    var expanded by remember { mutableStateOf(false) }
    ExposedDropdownMenuBox(
        expanded = expanded,
        onExpandedChange = { expanded = it },
    ) {
        OutlinedTextField(
            value = value,
            onValueChange = {},
            readOnly = true,
            label = { Text(label) },
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
            modifier = Modifier
                .fillMaxWidth()
                .menuAnchor(),
            colors = ExposedDropdownMenuDefaults.outlinedTextFieldColors(
                focusedBorderColor = HeroOrange,
                focusedLabelColor = HeroOrange,
            ),
        )
        ExposedDropdownMenu(
            expanded = expanded,
            onDismissRequest = { expanded = false },
        ) {
            options.forEach { option ->
                DropdownMenuItem(
                    text = { Text(option) },
                    onClick = {
                        onValueChange(option)
                        expanded = false
                    },
                )
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun HealthFlagSelector(
    label: String,
    value: String,
    onValueChange: (String) -> Unit,
) {
    Column {
        Text(
            label,
            style = MaterialTheme.typography.labelLarge,
            fontWeight = FontWeight.Medium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(Modifier.height(8.dp))
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            HealthFlagOptions.forEach { option ->
                val color = when (option) {
                    "GOOD" -> FlagGood
                    "WATCH" -> FlagWatch
                    "ALERT" -> FlagAlert
                    else -> MaterialTheme.colorScheme.outline
                }
                FilterChip(
                    selected = value == option,
                    onClick = { onValueChange(option) },
                    label = { Text(option) },
                    leadingIcon = {
                        Box(
                            Modifier.size(8.dp).clip(RoundedCornerShape(50))
                                .background(color)
                        )
                    },
                )
            }
        }
    }
}

@Composable
private fun ToggleRow(
    label: String,
    checked: Boolean,
    onValueChange: (Boolean) -> Unit,
) {
    Row(
        Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(
            label,
            style = MaterialTheme.typography.bodyLarge,
            modifier = Modifier.weight(1f),
        )
        Switch(
            checked = checked,
            onCheckedChange = onValueChange,
        )
    }
}

@Composable
private fun NumberField(
    label: String,
    value: String,
    modifier: Modifier = Modifier,
    onValueChange: (String) -> Unit,
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        label = { Text(label) },
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
        singleLine = true,
        modifier = modifier.fillMaxWidth(),
        colors = androidx.compose.material3.OutlinedTextFieldDefaults.colors(
            focusedBorderColor = HeroOrange,
            focusedLabelColor = HeroOrange,
        ),
    )
}

@Composable
private fun TextField(
    label: String,
    value: String,
    modifier: Modifier = Modifier,
    onValueChange: (String) -> Unit,
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        label = { Text(label) },
        singleLine = false,
        modifier = modifier.fillMaxWidth(),
        colors = androidx.compose.material3.OutlinedTextFieldDefaults.colors(
            focusedBorderColor = HeroOrange,
            focusedLabelColor = HeroOrange,
        ),
    )
}
