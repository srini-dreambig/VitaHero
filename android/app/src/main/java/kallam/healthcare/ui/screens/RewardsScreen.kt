package kallam.healthcare.ui.screens

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
import androidx.compose.material3.Switch
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import kallam.healthcare.data.Badge
import kallam.healthcare.data.BadgeProgress
import kallam.healthcare.data.GuardianViewModel
import kallam.healthcare.data.Kid
import kallam.healthcare.data.LeaderEntry
import kallam.healthcare.data.S
import kallam.healthcare.ui.components.AppCard
import kallam.healthcare.ui.components.AppListRow
import kallam.healthcare.ui.components.AppScreenHeader
import kallam.healthcare.ui.components.AppSectionTitle
import kallam.healthcare.ui.components.KidAvatar
import kallam.healthcare.ui.components.ProgressRing
import kallam.healthcare.ui.components.StatusBarSpacer
import kallam.healthcare.ui.components.StatusPill
import kallam.healthcare.ui.components.Tone
import kallam.healthcare.ui.components.bottomBarClearance
import kallam.healthcare.ui.components.t
import kallam.healthcare.ui.components.tf
import kallam.healthcare.ui.theme.YellowLight
import kallam.healthcare.ui.theme.AppCorners
import kallam.healthcare.ui.theme.AppSpacing
import kallam.healthcare.ui.theme.FlagWatch
import kallam.healthcare.ui.theme.HeroYellow
import kallam.healthcare.ui.theme.InkFaint

