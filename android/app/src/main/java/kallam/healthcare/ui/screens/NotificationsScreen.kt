package kallam.healthcare.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.AssignmentTurnedIn
import androidx.compose.material.icons.outlined.CalendarMonth
import androidx.compose.material.icons.outlined.Description
import androidx.compose.material.icons.outlined.Notifications
import androidx.compose.material.icons.outlined.MedicalServices
import androidx.compose.material.icons.outlined.Restaurant
import androidx.compose.material.icons.outlined.WorkspacePremium
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import kallam.healthcare.data.AppNotification
import kallam.healthcare.data.NotificationType
import kallam.healthcare.data.S
import kallam.healthcare.ui.components.AppListRow
import kallam.healthcare.ui.components.AppScreenHeader
import kallam.healthcare.ui.components.EmptyState
import kallam.healthcare.ui.components.IconBubble
import kallam.healthcare.ui.components.StatusBarSpacer
import kallam.healthcare.ui.components.t
import kallam.healthcare.ui.theme.AppSpacing
import kallam.healthcare.ui.theme.HeroPurple
import kallam.healthcare.ui.theme.HeroYellow

@Composable
fun NotificationsScreen(
    notifications: List<AppNotification>,
    onBack: () -> Unit
) {
    // The header pads itself, so the list has no horizontal contentPadding;
    // every other item carries the screen margin instead.
    val margin = Modifier.padding(horizontal = AppSpacing.xl)

    LazyColumn(
        Modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.background),
        contentPadding = PaddingValues(bottom = AppSpacing.xxl)
    ) {
        item {
            StatusBarSpacer()
            AppScreenHeader(title = t(S.notifCenter), onBack = onBack)
            Spacer(Modifier.height(AppSpacing.sm))
        }
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
                NotificationRow(n, margin)
                Spacer(Modifier.height(AppSpacing.md))
            }
        }
    }
}

@Composable
private fun NotificationRow(n: AppNotification, modifier: Modifier = Modifier) {
    val primary = MaterialTheme.colorScheme.primary
    val secondary = MaterialTheme.colorScheme.secondary
    val (icon, tint) = when (n.type) {
        NotificationType.CAMP -> Icons.Outlined.CalendarMonth to secondary
        NotificationType.CHECKUP -> Icons.Outlined.MedicalServices to HeroPurple
        NotificationType.DIET -> Icons.Outlined.Restaurant to primary
        NotificationType.REWARD -> Icons.Outlined.WorkspacePremium to HeroYellow
        // The school programme. Consent is the only one with a deadline, so it
        // is the one that reads as a task rather than as news.
        NotificationType.CONSENT -> Icons.Outlined.AssignmentTurnedIn to primary
        NotificationType.RESULT -> Icons.Outlined.Description to secondary
        NotificationType.REFERRAL -> Icons.Outlined.MedicalServices to HeroPurple
    }
    AppListRow(
        title = n.title,
        modifier = modifier,
        subtitle = n.time,
        supporting = n.body,
        leading = { IconBubble(icon, tint) },
        trailing = if (n.unread) {
            {
                Box(
                    Modifier
                        .size(8.dp)
                        .clip(CircleShape)
                        .background(MaterialTheme.colorScheme.error)
                )
            }
        } else null,
    )
}
