package com.rork.vitahero.ui.screens

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.Groups
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.WorkspacePremium
import androidx.compose.material.icons.outlined.CalendarMonth
import androidx.compose.material.icons.outlined.Groups
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material.icons.outlined.WorkspacePremium
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.rork.vitahero.data.AppViewModel
import com.rork.vitahero.data.S
import com.rork.vitahero.ui.components.t
import com.rork.vitahero.data.KidsViewModel
import com.rork.vitahero.data.ProfileViewModel

/** `labelKey` rather than a literal: this bar was the last English-only chrome. */
private enum class Tab(val labelKey: String, val filled: ImageVector, val outlined: ImageVector) {
    HOME(S.navHome, Icons.Filled.Home, Icons.Outlined.Home),
    KIDS(S.navKids, Icons.Filled.Groups, Icons.Outlined.Groups),
    CAMPS(S.navCamps, Icons.Filled.CalendarMonth, Icons.Outlined.CalendarMonth),
    REWARDS(S.navRewards, Icons.Filled.WorkspacePremium, Icons.Outlined.WorkspacePremium),
    PROFILE(S.navProfile, Icons.Filled.Person, Icons.Outlined.Person),
}

@Composable
fun MainScaffold(
    appViewModel: AppViewModel,
    profileViewModel: ProfileViewModel,
    kidsViewModel: KidsViewModel,
    phone: String,
    darkTheme: Boolean,
    onOpenKid: (String) -> Unit,
    onOpenDiet: (String) -> Unit,
    onOpenBooking: () -> Unit,
    onOpenNotifications: () -> Unit,
    onAddKid: () -> Unit,
    onOpenFamilySharing: () -> Unit,
    onOpenSchools: () -> Unit = {},
    onOpenHospitals: () -> Unit = {},
    onOpenCamp: (String) -> Unit = {},
    onOpenConsent: () -> Unit = {},
    onOpenReferrals: () -> Unit = {},
    onOpenQuestions: () -> Unit = {},
    onOpenLibrary: () -> Unit = {},
    onOpenRecord: () -> Unit = {},
    /** How many camps are waiting on this guardian to answer. */
    pendingConsents: Int = 0,
    onOpenGrowthCharts: (String) -> Unit = {},
    onOpenFoodRecognition: (String, String) -> Unit,
    onLogout: () -> Unit,
) {
    var tab by rememberSaveable { mutableStateOf(Tab.HOME) }
    val state by appViewModel.uiState.collectAsState()
    val unread = state.notifications.count { it.unread }

    Box(
        Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
    ) {
        AnimatedContent(
            targetState = tab,
            transitionSpec = { fadeIn(tween(200)) togetherWith fadeOut(tween(150)) },
            label = "tab",
            modifier = Modifier.fillMaxSize()
        ) { current ->
            when (current) {
                Tab.HOME -> HomeScreen(
                    parentName = state.parentName,
                    kids = state.kids,
                    camps = state.camps,
                    appointments = state.appointments,
                    unreadCount = unread,
                    onOpenKid = onOpenKid,
                    onOpenNotifications = onOpenNotifications,
                    onOpenCamps = { tab = Tab.CAMPS },
                    onOpenDiet = onOpenDiet,
                    onOpenRewards = { tab = Tab.REWARDS },
                    onBookAppointment = onOpenBooking
                )
                Tab.KIDS -> KidsScreen(
                    kids = state.kids,
                    onOpenKid = onOpenKid,
                    onAddKid = onAddKid
                )
                Tab.CAMPS -> CampsScreen(
                    camps = state.camps,
                    onBookFollowUp = onOpenBooking,
                    onOpenCamp = onOpenCamp,
                    onOpenSchools = onOpenSchools,
                    pendingConsents = pendingConsents,
                    onOpenConsent = onOpenConsent,
                )
                Tab.REWARDS -> {
                    val leaderboards by kidsViewModel.leaderboards.collectAsState()
                    RewardsScreen(
                        kids = state.kids,
                        leaderboards = leaderboards,
                        onRefreshLeaderboard = { kidsViewModel.refreshLeaderboard(it) },
                        badgeData = { kidsViewModel.badgeProgressForKid(it) }
                    )
                }
                Tab.PROFILE -> ProfileScreen(
                    parentName = state.parentName,
                    phone = phone,
                    kids = state.kids,
                    darkTheme = darkTheme,
                    currentLocale = state.locale,
                    notificationsEnabled = state.notificationsEnabled,
                    campRemindersEnabled = state.campRemindersEnabled,
                    onToggleDarkTheme = { profileViewModel.toggleDarkTheme() },
                    onToggleNotifications = { profileViewModel.toggleNotificationsEnabled() },
                    onToggleCampReminders = { profileViewModel.toggleCampReminders() },
                    onSelectLocale = { profileViewModel.setLocale(it) },
                    onOpenFamilySharing = onOpenFamilySharing,
                    onOpenHospitals = onOpenHospitals,
                    onOpenReferrals = onOpenReferrals,
                    onOpenQuestions = onOpenQuestions,
                    onOpenLibrary = onOpenLibrary,
                    onOpenRecord = onOpenRecord,
                    onLogout = onLogout
                )
            }
        }

        BottomBar(
            selected = tab,
            onSelect = { tab = it },
            modifier = Modifier.align(Alignment.BottomCenter)
        )
    }
}

@Composable
private fun BottomBar(
    selected: Tab,
    onSelect: (Tab) -> Unit,
    modifier: Modifier = Modifier,
) {
    val navBarPadding = WindowInsets.navigationBars.asPaddingValues()
    Surface(
        modifier = modifier
            .fillMaxWidth()
            .padding(bottom = navBarPadding.calculateBottomPadding()),
        color = MaterialTheme.colorScheme.surface,
        shadowElevation = 8.dp,
    ) {
        Row(
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 8.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.SpaceEvenly,
        ) {
            Tab.entries.forEach { tab ->
                val isSelected = tab == selected
                val scale by animateFloatAsState(if (isSelected) 1.1f else 1f, label = "tabScale")
                val label = t(tab.labelKey)
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    modifier = Modifier
                        .clip(RoundedCornerShape(12.dp))
                        .clickable(
                            interactionSource = remember { MutableInteractionSource() },
                            indication = null,
                        ) { onSelect(tab) }
                        .padding(horizontal = 12.dp, vertical = 6.dp),
                ) {
                    Icon(
                        imageVector = if (isSelected) tab.filled else tab.outlined,
                        contentDescription = label,
                        tint = if (isSelected) MaterialTheme.colorScheme.primary else Color.Gray,
                        modifier = Modifier.size((22 * scale).dp),
                    )
                    Spacer(Modifier.height(2.dp))
                    Text(
                        label,
                        style = MaterialTheme.typography.labelSmall,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                        color = if (isSelected) MaterialTheme.colorScheme.primary else Color.Gray,
                    )
                }
            }
        }
    }
}
