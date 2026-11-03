package kallam.healthcare.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.HealthAndSafety
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material.icons.outlined.PrivacyTip
import androidx.compose.material.icons.outlined.Security
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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import kallam.healthcare.data.S
import kallam.healthcare.ui.components.PrimaryGradientButton
import kallam.healthcare.ui.components.t
import kallam.healthcare.ui.theme.AppCorners
import kallam.healthcare.ui.theme.AppSpacing
import kallam.healthcare.ui.theme.HeroPurple

@Composable
fun ConsentScreen(
    onAccept: () -> Unit,
    onDecline: () -> Unit
) {
    Column(
        Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .verticalScroll(rememberScrollState())
            .padding(horizontal = AppSpacing.xxl),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Spacer(Modifier.height(60.dp))

        Box(
            Modifier
                .size(80.dp)
                .clip(RoundedCornerShape(AppCorners.xlarge))
                .background(MaterialTheme.colorScheme.primaryContainer),
            contentAlignment = Alignment.Center
        ) {
            Icon(Icons.Outlined.HealthAndSafety, contentDescription = null, tint = MaterialTheme.colorScheme.onPrimaryContainer, modifier = Modifier.size(42.dp))
        }

        Spacer(Modifier.height(AppSpacing.xl))
        Text(
            t(S.consentTitle),
            style = MaterialTheme.typography.headlineLarge,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(AppSpacing.md))
        Text(
            t(S.consentSubtitle),
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
        )

        Spacer(Modifier.height(AppSpacing.xxxl))

        ConsentItem(
            icon = Icons.Outlined.Lock,
            title = t(S.consentItem1Title),
            description = t(S.consentItem1Desc),
            tint = MaterialTheme.colorScheme.primary
        )
        Spacer(Modifier.height(AppSpacing.md))
        ConsentItem(
            icon = Icons.Outlined.Security,
            title = t(S.consentItem2Title),
            description = t(S.consentItem2Desc),
            tint = MaterialTheme.colorScheme.secondary
        )
        Spacer(Modifier.height(AppSpacing.md))
        ConsentItem(
            icon = Icons.Outlined.PrivacyTip,
            title = t(S.consentItem3Title),
            description = t(S.consentItem3Desc),
            tint = HeroPurple
        )

        Spacer(Modifier.height(AppSpacing.md))
        Text(
            t(S.medicalDisclaimer),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(vertical = AppSpacing.sm)
        )

        Spacer(Modifier.height(AppSpacing.xxl))
        PrimaryGradientButton(
            text = t(S.consentAccept),
            onClick = onAccept,
            modifier = Modifier.fillMaxWidth()
        )

        Spacer(Modifier.height(AppSpacing.md))
        Box(
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(AppCorners.large))
                .background(MaterialTheme.colorScheme.surfaceVariant)
                .padding(vertical = AppSpacing.md),
            contentAlignment = Alignment.Center
        ) {
            Text(
                t(S.learnPrivacy),
                style = MaterialTheme.typography.titleSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }

        Spacer(Modifier.height(40.dp))
        Text(
            t(S.version),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f),
            textAlign = TextAlign.Center
        )
        Spacer(Modifier.height(AppSpacing.xl))
    }
}

@Composable
private fun ConsentItem(
    icon: ImageVector,
    title: String,
    description: String,
    tint: Color
) {
    Row(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(AppCorners.large))
            .background(MaterialTheme.colorScheme.surface)
            .padding(AppSpacing.lg),
        verticalAlignment = Alignment.Top
    ) {
        Box(
            Modifier
                .size(44.dp)
                .clip(CircleShape)
                .background(tint.copy(alpha = 0.12f)),
            contentAlignment = Alignment.Center
        ) {
            Icon(icon, contentDescription = null, tint = tint, modifier = Modifier.size(24.dp))
        }
        Spacer(Modifier.width(AppSpacing.md))
        Column(Modifier.weight(1f)) {
            Text(title, style = MaterialTheme.typography.titleMedium)
            Spacer(Modifier.height(AppSpacing.xs))
            Text(
                description,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}
