package kallam.healthcare.ui.screens

import androidx.compose.material.icons.outlined.Groups
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Logout
import androidx.compose.material.icons.outlined.MenuBook
import androidx.compose.material.icons.outlined.School
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import kallam.healthcare.data.DieticianViewModel
import kallam.healthcare.ui.components.AppListRow
import kallam.healthcare.ui.components.AppScreenHeader
import kallam.healthcare.ui.components.EmptyState
import kallam.healthcare.ui.components.IconBubble
import kallam.healthcare.ui.components.Notice
import kallam.healthcare.ui.components.StatusBarSpacer
import kallam.healthcare.ui.components.Tone
import kallam.healthcare.ui.theme.AppSpacing

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
    val templates by dietician.templates.collectAsState()
    var precamp by rememberSaveable { mutableStateOf(false) }

    LaunchedEffect(precamp) {
        if (!precamp) {
            dietician.loadSchools()
            dietician.loadTemplates()
        }
    }

    if (precamp) {
        PrecampPlansScreen(dietician) { precamp = false }
        return
    }

    Column(Modifier.fillMaxSize()) {
        StatusBarSpacer()
        AppScreenHeader(
            "My schools",
            subtitle = if (me.name.isNotBlank()) {
                listOf(me.name, me.qualification).filter { it.isNotBlank() }.joinToString(" · ")
            } else null,
            actions = {
                IconButton(onClick = onLogout) {
                    Icon(Icons.Outlined.Logout, contentDescription = "Sign out")
                }
            },
        )
        if (message.isNotBlank()) Notice(message, error = true)

        LazyColumn(
            Modifier.fillMaxSize(),
            contentPadding = PaddingValues(start = AppSpacing.xl, end = AppSpacing.xl, top = AppSpacing.sm, bottom = AppSpacing.xxl),
            verticalArrangement = Arrangement.spacedBy(AppSpacing.md),
        ) {
            // The first job before any camp: the twelve plans families get
            // when their child's results are released.
            item {
                val t = templates
                val left = if (t == null) 0 else t.templates.size - t.ready
                AppListRow(
                    title = "Pre-camp diet plans",
                    subtitle = if (t == null) "Write before the camp" else "${t.ready} of ${t.templates.size} written",
                    supporting = if (t != null && left == 0) {
                        "Families get their child's plan when results are released."
                    } else {
                        "6 growth groups, for girls and boys. Write them before the camp."
                    },
                    supportingTone = if (t != null && left == 0) Tone.Good else Tone.Watch,
                    leading = { IconBubble(Icons.Outlined.Groups, MaterialTheme.colorScheme.primary) },
                    onClick = { precamp = true },
                )
            }
            if (schools.isEmpty()) {
                item {
                    EmptyState(
                        icon = Icons.Outlined.School,
                        title = if (busy) "Loading your schools…" else "No schools yet",
                        subtitle =
                            if (busy) "One moment."
                            else "VitaHero operations assigns you to a school. Once they do, its "
                                + "children appear here with their growth.",
                    )
                }
            } else {
                items(schools, key = { it.id }) { school ->
                    AppListRow(
                        title = school.name,
                        subtitle = school.city.ifBlank { null },
                        supporting = "${school.children} children · ${school.plans} on a plan",
                        supportingTone = Tone.Info,
                        leading = { IconBubble(Icons.Outlined.School, MaterialTheme.colorScheme.primary) },
                        onClick = { onOpenSchool(school.id, school.name) },
                    )
                }
            }
            // C4 — the other half of the job. A plan is for one child; the
            // reading list is the advice that is the same for every family, and
            // it was operations-only until now.
            item {
                AppListRow(
                    title = "What families read",
                    supporting = "Write for every family, not one child at a time",
                    leading = { IconBubble(Icons.Outlined.MenuBook, MaterialTheme.colorScheme.secondary) },
                    onClick = onOpenArticles,
                    modifier = Modifier.padding(top = AppSpacing.md),
                )
            }
        }
    }
}
