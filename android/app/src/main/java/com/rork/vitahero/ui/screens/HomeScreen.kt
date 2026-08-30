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
import com.rork.vitahero.data.AppLocale
import com.rork.vitahero.data.Appointment
import com.rork.vitahero.data.Camp
import com.rork.vitahero.data.CampStatus
import com.rork.vitahero.data.Kid
import com.rork.vitahero.data.HealthFlag
import com.rork.vitahero.data.LocalAppLocale
import com.rork.vitahero.data.S
import com.rork.vitahero.ui.components.HeroCard
import com.rork.vitahero.ui.components.KidAvatar
import com.rork.vitahero.ui.components.ProgressRing
import com.rork.vitahero.ui.components.SectionHeader
import com.rork.vitahero.ui.components.StatusBarSpacer
import com.rork.vitahero.ui.components.bottomBarClearance
import com.rork.vitahero.ui.components.t
import com.rork.vitahero.ui.components.tf
import com.rork.vitahero.ui.theme.AppTheme
import com.rork.vitahero.ui.theme.HeroBlue
import com.rork.vitahero.ui.theme.FlagNeutral
import com.rork.vitahero.ui.theme.HeroOrange
import com.rork.vitahero.ui.theme.HeroPurple
import com.rork.vitahero.ui.theme.HeroYellow

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
    val nextCamp = camps.firstOrNull { it.status == CampStatus.UPCOMING }

    LazyColumn(
        modifier = Modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.background),
        contentPadding = PaddingValues(bottom = bottomBarClearance())
    ) {
        item {
            StatusBarSpacer()
            Row(
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(Modifier.weight(1f)) {
                    Text(
                        t(S.goodMorning),
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Text(
                        tf(S.hiName, parentName),
                        style = MaterialTheme.typography.headlineMedium,
                        fontWeight = FontWeight.Bold
                    )
                }
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
                                .padding(4.dp)
                                .size(16.dp)
                                .clip(CircleShape)
                                .background(MaterialTheme.colorScheme.error),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                "$unreadCount",
                                color = Color.White,
                                style = MaterialTheme.typography.labelSmall,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }
            }
        }

        // Kid stat cards
        item {
            Spacer(Modifier.height(4.dp))
            SectionHeader(
                t(S.yourKids),
                modifier = Modifier.padding(horizontal = 20.dp)
            )
            Spacer(Modifier.height(12.dp))
            LazyRow(
                contentPadding = PaddingValues(horizontal = 20.dp),
                horizontalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                items(kids, key = { it.id }) { kid ->
                    KidStatCard(kid) { onOpenKid(kid.id) }
                }
            }
        }

        // Quick actions
        item {
            Spacer(Modifier.height(24.dp))
            Row(
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                QuickAction(t(S.dietPlan), Icons.Outlined.Restaurant, HeroOrange, Modifier.weight(1f)) {
                    kids.firstOrNull()?.let { onOpenDiet(it.id) }
                }
                QuickAction(t(S.bookVisit), Icons.Outlined.MedicalServices, HeroBlue, Modifier.weight(1f), onClick = onBookAppointment)
                QuickAction(t(S.badges), Icons.Outlined.WorkspacePremium, HeroYellow, Modifier.weight(1f), onClick = onOpenRewards)
            }
        }

        // Next camp banner
        if (nextCamp != null) {
            item {
                Spacer(Modifier.height(24.dp))
                SectionHeader(
                    t(S.upcomingCamp),
                    modifier = Modifier.padding(horizontal = 20.dp),
                    actionLabel = t(S.allCamps),
                    onAction = onOpenCamps
                )
                Spacer(Modifier.height(12.dp))
                CampBanner(nextCamp, Modifier.padding(horizontal = 20.dp), onOpenCamps)
            }
        }

        // Appointments
        if (appointments.isNotEmpty()) {
            item {
                Spacer(Modifier.height(24.dp))
                SectionHeader(
                    t(S.upcomingAppts),
                    modifier = Modifier.padding(horizontal = 20.dp)
                )
                Spacer(Modifier.height(12.dp))
            }
            items(appointments, key = { it.id }) { appt ->
                AppointmentRow(appt, Modifier.padding(horizontal = 20.dp, vertical = 6.dp))
            }
        }
    }
}

