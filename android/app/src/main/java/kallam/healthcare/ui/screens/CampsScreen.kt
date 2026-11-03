package kallam.healthcare.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.CalendarMonth
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.LocationOn
import androidx.compose.material.icons.outlined.Schedule
import androidx.compose.material.icons.outlined.School
import androidx.compose.material.icons.outlined.Verified
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import kallam.healthcare.data.AppLocale
import kallam.healthcare.data.Camp
import kallam.healthcare.data.LocalAppLocale
import kallam.healthcare.data.S
import kallam.healthcare.ui.components.AppCard
import kallam.healthcare.ui.components.AppListRow
import kallam.healthcare.ui.components.AppScreenHeader
import kallam.healthcare.ui.components.AppSectionTitle
import kallam.healthcare.ui.components.EmptyState
import kallam.healthcare.ui.components.IconBubble
import kallam.healthcare.ui.components.InfoNote
import kallam.healthcare.ui.components.PrimaryGradientButton
import kallam.healthcare.ui.components.SecondaryButton
import kallam.healthcare.ui.components.StatusBarSpacer
import kallam.healthcare.ui.components.StatusPill
import kallam.healthcare.ui.components.Tone
import kallam.healthcare.ui.components.bottomBarClearance
import kallam.healthcare.ui.components.campWhen
import kallam.healthcare.ui.components.color
import kallam.healthcare.ui.components.t
import kallam.healthcare.ui.theme.AppSpacing
import kallam.healthcare.ui.theme.AppTheme

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun CampsScreen(
    camps: List<Camp>,
    onBookFollowUp: () -> Unit,
    onOpenCamp: (String) -> Unit = {},
    onOpenSchools: () -> Unit = {},
    /** How many camps are waiting on this guardian to answer. */
    pendingConsents: Int = 0,
    onOpenConsent: () -> Unit = {},
) {
    val upcoming = camps.filter { it.status.isUpcoming }
    val past = camps.filter { it.status.isPast }
    // The header pads itself onto the screen margin, so the list has no
    // horizontal contentPadding; every other item carries the margin instead.
    val margin = Modifier.padding(horizontal = AppSpacing.xl)

    LazyColumn(
        modifier = Modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.background),
        contentPadding = PaddingValues(bottom = bottomBarClearance())
    ) {
        item {
            StatusBarSpacer()
            AppScreenHeader(
                title = t(S.schoolCamps),
                subtitle = t(S.schoolScreenings),
            )
            Spacer(Modifier.height(AppSpacing.xs))
            AppListRow(
                title = t(S.linkSchoolPartners),
                modifier = margin,
                supporting = t(S.schoolPartnersSub),
                leading = {
                    Icon(Icons.Outlined.School, contentDescription = null, tint = MaterialTheme.colorScheme.secondary, modifier = Modifier.size(24.dp))
                },
                showChevron = true,
                onClick = onOpenSchools,
            )
            Spacer(Modifier.height(AppSpacing.md))

            // A camp cannot happen for a child whose guardian has not answered,
            // so this sits above everything else on the screen while it is true.
            if (pendingConsents > 0) {
                AppListRow(
                    title = t(S.campConsentTitle),
                    modifier = margin,
                    supporting = t(S.campConsentSub),
                    leading = {
                        Icon(
                            Icons.Outlined.School,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.size(24.dp),
                        )
                    },
                    showChevron = true,
                    onClick = onOpenConsent,
                )
                Spacer(Modifier.height(AppSpacing.md))
            }
        }

        if (camps.isEmpty()) {
            item {
                EmptyState(
                    icon = Icons.Outlined.CalendarMonth,
                    title = t(S.noCampsYet),
                    subtitle = t(S.noCampsSub)
                )
            }
            return@LazyColumn
        }

        if (upcoming.isNotEmpty()) {
            item {
                Spacer(Modifier.height(AppSpacing.md))
                AppSectionTitle(t(S.upcoming), margin)
                Spacer(Modifier.height(AppSpacing.md))
            }
            items(upcoming, key = { it.id }) { camp ->
                CampCard(camp, onBookFollowUp, onOpenCamp, margin)
                Spacer(Modifier.height(AppSpacing.md))
            }
        }

        item {
            Spacer(Modifier.height(AppSpacing.md))
            AppSectionTitle(t(S.pastCamps), margin)
            Spacer(Modifier.height(AppSpacing.md))
        }
        items(past, key = { it.id }) { camp ->
            CampCard(camp, onBookFollowUp, onOpenCamp, margin)
            Spacer(Modifier.height(AppSpacing.md))
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun CampCard(camp: Camp, onBookFollowUp: () -> Unit, onOpenCamp: (String) -> Unit, modifier: Modifier = Modifier) {
    val upcoming = camp.status.isUpcoming
    val tone = if (upcoming) Tone.Info else Tone.Brand
    val brand = MaterialTheme.colorScheme.primary
    AppCard(modifier = modifier, onClick = { onOpenCamp(camp.id) }) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            IconBubble(
                if (upcoming) Icons.Outlined.CalendarMonth else Icons.Outlined.CheckCircle,
                if (upcoming) MaterialTheme.colorScheme.secondary else brand
            )
            Spacer(Modifier.width(AppSpacing.md))
            Column(Modifier.weight(1f)) {
                if (camp.isPartnerCamp) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Outlined.Verified, contentDescription = null, tint = brand, modifier = Modifier.size(14.dp))
                        Spacer(Modifier.width(AppSpacing.xs))
                        Text(t(S.partnerCamp), style = MaterialTheme.typography.labelMedium, color = brand)
                    }
                    Spacer(Modifier.height(AppSpacing.xs))
                }
                Text(camp.title, style = MaterialTheme.typography.titleMedium,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Outlined.LocationOn, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(14.dp))
                    Spacer(Modifier.width(AppSpacing.xs))
                    Text(camp.school, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
            }
            Spacer(Modifier.width(AppSpacing.sm))
            StatusPill(if (upcoming) t(S.upcoming) else t(S.completed), tone)
        }
        Spacer(Modifier.height(AppSpacing.md))
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Outlined.Schedule, contentDescription = null, tint = tone.color(), modifier = Modifier.size(16.dp))
            Spacer(Modifier.width(AppSpacing.sm))
            Text(campWhen(camp.date, camp.time), style = MaterialTheme.typography.bodyMedium)
        }
        Spacer(Modifier.height(AppSpacing.md))
        FlowRow(
            horizontalArrangement = Arrangement.spacedBy(AppSpacing.sm),
            verticalArrangement = Arrangement.spacedBy(AppSpacing.sm),
        ) {
            camp.checks.forEach { check ->
                StatusPill(check, Tone.Neutral)
            }
        }
        if (camp.resultSummary != null) {
            Spacer(Modifier.height(AppSpacing.md))
            InfoNote(camp.resultSummary, tone = Tone.Brand)
        }
        Spacer(Modifier.height(AppSpacing.md))
        if (upcoming) {
            SecondaryButton(t(S.addToReminders), onBookFollowUp, Modifier.fillMaxWidth())
        } else {
            PrimaryGradientButton(t(S.bookFollowUp), onBookFollowUp, Modifier.fillMaxWidth())
        }
    }
}

@Preview(showBackground = true)
@Composable
private fun CampsScreenPreview() {
    androidx.compose.runtime.CompositionLocalProvider(LocalAppLocale provides AppLocale.ENGLISH) {
        AppTheme {
            CampsScreen(
                camps = emptyList(),
                onBookFollowUp = {},
                onOpenCamp = {},
                onOpenSchools = {},
            )
        }
    }
}
