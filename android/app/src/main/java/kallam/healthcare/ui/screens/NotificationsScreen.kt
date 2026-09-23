package kallam.healthcare.ui.screens

import androidx.compose.foundation.background
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.AssignmentTurnedIn
import androidx.compose.material.icons.outlined.CalendarMonth
import androidx.compose.material.icons.outlined.Description
import androidx.compose.material.icons.outlined.Notifications
import androidx.compose.material.icons.outlined.MedicalServices
import androidx.compose.material.icons.outlined.Restaurant
import androidx.compose.material.icons.outlined.WorkspacePremium
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import kallam.healthcare.data.AppNotification
import kallam.healthcare.data.NotificationType
import kallam.healthcare.data.S
import kallam.healthcare.ui.components.EmptyState
import kallam.healthcare.ui.components.HeroCard
import kallam.healthcare.ui.components.IconBubble
import kallam.healthcare.ui.components.t
import kallam.healthcare.ui.theme.HeroBlue
import kallam.healthcare.ui.theme.HeroOrange
import kallam.healthcare.ui.theme.HeroPurple
import kallam.healthcare.ui.theme.HeroYellow

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NotificationsScreen(
    notifications: List<AppNotification>,
    onBack: () -> Unit
) {
    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = { Text(t(S.notifCenter), style = MaterialTheme.typography.titleLarge) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Outlined.ArrowBack, contentDescription = t(S.goBack))
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background)
            )
        }
    ) { pad ->
        LazyColumn(
            Modifier
                .fillMaxWidth()
                .padding(pad),
            contentPadding = PaddingValues(start = 20.dp, end = 20.dp, top = 8.dp, bottom = 24.dp)
        ) {
            if (notifications.isEmpty()) {
                item {
                    EmptyState(
                        icon = Icons.Outlined.Notifications,
                        title = t(S.allCaughtUp),
                        subtitle = t(S.allCaughtUpSub)
                    )
                }
            } else {
                items(notifications, key = { it.id }) { n ->
                    NotificationRow(n)
                    Spacer(Modifier.height(10.dp))
                }
            }
        }
    }
}

@Composable
private fun NotificationRow(n: AppNotification) {
    val (icon, tint) = when (n.type) {
        NotificationType.CAMP -> Icons.Outlined.CalendarMonth to HeroBlue
        NotificationType.CHECKUP -> Icons.Outlined.MedicalServices to HeroPurple
        NotificationType.DIET -> Icons.Outlined.Restaurant to HeroOrange
        NotificationType.REWARD -> Icons.Outlined.WorkspacePremium to HeroYellow
        // The school programme. Consent is the only one with a deadline, so it
        // is the one that reads as a task rather than as news.
        NotificationType.CONSENT -> Icons.Outlined.AssignmentTurnedIn to HeroOrange
        NotificationType.RESULT -> Icons.Outlined.Description to HeroBlue
        NotificationType.REFERRAL -> Icons.Outlined.MedicalServices to HeroPurple
    }
    HeroCard(
        Modifier.fillMaxWidth(),
        background = if (n.unread) MaterialTheme.colorScheme.surface else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f)
    ) {
        Row(Modifier.padding(16.dp)) {
            IconBubble(icon, tint)
            Spacer(Modifier.width(14.dp))
            Column(Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(n.title, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f),
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                    )
                    if (n.unread) {
                        Box(
                            Modifier
                                .size(8.dp)
                                .clip(CircleShape)
                                .background(MaterialTheme.colorScheme.error)
                        )
                    }
                }
                Spacer(Modifier.height(4.dp))
                Text(n.body, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Spacer(Modifier.height(6.dp))
                Text(n.time, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}
