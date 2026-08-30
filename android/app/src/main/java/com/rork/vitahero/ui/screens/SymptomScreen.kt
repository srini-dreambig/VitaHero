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
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.Warning
import androidx.compose.material3.Checkbox
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.rork.vitahero.data.GuardianViewModel
import com.rork.vitahero.data.S
import com.rork.vitahero.data.SymptomEventDto
import com.rork.vitahero.ui.components.HeroCard
import com.rork.vitahero.ui.components.PrimaryGradientButton
import com.rork.vitahero.ui.components.StatusBarSpacer
import com.rork.vitahero.ui.components.t
import com.rork.vitahero.ui.components.tf
import com.rork.vitahero.ui.theme.HeroOrange
import java.time.LocalDate
import java.time.format.DateTimeFormatter

/**
 * The one clinical thing a parent may write.
 *
 * Everything else about a child's health on this app is measured by somebody
 * trained and approved by a physician. An episode of fever is different: the
 * school never sees it, only the family can report it, and a doctor at the
 * next camp genuinely wants to know. So the parent gets exactly this — a
 * complaint from a fixed list, when it started, and a note — and nothing that
 * could be mistaken for a measurement or a diagnosis.
 *
 * The complaint list comes from the server, not from this file, so an old
 * build cannot offer something the server will refuse.
 */
