package kallam.healthcare.ui.screens

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
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import kallam.healthcare.data.ClinicianViewModel
import kallam.healthcare.data.ReviewFindingDto
import kotlinx.serialization.json.JsonPrimitive
import kallam.healthcare.ui.components.HeroCard
import kallam.healthcare.ui.components.Notice
import kallam.healthcare.ui.components.PrimaryGradientButton
import kallam.healthcare.ui.components.StatusBarSpacer
import kallam.healthcare.ui.theme.HeroBlue
import kallam.healthcare.ui.theme.HeroOrange

/** What the rules can conclude, worst last. */
private val FLAGS = listOf("GOOD", "WATCH", "ALERT")

/** How soon the guardian should act. NONE means nothing to do. */
private val URGENCIES = listOf("NONE", "ROUTINE", "SOON", "URGENT")

/**
 * One child's record, and the signature that lets it out.
 *
 * This is the step that turns measurements into something a parent may read.
 * The physician sees every finding with the flag the clinical rules gave it,
 * can move any flag, sets how soon the guardian should act, and writes the
 * sentence the guardian actually reads. Nothing here is optional on the
 * server: approving without a recommendation is refused, because approving is
 * the act of telling a family something.
 *
 * What the app does not do is decide anything. The flags come from
 * clinical.ts, the suggested urgency comes from the findings and is raised
 * when the same check was flagged at an earlier camp, and the draft
 * recommendation is written by the server so a physician edits a sentence at
 * the end of a long day rather than facing an empty box.
 */
