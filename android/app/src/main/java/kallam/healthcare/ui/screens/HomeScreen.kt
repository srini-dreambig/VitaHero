package kallam.healthcare.ui.screens

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
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowForward
import androidx.compose.material.icons.outlined.CalendarMonth
import androidx.compose.material.icons.outlined.MedicalServices
import androidx.compose.material.icons.outlined.Notifications
import androidx.compose.material.icons.outlined.Restaurant
import androidx.compose.material.icons.outlined.WorkspacePremium
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import kallam.healthcare.data.AppLocale
import kallam.healthcare.data.Appointment
import kallam.healthcare.data.Camp
import kallam.healthcare.data.Kid
import kallam.healthcare.data.HealthFlag
import kallam.healthcare.data.LocalAppLocale
import kallam.healthcare.data.S
import kallam.healthcare.ui.components.Illustration
import kallam.healthcare.ui.components.Scene
import kallam.healthcare.ui.components.AppCard
import kallam.healthcare.ui.components.AppListRow
import kallam.healthcare.ui.components.AppScreenHeader
import kallam.healthcare.ui.components.AppSectionTitle
import kallam.healthcare.ui.components.IconBubble
import kallam.healthcare.ui.components.InfoNote
import kallam.healthcare.ui.components.KidAvatar
import kallam.healthcare.ui.components.ProgressRing
import kallam.healthcare.ui.components.StatTile
import kallam.healthcare.ui.components.StatusBarSpacer
import kallam.healthcare.ui.components.Tone
import kallam.healthcare.ui.components.bottomBarClearance
import kallam.healthcare.ui.components.t
import kallam.healthcare.ui.components.tf
import kallam.healthcare.ui.theme.AppCorners
import kallam.healthcare.ui.theme.AppSpacing
import kallam.healthcare.ui.theme.AppTheme
import kallam.healthcare.ui.theme.HeroBlue
import kallam.healthcare.ui.theme.FlagNeutral
import kallam.healthcare.ui.theme.HeroPurple
import kallam.healthcare.ui.theme.HeroYellow

