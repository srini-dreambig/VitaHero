package com.rork.kidhero.ui.screens

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
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.rork.kidhero.data.Camp
import com.rork.kidhero.data.CampStatus
import com.rork.kidhero.ui.components.HeroCard
import com.rork.kidhero.ui.components.IconBubble
import com.rork.kidhero.ui.components.StatusBarSpacer
import com.rork.kidhero.ui.theme.HeroBlue
import com.rork.kidhero.ui.theme.HeroGreen

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun CampsScreen(
    camps: List<Camp>,
    onBookFollowUp: () -> Unit
) {
    val upcoming = camps.filter { it.status == CampStatus.UPCOMING }
    val past = camps.filter { it.status == CampStatus.COMPLETED }

    LazyColumn(
        modifier = Modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.background),
        contentPadding = PaddingValues(start = 20.dp, end = 20.dp, bottom = 24.dp)
    ) {
        item {
            StatusBarSpacer()
            Column(Modifier.padding(vertical = 12.dp)) {
                Text("Health Camps", style = MaterialTheme.typography.headlineLarge, fontWeight = FontWeight.Bold)
                Text(
                    "School screening camps & follow-ups",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }

        if (upcoming.isNotEmpty()) {
            item {
                Text("Upcoming", style = MaterialTheme.typography.headlineSmall)
                Spacer(Modifier.height(12.dp))
            }
            items(upcoming, key = { it.id }) { camp ->
                CampCard(camp, onBookFollowUp)
                Spacer(Modifier.height(12.dp))
            }
        }

        item {
            Spacer(Modifier.height(8.dp))
            Text("Past camps", style = MaterialTheme.typography.headlineSmall)
            Spacer(Modifier.height(12.dp))
        }
        items(past, key = { it.id }) { camp ->
            CampCard(camp, onBookFollowUp)
            Spacer(Modifier.height(12.dp))
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun CampCard(camp: Camp, onBookFollowUp: () -> Unit) {
    val upcoming = camp.status == CampStatus.UPCOMING
    val accent = if (upcoming) HeroBlue else HeroGreen
    HeroCard(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(18.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconBubble(
                    if (upcoming) Icons.Outlined.CalendarMonth else Icons.Outlined.CheckCircle,
                    accent
                )
                Spacer(Modifier.width(14.dp))
                Column(Modifier.weight(1f)) {
                    Text(camp.title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Outlined.LocationOn, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(14.dp))
                        Spacer(Modifier.width(4.dp))
                        Text(camp.school, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
                Box(
                    Modifier
                        .clip(RoundedCornerShape(50))
                        .background(accent.copy(alpha = 0.13f))
                        .padding(horizontal = 10.dp, vertical = 4.dp)
                ) {
                    Text(
                        if (upcoming) "Upcoming" else "Done",
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
                        .background(HeroGreen.copy(alpha = 0.1f))
                        .padding(12.dp)
                ) {
                    Text(camp.resultSummary, style = MaterialTheme.typography.bodySmall, color = HeroGreen, fontWeight = FontWeight.Medium)
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
                    if (upcoming) "Add to reminders" else "Book follow-up",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold,
                    color = if (upcoming) MaterialTheme.colorScheme.onSurface else Color.White
                )
            }
        }
    }
}
