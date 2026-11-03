package kallam.healthcare.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.TaskAlt
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
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
import kallam.healthcare.data.ClinicianViewModel
import kallam.healthcare.data.ReviewQueueItemDto
import kallam.healthcare.ui.components.AppListRow
import kallam.healthcare.ui.components.AppScreenHeader
import kallam.healthcare.ui.components.AppSectionTitle
import kallam.healthcare.ui.components.AppTextButton
import kallam.healthcare.ui.components.EmptyState
import kallam.healthcare.ui.components.PrimaryGradientButton
import kallam.healthcare.ui.components.Notice
import kallam.healthcare.ui.components.StatusBarSpacer
import kallam.healthcare.ui.components.StatusPill
import kallam.healthcare.ui.components.Tone
import kallam.healthcare.ui.theme.AppSpacing

/**
 * The physician's queue: who is screened and waiting on a signature.
 *
 * Each specialist signs off only their own checks; a child is approved once
 * every check the guardian agreed to has been signed by somebody. So the
 * dentist's list holds only children with a dental check, and a child they
 * have signed waits under "signed by you" until the eye doctor signs too.
 *
 * A camp does not end when the last child is measured. Every finding sits at
 * SCREENED until a physician approves it, and no guardian sees anything until
 * the camp is released. Both steps lived only in the web console, so the
 * physician who took the readings — in the hall, on the phone they took them
 * on — had to find a laptop before any of it reached a parent.
 *
 * The server decides who may be here: assertCampAccess grants canReview only
 * to a PHYSICIAN on this camp's staff, and refuses the queue to anyone else.
 * The app asks; it does not judge.
 */
