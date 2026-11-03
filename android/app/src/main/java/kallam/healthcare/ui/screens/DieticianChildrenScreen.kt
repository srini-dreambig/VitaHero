package kallam.healthcare.ui.screens

import androidx.compose.material.icons.outlined.Search
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Groups
import androidx.compose.material3.MaterialTheme
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
import kallam.healthcare.data.DieticianViewModel
import kallam.healthcare.ui.components.AppCard
import kallam.healthcare.ui.components.AppListRow
import kallam.healthcare.ui.components.AppScreenHeader
import kallam.healthcare.ui.components.AppTextField
import kallam.healthcare.ui.components.EmptyState
import kallam.healthcare.ui.components.IconBubble
import kallam.healthcare.ui.components.Notice
import kallam.healthcare.ui.components.StatusBarSpacer
import kallam.healthcare.ui.components.StatusPill
import kallam.healthcare.ui.components.Tone
import kallam.healthcare.ui.theme.AppSpacing

/**
 * The children at one of this dietician's schools.
 *
 * Each row carries only what is needed to choose: the name, the class, whether
 * a plan is running, and how many of the two checks this person may read came
 * back flagged. Not the readings — those are one tap away, and that tap is
 * written to the access trail.
 *
 * The filter is done here rather than on the server because the list is one
 * school's roster and a round trip to re-filter a few hundred names is a round
 * trip spent to feel slower. The server still decides which names are in it.
 */
@Composable
fun DieticianChildrenScreen(
    schoolId: String,
    schoolName: String,
    dietician: DieticianViewModel,
    onOpenChild: (kidId: String) -> Unit,
    onOpenGroups: (schoolId: String, schoolName: String) -> Unit,
    onBack: () -> Unit,
) {
    val children by dietician.children.collectAsState()
    val busy by dietician.busy.collectAsState()
    val message by dietician.message.collectAsState()
    var query by rememberSaveable { mutableStateOf("") }

    LaunchedEffect(schoolId) { dietician.loadChildren(schoolId) }

    val q = query.trim().lowercase()
    val shown = if (q.isEmpty()) children else children.filter { it.name.lowercase().contains(q) }
    val onPlan = children.count { it.hasPlan }

    Column(Modifier.fillMaxSize()) {
        StatusBarSpacer()
        AppScreenHeader(
            schoolName,
            subtitle = "$onPlan of ${children.size} on a plan",
            onBack = onBack,
        )
        if (message.isNotBlank()) Notice(message, error = true)

        LazyColumn(
            Modifier.fillMaxSize(),
            contentPadding = PaddingValues(start = AppSpacing.xl, end = AppSpacing.xl, top = AppSpacing.sm, bottom = AppSpacing.xxl),
            verticalArrangement = Arrangement.spacedBy(AppSpacing.md),
        ) {
            item {
                AppTextField(
                    value = query,
                    onValueChange = { query = it },
                    modifier = Modifier.fillMaxWidth(),
                    placeholder = "Search by name",
                    leadingIcon = Icons.Outlined.Search,
                )
            }
            // Most children need one of a handful of plans. Writing it once
            // per group is the quick way through a school.
            item {
                AppCard(
                    onClick = { onOpenGroups(schoolId, schoolName) },
                    background = MaterialTheme.colorScheme.primary.copy(alpha = 0.08f),
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        IconBubble(Icons.Outlined.Groups, MaterialTheme.colorScheme.primary)
                        Spacer(Modifier.width(AppSpacing.md))
                        Column(Modifier.weight(1f)) {
                            Text(
                                "Plan by groups",
                                style = MaterialTheme.typography.titleMedium,
                            )
                            Text(
                                "Children grouped by what their checks found, each with a draft plan to edit and send.",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                }
            }

            if (shown.isEmpty()) {
                item {
                    EmptyState(
                        icon = Icons.Outlined.Groups,
                        title = when {
                            busy -> "Loading…"
                            children.isEmpty() -> "No children on this roster yet"
                            else -> "Nobody matches that"
                        },
                        subtitle = when {
                            busy -> "One moment."
                            children.isEmpty() -> (
                                "The school office builds the roster. Once it is in, every child "
                                    + "here can be given a plan."
                            )
                            else -> "Try part of the name."
                        },
                    )
                }
            } else {
                items(shown, key = { it.kidId }) { child ->
                    AppListRow(
                        title = child.name,
                        subtitle = listOf(
                            listOf(child.grade, child.section).filter { it.isNotBlank() }
                                .joinToString(" "),
                            child.age?.let { "$it yrs" } ?: "",
                        ).filter { it.isNotBlank() }.joinToString(" · "),
                        leading = {
                            IconBubble(
                                Icons.Outlined.Groups,
                                if (child.concerns > 0) MaterialTheme.colorScheme.primary
                                else MaterialTheme.colorScheme.secondary,
                            )
                        },
                        trailing = if (child.hasPlan || child.concerns > 0) {
                            @Composable {
                                Column(horizontalAlignment = Alignment.End) {
                                    if (child.hasPlan) StatusPill("On a plan", Tone.Info)
                                    if (child.concerns > 0) {
                                        if (child.hasPlan) Spacer(Modifier.height(AppSpacing.xs))
                                        StatusPill(
                                            if (child.concerns == 1) "1 to look at" else "${child.concerns} to look at",
                                            Tone.Watch,
                                        )
                                    }
                                }
                            }
                        } else null,
                        onClick = { onOpenChild(child.kidId) },
                    )
                }
            }
        }
    }
}
