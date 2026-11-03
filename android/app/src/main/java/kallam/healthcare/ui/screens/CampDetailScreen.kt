package kallam.healthcare.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.LocationOn
import androidx.compose.material.icons.outlined.Schedule
import androidx.compose.material.icons.outlined.Verified
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import kallam.healthcare.data.Camp
import kallam.healthcare.data.CampResultDto
import kallam.healthcare.data.Kid
import kallam.healthcare.data.S
import kallam.healthcare.ui.components.AppCard
import kallam.healthcare.ui.components.AppListRow
import kallam.healthcare.ui.components.AppScreenHeader
import kallam.healthcare.ui.components.AppSectionTitle
import kallam.healthcare.ui.components.InfoNote
import kallam.healthcare.ui.components.PrimaryGradientButton
import kallam.healthcare.ui.components.StatusBarSpacer
import kallam.healthcare.ui.components.StatusPill
import kallam.healthcare.ui.components.Tone
import kallam.healthcare.ui.components.campWhen
import kallam.healthcare.ui.components.color
import kallam.healthcare.ui.components.t
import kallam.healthcare.ui.theme.AppSpacing
import kotlinx.coroutines.delay

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun CampDetailScreen(
    camp: Camp,
    kids: List<Kid>,
    onBack: () -> Unit,
    /** True while the registration is with the server. */
    onBookFollowUp: () -> Unit,
    /** Open what a doctor released for one child at this camp. */
    onOpenResult: (campId: String, kidId: String) -> Unit = { _, _ -> },
    /** Each child's place in the camp, keyed "campId/kidId". */
    progress: Map<String, CampResultDto> = emptyMap(),
    /** Ask the server again where these children are in the camp. */
    onRefreshProgress: (campId: String, kidIds: List<String>) -> Unit = { _, _ -> },
) {
    val upcoming = camp.status.isUpcoming
    val accent = if (upcoming) Tone.Info.color() else MaterialTheme.colorScheme.primary
    val registered = camp.registeredKidIds
    // The header pads itself, so the list has no horizontal contentPadding;
    // every other item carries the screen margin instead.
    val margin = Modifier.padding(horizontal = AppSpacing.xl)

    LazyColumn(
        modifier = Modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.background),
        contentPadding = PaddingValues(bottom = AppSpacing.xxxl)
    ) {
        item {
            StatusBarSpacer()
            AppScreenHeader(title = t(S.campDetails), onBack = onBack)
            Spacer(Modifier.height(AppSpacing.sm))
        }

        item {
            AppCard(margin) {
                if (camp.isPartnerCamp) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Outlined.Verified, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.width(AppSpacing.xs))
                        Text(t(S.partnerCamp), style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.primary)
                    }
                    Spacer(Modifier.height(AppSpacing.sm))
                }
                Text(camp.title, style = MaterialTheme.typography.headlineSmall,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
                Spacer(Modifier.height(AppSpacing.sm))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Outlined.LocationOn, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(AppSpacing.xs))
                    Text(camp.school, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
                Spacer(Modifier.height(AppSpacing.sm))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Outlined.Schedule, contentDescription = null, tint = accent, modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(AppSpacing.xs))
                    Text(campWhen(camp.date, camp.time), style = MaterialTheme.typography.bodyMedium)
                }
                if (camp.description.isNotBlank()) {
                    Spacer(Modifier.height(AppSpacing.md))
                    Text(camp.description, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                if (camp.grades.isNotEmpty()) {
                    Spacer(Modifier.height(AppSpacing.lg))
                    AppSectionTitle(t(S.eligibleGrades))
                    Spacer(Modifier.height(AppSpacing.sm))
                    FlowRow(
                        horizontalArrangement = Arrangement.spacedBy(AppSpacing.sm),
                        verticalArrangement = Arrangement.spacedBy(AppSpacing.sm),
                    ) {
                        camp.grades.forEach { grade -> StatusPill(grade, Tone.Neutral) }
                    }
                }
                Spacer(Modifier.height(AppSpacing.lg))
                AppSectionTitle(t(S.screeningsIncluded))
                Spacer(Modifier.height(AppSpacing.sm))
                // Same chip as the camp cards on the Camps tab.
                FlowRow(
                    horizontalArrangement = Arrangement.spacedBy(AppSpacing.sm),
                    verticalArrangement = Arrangement.spacedBy(AppSpacing.sm),
                ) {
                    camp.checks.forEach { check -> StatusPill(check, Tone.Neutral) }
                }
                if (camp.capacity > 0) {
                    Spacer(Modifier.height(AppSpacing.md))
                    Text("${t(S.capacity)}: ${camp.capacity}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                camp.resultSummary?.let {
                    Spacer(Modifier.height(AppSpacing.md))
                    InfoNote(it, tone = Tone.Brand)
                }
            }
            Spacer(Modifier.height(AppSpacing.xxl))
        }

        if (upcoming && camp.isPartnerCamp && kids.isNotEmpty()) {
            item {
                // Who is being screened, not who to sign up.
                //
                // This was a "Register your child" form with a list and a
                // confirm button. A camp's list is built by a school
                // administrator from the classes the camp covers, so a parent
                // adding their own child produced a participant the school had
                // not planned for and had not sought consent for. The server
                // refuses it now; showing the button anyway would only let a
                // parent discover that by pressing it.
                //
                // The same list is still worth showing — a parent opening a
                // camp wants to know whether it involves their child — so it
                // reads rather than acts.
                AppSectionTitle(t(S.campRosterTitle), margin)
                Spacer(Modifier.height(AppSpacing.md))
                kids.forEach { kid ->
                    val isOnList = kid.id in registered
                    // The on-list status is a sentence, so it sits under the
                    // name rather than beside it, where it squeezed the name.
                    AppListRow(
                        title = kid.name,
                        modifier = margin.padding(bottom = AppSpacing.md),
                        subtitle = "${kid.grade} · ${kid.school}",
                        supporting = if (isOnList) t(S.campRosterOnList) else t(S.campRosterNotOnList),
                        supportingTone = if (isOnList) Tone.Brand else Tone.Neutral,
                    )
                }
                Text(
                    t(S.campRosterNote),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = margin,
                )
                Spacer(Modifier.height(AppSpacing.xxl))
            }
        }

        // Each child on this camp's list, from the day they are put on it: which
        // checks are done and which are still to come, then the result once a
        // doctor releases it. Only the children on this camp's list: a brother
        // at another school was once told "a doctor is still checking this" for
        // a camp he never attended. Every server sends this list for a partner
        // camp, so an empty one means none of this family's children take part.
        //
        // It shows progress, never findings. What a check found reaches the
        // parent only through a doctor's release, on the result screen.
        val resultKids = kids.filter { it.id in registered }
        val campKey = camp.schoolCampId.ifBlank { camp.id }
        if (camp.isPartnerCamp && resultKids.isNotEmpty()) {
            item {
                // Live while the screen is open: asked again every half minute
                // until every child has an answer that will not change.
                val kidIds = resultKids.map { it.id }
                val settled = kidIds.all { id ->
                    progress["$campKey/$id"]?.progress?.stage in setOf("RELEASED", "NOT_SCREENED", "DECLINED")
                }
                LaunchedEffect(campKey, kidIds, settled) {
                    while (true) {
                        onRefreshProgress(campKey, kidIds)
                        if (settled) break
                        delay(30_000)
                    }
                }

                AppSectionTitle(t(S.campProgressTitle), margin)
                Spacer(Modifier.height(AppSpacing.md))
                resultKids.forEach { kid ->
                    ChildProgressCard(
                        name = kid.name,
                        result = progress["$campKey/${kid.id}"],
                        onOpen = { onOpenResult(campKey, kid.id) },
                        modifier = margin.padding(bottom = AppSpacing.md),
                    )
                }
                Text(
                    t(S.progressValuesNote),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = margin,
                )
                Spacer(Modifier.height(AppSpacing.xxl))
            }
        }

        item {
            PrimaryGradientButton(
                text = if (upcoming) t(S.addToReminders) else t(S.bookFollowUp),
                onClick = onBookFollowUp,
                modifier = margin.fillMaxWidth(),
            )
        }
    }
}

