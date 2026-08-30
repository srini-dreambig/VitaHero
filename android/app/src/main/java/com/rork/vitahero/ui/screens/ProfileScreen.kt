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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.HelpOutline
import androidx.compose.material.icons.automirrored.outlined.MenuBook
import androidx.compose.material.icons.automirrored.outlined.ArrowForwardIos
import androidx.compose.material.icons.automirrored.outlined.Logout
import androidx.compose.material.icons.outlined.ChildCare
import androidx.compose.material.icons.outlined.DarkMode
import androidx.compose.material.icons.outlined.Language
import androidx.compose.material.icons.outlined.LocalHospital
import androidx.compose.material.icons.outlined.MedicalServices
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material.icons.outlined.Notifications
import androidx.compose.material.icons.outlined.People
import androidx.compose.material.icons.outlined.SupportAgent
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.rork.vitahero.data.AppLocale
import com.rork.vitahero.data.Kid
import com.rork.vitahero.data.LocalAppLocale
import com.rork.vitahero.data.S
import com.rork.vitahero.ui.components.HeroCard
import com.rork.vitahero.ui.components.IconBubble
import com.rork.vitahero.ui.components.KidAvatar
import com.rork.vitahero.ui.components.StatusBarSpacer
import com.rork.vitahero.ui.components.bottomBarClearance
import com.rork.vitahero.ui.components.t
import com.rork.vitahero.ui.theme.AppTheme
import com.rork.vitahero.ui.theme.HeroBlue
import com.rork.vitahero.ui.theme.HeroOrange
import com.rork.vitahero.ui.theme.HeroPurple
import android.content.Intent
import android.net.Uri

