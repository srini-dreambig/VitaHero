package com.rork.vitahero.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
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
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.CalendarMonth
import androidx.compose.material.icons.outlined.LocalHospital
import androidx.compose.material.icons.outlined.MedicalServices
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.rork.vitahero.data.ApiRepositoryProvider
import com.rork.vitahero.data.HealthCheckupResultDto
import com.rork.vitahero.ui.components.HeroCard
import com.rork.vitahero.ui.components.IconBubble
import com.rork.vitahero.ui.components.StatusBarSpacer
import com.rork.vitahero.ui.theme.FlagAlert
import com.rork.vitahero.ui.theme.FlagGood
import com.rork.vitahero.ui.theme.FlagWatch
import com.rork.vitahero.ui.theme.HeroBlue
import com.rork.vitahero.ui.theme.HeroOrange
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull

/**
 * Parent-facing screen showing a detailed health checkup report for their child.
 */
@Composable
fun HealthCheckupDetailScreen(
    checkupId: String,
    onBack: () -> Unit,
) {
    var checkup by remember { mutableStateOf<HealthCheckupResultDto?>(null) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(checkupId) {
        loading = true
        try {
            val result = withContext(Dispatchers.IO) {
                ApiRepositoryProvider.firestoreRepo?.fetchHealthCheckup(checkupId)
            }
            checkup = result
            if (result == null) error = "Checkup not found"
        } catch (e: Exception) {
            error = e.message
        }
        loading = false
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.background),
        contentPadding = PaddingValues(start = 20.dp, end = 20.dp, bottom = 32.dp)
    ) {
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
                Text(
                    "Health Checkup Report",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                )
            }
        }

        if (loading) {
            item {
                Box(
                    Modifier.fillMaxWidth().padding(48.dp),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator(color = HeroOrange)
                }
            }
        } else if (error != null) {
            item {
                HeroCard {
                    Text(
                        error!!,
                        style = MaterialTheme.typography.bodyLarge,
                        modifier = Modifier.padding(28.dp),
                        color = FlagAlert,
                    )
                }
            }
        } else if (checkup != null) {
            val cp = checkup!!

            // ── Header card ──
            item {
                HeroCard {
                    Column(Modifier.padding(20.dp)) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            IconBubble(
                                icon = Icons.Outlined.MedicalServices,
                                tint = HeroOrange,
                                size = 48.dp
                            )
                            Column(Modifier.weight(1f)) {
                                Text(
                                    cp.kidName.ifBlank { "Child" },
                                    style = MaterialTheme.typography.titleLarge,
                                    fontWeight = FontWeight.Bold,
                                )
                                Text(
                                    cp.campTitle,
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                            }
                        }
                        Spacer(Modifier.height(12.dp))
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(16.dp)
                        ) {
                            InfoChip(Icons.Outlined.CalendarMonth, cp.campDate)
                            if (cp.schoolName.isNotBlank()) {
                                InfoChip(Icons.Outlined.LocalHospital, cp.schoolName)
                            }
                            if (cp.doctorName.isNotBlank()) {
                                InfoChip(Icons.Outlined.Person, "Dr. ${cp.doctorName}")
                            }
                        }
                        Spacer(Modifier.height(14.dp))
                        OverallStatusBadge(cp.overallStatus)
                    }
                }
                Spacer(Modifier.height(16.dp))
            }

            // ── Referral alert ──
            if (cp.referralNeeded) {
                item {
                    HeroCard(background = FlagAlert.copy(alpha = 0.08f)) {
                        Column(Modifier.padding(16.dp)) {
                            Text(
                                "Referral Required",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold,
                                color = FlagAlert,
                            )
                            if (cp.referralNotes.isNotBlank()) {
                                Spacer(Modifier.height(6.dp))
                                Text(
                                    cp.referralNotes,
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = MaterialTheme.colorScheme.onSurface,
                                )
                            }
                        }
                    }
                    Spacer(Modifier.height(16.dp))
                }
            }

            // ── Summary ──
            if (cp.summary.isNotBlank()) {
                item {
                    SectionCard("Doctor's Summary") {
                        Text(
                            cp.summary,
                            style = MaterialTheme.typography.bodyLarge,
                            modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                        )
                    }
                    Spacer(Modifier.height(12.dp))
                }
            }

            // ── Form sections ──
            val fd = cp.formData
            val vitals = fd["vitals"] as? JsonObject
            val dental = fd["dental"] as? JsonObject
            val vision = fd["vision"] as? JsonObject
            val nutrition = fd["nutrition"] as? JsonObject
            val general = fd["general"] as? JsonObject
            val ent = fd["ent"] as? JsonObject
            val dermatology = fd["dermatology"] as? JsonObject

            vitals?.let {
                item {
                    SectionCard("Vitals & Anthropometry") {
                        VitalRow(it, "Height", "height_cm", "cm")
                        VitalRow(it, "Weight", "weight_kg", "kg")
                        VitalRow(it, "Temperature", "temperature", "°F")
                        VitalRow(it, "Heart Rate", "heart_rate", "bpm")
                        VitalRow(it, "Respiratory Rate", "respiratory_rate", "/min")
                        VitalRow(it, "BP", "bp_systolic", "", "bp_diastolic")
                        VitalRow(it, "BMI", "bmi", "")
                    }
                    Spacer(Modifier.height(12.dp))
                }
            }

            dental?.let {
                item {
                    SectionCard("Dental Check") {
                        StatusRow("Overall", it["overall_status"] as? JsonPrimitive)
                        BoolRow("Caries Present", it["caries_present"] as? JsonPrimitive)
                        VitalRow(it, "Caries Count", "caries_count", "")
                        BoolRow("Gingivitis", it["gingivitis"] as? JsonPrimitive)
                        TextRow("Oral Hygiene", it["oral_hygiene"] as? JsonPrimitive)
                        BoolRow("Fluoride Treatment", it["fluoride_treatment"] as? JsonPrimitive)
                        TextRow("Notes", it["notes"] as? JsonPrimitive)
                    }
                    Spacer(Modifier.height(12.dp))
                }
            }

            vision?.let {
                item {
                    SectionCard("Vision Screening") {
                        StatusRow("Overall", it["overall_status"] as? JsonPrimitive)
                        TextRow("Right Eye", it["right_eye"] as? JsonPrimitive)
                        TextRow("Left Eye", it["left_eye"] as? JsonPrimitive)
                        TextRow("Color Blindness", it["color_blindness"] as? JsonPrimitive)
                        BoolRow("Squint Detected", it["squint"] as? JsonPrimitive)
                        BoolRow("Glasses Needed", it["glasses_needed"] as? JsonPrimitive)
                        TextRow("Notes", it["notes"] as? JsonPrimitive)
                    }
                    Spacer(Modifier.height(12.dp))
                }
            }

            nutrition?.let {
                item {
                    SectionCard("Nutrition & Anaemia") {
                        StatusRow("Overall", it["overall_status"] as? JsonPrimitive)
                        VitalRow(it, "Hemoglobin", "hemoglobin", "g/dL")
                        VitalRow(it, "BMI Percentile", "bmi_percentile", "")
                        BoolRow("Pallor", it["pallor"] as? JsonPrimitive)
                        BoolRow("Edema", it["edema"] as? JsonPrimitive)
                        BoolRow("Wasting", it["wasting"] as? JsonPrimitive)
                        BoolRow("Stunting", it["stunting"] as? JsonPrimitive)
                        TextRow("Notes", it["notes"] as? JsonPrimitive)
                    }
                    Spacer(Modifier.height(12.dp))
                }
            }

            general?.let {
                item {
                    SectionCard("General Physical Examination") {
                        TextRow("Skin Condition", it["skin_condition"] as? JsonPrimitive)
                        TextRow("Lymph Nodes", it["lymph_nodes"] as? JsonPrimitive)
                        TextRow("Hearing Screening", it["hearing"] as? JsonPrimitive)
                        BoolRow("Immunization Up to Date", it["immunization_up_to_date"] as? JsonPrimitive)
                        TextRow("Developmental Milestone", it["developmental_milestone"] as? JsonPrimitive)
                        TextRow("Notes", it["notes"] as? JsonPrimitive)
                    }
                    Spacer(Modifier.height(12.dp))
                }
            }

            ent?.let {
                item {
                    SectionCard("ENT Examination") {
                        StatusRow("Overall", it["overall_status"] as? JsonPrimitive)
                        TextRow("Ear Condition", it["ear_condition"] as? JsonPrimitive)
                        TextRow("Hearing Screening", it["hearing"] as? JsonPrimitive)
                        TextRow("Tonsils", it["tonsils"] as? JsonPrimitive)
                        TextRow("Throat Condition", it["throat_condition"] as? JsonPrimitive)
                        TextRow("Nasal Condition", it["nasal_condition"] as? JsonPrimitive)
                        BoolRow("Speech Delay Suspected", it["speech_delay"] as? JsonPrimitive)
                        TextRow("Notes", it["notes"] as? JsonPrimitive)
                    }
                    Spacer(Modifier.height(12.dp))
                }
            }

            dermatology?.let {
                item {
                    SectionCard("Dermatology / Skin Examination") {
                        StatusRow("Overall", it["overall_status"] as? JsonPrimitive)
                        TextRow("Skin Lesion / Condition", it["skin_lesion_type"] as? JsonPrimitive)
                        BoolRow("Rash Present", it["rash_present"] as? JsonPrimitive)
                        TextRow("Rash Location", it["rash_location"] as? JsonPrimitive)
                        BoolRow("Pigmentation Issue", it["pigmentation_issue"] as? JsonPrimitive)
                        TextRow("Scalp / Hair Condition", it["scalp_condition"] as? JsonPrimitive)
                        BoolRow("Known Allergy History", it["allergy_history"] as? JsonPrimitive)
                        TextRow("Notes", it["notes"] as? JsonPrimitive)
                    }
                    Spacer(Modifier.height(12.dp))
                }
            }

            // ── Date ──
            item {
                Text(
                    "Last updated: ${cp.updatedAt?.take(10) ?: "N/A"}",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 8.dp),
                )
            }
        }
    }
}

