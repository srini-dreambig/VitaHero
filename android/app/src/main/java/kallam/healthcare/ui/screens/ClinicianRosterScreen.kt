package kallam.healthcare.ui.screens

import androidx.compose.material.icons.outlined.Search
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.FactCheck
import androidx.compose.material.icons.outlined.Groups
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import kallam.healthcare.data.CampChildDto
import kallam.healthcare.data.ClinicianViewModel
import kallam.healthcare.data.classTitle
import kallam.healthcare.ui.components.AppListRow
import kallam.healthcare.ui.components.AppScreenHeader
import kallam.healthcare.ui.components.AppTextField
import kallam.healthcare.ui.components.EmptyState
import kallam.healthcare.ui.components.IconBubble
import kallam.healthcare.ui.components.KidAvatar
import kallam.healthcare.ui.components.SelectChip
import kallam.healthcare.ui.components.StatusBarSpacer
import kallam.healthcare.ui.components.StatusPill
import kallam.healthcare.ui.components.Tone
import kallam.healthcare.ui.theme.AppSpacing

/**
 * One camp's children, as a clinician works through them.
 *
 * Searchable by name and by roll number, because a camp is not a queue: a
 * child is sent back from the next table, or arrives late, and the person
 * holding the phone needs to find them among four hundred without scrolling.
 *
 * The status on each row is the point of the screen — it is how a clinician
 * knows who is still to be seen. It is this clinician's own: once the dentist
 * has been, the child is still To do for the eye doctor.
 *
 * Filtered by class and by status, because a doctor works a camp one class at
 * a time and wants the list to shrink as they go.
 */
@Composable
fun ClinicianRosterScreen(
    campTitle: String,
    campId: String,
    clinician: ClinicianViewModel,
    onOpenChild: (kidId: String) -> Unit,
    onOpenReview: () -> Unit,
    onBack: () -> Unit,
) {
    val roster by clinician.roster.collectAsState()
    val busy by clinician.busy.collectAsState()
    val can by clinician.can.collectAsState()
    val message by clinician.message.collectAsState()
    var query by rememberSaveable { mutableStateOf("") }
    var classFilter by rememberSaveable { mutableStateOf("") }
    var stateFilter by rememberSaveable { mutableStateOf("") }

    LaunchedEffect(campId) { clinician.loadRoster(campId) }

    val q = query.trim().lowercase()
    // Children with none of this clinician's checks are not theirs to see.
    val mine = roster.filter { it.state != "NOT_MINE" }
    val classes = mine.map { it.classLabel }.filter { it.isNotBlank() }.distinct()
    val shown = mine.filter {
        (q.isEmpty() || it.name.lowercase().contains(q) || it.studentRef.lowercase().contains(q)) &&
            (classFilter.isEmpty() || it.classLabel == classFilter) &&
            (stateFilter.isEmpty() || it.state == stateFilter)
    }
    val doneByMe = mine.count { it.state == "DONE" }
    // Anybody's save puts a child in the physician's queue, so the review card
    // still counts on the child's own status.
    val screened = roster.count { it.status != "NOT_SCREENED" && it.status != "ABSENT" }

    // The header and the chip rows run edge to edge (the header pads itself,
    // the chips scroll under the margin), so the 20dp margin is on each item
    // rather than on the list's contentPadding.
    LazyColumn(Modifier.fillMaxSize()) {
        item {
            StatusBarSpacer()
            AppScreenHeader(
                title = campTitle,
                subtitle = "$doneByMe of ${mine.size} done by you",
                onBack = onBack,
            )
            Spacer(Modifier.height(AppSpacing.sm))
            AppTextField(
                value = query,
                onValueChange = { query = it },
                modifier = Modifier.fillMaxWidth().padding(horizontal = AppSpacing.xl),
                placeholder = "Search name or roll number",
                leadingIcon = Icons.Outlined.Search,
            )
            Spacer(Modifier.height(AppSpacing.md))
            val states = listOf(
                "" to "All", "TODO" to "To do", "DONE" to "Done",
                "ABSENT" to "Absent", "NO_CONSENT" to "No consent",
            )
            LazyRow(
                contentPadding = PaddingValues(horizontal = AppSpacing.xl),
                horizontalArrangement = Arrangement.spacedBy(AppSpacing.sm),
            ) {
                items(states, key = { "s" + it.first }) { (value, label) ->
                    val count = if (value.isEmpty()) mine.size else mine.count { it.state == value }
                    SelectChip(label, stateFilter == value, onClick = { stateFilter = value }, count = count)
                }
            }
            if (classes.size > 1) {
                Spacer(Modifier.height(AppSpacing.sm))
                LazyRow(
                    contentPadding = PaddingValues(horizontal = AppSpacing.xl),
                    horizontalArrangement = Arrangement.spacedBy(AppSpacing.sm),
                ) {
                    item(key = "c-all") {
                        SelectChip("All classes", classFilter.isEmpty(), onClick = { classFilter = "" })
                    }
                    items(classes, key = { "c$it" }) { c ->
                        SelectChip(classTitle(c), classFilter == c, onClick = {
                            classFilter = if (classFilter == c) "" else c
                        })
                    }
                }
            }
            Spacer(Modifier.height(AppSpacing.lg))
            // Only a physician sees this, and only once there is something to
            // sign off. The server decides both: `can.review` comes back with
            // the roster, and it refuses the queue to anyone else regardless
            // of what this build chooses to draw.
            if (can.review && screened > 0) {
                AppListRow(
                    title = "Review and send results",
                    supporting = "$screened screened. Nothing reaches a guardian until you "
                        + "sign it off.",
                    modifier = Modifier.padding(horizontal = AppSpacing.xl),
                    leading = { IconBubble(Icons.Outlined.FactCheck, MaterialTheme.colorScheme.secondary) },
                    showChevron = true,
                    onClick = onOpenReview,
                )
                Spacer(Modifier.height(AppSpacing.md))
            }
        }

        if (shown.isEmpty()) {
            item {
                EmptyState(
                    icon = Icons.Outlined.Groups,
                    title = when {
                        busy -> "Loading the list…"
                        roster.isEmpty() && message.isNotBlank() -> "Could not load the list"
                        roster.isEmpty() -> "No children on this camp yet"
                        mine.isEmpty() -> "None of your checks on this camp"
                        else -> "No match"
                    },
                    subtitle = when {
                        busy -> "One moment."
                        roster.isEmpty() && message.isNotBlank() -> message
                        roster.isEmpty() ->
                            "An administrator builds the camp's list from the school's roster."
                        mine.isEmpty() ->
                            "No child here is consented for the checks your specialty records."
                        q.isNotEmpty() -> "Nobody on this camp matches \"$query\"."
                        else -> "Nobody matches these filters."
                    },
                    modifier = Modifier.padding(AppSpacing.xl),
                )
            }
        } else {
            items(shown, key = { it.kidId }) { child ->
                ChildRow(child) { onOpenChild(child.kidId) }
            }
        }
        item { Spacer(Modifier.height(AppSpacing.xxl)) }
    }
}

