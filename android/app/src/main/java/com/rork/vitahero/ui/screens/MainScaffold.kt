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
import androidx.compose.ui.unit.dp
import com.rork.vitahero.data.AppViewModel

private enum class Tab(val label: String, val filled: ImageVector, val outlined: ImageVector) {
    HOME("Home", Icons.Filled.Home, Icons.Outlined.Home),
    KIDS("Kids", Icons.Filled.Groups, Icons.Outlined.Groups),
    CAMPS("Camps", Icons.Filled.CalendarMonth, Icons.Outlined.CalendarMonth),
    REWARDS("Rewards", Icons.Filled.WorkspacePremium, Icons.Outlined.WorkspacePremium),
    PROFILE("Profile", Icons.Filled.Person, Icons.Outlined.Person),
}

@Composable
fun MainScaffold(
    appViewModel: AppViewModel,
    phone: String,
    darkTheme: Boolean,
    onOpenKid: (String) -> Unit,
    onOpenDiet: (String) -> Unit,
    onOpenBooking: () -> Unit,
    onOpenNotifications: () -> Unit,
    onAddKid: () -> Unit,
    onOpenFamilySharing: () -> Unit,
    onOpenFoodRecognition: (String, String) -> Unit,
    onLogout: () -> Unit
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
                    onBookFollowUp = onOpenBooking
                )
                Tab.REWARDS -> RewardsScreen(
                    kids = state.kids,
                    badgeData = { appViewModel.badgeProgressForKid(it) }
                )
                Tab.PROFILE -> ProfileScreen(
                    parentName = state.parentName,
                    phone = phone,
                    kids = state.kids,
                    darkTheme = darkTheme,
                    currentLocale = state.locale,
                    onToggleDarkTheme = { appViewModel.toggleDarkTheme() },
                    onSelectLocale = { appViewModel.setLocale(it) },
                    onOpenFamilySharing = onOpenFamilySharing,
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
    modifier: Modifier = Modifier
) {
    val navBarPadding = WindowInsets.navigationBars.asPaddingValues().calculateBottomPadding()
    Surface(
        modifier = modifier.fillMaxWidth(),
        color = MaterialTheme.colorScheme.surface,
        shadowElevation = 16.dp,
        shape = RoundedCornerShape(topStart = 28.dp, topEnd = 28.dp)
    ) {
        Row(
            Modifier
                .fillMaxWidth()
                .padding(top = 10.dp, bottom = navBarPadding + 10.dp, start = 8.dp, end = 8.dp),
            horizontalArrangement = Arrangement.SpaceEvenly,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Tab.entries.forEach { t ->
                BottomItem(t, t == selected) { onSelect(t) }
            }
        }
    }
}

@Composable
private fun BottomItem(tab: Tab, selected: Boolean, onClick: () -> Unit) {
    val scale by animateFloatAsState(if (selected) 1f else 0.92f, label = "scale")
    val interaction = remember { MutableInteractionSource() }
    Column(
        modifier = Modifier
            .clip(RoundedCornerShape(16.dp))
            .clickable(interactionSource = interaction, indication = null, onClick = onClick)
            .padding(horizontal = 10.dp, vertical = 6.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Box(
            Modifier
                .clip(RoundedCornerShape(14.dp))
                .background(if (selected) MaterialTheme.colorScheme.primaryContainer else Color.Transparent)
                .padding(horizontal = 16.dp, vertical = 5.dp),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                if (selected) tab.filled else tab.outlined,
                contentDescription = tab.label,
                tint = if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(24.dp * scale)
            )
        }
        Spacer(Modifier.height(3.dp))
        Text(
            tab.label,
            style = MaterialTheme.typography.labelSmall,
            color = if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
            fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Medium
        )
    }
}
