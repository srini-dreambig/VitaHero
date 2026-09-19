package com.rork.vitahero.ui.screens

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
import com.rork.vitahero.data.ClinicianViewModel
import com.rork.vitahero.ui.components.HeroCard
import com.rork.vitahero.ui.components.PrimaryGradientButton
import com.rork.vitahero.ui.components.StatusBarSpacer
import com.rork.vitahero.ui.theme.HeroBlue
import com.rork.vitahero.ui.theme.HeroOrange

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
private val GUMS = listOf("healthy", "bleeding", "swollen")

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
        "Vision" -> Column {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                ChoiceField("Left eye", ACUITY, fields, "leftAcuity", Modifier.weight(1f))
                ChoiceField("Right eye", ACUITY, fields, "rightAcuity", Modifier.weight(1f))
            }
            Spacer(Modifier.height(6.dp))
            ToggleField("Squint noted", fields, "squint")
        }
        "Dental" -> Column {
            NumberField("Carious teeth", fields, "cariesCount", Modifier.fillMaxWidth())
            Spacer(Modifier.height(8.dp))
            ChoiceField("Gums", GUMS, fields, "gums", Modifier.fillMaxWidth())
            Spacer(Modifier.height(6.dp))
            ToggleField("Reports pain", fields, "pain")
        }
        "Haemoglobin" -> NumberField("Haemoglobin (g/dL)", fields, "hb", Modifier.fillMaxWidth())
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

/** A short closed list, as chips: a dropdown is two taps for four options. */
@Composable
private fun ChoiceField(
    label: String,
    options: List<String>,
    fields: MutableMap<String, String>,
    key: String,
    modifier: Modifier = Modifier,
) {
    Column(modifier) {
        Text(
            label,
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(Modifier.height(6.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            for (o in options) {
                val on = fields[key] == o
                Text(
                    o,
                    modifier = Modifier
                        .clip(RoundedCornerShape(50))
                        .background(
                            if (on) HeroOrange.copy(alpha = 0.16f)
                            else MaterialTheme.colorScheme.surfaceVariant
                        )
                        .clickable { fields[key] = if (on) "" else o }
                        .padding(horizontal = 10.dp, vertical = 6.dp),
                    style = MaterialTheme.typography.labelMedium,
                    fontWeight = if (on) FontWeight.Bold else FontWeight.Medium,
                    color = if (on) HeroOrange else MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
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

@Composable
private fun Notice(text: String, error: Boolean) {
    Text(
        text,
        Modifier
            .fillMaxWidth()
            .padding(horizontal = 20.dp, vertical = 5.dp)
            .clip(RoundedCornerShape(12.dp))
            .background(
                if (error) MaterialTheme.colorScheme.errorContainer
                else HeroBlue.copy(alpha = 0.10f)
            )
            .padding(12.dp),
        style = MaterialTheme.typography.bodySmall,
        color =
            if (error) MaterialTheme.colorScheme.onErrorContainer
            else MaterialTheme.colorScheme.onSurface,
    )
}


/** A plain copy of the live field map, taken at the moment Save is pressed. */
private fun snapshot(
    values: Map<String, MutableMap<String, String>>,
): Map<String, Map<String, String>> = values.mapValues { entry -> entry.value.toMap() }
