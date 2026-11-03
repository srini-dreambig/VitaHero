package kallam.healthcare.ui.screens

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.systemBars
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Email
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material.icons.outlined.Phone
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import kallam.healthcare.R
import kallam.healthcare.data.AppLocale
import kallam.healthcare.data.LocalAppLocale
import kallam.healthcare.data.S
import kallam.healthcare.ui.components.FieldLabel
import kallam.healthcare.ui.components.HeroTextField
import kallam.healthcare.ui.components.t
import kallam.healthcare.ui.theme.AppTheme
import kallam.healthcare.ui.theme.AppCorners
import kallam.healthcare.ui.theme.AppSpacing


/**
 * Auth screen with three tabs:
 * - Google Sign-In (one tap)
 * - Email/password (sign-up or sign-in)
 * - Phone OTP via Firebase
 */
@Composable
fun AuthScreen(
    onContinueWithPhone: (phone: String) -> Unit,
    isLoading: Boolean = false,
    authError: String? = null,
    prefilledPhone: String = "",
) {
    // Closed app: parents sign in with their registered mobile number only.
    var phone by remember(prefilledPhone) { mutableStateOf(prefilledPhone) }

    Column(
        Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .windowInsetsPadding(WindowInsets.systemBars)
            .verticalScroll(rememberScrollState())
            .padding(horizontal = AppSpacing.xxl),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Spacer(Modifier.height(AppSpacing.xxxl))

        // Brand logo
        Image(
            painter = painterResource(id = R.drawable.vitahero_logo),
            contentDescription = "VitaHero",
            modifier = Modifier
                .fillMaxWidth(0.62f)
                .heightIn(max = 180.dp)
        )
        Spacer(Modifier.height(AppSpacing.xs))
        Text(
            t(S.appSubtitle),
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )

        Spacer(Modifier.height(AppSpacing.xxl))

        // Closed app: parents sign in with their registered mobile number only.
        PhoneAuthSection(
            phone = phone,
            onPhoneChange = { if (it.length <= 10) phone = it.filter(Char::isDigit) },
            onSubmit = { onContinueWithPhone(phone) },
            isLoading = isLoading
        )

        // ─── Auth Error ───────────────────────────────────────
        if (authError != null) {
            Spacer(Modifier.height(AppSpacing.md))
            Box(
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(AppCorners.medium))
                    // Theme colours: the fixed light red was a bright pink
                    // panel on an otherwise dark screen in dark mode.
                    .background(MaterialTheme.colorScheme.errorContainer)
                    .padding(AppSpacing.md)
            ) {
                Text(
                    authError,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onErrorContainer,
                )
            }
        }

        // ─── Loading ──────────────────────────────────────────
        if (isLoading) {
            Spacer(Modifier.height(AppSpacing.md))
            CircularProgressIndicator(
                modifier = Modifier.size(24.dp),
                strokeWidth = 2.dp,
                color = MaterialTheme.colorScheme.primary
            )
        }

        Spacer(Modifier.weight(1f))
        Spacer(Modifier.height(AppSpacing.md))

        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(AppSpacing.sm),
            modifier = Modifier.padding(bottom = AppSpacing.lg)
        ) {
            Icon(Icons.Outlined.Lock, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(16.dp))
            Text(
                t(S.trustBadge),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center
            )
        }
    }
}

// ─── Google Section ──────────────────────────────────────────


// ─── Email Section ───────────────────────────────────────────


// ─── Phone Section ───────────────────────────────────────────

@Composable
private fun PhoneAuthSection(
    phone: String,
    onPhoneChange: (String) -> Unit,
    onSubmit: () -> Unit,
    isLoading: Boolean
) {
    FieldLabel(t(S.phoneLabel))
    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(
            Modifier
                .height(52.dp)
                .clip(RoundedCornerShape(AppCorners.medium))
                .background(MaterialTheme.colorScheme.surfaceVariant)
                .padding(horizontal = AppSpacing.lg),
            contentAlignment = Alignment.Center
        ) {
            Text("+91", style = MaterialTheme.typography.titleMedium)
        }
        Spacer(Modifier.width(AppSpacing.sm))
        HeroTextField(
            value = phone,
            onValueChange = onPhoneChange,
            placeholder = "98765 43210",
            keyboardType = KeyboardType.Phone,
            modifier = Modifier.weight(1f)
        )
    }

    Spacer(Modifier.height(AppSpacing.sm))
    Text(
        t(S.smsNote),
        style = MaterialTheme.typography.bodySmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier.fillMaxWidth()
    )

    Spacer(Modifier.height(AppSpacing.xl))

    Box(
        Modifier
            .fillMaxWidth()
            .height(56.dp)
            .clip(RoundedCornerShape(50))
            .background(if (phone.length == 10 && !isLoading) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surfaceVariant)
            .clickable(enabled = phone.length == 10 && !isLoading) { onSubmit() },
        contentAlignment = Alignment.Center
    ) {
        Text(
            if (isLoading) t(S.pleaseWait) else t(S.sendOtp),
            style = MaterialTheme.typography.labelLarge,
            color = if (phone.length == 10 && !isLoading) MaterialTheme.colorScheme.onPrimaryContainer
                    else MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

// ─── Previews ────────────────────────────────────────────────

@Preview(showBackground = true)
@Composable
private fun AuthScreenPreview() {
    androidx.compose.runtime.CompositionLocalProvider(LocalAppLocale provides AppLocale.ENGLISH) {
        AppTheme {
            AuthScreen(
                onContinueWithPhone = {}
            )
        }
    }
}
