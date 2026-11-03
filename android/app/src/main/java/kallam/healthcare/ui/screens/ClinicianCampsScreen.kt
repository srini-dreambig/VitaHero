package kallam.healthcare.ui.screens

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.CalendarMonth
import androidx.compose.material.icons.outlined.Logout
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import kallam.healthcare.data.ClinicianViewModel
import kallam.healthcare.ui.components.AppCard
import kallam.healthcare.ui.components.AppScreenHeader
import kallam.healthcare.ui.components.EmptyState
import kallam.healthcare.ui.components.IconBubble
import kallam.healthcare.ui.components.StatusBarSpacer
import kallam.healthcare.ui.theme.AppSpacing

/**
 * Where a clinician lands: the camps they were put on, and nothing else.
 *
 * Not a parent's home screen with different numbers. A doctor opening this in
 * a school hall wants one thing — which camp am I working, and how much of it
 * is left — so the row carries the school, the date and the count screened out
 * of the count expected.
 *
 * The list comes from listMyCamps, which only ever returns camps this person
 * is assigned to. There is no "all camps" to filter down from.
 */
@Composable
fun ClinicianCampsScreen(
    clinician: ClinicianViewModel,
    clinicianName: String,
    onOpenCamp: (campId: String, title: String) -> Unit,
    onLogout: () -> Unit,
) {
    val camps by clinician.camps.collectAsState()
    val busy by clinician.busy.collectAsState()
    val message by clinician.message.collectAsState()

    LaunchedEffect(Unit) { clinician.loadCamps() }

    LazyColumn(Modifier.fillMaxSize()) {
        item {
            StatusBarSpacer()
            AppScreenHeader(
                title = "My camps",
                // "Parent" is the profile's fallback when a name is blank, and a
                // doctor's own camps listed under the word Parent is worse than
                // no subtitle at all.
                subtitle = clinicianName.takeIf { it.isNotBlank() && it != "Parent" },
                actions = {
                    IconButton(onClick = onLogout) {
                        Icon(Icons.Outlined.Logout, contentDescription = "Sign out")
                    }
                },
            )
            Spacer(Modifier.height(AppSpacing.sm))
        }

        if (camps.isEmpty()) {
            item {
                EmptyState(
                    icon = Icons.Outlined.CalendarMonth,
                    title = when {
                        busy -> "Loading your camps…"
                        message.isNotBlank() -> "Could not load your camps"
                        else -> "No camps assigned"
                    },
                    subtitle = when {
                        busy -> "One moment."
                        message.isNotBlank() -> message
                        else -> "A school administrator puts you on a camp. Once they do, it " +
                            "appears here with its list of children."
                    },
                    modifier = Modifier.padding(AppSpacing.xl),
                )
            }
        } else {
            items(camps, key = { it.id }) { camp ->
                AppCard(
                    Modifier.padding(horizontal = AppSpacing.xl, vertical = AppSpacing.xs + AppSpacing.xxs),
                    onClick = { onOpenCamp(camp.id, camp.title) },
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        IconBubble(Icons.Outlined.CalendarMonth, MaterialTheme.colorScheme.primary)
                        Spacer(Modifier.width(AppSpacing.md))
                        Column(Modifier.weight(1f)) {
                            Text(
                                camp.title,
                                style = MaterialTheme.typography.titleMedium,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                            )
                            Text(
                                listOf(camp.schoolName, camp.date).filter { it.isNotBlank() }
                                    .joinToString(" · "),
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                            )
                            Spacer(Modifier.height(AppSpacing.xs))
                            // The only number that matters mid-camp: how many
                            // children are still to be seen by this doctor.
                            Text(
                                if (camp.myChildren > 0)
                                    "${camp.myTodo} to do · ${camp.myDone} done"
                                else "${camp.screened} of ${camp.participants} screened",
                                style = MaterialTheme.typography.labelMedium,
                                color = MaterialTheme.colorScheme.secondary,
                            )
                            val mine = listOf(camp.specialty, camp.myChecks.joinToString(", "))
                                .filter { it.isNotBlank() }.joinToString(": ")
                            if (mine.isNotBlank()) {
                                Text(
                                    mine,
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis,
                                )
                            }
                        }
                    }
                }
            }
        }
        item { Spacer(Modifier.height(AppSpacing.xxl)) }
    }
}