@Composable
fun ClinicianReviewScreen(
    campId: String,
    campTitle: String,
    clinician: ClinicianViewModel,
    onOpenChild: (kidId: String) -> Unit,
    onBack: () -> Unit,
) {
    val queue by clinician.queue.collectAsState()
    val busy by clinician.busy.collectAsState()
    val message by clinician.message.collectAsState()
    val released by clinician.released.collectAsState()

    var confirmRelease by remember(campId) { mutableStateOf(false) }

    LaunchedEffect(campId) { clinician.loadQueue(campId) }

    val waiting = queue.filter { it.state == "TO_SIGN" }
    val incomplete = queue.filter { it.state == "NOT_READY" }
    val signed = queue.filter { it.state == "SIGNED" }
    val approved = queue.filter { it.state == "APPROVED" }
    // Checks no physician on this camp can sign: those children would wait for
    // ever, so it is said once, at the top, for whoever can fix the staffing.
    val unsignable = queue.flatMap { it.noSigner }.distinct()

    val done = released
    if (done != null) {
        AlertDialog(
            onDismissRequest = { clinician.clearReleased() },
            title = { Text("Results sent") },
            text = {
                Text(
                    listOfNotNull(
                        "${done.released} " +
                            (if (done.released == 1) "child's" else "children's") +
                            " results are now with their guardians.",
                        if (done.referralsOpened > 0)
                            "${done.referralsOpened} referrals opened." else null,
                        if (done.urgentNotified > 0)
                            "${done.urgentNotified} urgent guardians texted." else null,
                    ).joinToString(" ")
                )
            },
            confirmButton = {
                AppTextButton("Done", onClick = { clinician.clearReleased(); onBack() })
            },
        )
    }

    if (confirmRelease) {
        val onConfirm: () -> Unit = {
            confirmRelease = false
            clinician.release(campId)
        }
        AlertDialog(
            onDismissRequest = { confirmRelease = false },
            title = { Text("Send results to guardians?") },
            text = {
                Text(
                    "${approved.size} approved " +
                        (if (approved.size == 1) "child" else "children") +
                        " will be released. Guardians can read the findings immediately, and " +
                        "anyone marked urgent is texted straight away. This cannot be undone." +
                        if (waiting.size + incomplete.size + signed.size > 0)
                            " ${waiting.size + incomplete.size + signed.size} not yet approved " +
                                "will not be sent." else ""
                )
            },
            confirmButton = { AppTextButton("Send", onClick = onConfirm) },
            dismissButton = {
                AppTextButton("Not yet", onClick = { confirmRelease = false })
            },
        )
    }

    LazyColumn(Modifier.fillMaxSize()) {
        item {
            StatusBarSpacer()
            AppScreenHeader(title = "Review", subtitle = campTitle, onBack = onBack)
            Spacer(Modifier.height(AppSpacing.sm))
            if (message.isNotBlank()) Notice(message, error = true)
            if (unsignable.isNotEmpty()) {
                Notice(
                    "No physician on this camp can sign off " + unsignable.joinToString(", ") +
                        ". Children with those checks cannot be approved until the school " +
                        "adds a doctor who can, or a general physician.",
                    error = true,
                )
            }
        }

        // Under a load failure, "Nothing to review" would be a false all-clear.
        if (queue.isEmpty() && message.isBlank()) {
            item {
                EmptyState(
                    icon = Icons.Outlined.TaskAlt,
                    title = if (busy) "Loading…" else "Nothing to review",
                    subtitle =
                        if (busy) "One moment."
                        // An empty queue means either nobody is screened yet or every
                        // result has already been sent; the server drops RELEASED rows.
                        else "Children appear here once they have been screened, and leave "
                            + "once their results are sent to guardians.",
                    modifier = Modifier.padding(AppSpacing.xl),
                )
            }
        }

        if (waiting.isNotEmpty()) {
            item { QueueSectionTitle("${waiting.size} waiting on you") }
            items(waiting, key = { it.kidId }) { child ->
                ReviewRow(child) { onOpenChild(child.kidId) }
            }
        }

        if (incomplete.isNotEmpty()) {
            item { QueueSectionTitle("${incomplete.size} still being screened") }
            items(incomplete, key = { it.kidId }) { child ->
                ReviewRow(child) { onOpenChild(child.kidId) }
            }
        }

        if (signed.isNotEmpty()) {
            item { QueueSectionTitle("${signed.size} signed by you, waiting for others") }
            items(signed, key = { it.kidId }) { child ->
                ReviewRow(child) { onOpenChild(child.kidId) }
            }
        }

        if (approved.isNotEmpty()) {
            item { QueueSectionTitle("${approved.size} approved, not yet sent") }
            items(approved, key = { it.kidId }) { child ->
                ReviewRow(child) { onOpenChild(child.kidId) }
            }
        }

        if (approved.isNotEmpty()) {
            item {
                Spacer(Modifier.height(AppSpacing.lg))
                val openRelease: () -> Unit = { confirmRelease = true }
                PrimaryGradientButton(
                    text = if (busy) "Sending…" else "Send results to guardians",
                    onClick = openRelease,
                    modifier = Modifier.fillMaxWidth().padding(horizontal = AppSpacing.xl),
                    enabled = !busy,
                )
                Spacer(Modifier.height(AppSpacing.sm))
                val left = waiting.size + incomplete.size + signed.size
                Text(
                    if (left == 0)
                        "Everyone on this camp has been reviewed."
                    else
                        "$left " +
                            (if (left == 1) "child is" else "children are") +
                            " still waiting. You can send the rest now and the others later.",
                    Modifier.padding(horizontal = AppSpacing.xl),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
        item { Spacer(Modifier.height(AppSpacing.xxxl)) }
    }
}

/** A queue section's title, on the screen margin with a section's space above. */
@Composable
private fun QueueSectionTitle(text: String) {
    AppSectionTitle(
        text,
        Modifier.padding(start = AppSpacing.xl, end = AppSpacing.xl, top = AppSpacing.lg, bottom = AppSpacing.xs),
    )
}

@Composable
private fun ReviewRow(child: ReviewQueueItemDto, onClick: () -> Unit) {
    AppListRow(
        title = child.name,
        subtitle = listOfNotNull(
            child.grade.ifBlank { null },
            child.age?.let { "$it years" },
        ).joinToString(" · ").ifBlank { "—" },
        // What the child still waits on is a supporting line, never the
        // trailing column, so it cannot squeeze the name.
        supporting = if (child.state != "APPROVED" && child.waitingFor.isNotEmpty())
            "Waiting for: " + child.waitingFor.joinToString(", ") else null,
        supportingTone = Tone.Watch,
        modifier = Modifier.padding(horizontal = AppSpacing.xl, vertical = AppSpacing.xs + AppSpacing.xxs),
        trailing = if (child.alerts > 0 || child.watches > 0 || child.status == "APPROVED") {
            {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(AppSpacing.xs),
                ) {
                    // Counts, not a single worst-flag: "2 alerts" and "1 alert"
                    // are different amounts of work, and the queue is sorted by
                    // them.
                    if (child.alerts > 0) StatusPill("${child.alerts} alert", Tone.Alert)
                    if (child.watches > 0) StatusPill("${child.watches} watch", Tone.Watch)
                    if (child.status == "APPROVED") {
                        Icon(
                            Icons.Outlined.TaskAlt,
                            contentDescription = "Approved",
                            tint = MaterialTheme.colorScheme.primary,
                        )
                    }
                }
            }
        } else null,
        onClick = onClick,
    )
}
