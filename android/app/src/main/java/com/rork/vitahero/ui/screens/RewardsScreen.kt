package com.rork.vitahero.ui.screens

import androidx.compose.foundation.background
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
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.EmojiEvents
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material.icons.outlined.WorkspacePremium
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.rork.vitahero.data.Badge
import com.rork.vitahero.data.BadgeProgress
import com.rork.vitahero.data.Kid
import com.rork.vitahero.data.LeaderEntry
import com.rork.vitahero.data.S
import com.rork.vitahero.ui.components.HeroCard
import com.rork.vitahero.ui.components.KidAvatar
import com.rork.vitahero.ui.components.ProgressRing
import com.rork.vitahero.ui.components.StatusBarSpacer
import com.rork.vitahero.ui.components.t
import com.rork.vitahero.ui.theme.HeroBlue
import com.rork.vitahero.ui.theme.HeroGreen
import com.rork.vitahero.ui.theme.HeroYellow

@Composable
fun RewardsScreen(
    kids: List<Kid>,
    badgeData: (String) -> BadgeProgress,
) {
    var selectedKidId by remember { mutableStateOf(kids.firstOrNull()?.id.orEmpty()) }
    val active = kids.firstOrNull { it.id == selectedKidId }
    val progress = badgeData(selectedKidId)
    val badges = progress.badges
    val earned = badges.count { it.earned }
    val leaderboard = progress.leaderboard
    val kidName = active?.name ?: "Hero"

    LazyColumn(
        modifier = Modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.background),
        contentPadding = PaddingValues(start = 20.dp, end = 20.dp, bottom = 24.dp)
    ) {
        item {
            StatusBarSpacer()
            Column(Modifier.padding(vertical = 12.dp)) {
                Text("Hero Badges", style = MaterialTheme.typography.headlineLarge, fontWeight = FontWeight.Bold)
                Text(
                    "Celebrate healthy habits & progress",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }

        // Kid selector
        if (kids.size > 1) {
            item {
                LazyRow(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    items(kids, key = { it.id }) { kid ->
                        val selected = selectedKidId == kid.id
                        Row(
                            Modifier
                                .clip(RoundedCornerShape(50))
                                .background(if (selected) HeroGreen.copy(alpha = 0.14f) else MaterialTheme.colorScheme.surface)
                                .padding(end = 16.dp, top = 6.dp, bottom = 6.dp, start = 6.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            KidAvatar(kid.name, kid.avatarColor, size = 30.dp)
                            Spacer(Modifier.width(8.dp))
                            Text(
                                kid.name,
                                style = MaterialTheme.typography.titleSmall,
                                fontWeight = FontWeight.SemiBold,
                                color = if (selected) HeroGreen else MaterialTheme.colorScheme.onSurface,
                                modifier = Modifier.padding(
                                    top = 4.dp, bottom = 4.dp, end = 4.dp
                                )
                            )
                        }
                    }
                }
                Spacer(Modifier.height(16.dp))
            }
        }

        // Hero header card
        item {
            Box(
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(24.dp))
                    .background(Brush.linearGradient(listOf(HeroYellow, Color(0xFFF59E0B))))
                    .padding(20.dp)
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    ProgressRing(
                        progress = if (badges.isEmpty()) 0f else earned / badges.size.toFloat(),
                        size = 76.dp,
                        color = Color.White,
                        track = Color.White.copy(alpha = 0.3f)
                    ) {
                        Icon(Icons.Outlined.WorkspacePremium, contentDescription = null, tint = Color.White, modifier = Modifier.size(30.dp))
                    }
                    Spacer(Modifier.width(18.dp))
                    Column {
                        Text("$earned / ${badges.size} ${t(S.earned)}", color = Color.White, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                        Text("$kidName is a rising hero! Keep going to unlock more.", color = Color.White.copy(alpha = 0.95f), style = MaterialTheme.typography.bodyMedium)
                    }
                }
            }
            Spacer(Modifier.height(24.dp))
            Text("$kidName — ${t(S.heroBadges)}", style = MaterialTheme.typography.headlineSmall)
            Spacer(Modifier.height(12.dp))
        }

        // Badge grid (2 per row)
        item {
            val rows = badges.chunked(2)
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                rows.forEach { row ->
                    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        row.forEach { badge ->
                            BadgeCard(badge, Modifier.weight(1f))
                        }
                        if (row.size == 1) Spacer(Modifier.weight(1f))
                    }
                }
            }
            Spacer(Modifier.height(24.dp))
        }

        // Leaderboard
        item {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("Class leaderboard", style = MaterialTheme.typography.headlineSmall, modifier = Modifier.weight(1f))
                Box(
                    Modifier
                        .clip(RoundedCornerShape(50))
                        .background(MaterialTheme.colorScheme.secondaryContainer)
                        .padding(horizontal = 10.dp, vertical = 4.dp)
                ) {
                    Text("Anonymized", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSecondaryContainer, fontWeight = FontWeight.SemiBold)
                }
            }
            Spacer(Modifier.height(12.dp))
            HeroCard(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(vertical = 6.dp)) {
                    leaderboard.forEach { entry ->
                        LeaderRow(entry)
                    }
                }
            }
            Spacer(Modifier.height(12.dp))
        }
    }
}

