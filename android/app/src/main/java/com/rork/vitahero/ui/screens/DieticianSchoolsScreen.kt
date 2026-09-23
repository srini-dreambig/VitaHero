package com.rork.vitahero.ui.screens

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
import androidx.compose.material.icons.outlined.Logout
import androidx.compose.material.icons.outlined.MenuBook
import androidx.compose.material.icons.outlined.School
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
import com.rork.vitahero.data.DieticianViewModel
import com.rork.vitahero.ui.components.EmptyState
import com.rork.vitahero.ui.components.HeroCard
import com.rork.vitahero.ui.components.IconBubble
import com.rork.vitahero.ui.components.Notice
import com.rork.vitahero.ui.components.StatusBarSpacer
import com.rork.vitahero.ui.theme.HeroBlue
import com.rork.vitahero.ui.theme.HeroOrange

/**
 * Where a dietician lands: the schools they were assigned.
 *
 * Schools rather than camps, and that is the whole difference between this
 * role and the clinical one. A camp is a day; a diet plan runs for weeks and
 * the food log fills in every evening. So the unit of work is a school, and it
 * stays theirs until somebody says otherwise.
 */
@Composable
fun DieticianSchoolsScreen(
    dietician: DieticianViewModel,
    onOpenSchool: (schoolId: String, name: String) -> Unit,
    onOpenArticles: () -> Unit,
    onLogout: () -> Unit,
) {
    val me by dietician.me.collectAsState()
    val schools by dietician.schools.collectAsState()
    val busy by dietician.busy.collectAsState()
    val message by dietician.message.collectAsState()

    LaunchedEffect(Unit) { dietician.loadSchools() }

    LazyColumn(Modifier.fillMaxSize()) {
        item {
            StatusBarSpacer()
            Row(
                Modifier.fillMaxWidth().padding(20.dp, 12.dp, 12.dp, 4.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(Modifier.weight(1f)) {
                    Text(
                        "My schools",
                        style = MaterialTheme.typography.headlineMedium,
                        fontWeight = FontWeight.Bold,
                    )
                    if (me.name.isNotBlank()) {
                        Text(
                            listOf(me.name, me.qualification).filter { it.isNotBlank() }
                                .joinToString(" · "),
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
                IconButton(onClick = onLogout) {
                    Icon(Icons.Outlined.Logout, contentDescription = "Sign out")
                }
            }
            if (message.isNotBlank()) {
                Column(Modifier.padding(horizontal = 20.dp)) { Notice(message, error = true) }
            }
            Spacer(Modifier.height(8.dp))
        }

        if (schools.isEmpty()) {
            item {
                EmptyState(
                    icon = Icons.Outlined.School,
                    title = if (busy) "Loading your schools…" else "No schools yet",
                    subtitle =
                        if (busy) "One moment."
                        else "VitaHero operations assigns you to a school. Once they do, its "
                            + "children appear here with their growth and haemoglobin.",
                    modifier = Modifier.padding(20.dp),
                )
            }
        } else {
            items(schools, key = { it.id }) { school ->
                HeroCard(
                    Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 20.dp, vertical = 7.dp)
                        .clickable { onOpenSchool(school.id, school.name) }
                ) {
                    Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                        IconBubble(Icons.Outlined.School, HeroOrange)
                        Spacer(Modifier.width(14.dp))
                        Column(Modifier.weight(1f)) {
                            Text(
                                school.name,
                                style = MaterialTheme.typography.titleSmall,
                                fontWeight = FontWeight.SemiBold,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                            )
                            if (school.city.isNotBlank()) {
                                Text(
                                    school.city,
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                            }
                            Spacer(Modifier.height(4.dp))
                            Text(
                                "${school.children} children · ${school.plans} on a plan",
                                style = MaterialTheme.typography.labelMedium,
                                color = HeroBlue,
                                fontWeight = FontWeight.SemiBold,
                            )
                        }
                    }
                }
            }
        }
        // C4 — the other half of the job. A plan is for one child; the
        // reading list is the advice that is the same for every family, and
        // it was operations-only until now.
        item {
            Spacer(Modifier.height(10.dp))
            HeroCard(
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp, vertical = 7.dp)
                    .clickable(onClick = onOpenArticles)
            ) {
                Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                    IconBubble(Icons.Outlined.MenuBook, HeroBlue)
                    Spacer(Modifier.width(14.dp))
                    Column(Modifier.weight(1f)) {
                        Text(
                            "What families read",
                            style = MaterialTheme.typography.titleSmall,
                            fontWeight = FontWeight.SemiBold,
                        )
                        Text(
                            "Write for every family, not one child at a time",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }
        }
        item { Spacer(Modifier.height(24.dp)) }
    }
}
