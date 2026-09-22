package com.rork.vitahero.ui.screens

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.TaskAlt
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.rork.vitahero.data.ClinicianViewModel
import com.rork.vitahero.data.ReviewQueueItemDto
import com.rork.vitahero.ui.components.EmptyState
import com.rork.vitahero.ui.components.HeroCard
import com.rork.vitahero.ui.components.PrimaryGradientButton
import com.rork.vitahero.ui.components.Notice
import com.rork.vitahero.ui.components.StatusBarSpacer
import com.rork.vitahero.ui.theme.HeroOrange

/**
 * The physician's queue: who is screened and waiting on a signature.
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

    val waiting = queue.filter { it.status == "SCREENED" }
    val approved = queue.filter { it.status == "APPROVED" }

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
                TextButton(onClick = { clinician.clearReleased(); onBack() }) { Text("Done") }
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
                        if (waiting.isNotEmpty())
                            " ${waiting.size} still waiting on you will not be sent." else ""
                )
            },
            confirmButton = { TextButton(onClick = onConfirm) { Text("Send") } },
            dismissButton = {
                TextButton(onClick = { confirmRelease = false }) { Text("Not yet") }
            },
        )
    }

    LazyColumn(Modifier.fillMaxSize()) {
        item {
            StatusBarSpacer()
            Row(
                Modifier.fillMaxWidth().padding(8.dp, 8.dp, 20.dp, 0.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                IconButton(onClick = onBack) {
                    Icon(Icons.AutoMirrored.Outlined.ArrowBack, contentDescription = "Back")
                }
                Column(Modifier.weight(1f)) {
                    Text(
                        "Review",
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold,
                    )
                    Text(
                        campTitle,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
            }
            Spacer(Modifier.height(8.dp))
            if (message.isNotBlank()) Notice(message, error = true)
        }

        if (queue.isEmpty()) {
            item {
                EmptyState(
                    icon = Icons.Outlined.TaskAlt,
                    title = if (busy) "Loading…" else "Nothing to review",
                    subtitle =
                        if (busy) "One moment."
                        else "Children appear here once they have been screened. Nobody on "
                            + "this camp has been measured yet.",
                    modifier = Modifier.padding(20.dp),
                )
            }
        }

        if (waiting.isNotEmpty()) {
            item { SectionLabel("${waiting.size} waiting on you") }
            items(waiting, key = { it.kidId }) { child ->
                ReviewRow(child) { onOpenChild(child.kidId) }
            }
        }

        if (approved.isNotEmpty()) {
            item { SectionLabel("${approved.size} approved, not yet sent") }
            items(approved, key = { it.kidId }) { child ->
                ReviewRow(child) { onOpenChild(child.kidId) }
            }
        }

        if (approved.isNotEmpty()) {
            item {
                Spacer(Modifier.height(14.dp))
                val openRelease: () -> Unit = { confirmRelease = true }
                PrimaryGradientButton(
                    text = if (busy) "Sending…" else "Send results to guardians",
                    onClick = openRelease,
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp),
                    enabled = !busy,
                )
                Spacer(Modifier.height(8.dp))
                Text(
                    if (waiting.isEmpty())
                        "Everyone on this camp has been reviewed."
                    else
                        "${waiting.size} " +
                            (if (waiting.size == 1) "child is" else "children are") +
                            " still waiting. You can send the rest now and the others later.",
                    Modifier.padding(horizontal = 20.dp),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
        item { Spacer(Modifier.height(28.dp)) }
    }
}

@Composable
private fun SectionLabel(text: String) {
    Text(
        text,
        Modifier.padding(start = 20.dp, end = 20.dp, top = 14.dp, bottom = 2.dp),
        style = MaterialTheme.typography.labelMedium,
        fontWeight = FontWeight.SemiBold,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
    )
}

@Composable
private fun ReviewRow(child: ReviewQueueItemDto, onClick: () -> Unit) {
    HeroCard(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = 20.dp, vertical = 5.dp)
            .clickable(onClick = onClick)
    ) {
        Row(
            Modifier.padding(14.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Column(Modifier.weight(1f)) {
                Text(
                    child.name,
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    listOfNotNull(
                        child.grade.ifBlank { null },
                        child.age?.let { "$it years" },
                    ).joinToString(" · ").ifBlank { "—" },
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            // Counts, not a single worst-flag: "2 alerts" and "1 alert" are
            // different amounts of work, and the queue is sorted by them.
            if (child.alerts > 0) {
                Text(
                    "${child.alerts} alert",
                    style = MaterialTheme.typography.labelSmall,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.error,
                )
            }
            if (child.watches > 0) {
                Text(
                    "${child.watches} watch",
                    style = MaterialTheme.typography.labelSmall,
                    fontWeight = FontWeight.Bold,
                    color = HeroOrange,
                )
            }
            if (child.status == "APPROVED") {
                Spacer(Modifier.width(2.dp))
                Icon(
                    Icons.Outlined.TaskAlt,
                    contentDescription = "Approved",
                    tint = MaterialTheme.colorScheme.primary,
                )
            }
        }
    }
}