@Composable
private fun ChildRow(child: CampChildDto, onClick: () -> Unit) {
    // Consent first: without it nothing may be recorded at all, so a clinician
    // must see that before they sit the child down.
    val consented = child.consentStatus == "GRANTED" || child.consentStatus == "PAPER"
    val done = child.state == "DONE"
    AppListRow(
        title = child.name,
        subtitle = listOf(
            listOf(child.grade, child.section).filter { it.isNotBlank() }.joinToString(" "),
            child.studentRef,
        ).filter { it.isNotBlank() }.joinToString(" · "),
        // What is left of this clinician's own share, when they have more than
        // one check to do. It is a supporting line, not part of the trailing
        // column: in the trailing column it used to squeeze the child's name
        // to "Aarav…" or to nothing.
        supporting = if (consented && !done && child.myOutstanding.isNotEmpty() && child.myChecks.size > 1)
            child.myOutstanding.joinToString(", ") else null,
        supportingTone = Tone.Watch,
        modifier = Modifier.padding(horizontal = AppSpacing.xl, vertical = AppSpacing.xs + AppSpacing.xxs),
        leading = {
            // The same derivation ProfileViewModel uses, so a child keeps one
            // colour wherever they appear. KidAvatar requires it; there is no
            // default.
            KidAvatar(
                name = child.name,
                colorValue = (child.name.hashCode() and 0xFFFFFF).toLong() or 0xFF000000,
                size = 40.dp,
            )
        },
        trailing = {
            Column(
                horizontalAlignment = Alignment.End,
                verticalArrangement = Arrangement.spacedBy(AppSpacing.xs),
            ) {
                if (!consented) {
                    StatusPill(if (child.consentStatus == "DECLINED") "Declined" else "No consent", Tone.Alert)
                } else {
                    StatusPill(if (done) "Done" else "To do", if (done) Tone.Good else Tone.Brand)
                }
                if (child.attendance == "ABSENT") {
                    StatusPill("Absent", Tone.Neutral)
                }
            }
        },
        onClick = onClick,
    )
}
