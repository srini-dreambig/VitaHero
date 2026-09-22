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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.FactCheck
import androidx.compose.material.icons.outlined.Groups
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.rork.vitahero.data.CampChildDto
import com.rork.vitahero.data.ClinicianViewModel
import com.rork.vitahero.ui.components.EmptyState
import com.rork.vitahero.ui.components.HeroCard
import com.rork.vitahero.ui.components.IconBubble
import com.rork.vitahero.ui.components.KidAvatar
import com.rork.vitahero.ui.components.StatusBarSpacer
import com.rork.vitahero.ui.theme.HeroBlue
import com.rork.vitahero.ui.theme.HeroOrange

/**
 * One camp's children, as a clinician works through them.
 *
 * Searchable by name and by roll number, because a camp is not a queue: a
 * child is sent back from the next table, or arrives late, and the person
 * holding the phone needs to find them among four hundred without scrolling.
 *
 * The status on each row is the point of the screen — it is how a clinician
 * knows who is still to be seen.
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
    var query by rememberSaveable { mutableStateOf("") }

    LaunchedEffect(campId) { clinician.loadRoster(campId) }

    val q = query.trim().lowercase()
    val shown = if (q.isEmpty()) roster else roster.filter {
        it.name.lowercase().contains(q) || it.studentRef.lowercase().contains(q)
    }
    val screened = roster.count { it.status != "NOT_SCREENED" }

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
                        campTitle,
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Text(
                        "$screened of ${roster.size} screened",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
            Spacer(Modifier.height(12.dp))
            OutlinedTextField(
                value = query,
                onValueChange = { query = it },
                modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp),
                placeholder = { Text("Search name or roll number") },
                leadingIcon = { Icon(Icons.Outlined.Search, contentDescription = null) },
                singleLine = true,
                shape = RoundedCornerShape(14.dp),
                colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = HeroOrange),
            )
            Spacer(Modifier.height(12.dp))
            // Only a physician sees this, and only once there is something to
            // sign off. The server decides both: `can.review` comes back with
            // the roster, and it refuses the queue to anyone else regardless
            // of what this build chooses to draw.
            if (can.review && screened > 0) {
                HeroCard(
                    Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 20.dp)
                        .clickable(onClick = onOpenReview)
                ) {
                    Row(
                        Modifier.padding(14.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        IconBubble(Icons.Outlined.FactCheck, HeroBlue)
                        Spacer(Modifier.width(12.dp))
                        Column(Modifier.weight(1f)) {
                            Text(
                                "Review and send results",
                                style = MaterialTheme.typography.titleSmall,
                                fontWeight = FontWeight.SemiBold,
                            )
                            Text(
                                "$screened screened. Nothing reaches a guardian until you "
                                    + "sign it off.",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                }
                Spacer(Modifier.height(12.dp))
            }
        }

        if (shown.isEmpty()) {
            item {
                EmptyState(
                    icon = Icons.Outlined.Groups,
                    title = when {
                        busy -> "Loading the list…"
                        roster.isEmpty() -> "No children on this camp yet"
                        else -> "No match"
                    },
                    subtitle = when {
                        busy -> "One moment."
                        roster.isEmpty() ->
                            "An administrator builds the camp's list from the school's roster."
                        else -> "Nobody on this camp matches \"$query\"."
                    },
                    modifier = Modifier.padding(20.dp),
                )
            }
        } else {
            items(shown, key = { it.kidId }) { child ->
                ChildRow(child) { onOpenChild(child.kidId) }
            }
        }
        item { Spacer(Modifier.height(24.dp)) }
    }
}

@Composable
private fun ChildRow(child: CampChildDto, onClick: () -> Unit) {
    HeroCard(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = 20.dp, vertical = 6.dp)
            .clickable(onClick = onClick)
    ) {
        Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
            // The same derivation ProfileViewModel uses, so a child keeps one
            // colour wherever they appear. KidAvatar requires it; there is no
            // default.
            KidAvatar(
                name = child.name,
                colorValue = (child.name.hashCode() and 0xFFFFFF).toLong() or 0xFF000000,
                size = 42.dp,
            )
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(
                    child.name,
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    listOf(
                        listOf(child.grade, child.section).filter { it.isNotBlank() }.joinToString(" "),
                        child.studentRef,
                    ).filter { it.isNotBlank() }.joinToString(" · "),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.Center) {
                // Consent first: without it nothing may be recorded at all, so
                // a clinician must see that before they sit the child down.
                if (child.consentStatus != "GRANTED" && child.consentStatus != "PAPER") {
                    Text(
                        if (child.consentStatus == "DECLINED") "Declined" else "No consent",
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.error,
                    )
                } else {
                    Text(
                        if (child.status == "NOT_SCREENED") "To do" else "Done",
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = FontWeight.Bold,
                        color = if (child.status == "NOT_SCREENED") HeroOrange else HeroBlue,
                    )
                }
                if (child.attendance == "ABSENT") {
                    Text(
                        "Absent",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
    }
}
