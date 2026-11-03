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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import kallam.healthcare.data.AppLocale
import kallam.healthcare.data.Kid
import kallam.healthcare.data.LocalAppLocale
import kallam.healthcare.data.S
import kallam.healthcare.ui.components.AppCard
import kallam.healthcare.ui.components.AppSectionTitle
import kallam.healthcare.ui.components.IconBubble
import kallam.healthcare.ui.components.KidAvatar
import kallam.healthcare.ui.components.StatusBarSpacer
import kallam.healthcare.ui.components.Tone
import kallam.healthcare.ui.components.bottomBarClearance
import kallam.healthcare.ui.components.color
import kallam.healthcare.ui.components.t
import kallam.healthcare.ui.theme.AppCorners
import kallam.healthcare.ui.theme.AppSpacing
import kallam.healthcare.ui.theme.AppTheme
import kallam.healthcare.ui.theme.HeroPurple
import android.content.Intent
import android.net.Uri
import kallam.healthcare.BuildConfig

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
    val primary = MaterialTheme.colorScheme.primary
    val secondary = MaterialTheme.colorScheme.secondary

    LazyColumn(
        modifier = Modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.background),
        contentPadding = PaddingValues(start = AppSpacing.xl, end = AppSpacing.xl, bottom = bottomBarClearance())
    ) {
        item {
            StatusBarSpacer()
            Spacer(Modifier.height(AppSpacing.sm))
            // Parent header. There is no screen title string, so the parent's
            // own card stands in for the header, as before.
            AppCard(contentPadding = PaddingValues(AppSpacing.xl)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        Modifier
                            .size(64.dp)
                            .clip(CircleShape)
                            .background(MaterialTheme.colorScheme.primaryContainer),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(parentName.take(1).uppercase(), color = MaterialTheme.colorScheme.onPrimaryContainer, style = MaterialTheme.typography.headlineMedium,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }
                    Spacer(Modifier.width(AppSpacing.lg))
                    Column {
                        Text(parentName, style = MaterialTheme.typography.titleLarge,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                        Text(
                            // The server stores E.164, so the number already
                            // begins +91. Prefixing it again printed
                            // "+91 +918107994567" on a doctor's own profile.
                            if (phone.isNotBlank()) {
                                if (phone.startsWith("+")) phone else "+91 $phone"
                            } else t(S.phonePlaceholder),
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }
            Spacer(Modifier.height(AppSpacing.xxl))
            AppSectionTitle(t(S.linkedChildren))
            Spacer(Modifier.height(AppSpacing.md))
            AppCard(contentPadding = PaddingValues(vertical = AppSpacing.xs)) {
                kids.forEach { kid ->
                    Row(
                        Modifier
                            .fillMaxWidth()
                            .padding(horizontal = AppSpacing.lg, vertical = AppSpacing.md),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        KidAvatar(kid.name, kid.avatarColor, size = 40.dp)
                        Spacer(Modifier.width(AppSpacing.md))
                        Column(Modifier.weight(1f)) {
                            Text(kid.name, style = MaterialTheme.typography.titleMedium,
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
            Spacer(Modifier.height(AppSpacing.xxl))

            // Appearance section
            AppSectionTitle(t(S.appearance))
            Spacer(Modifier.height(AppSpacing.md))
            AppCard(contentPadding = PaddingValues(0.dp)) {
                ToggleRow(
                    icon = Icons.Outlined.DarkMode, tint = HeroPurple,
                    title = t(S.darkMode), subtitle = t(S.darkModeSub),
                    checked = darkTheme, onCheckedChange = { onToggleDarkTheme() }
                )
                LinkRow(
                    Icons.Outlined.Language, secondary, t(S.language),
                    "${currentLocale.label} — Tap to change",
                    onClick = {
                        val next = when (currentLocale) {
                            AppLocale.ENGLISH -> AppLocale.HINDI
                            AppLocale.HINDI -> AppLocale.TELUGU
                            AppLocale.TELUGU -> AppLocale.ENGLISH
                        }
                        onSelectLocale(next)
                    }
                )
            }

            Spacer(Modifier.height(AppSpacing.xxl))
            AppSectionTitle(t(S.notifications))
            Spacer(Modifier.height(AppSpacing.md))
            AppCard(contentPadding = PaddingValues(0.dp)) {
                ToggleRow(Icons.Outlined.Notifications, secondary, t(S.pushNotif), t(S.notifSubtitle), notificationsEnabled) { onToggleNotifications() }
                ToggleRow(Icons.Outlined.ChildCare, primary, t(S.campReminders), t(S.campReminderSub), campRemindersEnabled) { onToggleCampReminders() }
            }
            Spacer(Modifier.height(AppSpacing.xxl))
            AppSectionTitle(t(S.more))
            Spacer(Modifier.height(AppSpacing.md))
            AppCard(contentPadding = PaddingValues(0.dp)) {
                // The school pathway, in the order a parent meets it.
                LinkRow(
                    Icons.Outlined.MedicalServices, primary, t(S.referralsTitle),
                    t(S.referralsSub), onClick = onOpenReferrals
                )
                LinkRow(
                    Icons.AutoMirrored.Outlined.HelpOutline, secondary, t(S.questionsTitle),
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
                LinkRow(
                    Icons.Outlined.People, primary, t(S.familySharing),
                    t(S.inviteCoParent), onClick = onOpenFamilySharing
                )
                // Was a link to a web privacy page. A parent asking this
                // question wants to act on their own child's record, not
                // read a policy, so it opens the record itself.
                LinkRow(
                    Icons.Outlined.Lock, secondary, t(S.privacyTitle), t(S.privacySub),
                    onClick = onOpenRecord
                )
                LinkRow(
                    Icons.Outlined.SupportAgent, Tone.Watch.color(), t(S.helpSupport), t(S.helpSupportSub),
                    onClick = {
                        context.startActivity(Intent(Intent.ACTION_SENDTO, Uri.parse("mailto:support@vitahero.in")))
                    }
                )
            }
            Spacer(Modifier.height(AppSpacing.xxl))
            Row(
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(AppCorners.large))
                    .background(MaterialTheme.colorScheme.error.copy(alpha = 0.1f))
                    .clickable(onClick = onLogout)
                    .padding(AppSpacing.lg),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.Center
            ) {
                Icon(Icons.AutoMirrored.Outlined.Logout, contentDescription = null, tint = MaterialTheme.colorScheme.error, modifier = Modifier.size(20.dp))
                Spacer(Modifier.width(AppSpacing.sm))
                Text(t(S.logout), color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.titleMedium)
            }
            Spacer(Modifier.height(AppSpacing.lg))
            Text(
                // Read, not typed. This said v1.0 while the build was 1.1.0,
                // so the one screen a person looks at to report a problem was
                // naming the wrong release.
                "VitaHero v" + BuildConfig.VERSION_NAME + "\n" + t(S.medicalDisclaimer),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }
}

/** A grouped settings row in AppListRow's style, kept private because it needs a Switch. */
@Composable
private fun ToggleRow(icon: ImageVector, tint: Color, title: String, subtitle: String, checked: Boolean, onCheckedChange: (Boolean) -> Unit) {
    Row(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = AppSpacing.lg, vertical = AppSpacing.md),
        verticalAlignment = Alignment.CenterVertically
    ) {
        IconBubble(icon, tint, size = 40.dp)
        Spacer(Modifier.width(AppSpacing.md))
        Column(Modifier.weight(1f)) {
            Text(title, style = MaterialTheme.typography.titleMedium)
            Text(subtitle, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        Spacer(Modifier.width(AppSpacing.sm))
        Switch(
            checked = checked,
            onCheckedChange = onCheckedChange,
            colors = SwitchDefaults.colors(checkedTrackColor = MaterialTheme.colorScheme.primary)
        )
    }
}

/** A grouped settings row in AppListRow's style; several share one card, so not AppListRow itself. */
@Composable
private fun LinkRow(icon: ImageVector, tint: Color, title: String, subtitle: String, onClick: () -> Unit = {}) {
    Row(
        Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = AppSpacing.lg, vertical = AppSpacing.md),
        verticalAlignment = Alignment.CenterVertically
    ) {
        IconBubble(icon, tint, size = 40.dp)
        Spacer(Modifier.width(AppSpacing.md))
        Column(Modifier.weight(1f)) {
            Text(title, style = MaterialTheme.typography.titleMedium)
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
