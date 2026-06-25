package com.rork.vitahero.ui.screens

import androidx.compose.animation.AnimatedContent
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Email
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material.icons.outlined.Phone
import androidx.compose.material.icons.outlined.Shield
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.rork.vitahero.R
import com.rork.vitahero.data.AppLocale
import com.rork.vitahero.data.LocalAppLocale
import com.rork.vitahero.data.S
import com.rork.vitahero.ui.components.FieldLabel
import com.rork.vitahero.ui.components.HeroTextField
import com.rork.vitahero.ui.components.t
import com.rork.vitahero.ui.theme.AppTheme
import com.rork.vitahero.ui.theme.HeroBlue
import com.rork.vitahero.ui.theme.HeroOrange

private enum class AuthTab { GOOGLE, EMAIL, PHONE }

/**
 * Auth screen with three tabs:
 * - Google Sign-In (one tap)
 * - Email/password (sign-up or sign-in)
 * - Phone OTP via Twilio
 */
@Composable
fun AuthScreen(
    onSignInWithGoogle: () -> Unit,
    onSignUpWithEmail: (name: String, email: String, password: String) -> Unit,
    onSignInWithEmail: (email: String, password: String) -> Unit,
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
            .padding(horizontal = 24.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Spacer(Modifier.height(32.dp))

        // Brand logo
        Image(
            painter = painterResource(id = R.drawable.vitahero_logo),
            contentDescription = "VitaHero",
            modifier = Modifier
                .fillMaxWidth(0.62f)
                .heightIn(max = 180.dp)
        )
        Spacer(Modifier.height(4.dp))
        Text(
            t(S.appSubtitle),
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )

        Spacer(Modifier.height(24.dp))

        // Closed app: parents sign in with their registered mobile number only.
        PhoneAuthSection(
            phone = phone,
            onPhoneChange = { if (it.length <= 10) phone = it.filter(Char::isDigit) },
            onSubmit = { onContinueWithPhone(phone) },
            isLoading = isLoading
        )

        // ─── Auth Error ───────────────────────────────────────
        if (authError != null) {
            Spacer(Modifier.height(12.dp))
            Box(
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .background(Color(0xFFFEE2E2))
                    .padding(12.dp)
            ) {
                Text(authError, style = MaterialTheme.typography.bodySmall, color = Color(0xFFDC2626))
            }
        }

        // ─── Loading ──────────────────────────────────────────
        if (isLoading) {
            Spacer(Modifier.height(12.dp))
            CircularProgressIndicator(
                modifier = Modifier.size(24.dp),
                strokeWidth = 2.dp,
                color = HeroOrange
            )
        }

        Spacer(Modifier.weight(1f))
        Spacer(Modifier.height(12.dp))

        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            modifier = Modifier.padding(bottom = 16.dp)
        ) {
            Icon(Icons.Outlined.Lock, contentDescription = null, tint = HeroOrange, modifier = Modifier.size(16.dp))
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

@Composable
private fun GoogleAuthSection(
    onSignInWithGoogle: () -> Unit,
    isLoading: Boolean
) {
    Box(
        Modifier
            .fillMaxWidth()
            .height(56.dp)
            .clip(RoundedCornerShape(16.dp))
            .border(1.dp, MaterialTheme.colorScheme.outline, RoundedCornerShape(16.dp))
            .background(MaterialTheme.colorScheme.surface)
            .clickable(enabled = !isLoading) { onSignInWithGoogle() },
        contentAlignment = Alignment.Center
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                Modifier
                    .size(24.dp)
                    .clip(RoundedCornerShape(6.dp))
                    .background(Color.White),
                contentAlignment = Alignment.Center
            ) {
                Text("G", fontWeight = FontWeight.Bold, color = Color(0xFF4285F4))
            }
            Spacer(Modifier.width(12.dp))
            Text(
                t(S.signInWithGoogle),
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.SemiBold
            )
        }
    }

    Spacer(Modifier.height(16.dp))
    Text(
        t(S.emailConfirmNote),
        style = MaterialTheme.typography.bodySmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        textAlign = TextAlign.Center,
        modifier = Modifier.fillMaxWidth()
    )
}

// ─── Email Section ───────────────────────────────────────────

