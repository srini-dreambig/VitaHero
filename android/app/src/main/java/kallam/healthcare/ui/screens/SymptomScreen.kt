package kallam.healthcare.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
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
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.Warning
import androidx.compose.material3.Checkbox
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import kallam.healthcare.data.GuardianViewModel
import kallam.healthcare.data.S
import kallam.healthcare.data.SymptomEventDto
import kallam.healthcare.ui.components.AppCard
import kallam.healthcare.ui.components.AppListRow
import kallam.healthcare.ui.components.AppScreenHeader
import kallam.healthcare.ui.components.AppSectionTitle
import kallam.healthcare.ui.components.AppTextField
import kallam.healthcare.ui.components.FieldLabel
import kallam.healthcare.ui.components.HeroSingleSelectDropdown
import kallam.healthcare.ui.components.InfoNote
import kallam.healthcare.ui.components.PrimaryGradientButton
import kallam.healthcare.ui.components.SegmentedChoice
import kallam.healthcare.ui.components.StatusBarSpacer
import kallam.healthcare.ui.components.Tone
import kallam.healthcare.ui.components.t
import kallam.healthcare.ui.components.tf
import kallam.healthcare.ui.theme.AppSpacing
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
    onBookDoctor: () -> Unit = {},
) {
    val log by guardianViewModel.symptomLog.collectAsState()
    val advice by guardianViewModel.symptomAdvice.collectAsState()
    val busy by guardianViewModel.busy.collectAsState()

    LaunchedEffect(kidId) { guardianViewModel.loadSymptoms(kidId) }

    val today = remember { LocalDate.now() }
    val fmt = remember { DateTimeFormatter.ISO_LOCAL_DATE }

    var symptom by rememberSaveable(kidId) { mutableStateOf("") }
    var severity by rememberSaveable(kidId) { mutableStateOf("MILD") }
    var daysAgo by rememberSaveable(kidId) { mutableStateOf(0) }
    var stillGoing by rememberSaveable(kidId) { mutableStateOf(true) }
    var note by rememberSaveable(kidId) { mutableStateOf("") }
    var sawDoctor by rememberSaveable(kidId) { mutableStateOf(false) }
    var missedSchool by rememberSaveable(kidId) { mutableStateOf(false) }

    Column(
        Modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.background)
    ) {
        StatusBarSpacer()
        AppScreenHeader(t(S.symptomsTitle), subtitle = tf(S.symptomsSub, kidName), onBack = onBack)
        LazyColumn(
            modifier = Modifier.fillMaxWidth(),
            contentPadding = PaddingValues(start = AppSpacing.xl, end = AppSpacing.xl, top = AppSpacing.sm, bottom = AppSpacing.xxxl),
            verticalArrangement = Arrangement.spacedBy(AppSpacing.md),
        ) {
            // The safety line sits above the form, in the server's own words.
            item {
                InfoNote(
                    log.notice.ifBlank { t(S.symptomsNoticeFallback) },
                    tone = Tone.Watch,
                    icon = Icons.Outlined.Warning,
                )
                Spacer(Modifier.height(AppSpacing.md))
                // A child who is unwell can be booked in from here, straight to
                // the hospitals we work with, without hunting for the screen.
                PrimaryGradientButton(text = t(S.bookAppt), onClick = onBookDoctor)
            }

            // Advice for a complaint that can turn serious. Shown above the form
            // after saving, because the record is kept either way.
            if (advice.isNotBlank()) {
                item {
                    AppCard(background = MaterialTheme.colorScheme.errorContainer) {
                        Row(
                            Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.Top,
                        ) {
                            Text(
                                t(S.seeADoctor),
                                style = MaterialTheme.typography.titleMedium,
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
                        Spacer(Modifier.height(AppSpacing.sm))
                        Text(
                            advice,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onErrorContainer,
                        )
                        Spacer(Modifier.height(AppSpacing.md))
                        PrimaryGradientButton(text = t(S.bookAppt), onClick = onBookDoctor)
                    }
                }
            }

            item {
                AppCard {
                    HeroSingleSelectDropdown(
                        label = t(S.whatHappened),
                        options = log.symptoms,
                        selected = symptom,
                        onSelect = { symptom = it },
                        placeholder = "Select reported symptom..."
                    )

                    Spacer(Modifier.height(AppSpacing.md))
                    FieldLabel(t(S.howBad))
                    val mild = t(S.severityMild)
                    val moderate = t(S.severityModerate)
                    SegmentedChoice(
                        options = listOf("MILD", "MODERATE"),
                        selected = severity,
                        onSelect = { severity = it },
                        label = { if (it == "MILD") mild else moderate },
                        toneOf = { if (it == "MILD") Tone.Good else Tone.Watch },
                    )

                    Spacer(Modifier.height(AppSpacing.lg))
                    val dayChoices = listOf(
                        0 to t(S.dayToday),
                        1 to t(S.dayYesterday),
                        2 to tf(S.dayNAgo, "2"),
                        3 to tf(S.dayNAgo, "3"),
                        5 to tf(S.dayNAgo, "5"),
                        7 to tf(S.dayNAgo, "7"),
                    )
                    HeroSingleSelectDropdown(
                        label = t(S.whenStarted),
                        options = dayChoices.map { it.second },
                        selected = dayChoices.firstOrNull { it.first == daysAgo }?.second ?: "",
                        onSelect = { chosen ->
                            daysAgo = dayChoices.firstOrNull { it.second == chosen }?.first ?: 0
                        },
                        placeholder = "Select start day..."
                    )

                    Spacer(Modifier.height(AppSpacing.md))
                    CheckRow(t(S.stillUnwell), stillGoing) { stillGoing = it }
                    CheckRow(t(S.missedSchool), missedSchool) { missedSchool = it }
                    CheckRow(t(S.sawADoctor), sawDoctor) { sawDoctor = it }

                    Spacer(Modifier.height(AppSpacing.md))
                    AppTextField(
                        value = note,
                        onValueChange = { note = it.take(500) },
                        modifier = Modifier.fillMaxWidth(),
                        placeholder = t(S.symptomNoteHint),
                        singleLine = false,
                        minLines = 2,
                    )

                    Spacer(Modifier.height(AppSpacing.md))
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
                    Spacer(Modifier.height(AppSpacing.sm))
                    Text(
                        t(S.symptomNotADiagnosis),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }

            if (log.events.isNotEmpty()) {
                item {
                    AppSectionTitle(
                        t(S.pastIllnesses),
                        Modifier.padding(top = AppSpacing.md),
                        subtitle = t(S.pastIllnessesSub),
                    )
                }
                items(log.events, key = { it.id }) { e ->
                    EventRow(e) { guardianViewModel.deleteSymptom(kidId, e.id) }
                }
            }
        }
    }
}

@Composable
private fun EventRow(e: SymptomEventDto, onDelete: () -> Unit) {
    AppListRow(
        title = e.symptom,
        subtitle = listOf(
            e.startedOn,
            if (e.endedOn.isBlank()) t(S.ongoingLabel) else "→ " + e.endedOn,
            if (e.severity == "MODERATE") t(S.severityModerate) else "",
        ).filter { it.isNotBlank() }.joinToString(" · "),
        supporting = e.note.ifBlank { null },
        trailing = {
            Icon(
                Icons.Outlined.Close,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(20.dp).clickable(onClick = onDelete),
            )
        },
    )
}

/** A form checkbox, not a list row: it sits inside the form card. */
@Composable
private fun CheckRow(label: String, checked: Boolean, onChange: (Boolean) -> Unit) {
    Row(
        Modifier.fillMaxWidth().clickable { onChange(!checked) },
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Checkbox(checked = checked, onCheckedChange = onChange)
        Spacer(Modifier.width(AppSpacing.xs))
        Text(label, style = MaterialTheme.typography.bodyMedium)
    }
}
