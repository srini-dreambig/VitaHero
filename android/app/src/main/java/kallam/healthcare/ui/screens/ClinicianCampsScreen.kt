package kallam.healthcare.ui.screens

import androidx.compose.foundation.clickable
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import kallam.healthcare.data.ClinicianViewModel
import kallam.healthcare.ui.components.EmptyState
import kallam.healthcare.ui.components.HeroCard
import kallam.healthcare.ui.components.IconBubble
import kallam.healthcare.ui.components.StatusBarSpacer
import kallam.healthcare.ui.theme.HeroBlue
import kallam.healthcare.ui.theme.HeroOrange

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

    LaunchedEffect(Unit) { clinician.loadCamps() }

    LazyColumn(Modifier.fillMaxSize()) {
        item {
            StatusBarSpacer()
            Row(
                Modifier.fillMaxWidth().padding(20.dp, 12.dp, 12.dp, 4.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(Modifier.weight(1f)) {
                    Text(
                        "My camps",
                        style = MaterialTheme.typography.headlineMedium,
                        fontWeight = FontWeight.Bold,
                    )
                    // "Parent" is the profile's fallback when a name is
                    // blank, and a doctor's own camps listed under the word
                    // Parent is worse than no subtitle at all.
                    if (clinicianName.isNotBlank() && clinicianName != "Parent") {
                        Text(
                            clinicianName,
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
                IconButton(onClick = onLogout) {
                    Icon(Icons.Outlined.Logout, contentDescription = "Sign out")
                }
            }
            Spacer(Modifier.height(8.dp))
        }

        if (camps.isEmpty()) {
            item {
                EmptyState(
                    icon = Icons.Outlined.CalendarMonth,
                    title = if (busy) "Loading your camps…" else "No camps assigned",
                    subtitle =
                        if (busy) "One moment."
                        else "A school administrator puts you on a camp. Once they do, it "
                            + "appears here with its list of children.",
                    modifier = Modifier.padding(20.dp),
                )
            }
        } else {
            items(camps, key = { it.id }) { camp ->
                HeroCard(
                    Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 20.dp, vertical = 7.dp)
                        .clickable { onOpenCamp(camp.id, camp.title) }
                ) {
                    Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                        IconBubble(Icons.Outlined.CalendarMonth, HeroOrange)
                        Spacer(Modifier.width(14.dp))
                        Column(Modifier.weight(1f)) {
                            Text(
                                camp.title,
                                style = MaterialTheme.typography.titleSmall,
                                fontWeight = FontWeight.SemiBold,
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
                            Spacer(Modifier.height(4.dp))
                            // The only number that matters mid-camp: how many
                            // children are still to be seen.
                            Text(
                                "${camp.screened} of ${camp.participants} screened",
                                style = MaterialTheme.typography.labelMedium,
                                color = HeroBlue,
                                fontWeight = FontWeight.SemiBold,
                            )
                        }
                    }
                }
            }
        }
        item { Spacer(Modifier.height(24.dp)) }
    }
}