@Composable
private fun EmailAuthSection(
    isSignUp: Boolean,
    onToggleMode: () -> Unit,
    name: String,
    onNameChange: (String) -> Unit,
    email: String,
    onEmailChange: (String) -> Unit,
    password: String,
    onPasswordChange: (String) -> Unit,
    onSubmit: () -> Unit,
    isLoading: Boolean
) {
    if (isSignUp) {
        FieldLabel(t(S.yourName))
        HeroTextField(
            value = name,
            onValueChange = onNameChange,
            placeholder = t(S.namePlaceholderAuth),
            modifier = Modifier.fillMaxWidth()
        )
        Spacer(Modifier.height(12.dp))
    }

    FieldLabel(t(S.emailLabel))
    HeroTextField(
        value = email,
        onValueChange = onEmailChange,
        placeholder = t(S.emailPlaceholder),
        keyboardType = KeyboardType.Email,
        modifier = Modifier.fillMaxWidth()
    )

    Spacer(Modifier.height(12.dp))

    FieldLabel(t(S.passwordLabel))
    HeroTextField(
        value = password,
        onValueChange = onPasswordChange,
        placeholder = t(S.passwordPlaceholder),
        keyboardType = KeyboardType.Password,
        isPassword = true,
        modifier = Modifier.fillMaxWidth()
    )

    Spacer(Modifier.height(8.dp))
    Text(
        t(S.emailConfirmNote),
        style = MaterialTheme.typography.bodySmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier.fillMaxWidth()
    )

    Spacer(Modifier.height(20.dp))

    val submitEnabled = when {
        isSignUp -> name.isNotBlank() && email.isNotBlank() && password.length >= 6
        else -> email.isNotBlank() && password.length >= 6
    }

    // Submit button
    Box(
        Modifier
            .fillMaxWidth()
            .height(52.dp)
            .clip(RoundedCornerShape(14.dp))
            .background(
                if (submitEnabled && !isLoading)
                    Brush.linearGradient(listOf(HeroOrange, HeroBlue))
                else
                    Brush.linearGradient(listOf(MaterialTheme.colorScheme.surfaceVariant, MaterialTheme.colorScheme.surfaceVariant))
            )
            .clickable(enabled = submitEnabled && !isLoading) { onSubmit() },
        contentAlignment = Alignment.Center
    ) {
        Text(
            if (isSignUp) t(S.createAccount) else t(S.loginTab),
            style = MaterialTheme.typography.titleSmall,
            fontWeight = FontWeight.SemiBold,
            color = if (submitEnabled && !isLoading) Color.White
                    else MaterialTheme.colorScheme.onSurfaceVariant
        )
    }

    Spacer(Modifier.height(12.dp))

    // Toggle sign-in / sign-up
    Row(
        horizontalArrangement = Arrangement.Center,
        modifier = Modifier.fillMaxWidth()
    ) {
        Text(
            if (isSignUp) t(S.loginHint) else t(S.signUpHint),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(Modifier.width(4.dp))
        Text(
            if (isSignUp) t(S.loginTab) else t(S.signupTab),
            style = MaterialTheme.typography.bodySmall,
            fontWeight = FontWeight.Bold,
            color = HeroOrange,
            modifier = Modifier.clickable { onToggleMode() }
        )
    }
}

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
                .clip(RoundedCornerShape(14.dp))
                .background(MaterialTheme.colorScheme.surfaceVariant)
                .padding(horizontal = 16.dp),
            contentAlignment = Alignment.Center
        ) {
            Text("+91", style = MaterialTheme.typography.titleMedium)
        }
        Spacer(Modifier.width(10.dp))
        HeroTextField(
            value = phone,
            onValueChange = onPhoneChange,
            placeholder = "98765 43210",
            keyboardType = KeyboardType.Phone,
            modifier = Modifier.weight(1f)
        )
    }

    Spacer(Modifier.height(8.dp))
    Text(
        t(S.smsNote),
        style = MaterialTheme.typography.bodySmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier.fillMaxWidth()
    )

    Spacer(Modifier.height(20.dp))

    Box(
        Modifier
            .fillMaxWidth()
            .height(52.dp)
            .clip(RoundedCornerShape(14.dp))
            .background(
                if (phone.length == 10 && !isLoading)
                    Brush.linearGradient(listOf(HeroOrange, HeroBlue))
                else
                    Brush.linearGradient(listOf(MaterialTheme.colorScheme.surfaceVariant, MaterialTheme.colorScheme.surfaceVariant))
            )
            .clickable(enabled = phone.length == 10 && !isLoading) { onSubmit() },
        contentAlignment = Alignment.Center
    ) {
        Text(
            if (isLoading) t(S.pleaseWait) else t(S.sendOtp),
            style = MaterialTheme.typography.titleSmall,
            fontWeight = FontWeight.SemiBold,
            color = if (phone.length == 10 && !isLoading) Color.White
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
                onSignInWithGoogle = {},
                onSignUpWithEmail = { _, _, _ -> },
                onSignInWithEmail = { _, _ -> },
                onContinueWithPhone = {}
            )
        }
    }
}