@Composable
fun HomeScreen(
    parentName: String,
    kids: List<Kid>,
    camps: List<Camp>,
    appointments: List<Appointment>,
    unreadCount: Int,
    onOpenKid: (String) -> Unit,
    onOpenNotifications: () -> Unit,
    onOpenCamps: () -> Unit,
    onOpenDiet: (String) -> Unit,
    onOpenRewards: () -> Unit,
    onBookAppointment: () -> Unit
) {
    val nextCamp = camps.firstOrNull { it.status.isUpcoming }

    LazyColumn(
        modifier = Modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.background),
        contentPadding = PaddingValues(bottom = bottomBarClearance())
    ) {
        item {
            StatusBarSpacer()
            AppScreenHeader(
                title = tf(S.hiName, parentName),
                actions = {
                    Box {
                        Box(
                            Modifier
                                .size(46.dp)
                                .clip(CircleShape)
                                .background(MaterialTheme.colorScheme.surface)
                                .clickable(onClick = onOpenNotifications),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(Icons.Outlined.Notifications, contentDescription = "Notifications", tint = MaterialTheme.colorScheme.onSurface)
                        }
                        if (unreadCount > 0) {
                            Box(
                                Modifier
                                    .align(Alignment.TopEnd)
                                    .padding(AppSpacing.xs)
                                    .size(16.dp)
                                    .clip(CircleShape)
                                    .background(MaterialTheme.colorScheme.error),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    "$unreadCount",
                                    color = MaterialTheme.colorScheme.onError,
                                    style = MaterialTheme.typography.labelSmall
                                )
                            }
                        }
                    }
                }
            )
        }

        // Kid stat cards. One child fills the width; several scroll as a row
        // of fixed-width cards, so a lone card never floats at half width.
        item {
            Spacer(Modifier.height(AppSpacing.xs))
            AppSectionTitle(
                t(S.yourKids),
                modifier = Modifier.padding(horizontal = AppSpacing.xl)
            )
            Spacer(Modifier.height(AppSpacing.md))
            if (kids.isEmpty()) {
                InfoNote(
                    "Add your child from the Children tab to see their growth and diet plan here.",
                    Modifier.padding(horizontal = AppSpacing.xl)
                )
            } else if (kids.size == 1) {
                val kid = kids.first()
                KidStatCard(kid, Modifier.padding(horizontal = AppSpacing.xl)) { onOpenKid(kid.id) }
            } else {
                LazyRow(
                    contentPadding = PaddingValues(horizontal = AppSpacing.xl),
                    horizontalArrangement = Arrangement.spacedBy(AppSpacing.md)
                ) {
                    items(kids, key = { it.id }) { kid ->
                        KidStatCard(kid, Modifier.width(280.dp)) { onOpenKid(kid.id) }
                    }
                }
            }
        }

        // Quick actions
        item {
            Spacer(Modifier.height(AppSpacing.xxl))
            Row(
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = AppSpacing.xl),
                horizontalArrangement = Arrangement.spacedBy(AppSpacing.md)
            ) {
                QuickAction(t(S.dietPlan), Icons.Outlined.Restaurant, MaterialTheme.colorScheme.primary, Modifier.weight(1f)) {
                    kids.firstOrNull()?.let { onOpenDiet(it.id) }
                }
                QuickAction(t(S.bookVisit), Icons.Outlined.MedicalServices, MaterialTheme.colorScheme.secondary, Modifier.weight(1f), onClick = onBookAppointment)
                QuickAction(t(S.badges), Icons.Outlined.WorkspacePremium, HeroYellow, Modifier.weight(1f), onClick = onOpenRewards)
            }
        }

        // Next camp banner
        if (nextCamp != null) {
            item {
                Spacer(Modifier.height(AppSpacing.xxl))
                AppSectionTitle(
                    t(S.upcomingCamp),
                    modifier = Modifier.padding(horizontal = AppSpacing.xl),
                    actionLabel = t(S.allCamps),
                    onAction = onOpenCamps
                )
                Spacer(Modifier.height(AppSpacing.md))
                CampBanner(nextCamp, Modifier.padding(horizontal = AppSpacing.xl), onOpenCamps)
            }
        }

        // Appointments
        if (appointments.isNotEmpty()) {
            item {
                Spacer(Modifier.height(AppSpacing.xxl))
                AppSectionTitle(
                    t(S.upcomingAppts),
                    modifier = Modifier.padding(horizontal = AppSpacing.xl)
                )
                Spacer(Modifier.height(AppSpacing.sm))
            }
            items(appointments, key = { it.id }) { appt ->
                AppointmentRow(appt, Modifier.padding(horizontal = AppSpacing.xl, vertical = 6.dp))
            }
        }
    }
}

