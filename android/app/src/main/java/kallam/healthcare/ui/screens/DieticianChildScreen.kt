package kallam.healthcare.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
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
import kallam.healthcare.data.DietTargetDto
import kallam.healthcare.data.DieticianFindingDto
import kallam.healthcare.data.DieticianViewModel
import kallam.healthcare.ui.components.AppCard
import kallam.healthcare.ui.components.AppScreenHeader
import kallam.healthcare.ui.components.AppSectionTitle
import kallam.healthcare.ui.components.AppTextField
import kallam.healthcare.ui.components.Notice
import kallam.healthcare.ui.components.PrimaryGradientButton
import kallam.healthcare.ui.components.SelectChip
import kallam.healthcare.ui.components.StatusBarSpacer
import kallam.healthcare.ui.components.Tone
import kallam.healthcare.ui.components.color
import kallam.healthcare.ui.theme.AppSpacing

/**
 * One child, and the plan they are given.
 *
 * What is on this screen is everything the server was willing to send: growth
 * and haemoglobin from released camps, and the plans written so far. The dental and eye findings are not
 * hidden here — they never left the server, so there is nothing on this device
 * to hide.
 *
 * The plan form opens pre-filled from the server's draft. A dietician at the
 * end of a long day corrects a sentence rather than facing an empty box, and
 * the draft names the finding rather than giving the advice, because the
 * advice is the part only they can give.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun DieticianChildScreen(
    kidId: String,
    dietician: DieticianViewModel,
    onBack: () -> Unit,
) {
    val record by dietician.record.collectAsState()
    val busy by dietician.busy.collectAsState()
    val message by dietician.message.collectAsState()
    val saved by dietician.saved.collectAsState()

    LaunchedEffect(kidId) { dietician.openChild(kidId) }

    val current = record?.plans?.firstOrNull { it.status == "ACTIVE" }
    val draft = record?.draft

    var writing by remember(kidId) { mutableStateOf(false) }
    var title by remember(kidId, draft) { mutableStateOf(draft?.title ?: "") }
    var focus by remember(kidId, draft) { mutableStateOf(draft?.focus ?: "GENERAL") }
    var guidance by remember(kidId, draft) { mutableStateOf(draft?.guidance ?: "") }
    var targetLabel by remember(kidId) { mutableStateOf("") }
    var targetValue by remember(kidId) { mutableStateOf("") }

    LaunchedEffect(saved) {
        if (saved) {
            writing = false
            dietician.clearSaved()
        }
    }

    Column(Modifier.fillMaxSize()) {
        StatusBarSpacer()
        AppScreenHeader(
            record?.child?.name ?: "…",
            subtitle = listOfNotNull(
                record?.child?.let {
                    listOf(it.grade, it.section).filter { p -> p.isNotBlank() }
                        .joinToString(" ")
                },
                record?.child?.age?.let { "$it yrs" },
                record?.child?.schoolName,
            ).filter { it.isNotBlank() }.joinToString(" · "),
            onBack = {
                dietician.closeChild()
                onBack()
            },
        )
        if (message.isNotBlank()) Notice(message, error = true)

        LazyColumn(
            Modifier.fillMaxSize(),
            contentPadding = PaddingValues(
                start = AppSpacing.xl,
                end = AppSpacing.xl,
                top = AppSpacing.sm,
                bottom = AppSpacing.xxxl,
            ),
            verticalArrangement = Arrangement.spacedBy(AppSpacing.md),
        ) {
            if (record == null) {
                item {
                    Text(
                        if (busy) "Loading…" else "Nothing to show.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            } else {
                val r = record!!

                // ── what the camps found ──
                item {
                    AppSectionTitle("What the camps found")
                    if (r.findings.isEmpty()) {
                        Spacer(Modifier.height(AppSpacing.sm))
                        Text(
                            "Nobody has measured this child yet. Once a camp records height and "
                                + "weight, the child's growth shows here.",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
                items(r.findings.size) { i -> FindingRow(r.findings[i]) }

                // ── the plan ──
                item {
                    AppSectionTitle("The plan", Modifier.padding(top = AppSpacing.md))
                    if (current == null && !writing) {
                        Spacer(Modifier.height(AppSpacing.md))
                        AppCard {
                            Text("No plan yet", style = MaterialTheme.typography.titleMedium)
                            Spacer(Modifier.height(AppSpacing.xs))
                            Text(
                                "What you write here is what the family reads in the app.",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                            Spacer(Modifier.height(AppSpacing.md))
                            PrimaryGradientButton(
                                text = "Write a plan",
                                onClick = { writing = true },
                                modifier = Modifier.fillMaxWidth(),
                                enabled = !busy,
                            )
                        }
                    } else if (current != null && !writing) {
                        Spacer(Modifier.height(AppSpacing.md))
                        AppCard {
                            Text(
                                current.title.ifBlank { "Plan" },
                                style = MaterialTheme.typography.titleMedium,
                            )
                            Text(
                                listOf(focusLabel(current.focus), current.authorName, current.startsOn)
                                    .filter { it.isNotBlank() }.joinToString(" · "),
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                            Spacer(Modifier.height(AppSpacing.sm))
                            Text(current.guidance, style = MaterialTheme.typography.bodyMedium)
                            current.targets.forEach { t ->
                                Spacer(Modifier.height(AppSpacing.sm))
                                Row {
                                    Text(
                                        t.label,
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                        modifier = Modifier.weight(1f),
                                    )
                                    // The amount is what the family acts on, so it stays bold.
                                    Text(
                                        t.value,
                                        style = MaterialTheme.typography.bodySmall,
                                        fontWeight = FontWeight.SemiBold,
                                    )
                                }
                            }
                            Spacer(Modifier.height(AppSpacing.md))
                            PrimaryGradientButton(
                                text = "Replace this plan",
                                onClick = {
                                    title = current.title
                                    focus = current.focus
                                    guidance = current.guidance
                                    writing = true
                                },
                                modifier = Modifier.fillMaxWidth(),
                                enabled = !busy,
                            )
                            Spacer(Modifier.height(AppSpacing.sm))
                            Text(
                                "The plan before it is kept, so the family can see what changed.",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                }

                if (writing) {
                    item {
                        AppCard {
                            AppTextField(
                                value = title,
                                onValueChange = { title = it },
                                label = "Title",
                                modifier = Modifier.fillMaxWidth(),
                            )
                            Spacer(Modifier.height(AppSpacing.md))
                            Text(
                                "What this plan is for",
                                style = MaterialTheme.typography.labelMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                            Spacer(Modifier.height(AppSpacing.xs))
                            FlowRow(
                                horizontalArrangement = Arrangement.spacedBy(AppSpacing.sm),
                                verticalArrangement = Arrangement.spacedBy(AppSpacing.sm),
                            ) {
                                FOCUS.forEach { f ->
                                    SelectChip(focusLabel(f), focus == f, onClick = { focus = f })
                                }
                            }
                            Spacer(Modifier.height(AppSpacing.md))
                            AppTextField(
                                value = guidance,
                                onValueChange = { guidance = it },
                                label = "What the family should do",
                                singleLine = false,
                                minLines = 4,
                                modifier = Modifier.fillMaxWidth(),
                            )
                            Spacer(Modifier.height(AppSpacing.lg))
                            Text(
                                "One thing to aim for (optional)",
                                style = MaterialTheme.typography.titleMedium,
                            )
                            Spacer(Modifier.height(AppSpacing.sm))
                            Row(
                                verticalAlignment = Alignment.Bottom,
                                horizontalArrangement = Arrangement.spacedBy(AppSpacing.sm),
                            ) {
                                AppTextField(
                                    value = targetLabel,
                                    onValueChange = { targetLabel = it },
                                    label = "Such as",
                                    modifier = Modifier.weight(1f),
                                )
                                AppTextField(
                                    value = targetValue,
                                    onValueChange = { targetValue = it },
                                    label = "How much",
                                    modifier = Modifier.weight(1f),
                                )
                            }
                            Spacer(Modifier.height(AppSpacing.lg))
                            PrimaryGradientButton(
                                text = if (busy) "Saving…" else "Send this plan to the family",
                                onClick = {
                                    dietician.savePlan(
                                        kidId = kidId,
                                        title = title,
                                        focus = focus,
                                        startsOn = "",
                                        guidance = guidance,
                                        targets = if (targetLabel.isBlank()) emptyList()
                                        else listOf(DietTargetDto(targetLabel, targetValue)),
                                    )
                                },
                                modifier = Modifier.fillMaxWidth(),
                                enabled = !busy && guidance.trim().length >= 10,
                            )
                            Spacer(Modifier.height(AppSpacing.sm))
                            Text(
                                "A plan needs a sentence the family can act on.",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                }

                // ── what came before ──
                val past = r.plans.filter { it.status != "ACTIVE" }
                if (past.isNotEmpty()) {
                    item {
                        AppSectionTitle("Plans before this one", Modifier.padding(top = AppSpacing.md))
                    }
                    items(past.size) { i ->
                        val p = past[i]
                        AppCard {
                            Text(
                                p.title.ifBlank { "Plan" },
                                style = MaterialTheme.typography.titleMedium,
                            )
                            Text(
                                listOf(focusLabel(p.focus), p.authorName)
                                    .filter { it.isNotBlank() }.joinToString(" · "),
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                            Spacer(Modifier.height(AppSpacing.xs))
                            Text(
                                p.guidance,
                                style = MaterialTheme.typography.bodySmall,
                                maxLines = 3,
                                overflow = TextOverflow.Ellipsis,
                            )
                        }
                    }
                }
            }
        }
    }
}

private val FOCUS = listOf("GENERAL", "WEIGHT_GAIN", "WEIGHT_CONTROL", "ANAEMIA")

private fun focusLabel(v: String): String = when (v) {
    "WEIGHT_GAIN" -> "Growth"
    "WEIGHT_CONTROL" -> "Weight"
    "ANAEMIA" -> "Iron"
    "GENERAL" -> "Everyday"
    else -> v
}

@Composable
private fun FindingRow(f: DieticianFindingDto) {
    val tone = when (f.flag) {
        "ALERT" -> Tone.Alert
        "WATCH" -> Tone.Watch
        else -> Tone.Good
    }
    val colour = tone.color()
    // Not AppListRow: the rationale can run to a few lines and must not be cut
    // to one, so this keeps its own column inside the kit card.
    AppCard {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                Modifier
                    .width(AppSpacing.xs)
                    .height(36.dp)
                    .clip(RoundedCornerShape(AppSpacing.xxs))
                    .background(colour),
            )
            Spacer(Modifier.width(AppSpacing.md))
            Column(Modifier.weight(1f)) {
                Text(f.checkType, style = MaterialTheme.typography.titleMedium)
                Text(
                    listOf(f.valueText, f.rationale).filter { it.isNotBlank() }.first(),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                if (f.date.isNotBlank()) {
                    Text(
                        listOf(f.campTitle, f.date).filter { it.isNotBlank() }.joinToString(" · "),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
    }
}