@Composable
private fun BadgeCard(badge: Badge, modifier: Modifier = Modifier) {
    val accent = Color(badge.accent)
    HeroCard(
        modifier = modifier,
        background = if (badge.earned) MaterialTheme.colorScheme.surface else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
    ) {
        Column(
            Modifier.padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Box(contentAlignment = Alignment.Center) {
                Box(
                    Modifier
                        .size(64.dp)
                        .clip(CircleShape)
                        .background(if (badge.earned) accent.copy(alpha = 0.16f) else MaterialTheme.colorScheme.surfaceVariant),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        if (badge.earned) Icons.Outlined.EmojiEvents else Icons.Outlined.Lock,
                        contentDescription = null,
                        tint = if (badge.earned) accent else MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.size(30.dp)
                    )
                }
            }
            Spacer(Modifier.height(10.dp))
            Text(
                badge.title,
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.SemiBold,
                textAlign = TextAlign.Center,
                color = if (badge.earned) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(Modifier.height(4.dp))
            Text(
                badge.description,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center
            )
            Spacer(Modifier.height(10.dp))
            if (badge.earned) {
                Box(
                    Modifier
                        .clip(RoundedCornerShape(50))
                        .background(accent.copy(alpha = 0.14f))
                        .padding(horizontal = 12.dp, vertical = 4.dp)
                ) {
                    Text("Earned", style = MaterialTheme.typography.labelSmall, color = accent, fontWeight = FontWeight.Bold)
                }
            } else {
                Box(
                    Modifier
                        .fillMaxWidth()
                        .height(6.dp)
                        .clip(RoundedCornerShape(50))
                        .background(MaterialTheme.colorScheme.surfaceVariant)
                ) {
                    Box(
                        Modifier
                            .fillMaxWidth(badge.progress)
                            .height(6.dp)
                            .clip(RoundedCornerShape(50))
                            .background(accent)
                    )
                }
                Spacer(Modifier.height(4.dp))
                Text("${badge.currentCount}/${badge.targetCount}", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}

@Composable
private fun LeaderRow(entry: LeaderEntry) {
    val medal = when (entry.rank) {
        1 -> HeroYellow
        2 -> Color(0xFF94A3B8)
        3 -> Color(0xFFCD7F32)
        else -> MaterialTheme.colorScheme.onSurfaceVariant
    }
    Row(
        Modifier
            .fillMaxWidth()
            .background(if (entry.isYou) HeroGreen.copy(alpha = 0.08f) else Color.Transparent)
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            Modifier
                .size(30.dp)
                .clip(CircleShape)
                .background(medal.copy(alpha = 0.18f)),
            contentAlignment = Alignment.Center
        ) {
            Text("${entry.rank}", style = MaterialTheme.typography.labelLarge, color = medal, fontWeight = FontWeight.Bold)
        }
        Spacer(Modifier.width(14.dp))
        Text(
            entry.name,
            style = MaterialTheme.typography.titleSmall,
            fontWeight = if (entry.isYou) FontWeight.Bold else FontWeight.Medium,
            color = if (entry.isYou) HeroGreen else MaterialTheme.colorScheme.onSurface,
            modifier = Modifier.weight(1f)
        )
        Text("${entry.points} pts", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
    }
}