// ─── Helper composables ──────────────────────────────────────

@Composable
private fun SectionCard(title: String, content: @Composable () -> Unit) {
    HeroCard {
        Column {
            Text(
                title,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.padding(16.dp),
            )
            content()
        }
    }
}

@Composable
private fun VitalRow(
    json: JsonObject,
    label: String,
    key: String,
    unit: String,
    secondaryKey: String? = null,
) {
    val value = (json[key] as? JsonPrimitive)?.contentOrNull
    val secondary = secondaryKey?.let { (json[it] as? JsonPrimitive)?.contentOrNull }
    val display = buildString {
        if (!value.isNullOrBlank()) {
            append(value)
            if (unit.isNotBlank()) append(" ").append(unit)
            if (secondary != null && secondary.isNotBlank()) {
                append(" / ").append(secondary)
                if (unit.isNotBlank()) append(" ").append(unit)
            }
        } else {
            append("—")
        }
    }
    KeyValueRow(label, display)
}

@Composable
private fun KeyValueRow(key: String, value: String) {
    Row(
        Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(
            key,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.weight(1f),
        )
        Text(
            value,
            style = MaterialTheme.typography.bodyMedium,
            fontWeight = FontWeight.Medium,
        )
    }
}

@Composable
private fun StatusRow(label: String, value: JsonPrimitive?) {
    val status = value?.contentOrNull ?: "—"
    val color = when (status) {
        "GOOD" -> FlagGood
        "WATCH" -> FlagWatch
        "ALERT" -> FlagAlert
        else -> MaterialTheme.colorScheme.onSurface
    }
    Row(
        Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            label,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.weight(1f),
        )
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            Box(Modifier.size(8.dp).clip(RoundedCornerShape(50)).background(color))
            Text(status, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold, color = color)
        }
    }
}

