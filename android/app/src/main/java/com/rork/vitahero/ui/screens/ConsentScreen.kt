package com.rork.vitahero.ui.screens

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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.rork.vitahero.data.S
import com.rork.vitahero.ui.components.PrimaryGradientButton
import com.rork.vitahero.ui.components.t
import com.rork.vitahero.ui.theme.HeroBlue
import com.rork.vitahero.ui.theme.HeroOrange

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
            .padding(horizontal = 24.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Spacer(Modifier.height(60.dp))

        Box(
            Modifier
                .size(80.dp)
                .clip(RoundedCornerShape(22.dp))
                .background(Brush.linearGradient(listOf(HeroOrange, HeroBlue))),
            contentAlignment = Alignment.Center
        ) {
            Icon(Icons.Outlined.HealthAndSafety, contentDescription = null, tint = Color.White, modifier = Modifier.size(42.dp))
        }

        Spacer(Modifier.height(20.dp))
        Text(
            t(S.consentTitle),
            style = MaterialTheme.typography.headlineLarge,
            fontWeight = FontWeight.Bold,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(10.dp))
        Text(
            t(S.consentSubtitle),
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
        )

        Spacer(Modifier.height(32.dp))

        ConsentItem(
            icon = Icons.Outlined.Lock,
            title = t(S.consentItem1Title),
            description = t(S.consentItem1Desc),
            tint = HeroOrange
        )
        Spacer(Modifier.height(16.dp))
        ConsentItem(
            icon = Icons.Outlined.Security,
            title = t(S.consentItem2Title),
            description = t(S.consentItem2Desc),
            tint = HeroBlue
        )
        Spacer(Modifier.height(16.dp))
        ConsentItem(
            icon = Icons.Outlined.PrivacyTip,
            title = t(S.consentItem3Title),
            description = t(S.consentItem3Desc),
            tint = Color(0xFF8B5CF6)
        )

        Spacer(Modifier.height(10.dp))
        Text(
            "For informational purposes only. Always consult a doctor for medical decisions.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(vertical = 8.dp)
        )

        Spacer(Modifier.height(24.dp))
        PrimaryGradientButton(
            text = t(S.consentAccept),
            onClick = onAccept,
            modifier = Modifier.fillMaxWidth()
        )

        Spacer(Modifier.height(12.dp))
        Box(
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(16.dp))
                .background(MaterialTheme.colorScheme.surfaceVariant)
                .padding(vertical = 14.dp),
            contentAlignment = Alignment.Center
        ) {
            Text(
                t(S.learnPrivacy),
                style = MaterialTheme.typography.titleSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                fontWeight = FontWeight.Medium
            )
        }

        Spacer(Modifier.height(40.dp))
        Text(
            t(S.version),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f),
            textAlign = TextAlign.Center
        )
        Spacer(Modifier.height(20.dp))
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
            .clip(RoundedCornerShape(20.dp))
            .background(MaterialTheme.colorScheme.surface)
            .padding(18.dp),
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
        Spacer(Modifier.width(14.dp))
        Column(Modifier.weight(1f)) {
            Text(title, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
            Spacer(Modifier.height(4.dp))
            Text(
                description,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}
