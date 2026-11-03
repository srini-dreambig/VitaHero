package kallam.healthcare.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
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
import kallam.healthcare.data.ClinicianViewModel
import kallam.healthcare.data.OtherCheckDto
import kallam.healthcare.data.ReviewFindingDto
import kotlinx.serialization.json.JsonPrimitive
import kallam.healthcare.ui.components.AppCard
import kallam.healthcare.ui.components.AppScreenHeader
import kallam.healthcare.ui.components.AppSectionTitle
import kallam.healthcare.ui.components.AppTextField
import kallam.healthcare.ui.components.Notice
import kallam.healthcare.ui.components.PrimaryGradientButton
import kallam.healthcare.ui.components.SegmentedChoice
import kallam.healthcare.ui.components.StatusBarSpacer
import kallam.healthcare.ui.components.StatusPill
import kallam.healthcare.ui.components.Tone
import kallam.healthcare.ui.components.color
import kallam.healthcare.ui.theme.AppSpacing

/** What the rules can conclude, worst last. */
private val FLAGS = listOf("GOOD", "WATCH", "ALERT")

/** How soon the guardian should act. NONE means nothing to do. */
private val URGENCIES = listOf("NONE", "ROUTINE", "SOON", "URGENT")

/**
 * One child's record, and the signature that lets it out.
 *
 * A specialist signs off only their own checks, and sees only those results:
 * the other checks are listed by name with whether they are done and by whom.
 * What they write is their part of the guardian's message; the child is
 * approved, and the parts put together, once every check has been signed.
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

    // The view model can still hold the previous child's review (sign-off
    // returns without clearing it): never show or seed from another child's.
    val d = detail?.takeIf { it.child.kidId == kidId }
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
            AppScreenHeader(
                title = d?.child?.name ?: "…",
                subtitle = d?.let {
                    listOfNotNull(
                        it.child.grade.ifBlank { null },
                        it.child.age?.let { a -> "$a years" },
                        it.child.guardianName.ifBlank { null },
                    ).joinToString(" · ")
                },
                onBack = { clinician.closeReview(); onBack() },
            )
            Spacer(Modifier.height(AppSpacing.sm))
        }

        if (d == null) {
            item {
                Text(
                    if (busy) "Opening…" else message.ifBlank { "Could not open this record." },
                    Modifier.padding(AppSpacing.xl),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        } else {
            item {
                if (d.status == "APPROVED") {
                    Notice(
                        "Already approved. Changing anything here replaces your part of what "
                            + "was recorded, up until the camp is released.",
                        error = false,
                    )
                } else if (d.mySignedAt.isNotBlank()) {
                    Notice(
                        "You have signed off " + d.myChecks.joinToString(", ") + ". " +
                            (if (d.waitingFor.isEmpty()) ""
                            else "Waiting for " + d.waitingFor.joinToString(", ") + ". ") +
                            "Signing again replaces your note.",
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

            if (d.otherChecks.isNotEmpty()) {
                item(key = "other-checks") {
                    OtherChecksCard(d.otherChecks)
                }
            }

            item {
                Spacer(Modifier.height(AppSpacing.lg))
                AppSectionTitle(
                    "How soon should the guardian act?",
                    Modifier.padding(horizontal = AppSpacing.xl),
                )
                Spacer(Modifier.height(AppSpacing.sm))
                SegmentedChoice(
                    options = URGENCIES,
                    selected = urgency,
                    onSelect = { urgency = it },
                    label = ::urgencyWord,
                    modifier = Modifier.padding(horizontal = AppSpacing.xl),
                    toneOf = ::urgencyTone,
                )
                if (urgency == "URGENT") {
                    Spacer(Modifier.height(AppSpacing.xs))
                    Notice(
                        "Marking this urgent texts the guardian as soon as you sign off, "
                            + "without waiting for the camp to be released.",
                        error = false,
                    )
                }
            }

            item {
                Spacer(Modifier.height(AppSpacing.xxl))
                AppSectionTitle(
                    if (d.otherChecks.isEmpty()) "What the guardian will read"
                    else "Your part of what the guardian will read",
                    Modifier.padding(horizontal = AppSpacing.xl),
                    subtitle = if (d.recommendationIsDraft)
                        "Drafted from the findings. Edit it into your own words." else null,
                )
                Spacer(Modifier.height(AppSpacing.sm))
                AppTextField(
                    value = recommendation,
                    onValueChange = { recommendation = it },
                    modifier = Modifier.fillMaxWidth().padding(horizontal = AppSpacing.xl),
                    singleLine = false,
                    minLines = 3,
                )
            }

            item {
                Spacer(Modifier.height(AppSpacing.lg))
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
                    text = when {
                        busy -> "Signing…"
                        d.otherChecks.isEmpty() -> "Approve"
                        else -> "Sign off " + d.myChecks.joinToString(", ")
                    },
                    onClick = onApprove,
                    modifier = Modifier.fillMaxWidth().padding(horizontal = AppSpacing.xl),
                    enabled = !busy && recommendation.isNotBlank(),
                )
                Spacer(Modifier.height(AppSpacing.sm))
                Text(
                    (if (d.otherChecks.isEmpty()) ""
                    else "The child is approved once every specialist has signed their part. ") +
                        "Nothing is sent yet: results reach guardians when the camp is released.",
                    Modifier.padding(horizontal = AppSpacing.xl),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(Modifier.height(AppSpacing.xxxl))
            }
        }
    }
}

private fun formatDetailKey(key: String): String = when (key) {
    "heightCm" -> "height"
    "weightKg" -> "weight"
    "leftAcuity" -> "left eye"
    "rightAcuity" -> "right eye"
    "leftHearing" -> "left ear"
    "rightHearing" -> "right ear"
    "cariesCount" -> "caries"
    "missingCount" -> "missing"
    "filledCount" -> "filled"
    "stainsTartar" -> "stains/tartar"
    "skinCondition" -> "condition"
    "skinLocation" -> "location"
    "gaitLimb" -> "gait/limb"
    "jointPain" -> "joint pain"
    "restrictedMotion" -> "restricted motion"
    "vaccineStatus" -> "vaccine status"
    "missedVaccines" -> "missed vaccines"
    "entTreatment", "skinTreatment", "spineTreatment", "vaccineTreatment", "hbTreatment", "treatmentNeeded", "treatmentsRecommended" -> "rec"
    else -> key.replace(Regex("([a-z])([A-Z])"), "$1 $2").lowercase()
}

@Composable
private fun FindingCard(
    finding: ReviewFindingDto,
    chosen: String,
    onChoose: (String) -> Unit,
) {
    AppCard(Modifier.padding(horizontal = AppSpacing.xl, vertical = AppSpacing.xs + AppSpacing.xxs)) {
        Text(
            finding.checkType,
            style = MaterialTheme.typography.titleMedium,
            color = MaterialTheme.colorScheme.onSurface,
        )
        // What was actually measured, in the clinician's own terms. Without
        // it a physician is asked to endorse a flag without seeing the
        // number behind it.
        val measured = finding.detail.entries
            .filter { (k, _) -> k != "__note" }
            .joinToString(" · ") { (k, v) ->
                val shown = (v as? JsonPrimitive)?.content ?: v.toString()
                "${formatDetailKey(k)}: $shown"
            }
        if (measured.isNotBlank()) {
            Spacer(Modifier.height(AppSpacing.xs))
            Text(
                measured,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        if (finding.rationale.isNotBlank()) {
            Spacer(Modifier.height(AppSpacing.xs))
            Text(
                finding.rationale,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        if (finding.screenerNote.isNotBlank()) {
            Spacer(Modifier.height(AppSpacing.xs))
            Text(
                "Screener: ${finding.screenerNote}",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        if (finding.previous.isNotEmpty()) {
            Spacer(Modifier.height(AppSpacing.xs))
            Text(
                "Flagged before: " + finding.previous.joinToString(", ") {
                    listOf(it.flag.lowercase(), it.date).filter { p -> p.isNotBlank() }
                        .joinToString(" ")
                },
                style = MaterialTheme.typography.bodySmall,
                color = Tone.Watch.color(),
            )
        }
        Spacer(Modifier.height(AppSpacing.md))
        SegmentedChoice(
            options = FLAGS,
            selected = chosen,
            onSelect = onChoose,
            label = ::flagWord,
            toneOf = ::flagTone,
        )
        if (chosen != finding.autoFlag) {
            Spacer(Modifier.height(AppSpacing.sm))
            Text(
                "The rules said ${flagWord(finding.autoFlag).lowercase()}. " +
                    "Your decision is what the guardian sees.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

/** The checks other specialists sign: done or not, and by whom. Never their results. */
@Composable
private fun OtherChecksCard(checks: List<OtherCheckDto>) {
    AppCard(Modifier.padding(horizontal = AppSpacing.xl, vertical = AppSpacing.xs + AppSpacing.xxs)) {
        Text(
            "Other specialists",
            style = MaterialTheme.typography.titleMedium,
            color = MaterialTheme.colorScheme.onSurface,
        )
        Spacer(Modifier.height(AppSpacing.sm))
        checks.forEach { c ->
            Row(
                Modifier.fillMaxWidth().padding(vertical = AppSpacing.xs),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(AppSpacing.sm),
            ) {
                Text(
                    c.checkType,
                    Modifier.weight(1f),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurface,
                )
                // Capped at half the row, so a long "Signed by …" ellipsises
                // in its pill instead of squeezing the check's name.
                StatusPill(
                    when {
                        c.signedBy.isNotBlank() -> "Signed by ${c.signedBy}"
                        c.recorded -> "Recorded, not signed"
                        else -> "Not recorded yet"
                    },
                    when {
                        c.signedBy.isNotBlank() -> Tone.Info
                        c.recorded -> Tone.Watch
                        else -> Tone.Neutral
                    },
                    Modifier.weight(1f, fill = false),
                )
            }
        }
    }
}

private fun flagWord(flag: String) = when (flag) {
    "GOOD" -> "Normal"
    "WATCH" -> "Watch"
    "ALERT" -> "Alert"
    else -> "Not measured"
}

private fun flagTone(flag: String) = when (flag) {
    "ALERT" -> Tone.Alert
    "WATCH" -> Tone.Watch
    else -> Tone.Good
}

private fun urgencyWord(u: String) = when (u) {
    "NONE" -> "Nothing"
    "ROUTINE" -> "Routine"
    "SOON" -> "Soon"
    else -> "Urgent"
}

private fun urgencyTone(u: String) = when (u) {
    "URGENT" -> Tone.Alert
    "SOON" -> Tone.Watch
    "ROUTINE" -> Tone.Info
    else -> Tone.Neutral
}