@Composable
fun ProfileScreen(
    parentName: String,
    phone: String,
    kids: List<Kid>,
    darkTheme: Boolean,
    currentLocale: AppLocale,
    notificationsEnabled: Boolean,
    campRemindersEnabled: Boolean,
    onToggleDarkTheme: () -> Unit,
    onToggleNotifications: () -> Unit,
    onToggleCampReminders: () -> Unit,
    onSelectLocale: (AppLocale) -> Unit,
    onOpenFamilySharing: () -> Unit,
    onOpenHospitals: () -> Unit = {},
    onOpenReferrals: () -> Unit = {},
    onOpenQuestions: () -> Unit = {},
    onOpenLibrary: () -> Unit = {},
    onOpenRecord: () -> Unit = {},
    onLogout: () -> Unit
) {
    val context = LocalContext.current

    LazyColumn(
        modifier = Modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.background),
        contentPadding = PaddingValues(start = 20.dp, end = 20.dp, bottom = bottomBarClearance())
    ) {
        item {
            StatusBarSpacer()
            Spacer(Modifier.height(8.dp))
            // Parent header
            HeroCard(Modifier.fillMaxWidth(), border = false) {
                Column(Modifier.padding(20.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            Modifier
                                .size(64.dp)
                                .clip(CircleShape)
                                .background(Brush.linearGradient(listOf(HeroOrange, HeroBlue))),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(parentName.take(1).uppercase(), color = Color.White, style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                            )
                        }
                        Spacer(Modifier.width(16.dp))
                        Column {
                            Text(parentName, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                            )
                            Text(
                                if (phone.isNotBlank()) "+91 $phone" else t(S.phonePlaceholder),
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                }
            }
            Spacer(Modifier.height(20.dp))
            Text(t(S.linkedChildren), style = MaterialTheme.typography.headlineSmall)
            Spacer(Modifier.height(12.dp))
            HeroCard(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(vertical = 6.dp)) {
                    kids.forEach { kid ->
                        Row(
                            Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 16.dp, vertical = 10.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            KidAvatar(kid.name, kid.avatarColor, size = 40.dp)
                            Spacer(Modifier.width(14.dp))
                            Column(Modifier.weight(1f)) {
                                Text(kid.name, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis,
                                )
                                Text("${kid.age} yrs · ${kid.grade}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis,
                                )
                            }
                        }
                    }
                }
            }
            Spacer(Modifier.height(20.dp))

            // Appearance section
            Text(t(S.appearance), style = MaterialTheme.typography.headlineSmall)
            Spacer(Modifier.height(12.dp))
            HeroCard(Modifier.fillMaxWidth()) {
                Column {
                    ToggleRow(
                        icon = Icons.Outlined.DarkMode, tint = HeroPurple,
                        title = t(S.darkMode), subtitle = t(S.darkModeSub),
                        checked = darkTheme, onCheckedChange = { onToggleDarkTheme() }
                    )
                    Box(
                        Modifier
                            .fillMaxWidth()
                            .clickable {
                                val next = when (currentLocale) {
                                    AppLocale.ENGLISH -> AppLocale.HINDI
                                    AppLocale.HINDI -> AppLocale.TELUGU
                                    AppLocale.TELUGU -> AppLocale.ENGLISH
                                }
                                onSelectLocale(next)
                            }
                            .padding(horizontal = 16.dp, vertical = 10.dp)
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            IconBubble(Icons.Outlined.Language, HeroBlue, size = 40.dp)
                            Spacer(Modifier.width(14.dp))
                            Column(Modifier.weight(1f)) {
                                Text(t(S.language), style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                                Text(
                                    "${currentLocale.label} — Tap to change",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                            Icon(Icons.AutoMirrored.Outlined.ArrowForwardIos, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(14.dp))
                        }
                    }
                }
            }

            Spacer(Modifier.height(20.dp))
            Text(t(S.notifications), style = MaterialTheme.typography.headlineSmall)
            Spacer(Modifier.height(12.dp))
            HeroCard(Modifier.fillMaxWidth()) {
                Column {
                    ToggleRow(Icons.Outlined.Notifications, HeroBlue, t(S.pushNotif), t(S.notifSubtitle), notificationsEnabled) { onToggleNotifications() }
                    ToggleRow(Icons.Outlined.ChildCare, HeroOrange, t(S.campReminders), t(S.campReminderSub), campRemindersEnabled) { onToggleCampReminders() }
                }
            }
            Spacer(Modifier.height(20.dp))
            Text(t(S.more), style = MaterialTheme.typography.headlineSmall)
            Spacer(Modifier.height(12.dp))
            HeroCard(Modifier.fillMaxWidth()) {
                Column {
                    // The school pathway, in the order a parent meets it.
                    LinkRow(
                        Icons.Outlined.MedicalServices, HeroOrange, t(S.referralsTitle),
                        t(S.referralsSub), onClick = onOpenReferrals
                    )
                    LinkRow(
                        Icons.AutoMirrored.Outlined.HelpOutline, HeroBlue, t(S.questionsTitle),
                        t(S.questionsSub), onClick = onOpenQuestions
                    )
                    LinkRow(
                        Icons.AutoMirrored.Outlined.MenuBook, HeroPurple, t(S.libraryTitle),
                        t(S.librarySub), onClick = onOpenLibrary
                    )
                    LinkRow(
                        Icons.Outlined.LocalHospital, HeroPurple, t(S.linkedHospitals),
                        t(S.linkedHospitalsSub),
                        onClick = onOpenHospitals
                    )
                    Box(
                        Modifier
                            .fillMaxWidth()
                            .clickable(onClick = onOpenFamilySharing)
                            .padding(horizontal = 16.dp, vertical = 12.dp)
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            IconBubble(Icons.Outlined.People, HeroOrange, size = 40.dp)
                            Spacer(Modifier.width(14.dp))
                            Column(Modifier.weight(1f)) {
                                Text(t(S.familySharing), style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                                Text(t(S.inviteCoParent), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                            Icon(Icons.AutoMirrored.Outlined.ArrowForwardIos, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(14.dp))
                        }
                    }
                    // Was a link to a web privacy page. A parent asking this
                    // question wants to act on their own child's record, not
                    // read a policy, so it opens the record itself.
                    LinkRow(
                        Icons.Outlined.Lock, HeroBlue, t(S.privacyTitle), t(S.privacySub),
                        onClick = onOpenRecord
                    )
                    LinkRow(
                        Icons.Outlined.SupportAgent, Color(0xFFF59E0B), t(S.helpSupport), t(S.helpSupportSub),
                        onClick = {
                            context.startActivity(Intent(Intent.ACTION_SENDTO, Uri.parse("mailto:support@kidhero.rork.app")))
                        }
                    )
                }
            }
            Spacer(Modifier.height(20.dp))
            Row(
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(16.dp))
                    .background(MaterialTheme.colorScheme.error.copy(alpha = 0.1f))
                    .clickable(onClick = onLogout)
                    .padding(16.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.Center
            ) {
                Icon(Icons.AutoMirrored.Outlined.Logout, contentDescription = null, tint = MaterialTheme.colorScheme.error, modifier = Modifier.size(20.dp))
                Spacer(Modifier.width(8.dp))
                Text(t(S.logout), color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
            }
            Spacer(Modifier.height(16.dp))
            Text(
                "VitaHero v1.0 · For informational purposes only.\nAlways consult a doctor for medical advice.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.fillMaxWidth(),
                fontWeight = FontWeight.Normal
            )
        }
    }
}

@Composable
private fun ToggleRow(icon: ImageVector, tint: Color, title: String, subtitle: String, checked: Boolean, onCheckedChange: (Boolean) -> Unit) {
    Row(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        IconBubble(icon, tint, size = 40.dp)
        Spacer(Modifier.width(14.dp))
        Column(Modifier.weight(1f)) {
            Text(title, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
            Text(subtitle, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        Switch(
            checked = checked,
            onCheckedChange = onCheckedChange,
            colors = SwitchDefaults.colors(checkedTrackColor = HeroOrange)
        )
    }
}

@Composable
private fun LinkRow(icon: ImageVector, tint: Color, title: String, subtitle: String, onClick: () -> Unit = {}) {
    Row(
        Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        IconBubble(icon, tint, size = 40.dp)
        Spacer(Modifier.width(14.dp))
        Column(Modifier.weight(1f)) {
            Text(title, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
            Text(subtitle, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        Icon(Icons.AutoMirrored.Outlined.ArrowForwardIos, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(14.dp))
    }
}

@Preview(showBackground = true)
@Composable
private fun ProfileScreenPreview() {
    androidx.compose.runtime.CompositionLocalProvider(LocalAppLocale provides AppLocale.ENGLISH) {
        AppTheme {
            ProfileScreen(
                parentName = "Priya Sharma",
                phone = "",
                kids = emptyList(),
                darkTheme = false,
                currentLocale = AppLocale.ENGLISH,
                notificationsEnabled = true,
                campRemindersEnabled = true,
                onToggleDarkTheme = {},
                onToggleNotifications = {},
                onToggleCampReminders = {},
                onSelectLocale = {},
                onOpenFamilySharing = {},
                onOpenHospitals = {},
                onLogout = {}
            )
        }
    }
}
