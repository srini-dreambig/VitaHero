package com.rork.vitahero.ui.screens

import androidx.compose.animation.AnimatedContent
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.rork.vitahero.data.S
import com.rork.vitahero.ui.components.t
import com.rork.vitahero.ui.theme.HeroBlue
import com.rork.vitahero.ui.theme.HeroGreen

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
    authError: String? = null
) {
    var selectedTab by remember { mutableIntStateOf(0) }
    val tabs = AuthTab.entries

    // Email sign-in vs sign-up toggle
    var isEmailSignUp by remember { mutableStateOf(false) }

    // Phone
    var phone by remember { mutableStateOf("") }

    // Email form
    var emailName by remember { mutableStateOf("") }
    var emailAddress by remember { mutableStateOf("") }
    var emailPassword by remember { mutableStateOf("") }

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

        // Logo
        Box(
            Modifier
                .size(64.dp)
                .clip(RoundedCornerShape(20.dp))
                .background(Brush.linearGradient(listOf(HeroGreen, HeroBlue))),
            contentAlignment = Alignment.Center
        ) {
            Icon(Icons.Outlined.Shield, contentDescription = null, tint = Color.White, modifier = Modifier.size(34.dp))
        }
        Spacer(Modifier.height(12.dp))
        Text("VitaHero", style = MaterialTheme.typography.headlineLarge, fontWeight = FontWeight.Bold)
        Text(
            t(S.appSubtitle),
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )

        Spacer(Modifier.height(24.dp))

        // ─── Tab Bar ──────────────────────────────────────────
        Row(
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(14.dp))
                .background(MaterialTheme.colorScheme.surfaceVariant)
                .padding(4.dp),
            horizontalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            tabs.forEachIndexed { index, tab ->
                val isSelected = index == selectedTab
                val tabLabel = when (tab) {
                    AuthTab.GOOGLE -> t(S.signInWithGoogle).replace("Sign in with ", "")
                    AuthTab.EMAIL -> t(S.emailTab)
                    AuthTab.PHONE -> t(S.phoneTab)
                }
                Box(
                    Modifier
                        .weight(1f)
                        .height(40.dp)
                        .clip(RoundedCornerShape(10.dp))
                        .background(if (isSelected) MaterialTheme.colorScheme.surface else Color.Transparent)
                        .clickable { selectedTab = index },
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        tabLabel,
                        style = MaterialTheme.typography.labelLarge,
                        fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                        color = if (isSelected) MaterialTheme.colorScheme.primary
                                else MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }

        Spacer(Modifier.height(20.dp))

        // ─── Tab Content ──────────────────────────────────────
        when (tabs[selectedTab]) {
            AuthTab.GOOGLE -> GoogleAuthSection(
                onSignInWithGoogle = onSignInWithGoogle,
                isLoading = isLoading
            )

            AuthTab.EMAIL -> EmailAuthSection(
                isSignUp = isEmailSignUp,
                onToggleMode = { isEmailSignUp = !isEmailSignUp },
                name = emailName,
                onNameChange = { emailName = it },
                email = emailAddress,
                onEmailChange = { emailAddress = it },
                password = emailPassword,
                onPasswordChange = { emailPassword = it },
                onSubmit = {
                    if (isEmailSignUp) {
                        onSignUpWithEmail(emailName, emailAddress, emailPassword)
                    } else {
                        onSignInWithEmail(emailAddress, emailPassword)
                    }
                },
                isLoading = isLoading
            )

            AuthTab.PHONE -> PhoneAuthSection(
                phone = phone,
                onPhoneChange = { if (it.length <= 10) phone = it.filter(Char::isDigit) },
                onSubmit = { onContinueWithPhone(phone) },
                isLoading = isLoading
            )
        }

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
                color = HeroGreen
            )
        }

        Spacer(Modifier.weight(1f))
        Spacer(Modifier.height(12.dp))

        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            modifier = Modifier.padding(bottom = 16.dp)
        ) {
            Icon(Icons.Outlined.Lock, contentDescription = null, tint = HeroGreen, modifier = Modifier.size(16.dp))
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
                    Brush.linearGradient(listOf(HeroGreen, HeroBlue))
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
            color = HeroGreen,
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
                    Brush.linearGradient(listOf(HeroGreen, HeroBlue))
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

// ─── Reusable Components ────────────────────────────────────

@Composable
private fun FieldLabel(text: String) {
    Text(
        text,
        style = MaterialTheme.typography.labelLarge,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier
            .fillMaxWidth()
            .padding(bottom = 8.dp)
    )
}

@Composable
fun HeroTextField(
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String,
    modifier: Modifier = Modifier,
    keyboardType: KeyboardType = KeyboardType.Text,
    isPassword: Boolean = false
) {
    androidx.compose.material3.OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        placeholder = { Text(placeholder, color = MaterialTheme.colorScheme.onSurfaceVariant) },
        singleLine = true,
        shape = RoundedCornerShape(14.dp),
        keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
        visualTransformation = if (isPassword) PasswordVisualTransformation() else androidx.compose.ui.text.input.VisualTransformation.None,
        colors = androidx.compose.material3.OutlinedTextFieldDefaults.colors(
            focusedBorderColor = MaterialTheme.colorScheme.primary,
            unfocusedBorderColor = MaterialTheme.colorScheme.outline,
            focusedContainerColor = MaterialTheme.colorScheme.surface,
            unfocusedContainerColor = MaterialTheme.colorScheme.surface,
        ),
        modifier = modifier
    )
}