@Composable
private fun KidStatCard(kid: Kid, onClick: () -> Unit) {
    HeroCard(
        modifier = Modifier
            .width(220.dp)
            .clickable(onClick = onClick),
        border = false,
        background = MaterialTheme.colorScheme.surface
    ) {
        Column(Modifier.padding(18.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                KidAvatar(kid.name, kid.avatarColor, size = 44.dp)
                Spacer(Modifier.width(12.dp))
                Column {
                    Text(kid.name, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold,
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
            Spacer(Modifier.height(16.dp))
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
                    Text(
                        if (screened) "${kid.overallScore}%" else "\u2014",
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Bold
                    )
                }
                Spacer(Modifier.width(14.dp))
                Column {
                    Text(
                        t(S.healthScore),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Text(
                        when {
                            !screened -> t(S.notScreenedYet)
                            kid.overallScore >= 85 -> t(S.growthOnTrack)
                            else -> t(S.doingWell)
                        },
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.SemiBold,
                        color = if (screened) Color(kid.avatarColor) else MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis
                    )
                }
            }
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
    HeroCard(modifier = modifier.clickable(onClick = onClick)) {
        Column(
            Modifier.padding(vertical = 16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            com.rork.vitahero.ui.components.IconBubble(icon, tint, size = 44.dp)
            Spacer(Modifier.height(10.dp))
            Text(label, style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.SemiBold)
        }
    }
}

@Composable
private fun CampBanner(camp: Camp, modifier: Modifier = Modifier, onClick: () -> Unit) {
    Box(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(24.dp))
            .background(Brush.linearGradient(listOf(HeroBlue, HeroPurple)))
            .clickable(onClick = onClick)
            .padding(20.dp)
    ) {
        Column {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    Modifier
                        .clip(RoundedCornerShape(50))
                        .background(Color.White.copy(alpha = 0.2f))
                        .padding(horizontal = 10.dp, vertical = 4.dp)
                ) {
                    Text(t(S.upcoming).uppercase(), color = Color.White, style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Bold)
                }
            }
            Spacer(Modifier.height(12.dp))
            Text(camp.title, color = Color.White, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
            Spacer(Modifier.height(4.dp))
            Text("${camp.date} · ${camp.time}", color = Color.White.copy(alpha = 0.9f), style = MaterialTheme.typography.bodyMedium)
            Spacer(Modifier.height(14.dp))
            Row(
                Modifier
                    .clip(RoundedCornerShape(12.dp))
                    .background(Color.White)
                    .padding(horizontal = 16.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(t(S.viewDetails), color = HeroBlue, style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.SemiBold)
                Spacer(Modifier.width(6.dp))
                Icon(Icons.AutoMirrored.Outlined.ArrowForward, contentDescription = null, tint = HeroBlue, modifier = Modifier.size(18.dp))
            }
        }
    }
}

@Composable
private fun AppointmentRow(appt: Appointment, modifier: Modifier = Modifier) {
    HeroCard(modifier = modifier.fillMaxWidth()) {
        Row(
            Modifier.padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            com.rork.vitahero.ui.components.IconBubble(Icons.Outlined.CalendarMonth, HeroBlue)
            Spacer(Modifier.width(14.dp))
            Column(Modifier.weight(1f)) {
                Text(appt.doctorName, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    "${appt.specialty} · for ${appt.kidName}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            Column(horizontalAlignment = Alignment.End) {
                Text(appt.date, style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.SemiBold, color = HeroBlue)
                Text(appt.time, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
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