@Composable
private fun KidStatCard(kid: Kid, modifier: Modifier = Modifier, onClick: () -> Unit) {
    AppCard(modifier = modifier, onClick = onClick) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            KidAvatar(kid.name, kid.avatarColor, size = 44.dp)
            Spacer(Modifier.width(AppSpacing.md))
            Column(Modifier.weight(1f)) {
                Text(
                    kid.name,
                    style = MaterialTheme.typography.titleMedium,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    "${kid.age} yrs · ${kid.grade}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
        Spacer(Modifier.height(AppSpacing.lg))
        // A child nobody has examined has no health score. The column
        // defaults to 80, which used to render here as a confident "80%,
        // doing well" for a child who had never been screened — the most
        // prominent number in the app, and invented.
        val screened = kid.dental != HealthFlag.NOT_MEASURED ||
            kid.eyesight != HealthFlag.NOT_MEASURED ||
            kid.nutrition != HealthFlag.NOT_MEASURED
        Row(verticalAlignment = Alignment.CenterVertically) {
            ProgressRing(
                progress = if (screened) kid.overallScore / 100f else 0f,
                size = 58.dp,
                color = if (screened) Color(kid.avatarColor) else FlagNeutral
            ) {
                // The score is a bold value inside the ring, not a heading.
                Text(
                    if (screened) "${kid.overallScore}%" else "—",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold
                )
            }
            Spacer(Modifier.width(AppSpacing.md))
            StatTile(
                label = t(S.healthScore),
                value = when {
                    !screened -> t(S.notScreenedYet)
                    kid.overallScore >= 85 -> t(S.growthOnTrack)
                    else -> t(S.doingWell)
                },
                modifier = Modifier.weight(1f),
                tone = if (screened) Tone.Good else Tone.Neutral
            )
        }
    }
}

@Composable
private fun QuickAction(
    label: String,
    icon: ImageVector,
    tint: Color,
    modifier: Modifier = Modifier,
    onClick: () -> Unit
) {
    AppCard(
        modifier = modifier,
        onClick = onClick,
        contentPadding = PaddingValues(horizontal = AppSpacing.xs, vertical = AppSpacing.lg)
    ) {
        Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
            IconBubble(icon, tint, size = 44.dp)
            Spacer(Modifier.height(AppSpacing.sm))
            Text(label, style = MaterialTheme.typography.labelLarge, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
    }
}

@Composable
private fun CampBanner(camp: Camp, modifier: Modifier = Modifier, onClick: () -> Unit) {
    Box(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(AppCorners.xlarge))
            .background(MaterialTheme.colorScheme.secondaryContainer)
            .clickable(onClick = onClick)
            .padding(AppSpacing.xl)
    ) {
        Illustration(Scene.Banner, Modifier.align(Alignment.TopEnd).size(76.dp))
        Column(Modifier.padding(end = 64.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    Modifier
                        .clip(RoundedCornerShape(50))
                        .background(MaterialTheme.colorScheme.surface)
                        .padding(horizontal = 10.dp, vertical = AppSpacing.xs)
                ) {
                    Text(t(S.upcoming).uppercase(), color = MaterialTheme.colorScheme.onSurface, style = MaterialTheme.typography.labelMedium)
                }
            }
            Spacer(Modifier.height(AppSpacing.md))
            Text(camp.title, color = MaterialTheme.colorScheme.onSurface, style = MaterialTheme.typography.titleLarge,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
            Spacer(Modifier.height(AppSpacing.xs))
            Text("${camp.date} · ${camp.time}", color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
            Spacer(Modifier.height(AppSpacing.md))
            Row(
                Modifier
                    .clip(RoundedCornerShape(AppCorners.medium))
                    .background(Color.White)
                    .padding(horizontal = AppSpacing.lg, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(t(S.viewDetails), color = HeroBlue, style = MaterialTheme.typography.labelLarge)
                Spacer(Modifier.width(AppSpacing.xs))
                Icon(Icons.AutoMirrored.Outlined.ArrowForward, contentDescription = null, tint = HeroBlue, modifier = Modifier.size(18.dp))
            }
        }
    }
}

@Composable
private fun AppointmentRow(appt: Appointment, modifier: Modifier = Modifier) {
    AppListRow(
        title = appt.doctorName,
        modifier = modifier,
        subtitle = "${appt.specialty} · for ${appt.kidName}",
        leading = { IconBubble(Icons.Outlined.CalendarMonth, MaterialTheme.colorScheme.secondary) },
        trailing = {
            Column(horizontalAlignment = Alignment.End) {
                Text(appt.date, style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.secondary)
                Text(appt.time, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    )
}

@Preview(showBackground = true)
@Composable
private fun HomeScreenPreview() {
    androidx.compose.runtime.CompositionLocalProvider(LocalAppLocale provides AppLocale.ENGLISH) {
        AppTheme {
            HomeScreen(
                parentName = "Priya",
                kids = emptyList(),
                camps = emptyList(),
                appointments = emptyList(),
                unreadCount = 2,
                onOpenKid = {},
                onOpenNotifications = {},
                onOpenCamps = {},
                onOpenDiet = {},
                onOpenRewards = {},
                onBookAppointment = {}
            )
        }
    }
}