@Composable
fun SymptomScreen(
    kidId: String,
    kidName: String,
    guardianViewModel: GuardianViewModel,
    onBack: () -> Unit,
) {
    val log by guardianViewModel.symptomLog.collectAsState()
    val advice by guardianViewModel.symptomAdvice.collectAsState()
    val busy by guardianViewModel.busy.collectAsState()

    LaunchedEffect(kidId) { guardianViewModel.loadSymptoms(kidId) }

    val today = remember { LocalDate.now() }
    val fmt = remember { DateTimeFormatter.ISO_LOCAL_DATE }

    var symptom by remember(kidId) { mutableStateOf("") }
    var severity by remember(kidId) { mutableStateOf("MILD") }
    var daysAgo by remember(kidId) { mutableStateOf(0) }
    var stillGoing by remember(kidId) { mutableStateOf(true) }
    var note by remember(kidId) { mutableStateOf("") }
    var sawDoctor by remember(kidId) { mutableStateOf(false) }
    var missedSchool by remember(kidId) { mutableStateOf(false) }

    LazyColumn(
        modifier = Modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.background),
        contentPadding = PaddingValues(start = 20.dp, end = 20.dp, bottom = 40.dp),
    ) {
        item {
            StatusBarSpacer()
            ScreenHeader(t(S.symptomsTitle), tf(S.symptomsSub, kidName), onBack)
            Spacer(Modifier.height(12.dp))
        }

        // The safety line sits above the form, in the server's own words.
        item {
            Box(
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(14.dp))
                    .background(HeroOrange.copy(alpha = 0.12f))
                    .padding(14.dp),
            ) {
                Row(verticalAlignment = Alignment.Top) {
                    Icon(
                        Icons.Outlined.Warning,
                        contentDescription = null,
                        tint = HeroOrange,
                        modifier = Modifier.size(20.dp),
                    )
                    Spacer(Modifier.width(10.dp))
                    Text(
                        log.notice.ifBlank { t(S.symptomsNoticeFallback) },
                        style = MaterialTheme.typography.bodySmall,
                    )
                }
            }
            Spacer(Modifier.height(14.dp))
        }

        // Advice for a complaint that can turn serious. Shown above the form
        // after saving, because the record is kept either way.
        if (advice.isNotBlank()) {
            item {
                Box(
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(14.dp))
                        .background(MaterialTheme.colorScheme.errorContainer)
                        .padding(14.dp),
                ) {
                    Column {
                        Row(
                            Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.Top,
                        ) {
                            Text(
                                t(S.seeADoctor),
                                style = MaterialTheme.typography.titleSmall,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.onErrorContainer,
                                modifier = Modifier.weight(1f),
                            )
                            Icon(
                                Icons.Outlined.Close,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.onErrorContainer,
                                modifier = Modifier
                                    .size(20.dp)
                                    .clickable { guardianViewModel.clearSymptomAdvice() },
                            )
                        }
                        Spacer(Modifier.height(6.dp))
                        Text(
                            advice,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onErrorContainer,
                        )
                    }
                }
                Spacer(Modifier.height(14.dp))
            }
        }

        item {
            HeroCard(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(18.dp)) {
                    Text(
                        t(S.whatHappened),
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold,
                    )
                    Spacer(Modifier.height(10.dp))
                    ChipGrid(log.symptoms, symptom) { symptom = it }

                    Spacer(Modifier.height(16.dp))
                    Text(
                        t(S.howBad),
                        style = MaterialTheme.typography.labelLarge,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Spacer(Modifier.height(6.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Choice(t(S.severityMild), severity == "MILD") { severity = "MILD" }
                        Choice(t(S.severityModerate), severity == "MODERATE") { severity = "MODERATE" }
                    }

                    Spacer(Modifier.height(16.dp))
                    Text(
                        t(S.whenStarted),
                        style = MaterialTheme.typography.labelLarge,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Spacer(Modifier.height(6.dp))
                    // Days back rather than a date picker: a parent remembers
                    // "the day before yesterday", not the 14th.
                    val dayChoices = listOf(
                        0 to t(S.dayToday),
                        1 to t(S.dayYesterday),
                        2 to tf(S.dayNAgo, "2"),
                        3 to tf(S.dayNAgo, "3"),
                        5 to tf(S.dayNAgo, "5"),
                        7 to tf(S.dayNAgo, "7"),
                    )
                    ChipGrid(
                        options = dayChoices.map { it.second },
                        selected = dayChoices.first { it.first == daysAgo }.second,
                    ) { chosen ->
                        daysAgo = dayChoices.first { it.second == chosen }.first
                    }

                    Spacer(Modifier.height(14.dp))
                    CheckRow(t(S.stillUnwell), stillGoing) { stillGoing = it }
                    CheckRow(t(S.missedSchool), missedSchool) { missedSchool = it }
                    CheckRow(t(S.sawADoctor), sawDoctor) { sawDoctor = it }

                    Spacer(Modifier.height(12.dp))
                    OutlinedTextField(
                        value = note,
                        onValueChange = { note = it.take(500) },
                        modifier = Modifier.fillMaxWidth(),
                        placeholder = { Text(t(S.symptomNoteHint)) },
                        minLines = 2,
                        shape = RoundedCornerShape(14.dp),
                        colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = HeroOrange),
                    )

                    Spacer(Modifier.height(14.dp))
                    PrimaryGradientButton(
                        text = t(S.saveSymptom),
                        onClick = {
                            val start = today.minusDays(daysAgo.toLong())
                            guardianViewModel.recordSymptom(
                                kidId = kidId,
                                symptom = symptom,
                                severity = severity,
                                startedOn = start.format(fmt),
                                endedOn = if (stillGoing) null else today.format(fmt),
                                note = note.trim(),
                                sawDoctor = sawDoctor,
                                missedSchool = missedSchool,
                            ) {
                                symptom = ""
                                note = ""
                                daysAgo = 0
                                stillGoing = true
                                sawDoctor = false
                                missedSchool = false
                                severity = "MILD"
                            }
                        },
                        modifier = Modifier.fillMaxWidth(),
                        enabled = !busy && symptom.isNotBlank(),
                    )
                    Spacer(Modifier.height(8.dp))
                    Text(
                        t(S.symptomNotADiagnosis),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
            Spacer(Modifier.height(20.dp))
        }

        if (log.events.isNotEmpty()) {
            item {
                Text(
                    t(S.pastIllnesses),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                )
                Spacer(Modifier.height(4.dp))
                Text(
                    t(S.pastIllnessesSub),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(Modifier.height(10.dp))
            }
            items(log.events, key = { it.id }) { e ->
                EventRow(e) { guardianViewModel.deleteSymptom(kidId, e.id) }
                Spacer(Modifier.height(8.dp))
            }
        }
    }
}

@Composable
private fun EventRow(e: SymptomEventDto, onDelete: () -> Unit) {
    HeroCard(Modifier.fillMaxWidth()) {
        Row(
            Modifier.fillMaxWidth().padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(Modifier.weight(1f)) {
                Text(
                    e.symptom,
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    listOf(
                        e.startedOn,
                        if (e.endedOn.isBlank()) t(S.ongoingLabel) else "→ " + e.endedOn,
                        if (e.severity == "MODERATE") t(S.severityModerate) else "",
                    ).filter { it.isNotBlank() }.joinToString(" · "),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                if (e.note.isNotBlank()) {
                    Text(
                        e.note,
                        style = MaterialTheme.typography.bodySmall,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
            }
            Spacer(Modifier.width(8.dp))
            Icon(
                Icons.Outlined.Close,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(20.dp).clickable(onClick = onDelete),
            )
        }
    }
}

/** Wrapping chips. Written by hand so the layout never runs off a narrow screen. */
@Composable
private fun ChipGrid(options: List<String>, selected: String, onPick: (String) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        options.chunked(2).forEach { pair ->
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                pair.forEach { option ->
                    Box(Modifier.weight(1f)) { Choice(option, option == selected) { onPick(option) } }
                }
                if (pair.size == 1) Spacer(Modifier.weight(1f))
            }
        }
    }
}

@Composable
private fun Choice(label: String, selected: Boolean, onClick: () -> Unit) {
    Box(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(
                if (selected) HeroOrange.copy(alpha = 0.16f)
                else MaterialTheme.colorScheme.surfaceVariant
            )
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 10.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            label,
            style = MaterialTheme.typography.labelLarge,
            fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium,
            color = if (selected) HeroOrange else MaterialTheme.colorScheme.onSurfaceVariant,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

@Composable
private fun CheckRow(label: String, checked: Boolean, onChange: (Boolean) -> Unit) {
    Row(
        Modifier.fillMaxWidth().clickable { onChange(!checked) },
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Checkbox(checked = checked, onCheckedChange = onChange)
        Spacer(Modifier.width(4.dp))
        Text(label, style = MaterialTheme.typography.bodyMedium)
    }
}