@Composable
private fun BoolRow(label: String, value: JsonPrimitive?) {
    val bool = value?.contentOrNull == "true"
    Row(
        Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(
            label,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.weight(1f),
        )
        Text(
            if (bool) "Yes" else "No",
            style = MaterialTheme.typography.bodyMedium,
            fontWeight = FontWeight.Medium,
            color = if (bool) FlagAlert else FlagGood,
        )
    }
}

@Composable
private fun TextRow(label: String, value: JsonPrimitive?) {
    val text = value?.contentOrNull
    if (!text.isNullOrBlank()) {
        KeyValueRow(label, text)
    }
}

@Composable
private fun InfoChip(icon: androidx.compose.ui.graphics.vector.ImageVector, text: String) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        Icon(icon, contentDescription = null, modifier = Modifier.size(16.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(text, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
private fun OverallStatusBadge(status: String) {
    val (color, label) = when (status) {
        "GOOD" -> FlagGood to "All Clear"
        "WATCH" -> FlagWatch to "Needs Monitoring"
        "ALERT" -> FlagAlert to "Attention Required"
        else -> MaterialTheme.colorScheme.outline to status
    }
    Row(
        Modifier
            .clip(RoundedCornerShape(50))
            .background(color.copy(alpha = 0.12f))
            .padding(horizontal = 16.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Box(Modifier.size(10.dp).clip(RoundedCornerShape(50)).background(color))
        Text(label, style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.Bold, color = color)
    }
}