@Composable
fun RewardsScreen(
    kids: List<Kid>,
    leaderboards: Map<String, List<LeaderEntry>>,
    onRefreshLeaderboard: (String) -> Unit,
    badgeData: (String) -> BadgeProgress,
    guardianViewModel: GuardianViewModel,
) {
    var selectedKidId by rememberSaveable { mutableStateOf(kids.firstOrNull()?.id.orEmpty()) }
    val heroes by guardianViewModel.hero.collectAsState()
    val nameConsents by guardianViewModel.heroNameConsent.collectAsState()
    LaunchedEffect(selectedKidId) {
        if (selectedKidId.isNotBlank()) {
            onRefreshLeaderboard(selectedKidId)
            guardianViewModel.loadHero(selectedKidId)
            guardianViewModel.loadHeroNameConsent(selectedKidId)
        }
    }
    LaunchedEffect(kids.map { it.id }) {
        if (selectedKidId.isBlank()) {
            selectedKidId = kids.firstOrNull()?.id.orEmpty()
        }
    }
    val active = kids.firstOrNull { it.id == selectedKidId }
    val progress = badgeData(selectedKidId)
    val badges = progress.badges
    val earned = badges.count { it.earned }
    val leaderboard = leaderboards[selectedKidId] ?: progress.leaderboard
    // Null when no child is selected, not the word "Hero".
    //
    // The fallback used to be the literal string "Hero", which reads as a
    // child's name and is not one: a guardian with no children linked was
    // shown "Hero — Hero Badges" and "Hero is a rising hero!", as though the
    // app knew a child it did not. The headings drop the name entirely in
    // that case rather than inventing one.
    val kidName = active?.name

    Column(
        Modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.background)
    ) {
        StatusBarSpacer()
        AppScreenHeader(t(S.heroBadges), subtitle = t(S.heroBadgesTitle))
        LazyColumn(
            modifier = Modifier.fillMaxWidth(),
            contentPadding = PaddingValues(start = AppSpacing.xl, end = AppSpacing.xl, top = AppSpacing.sm, bottom = bottomBarClearance())
        ) {
            // Kid selector
            if (kids.size > 1) {
                item {
                    // Kept custom: the kit has no avatar chip, and the avatar
                    // is how a guardian tells two children apart at a glance.
                    LazyRow(horizontalArrangement = Arrangement.spacedBy(AppSpacing.sm)) {
                        items(kids, key = { it.id }) { kid ->
                            val selected = selectedKidId == kid.id
                            Row(
                                Modifier
                                    .clip(RoundedCornerShape(50))
                                    .background(if (selected) MaterialTheme.colorScheme.primary.copy(alpha = 0.14f) else MaterialTheme.colorScheme.surface)
                                    .padding(end = AppSpacing.lg, top = 6.dp, bottom = 6.dp, start = 6.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                KidAvatar(kid.name, kid.avatarColor, size = 30.dp)
                                Spacer(Modifier.width(AppSpacing.sm))
                                Text(
                                    kid.name,
                                    style = MaterialTheme.typography.labelLarge,
                                    color = if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface,
                                    modifier = Modifier.padding(
                                        top = AppSpacing.xs, bottom = AppSpacing.xs, end = AppSpacing.xs
                                    ),
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis,
                                )
                            }
                        }
                    }
                    Spacer(Modifier.height(AppSpacing.lg))
                }
            }

            // Hero header card
            item {
                Box(
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(AppCorners.xlarge))
                        .background(YellowLight)
                        .padding(AppSpacing.xl)
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        ProgressRing(
                            progress = if (badges.isEmpty()) 0f else earned / badges.size.toFloat(),
                            size = 76.dp,
                            color = HeroYellow,
                            track = MaterialTheme.colorScheme.surface
                        ) {
                            Icon(Icons.Outlined.WorkspacePremium, contentDescription = null, tint = MaterialTheme.colorScheme.onSurface, modifier = Modifier.size(30.dp))
                        }
                        Spacer(Modifier.width(AppSpacing.lg))
                        Column {
                            Text("$earned / ${badges.size} ${t(S.earned)}", color = MaterialTheme.colorScheme.onSurface, style = MaterialTheme.typography.headlineSmall)
                            if (kidName != null) {
                                Text(tf(S.risingHero, kidName), color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
                            }
                        }
                    }
                }
                Spacer(Modifier.height(AppSpacing.xxl))
                AppSectionTitle(if (kidName != null) tf(S.kidBadges, kidName) else t(S.badges))
                Spacer(Modifier.height(AppSpacing.md))
            }

            // D3 — this month's VitaHero, and the question behind the name.
            //
            // The name shown is whatever the server sent: a first name where that
            // child's guardian agreed, "A pupil in Class 5" where they did not.
            // This screen cannot show a name it was not given, which is the point
            // of resolving it there rather than here.
            item {
                val hero = heroes[selectedKidId]
                if (hero != null) {
                    AppCard {
                        Text(
                            t(S.heroOfMonthTitle),
                            style = MaterialTheme.typography.labelLarge,
                            color = MaterialTheme.colorScheme.primary,
                        )
                        Spacer(Modifier.height(AppSpacing.xs))
                        Text(
                            hero.displayName,
                            style = MaterialTheme.typography.titleLarge,
                        )
                        if (hero.achievement.isNotBlank()) {
                            Spacer(Modifier.height(AppSpacing.xxs))
                            Text(
                                hero.achievement,
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                        Spacer(Modifier.height(AppSpacing.sm))
                        Text(hero.story, style = MaterialTheme.typography.bodyMedium)
                    }
                    Spacer(Modifier.height(AppSpacing.md))
                }

                // Asked once per child, and revocable at any time. Deliberately
                // not a precondition of anything: a child can be chosen either
                // way, and saying no only changes whether their name appears.
                val consent = nameConsents[selectedKidId]
                if (consent != null && selectedKidId.isNotBlank()) {
                    AppCard {
                        Text(
                            t(S.heroNameAskTitle),
                            style = MaterialTheme.typography.titleMedium,
                        )
                        Spacer(Modifier.height(AppSpacing.xs))
                        Text(
                            t(S.heroNameAskBody),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Spacer(Modifier.height(AppSpacing.md))
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Switch(
                                checked = consent.granted,
                                onCheckedChange = { on ->
                                    guardianViewModel.setHeroNameConsent(selectedKidId, on)
                                },
                            )
                            Spacer(Modifier.width(AppSpacing.sm))
                            Text(
                                if (consent.granted) t(S.heroNameYes) else t(S.heroNameNo),
                                style = MaterialTheme.typography.bodyMedium,
                            )
                        }
                    }
                    Spacer(Modifier.height(AppSpacing.md))
                }
            }

            // Badge grid (2 per row)
            item {
                // Empty is a real state, the same way it is for the leaderboard.
                // Badges are kept on the server so they survive a reinstall, which
                // also means a phone that cannot reach it has nothing to show —
                // and an invented set drawn from this handset is the thing that
                // change was made to stop.
                if (badges.isEmpty()) {
                    EmptyCard(t(S.badgesEmpty), t(S.badgesEmptySub))
                } else {
                    val rows = badges.chunked(2)
                    Column(verticalArrangement = Arrangement.spacedBy(AppSpacing.md)) {
                        rows.forEach { row ->
                            Row(horizontalArrangement = Arrangement.spacedBy(AppSpacing.md)) {
                                row.forEach { badge ->
                                    BadgeCard(badge, Modifier.weight(1f))
                                }
                                if (row.size == 1) Spacer(Modifier.weight(1f))
                            }
                        }
                    }
                }
                Spacer(Modifier.height(AppSpacing.xxl))
            }

            // Leaderboard
            item {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    AppSectionTitle(t(S.classLeaderboard), modifier = Modifier.weight(1f))
                    StatusPill(t(S.anonymized), Tone.Info)
                }
                Spacer(Modifier.height(AppSpacing.md))
                // Empty is a real state now. It used to be filled with one
                // invented entry scoring 1500 against nobody.
                if (leaderboard.isEmpty()) {
                    EmptyCard(t(S.leaderboardEmpty), t(S.leaderboardEmptySub))
                } else {
                    Column(verticalArrangement = Arrangement.spacedBy(AppSpacing.sm)) {
                        leaderboard.forEach { entry -> LeaderRow(entry) }
                    }
                }
                Spacer(Modifier.height(AppSpacing.md))
            }
        }
    }
}