/** One child: where they are in the camp, and each check's state under it. */
@Composable
private fun ChildProgressCard(name: String, result: CampResultDto?, onOpen: () -> Unit, modifier: Modifier = Modifier) {
    val p = result?.progress
    val released = p?.stage == "RELEASED"
    AppCard(modifier = modifier, onClick = onOpen) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(name, style = MaterialTheme.typography.titleMedium,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    when (p?.stage) {
                        null -> t(S.loadingLabel)
                        "RELEASED" -> t(S.progressReleased)
                        "WITH_DOCTOR" -> t(S.progressWithDoctor)
                        "SCREENING" -> "${t(S.progressScreening)} · ${p.done}/${p.total}"
                        "CONSENT_NEEDED" -> t(S.progressConsentNeeded)
                        "DECLINED" -> t(S.progressDeclined)
                        "NOT_SCREENED" -> t(S.progressNotScreened)
                        else -> t(S.progressWaiting)
                    },
                    style = MaterialTheme.typography.bodySmall,
                    color = if (released) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            if (released) {
                Spacer(Modifier.width(AppSpacing.sm))
                StatusPill(t(S.viewLabel), Tone.Info)
            }
        }
        p?.checks?.forEach { c ->
            Spacer(Modifier.height(AppSpacing.sm))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    c.checkType,
                    style = MaterialTheme.typography.bodyMedium,
                    modifier = Modifier.weight(1f),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Spacer(Modifier.width(AppSpacing.sm))
                StatusPill(
                    when (c.state) {
                        "DONE" -> "✓ " + t(S.checkStateDone)
                        "NOT_DONE" -> t(S.checkStateNotDone)
                        "NOT_CONSENTED" -> t(S.checkStateNotIncluded)
                        else -> t(S.checkStatePending)
                    },
                    when (c.state) {
                        "DONE" -> Tone.Good
                        "PENDING" -> Tone.Watch
                        else -> Tone.Neutral
                    },
                )
            }
        }
    }
}
