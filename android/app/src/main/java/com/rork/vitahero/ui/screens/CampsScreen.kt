package com.rork.vitahero.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
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
import androidx.compose.foundation.shape.RoundedCornerShape
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.rork.vitahero.data.AppLocale
import com.rork.vitahero.data.Camp
import com.rork.vitahero.data.LocalAppLocale
import com.rork.vitahero.data.S
import com.rork.vitahero.ui.components.EmptyState
import com.rork.vitahero.ui.components.HeroCard
import com.rork.vitahero.ui.components.IconBubble
import com.rork.vitahero.ui.components.StatusBarSpacer
import com.rork.vitahero.ui.components.bottomBarClearance
import com.rork.vitahero.ui.components.t
import com.rork.vitahero.ui.theme.AppTheme
import com.rork.vitahero.ui.theme.HeroBlue
import com.rork.vitahero.ui.theme.HeroOrange

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

    LazyColumn(
        modifier = Modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.background),
        contentPadding = PaddingValues(start = 20.dp, end = 20.dp, bottom = bottomBarClearance())
    ) {
        item {
            StatusBarSpacer()
            Column(Modifier.padding(vertical = 12.dp)) {
                Text(t(S.schoolCamps), style = MaterialTheme.typography.headlineLarge, fontWeight = FontWeight.Bold)
                Text(
                    t(S.schoolScreenings),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            HeroCard(
                Modifier
                    .fillMaxWidth()
                    .clickable(onClick = onOpenSchools)
            ) {
                Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Outlined.School, contentDescription = null, tint = HeroBlue, modifier = Modifier.size(24.dp))
                    Spacer(Modifier.width(12.dp))
                    Column(Modifier.weight(1f)) {
                        Text(t(S.linkSchoolPartners), style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                        Text(t(S.schoolPartnersSub), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }
            Spacer(Modifier.height(12.dp))

            // A camp cannot happen for a child whose guardian has not answered,
            // so this sits above everything else on the screen while it is true.
            if (pendingConsents > 0) {
                HeroCard(
                    Modifier
                        .fillMaxWidth()
                        .clickable(onClick = onOpenConsent)
                ) {
                    Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            Icons.Outlined.School,
                            contentDescription = null,
                            tint = HeroOrange,
                            modifier = Modifier.size(24.dp),
                        )
                        Spacer(Modifier.width(12.dp))
                        Column(Modifier.weight(1f)) {
                            Text(
                                t(S.campConsentTitle),
                                style = MaterialTheme.typography.titleSmall,
                                fontWeight = FontWeight.SemiBold,
                            )
                            Text(
                                t(S.campConsentSub),
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                }
                Spacer(Modifier.height(12.dp))
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
                Text(t(S.upcoming), style = MaterialTheme.typography.headlineSmall)
                Spacer(Modifier.height(12.dp))
            }
            items(upcoming, key = { it.id }) { camp ->
                CampCard(camp, onBookFollowUp, onOpenCamp)
                Spacer(Modifier.height(12.dp))
            }
        }

        item {
            Spacer(Modifier.height(8.dp))
            Text(t(S.pastCamps), style = MaterialTheme.typography.headlineSmall)
            Spacer(Modifier.height(12.dp))
        }
        items(past, key = { it.id }) { camp ->
            CampCard(camp, onBookFollowUp, onOpenCamp)
            Spacer(Modifier.height(12.dp))
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun CampCard(camp: Camp, onBookFollowUp: () -> Unit, onOpenCamp: (String) -> Unit) {
    val upcoming = camp.status.isUpcoming
    val accent = if (upcoming) HeroBlue else HeroOrange
    HeroCard(
        Modifier
            .fillMaxWidth()
            .clickable { onOpenCamp(camp.id) }
    ) {
        Column(Modifier.padding(18.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconBubble(
                    if (upcoming) Icons.Outlined.CalendarMonth else Icons.Outlined.CheckCircle,
                    accent
                )
                Spacer(Modifier.width(14.dp))
                Column(Modifier.weight(1f)) {
                    if (camp.isPartnerCamp) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Outlined.Verified, contentDescription = null, tint = HeroOrange, modifier = Modifier.size(14.dp))
                            Spacer(Modifier.width(4.dp))
                            Text(t(S.partnerCamp), style = MaterialTheme.typography.labelSmall, color = HeroOrange, fontWeight = FontWeight.SemiBold)
                        }
                        Spacer(Modifier.height(4.dp))
                    }
                    Text(camp.title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Outlined.LocationOn, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(14.dp))
                        Spacer(Modifier.width(4.dp))
                        Text(camp.school, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }
                }
                Box(
                    Modifier
                        .clip(RoundedCornerShape(50))
                        .background(accent.copy(alpha = 0.13f))
                        .padding(horizontal = 10.dp, vertical = 4.dp)
                ) {
                    Text(
                        if (upcoming) t(S.upcoming) else t(S.completed),
                        style = MaterialTheme.typography.labelSmall,
                        color = accent,
                        fontWeight = FontWeight.SemiBold
                    )
                }
            }
            Spacer(Modifier.height(14.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Outlined.Schedule, contentDescription = null, tint = accent, modifier = Modifier.size(16.dp))
                Spacer(Modifier.width(6.dp))
                Text("${camp.date} · ${camp.time}", style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium)
            }
            Spacer(Modifier.height(12.dp))
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                camp.checks.forEach { check ->
                    Box(
                        Modifier
                            .padding(bottom = 8.dp)
                            .clip(RoundedCornerShape(50))
                            .background(MaterialTheme.colorScheme.surfaceVariant)
                            .padding(horizontal = 12.dp, vertical = 6.dp)
                    ) {
                        Text(check, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }
            if (camp.resultSummary != null) {
                Spacer(Modifier.height(6.dp))
                Box(
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(HeroOrange.copy(alpha = 0.1f))
                        .padding(12.dp)
                ) {
                    Text(camp.resultSummary, style = MaterialTheme.typography.bodySmall, color = HeroOrange, fontWeight = FontWeight.Medium)
                }
            }
            Spacer(Modifier.height(14.dp))
            Box(
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(14.dp))
                    .background(if (upcoming) MaterialTheme.colorScheme.surfaceVariant else accent)
                    .clickable(onClick = onBookFollowUp)
                    .padding(vertical = 13.dp),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    if (upcoming) t(S.addToReminders) else t(S.bookFollowUp),
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold,
                    color = if (upcoming) MaterialTheme.colorScheme.onSurface else Color.White
                )
            }
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