/** Centred title + explanation for an empty list; the kit has no empty-state card. */
@Composable
private fun EmptyCard(title: String, body: String) {
    AppCard {
        Column(
            Modifier.fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text(title, style = MaterialTheme.typography.titleMedium)
            Spacer(Modifier.height(AppSpacing.xs))
            Text(
                body,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
            )
        }
    }
}

@Composable
private fun BadgeCard(badge: Badge, modifier: Modifier = Modifier) {
    // Each badge carries its own accent from the server, so the earned pill
    // and progress bar are drawn here rather than with a fixed-tone StatusPill.
    val accent = Color(badge.accent)
    AppCard(
        modifier = modifier,
        background = if (badge.earned) MaterialTheme.colorScheme.surface else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
    ) {
        Column(
            Modifier.fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
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
            Spacer(Modifier.height(AppSpacing.sm))
            Text(
                t(badge.titleKey),
                style = MaterialTheme.typography.titleMedium,
                textAlign = TextAlign.Center,
                color = if (badge.earned) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(Modifier.height(AppSpacing.xs))
            Text(
                t(badge.descriptionKey),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center
            )
            Spacer(Modifier.height(AppSpacing.sm))
            if (badge.earned) {
                Box(
                    Modifier
                        .clip(RoundedCornerShape(50))
                        .background(accent.copy(alpha = 0.14f))
                        .padding(horizontal = AppSpacing.md, vertical = AppSpacing.xs)
                ) {
                    Text(t(S.earned), style = MaterialTheme.typography.labelMedium, color = accent)
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
                Spacer(Modifier.height(AppSpacing.xs))
                Text("${badge.currentCount}/${badge.targetCount}", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}

private val Bronze = Color(0xFFCD7F32)

@Composable
private fun LeaderRow(entry: LeaderEntry) {
    val medal = when (entry.rank) {
        1 -> HeroYellow
        2 -> InkFaint
        3 -> Bronze
        else -> MaterialTheme.colorScheme.onSurfaceVariant
    }
    AppListRow(
        title = entry.name,
        leading = {
            Box(
                Modifier
                    .size(30.dp)
                    .clip(CircleShape)
                    .background(medal.copy(alpha = 0.18f)),
                contentAlignment = Alignment.Center
            ) {
                Text("${entry.rank}", style = MaterialTheme.typography.labelLarge, color = medal)
            }
        },
        // The guardian's own child used to be marked by an orange name and
        // row tint; AppListRow has neither, so the points pill carries it.
        trailing = {
            StatusPill("${entry.points} ${t(S.points)}", if (entry.isYou) Tone.Brand else Tone.Neutral)
        },
    )
}