@Composable
fun ClinicianReviewChildScreen(
    campId: String,
    kidId: String,
    clinician: ClinicianViewModel,
    onBack: () -> Unit,
) {
    val detail by clinician.review.collectAsState()
    val busy by clinician.busy.collectAsState()
    val message by clinician.message.collectAsState()
    val saved by clinician.saved.collectAsState()

    // Only what this physician changed. An untouched finding is not sent, so
    // an approval cannot quietly restate a flag nobody looked at.
    val moved = remember(kidId) { mutableStateMapOf<String, String>() }
    var urgency by remember(kidId) { mutableStateOf("") }
    var recommendation by remember(kidId) { mutableStateOf("") }
    var prefilled by remember(kidId) { mutableStateOf(false) }

    LaunchedEffect(campId, kidId) { clinician.openReview(campId, kidId) }
    LaunchedEffect(saved) { if (saved) onBack() }

    val d = detail
    // Seeded once, from the server's draft, and then left alone: re-seeding on
    // every recomposition would wipe whatever the physician is typing.
    LaunchedEffect(d?.child?.kidId) {
        if (d != null && !prefilled) {
            urgency = d.suggestedUrgency.ifBlank { "NONE" }
            recommendation = d.recommendation
            prefilled = true
        }
    }

    LazyColumn(Modifier.fillMaxSize()) {
        item {
            StatusBarSpacer()
            Row(
                Modifier.fillMaxWidth().padding(8.dp, 8.dp, 20.dp, 0.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                IconButton(onClick = { clinician.closeReview(); onBack() }) {
                    Icon(Icons.AutoMirrored.Outlined.ArrowBack, contentDescription = "Back")
                }
                Column(Modifier.weight(1f)) {
                    Text(
                        d?.child?.name ?: "…",
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold,
                    )
                    if (d != null) {
                        Text(
                            listOfNotNull(
                                d.child.grade.ifBlank { null },
                                d.child.age?.let { "$it years" },
                                d.child.guardianName.ifBlank { null },
                            ).joinToString(" · "),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }
            Spacer(Modifier.height(10.dp))
        }

        if (d == null) {
            item {
                Text(
                    if (busy) "Opening…" else message.ifBlank { "Could not open this record." },
                    Modifier.padding(20.dp),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        } else {
            item {
                if (d.status == "APPROVED") {
                    Notice(
                        "Already approved. Changing anything here replaces what was recorded, "
                            + "up until the camp is released.",
                        error = false,
                    )
                }
                if (d.recurring.isNotEmpty()) {
                    Notice(
                        d.recurring.joinToString(", ") {
                            "${it.checkType} was flagged at ${it.timesBefore} earlier " +
                                (if (it.timesBefore == 1) "camp" else "camps")
                        } + ". Urgency has been raised for that.",
                        error = false,
                    )
                }
                if (message.isNotBlank()) Notice(message, error = true)
            }

            for (f in d.findings) {
                item(key = f.checkType) {
                    FindingCard(
                        finding = f,
                        chosen = moved[f.checkType] ?: f.flag,
                        onChoose = { flag ->
                            // Choosing the flag it already had is not a change.
                            if (flag == f.flag) moved.remove(f.checkType)
                            else moved[f.checkType] = flag
                        },
                    )
                }
            }

            item {
                Spacer(Modifier.height(6.dp))
                Text(
                    "How soon should the guardian act?",
                    Modifier.padding(horizontal = 20.dp),
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold,
                )
                Spacer(Modifier.height(8.dp))
                Row(
                    Modifier.fillMaxWidth().padding(horizontal = 20.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    URGENCIES.forEach { u ->
                        ReviewChoice(
                            label = urgencyWord(u),
                            selected = urgency == u,
                            tint = urgencyColour(u),
                            modifier = Modifier.weight(1f),
                        ) { urgency = u }
                    }
                }
                if (urgency == "URGENT") {
                    Notice(
                        "Marking this urgent texts the guardian as soon as the camp is "
                            + "released, not when you press approve.",
                        error = false,
                    )
                }
            }

            item {
                Spacer(Modifier.height(14.dp))
                Text(
                    "What the guardian will read",
                    Modifier.padding(horizontal = 20.dp),
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold,
                )
                if (d.recommendationIsDraft) {
                    Text(
                        "Drafted from the findings. Edit it into your own words.",
                        Modifier.padding(horizontal = 20.dp),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                Spacer(Modifier.height(8.dp))
                OutlinedTextField(
                    value = recommendation,
                    onValueChange = { recommendation = it },
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp),
                    minLines = 3,
                    shape = RoundedCornerShape(12.dp),
                    colors = OutlinedTextFieldDefaults.colors(),
                )
            }

            item {
                Spacer(Modifier.height(14.dp))
                val onApprove: () -> Unit = {
                    clinician.approve(
                        campId = campId,
                        kidId = kidId,
                        flags = moved.toMap(),
                        urgency = urgency,
                        recommendation = recommendation,
                    )
                }
                PrimaryGradientButton(
                    text = if (busy) "Approving…" else "Approve",
                    onClick = onApprove,
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp),
                    enabled = !busy && recommendation.isNotBlank(),
                )
                Spacer(Modifier.height(8.dp))
                Text(
                    "Approving does not send anything yet. Results reach guardians when the "
                        + "whole camp is released.",
                    Modifier.padding(horizontal = 20.dp),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(Modifier.height(28.dp))
            }
        }
    }
}

@Composable
private fun FindingCard(
    finding: ReviewFindingDto,
    chosen: String,
    onChoose: (String) -> Unit,
) {
    HeroCard(Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 6.dp)) {
        Column(Modifier.padding(16.dp)) {
            Text(
                finding.checkType,
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.SemiBold,
            )
            // What was actually measured, in the clinician's own terms. Without
            // it a physician is asked to endorse a flag without seeing the
            // number behind it.
            val measured = finding.detail.entries.joinToString("  ") { (k, v) ->
                // .content, not toString(): a JSON string renders itself with
                // its quotes, so a gum reading came out as gums "bleeding".
                val shown = (v as? JsonPrimitive)?.content ?: v.toString()
                "$k $shown"
            }
            if (measured.isNotBlank()) {
                Spacer(Modifier.height(4.dp))
                Text(
                    measured,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            if (finding.rationale.isNotBlank()) {
                Spacer(Modifier.height(4.dp))
                Text(
                    finding.rationale,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            if (finding.screenerNote.isNotBlank()) {
                Spacer(Modifier.height(4.dp))
                Text(
                    "Screener: ${finding.screenerNote}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            if (finding.previous.isNotEmpty()) {
                Spacer(Modifier.height(4.dp))
                Text(
                    "Flagged before: " + finding.previous.joinToString(", ") {
                        listOf(it.flag.lowercase(), it.date).filter { p -> p.isNotBlank() }
                            .joinToString(" ")
                    },
                    style = MaterialTheme.typography.bodySmall,
                    color = HeroOrange,
                )
            }
            Spacer(Modifier.height(10.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FLAGS.forEach { flag ->
                    ReviewChoice(
                        label = flagWord(flag),
                        selected = chosen == flag,
                        tint = flagColour(flag),
                        modifier = Modifier.weight(1f),
                    ) { onChoose(flag) }
                }
            }
            if (chosen != finding.autoFlag) {
                Spacer(Modifier.height(6.dp))
                Text(
                    "The rules said ${flagWord(finding.autoFlag).lowercase()}. " +
                        "Your decision is what the guardian sees.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

/** A tappable choice. Selected state is colour and weight, not a tick nobody sees. */
@Composable
private fun ReviewChoice(
    label: String,
    selected: Boolean,
    tint: Color,
    modifier: Modifier = Modifier,
    onClick: () -> Unit,
) {
    Text(
        label,
        modifier
            .clip(RoundedCornerShape(10.dp))
            .clickable(onClick = onClick)
            .padding(vertical = 9.dp),
        style = MaterialTheme.typography.labelMedium,
        fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal,
        color = if (selected) tint else MaterialTheme.colorScheme.onSurfaceVariant,
    )
}

private fun flagWord(flag: String) = when (flag) {
    "GOOD" -> "Normal"
    "WATCH" -> "Watch"
    "ALERT" -> "Alert"
    else -> "Not measured"
}

@Composable
private fun flagColour(flag: String) = when (flag) {
    "ALERT" -> MaterialTheme.colorScheme.error
    "WATCH" -> HeroOrange
    else -> HeroBlue
}

private fun urgencyWord(u: String) = when (u) {
    "NONE" -> "Nothing"
    "ROUTINE" -> "Routine"
    "SOON" -> "Soon"
    else -> "Urgent"
}

@Composable
private fun urgencyColour(u: String) = when (u) {
    "URGENT" -> MaterialTheme.colorScheme.error
    "SOON" -> HeroOrange
    else -> HeroBlue
}
