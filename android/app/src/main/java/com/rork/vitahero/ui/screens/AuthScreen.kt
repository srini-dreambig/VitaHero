package com.rork.vitahero.ui.screens

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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.Message
import androidx.compose.material.icons.outlined.Email
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material.icons.outlined.Phone
import androidx.compose.material.icons.outlined.Shield
import androidx.compose.material.icons.outlined.Visibility
import androidx.compose.material.icons.outlined.VisibilityOff
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.rork.vitahero.data.S
import com.rork.vitahero.ui.components.PrimaryGradientButton
import com.rork.vitahero.ui.components.t
import com.rork.vitahero.ui.theme.HeroBlue
import com.rork.vitahero.ui.theme.HeroGreen
import kotlinx.coroutines.launch

/**
 * Auth screen with real Supabase Auth:
 * - Email + Password (sign up / sign in)
 * - Phone OTP (sends real SMS via Supabase)
 */
@Composable
fun AuthScreen(
    onContinueWithPhone: (phone: String) -> Unit,
    onContinueWithEmail: (email: String, password: String, name: String, isSignUp: Boolean) -> Unit,
    isLoading: Boolean = false,
    authError: String? = null
) {
    var isLogin by remember { mutableStateOf(true) }
    var authMethod by remember { mutableStateOf<AuthMethod>(AuthMethod.EMAIL) }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var name by remember { mutableStateOf("") }
    var phone by remember { mutableStateOf("") }
    var passwordVisible by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    Column(
        Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .windowInsetsPadding(WindowInsets.systemBars)
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 24.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Spacer(Modifier.height(40.dp))

        // Logo
        Box(
            Modifier
                .size(72.dp)
                .clip(RoundedCornerShape(22.dp))
                .background(Brush.linearGradient(listOf(HeroGreen, HeroBlue))),
            contentAlignment = Alignment.Center
        ) {
            Icon(Icons.Outlined.Shield, contentDescription = null, tint = Color.White, modifier = Modifier.size(38.dp))
        }
        Spacer(Modifier.height(16.dp))
        Text("VitaHero", style = MaterialTheme.typography.headlineLarge, fontWeight = FontWeight.Bold)
        Text(
            t(S.appSubtitle),
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )

        Spacer(Modifier.height(28.dp))

        // Auth method selector
        Row(
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(16.dp))
                .background(MaterialTheme.colorScheme.surfaceVariant)
                .padding(4.dp)
        ) {
            AuthMethodChip(
                label = t(S.emailTab),
                icon = Icons.Outlined.Email,
                selected = authMethod == AuthMethod.EMAIL,
                modifier = Modifier.weight(1f),
                onClick = { authMethod = AuthMethod.EMAIL }
            )
            AuthMethodChip(
                label = t(S.phoneTab),
                icon = Icons.Outlined.Phone,
                selected = authMethod == AuthMethod.PHONE,
                modifier = Modifier.weight(1f),
                onClick = { authMethod = AuthMethod.PHONE }
            )
        }

        Spacer(Modifier.height(20.dp))

        // Login / Sign Up tabs
        Row(
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(16.dp))
                .background(MaterialTheme.colorScheme.surfaceVariant)
                .padding(4.dp)
        ) {
            AuthTab(t(S.loginTab), isLogin, Modifier.weight(1f)) { isLogin = true }
            AuthTab(t(S.signupTab), !isLogin, Modifier.weight(1f)) { isLogin = false }
        }

        Spacer(Modifier.height(24.dp))

        // Auth error
        if (authError != null) {
            Box(
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .background(Color(0xFFFEE2E2))
                    .padding(12.dp)
            ) {
                Text(
                    authError,
                    style = MaterialTheme.typography.bodySmall,
                    color = Color(0xFFDC2626)
                )
            }
            Spacer(Modifier.height(16.dp))
        }

        when (authMethod) {
            AuthMethod.EMAIL -> EmailAuthFields(
                isLogin = isLogin,
                email = email,
                password = password,
                name = name,
                passwordVisible = passwordVisible,
                onEmailChange = { email = it },
                onPasswordChange = { password = it },
                onNameChange = { name = it },
                onTogglePassword = { passwordVisible = !passwordVisible }
            )
            AuthMethod.PHONE -> PhoneAuthFields(
                phone = phone,
                onPhoneChange = { if (it.length <= 10) phone = it.filter(Char::isDigit) }
            )
        }

        Spacer(Modifier.height(24.dp))

        // Primary button
        val canSubmit = when (authMethod) {
            AuthMethod.EMAIL -> email.isNotBlank() && password.length >= 6 && (isLogin || name.isNotBlank())
            AuthMethod.PHONE -> phone.length == 10
        }

        PrimaryGradientButton(
            text = if (isLoading) t(S.pleaseWait) else if (authMethod == AuthMethod.PHONE) t(S.sendOtp) else if (isLogin) t(S.loginTab) else t(S.signupTab),
            enabled = canSubmit && !isLoading,
            onClick = {
                when (authMethod) {
                    AuthMethod.EMAIL -> onContinueWithEmail(
                        email.trim(),
                        password,
                        name.trim().ifBlank { email.substringBefore('@') },
                        !isLogin
                    )
                    AuthMethod.PHONE -> onContinueWithPhone(phone)
                }
            },
            modifier = Modifier.fillMaxWidth()
        )

        // Loading indicator
        if (isLoading) {
            Spacer(Modifier.height(12.dp))
            CircularProgressIndicator(
                modifier = Modifier.size(24.dp),
                strokeWidth = 2.dp,
                color = HeroGreen
            )
        }

        Spacer(Modifier.height(20.dp))

        // Divider
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.weight(1f).height(1.dp).background(MaterialTheme.colorScheme.outline))
            Text("  ${t(S.orContinue)}  ", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Box(Modifier.weight(1f).height(1.dp).background(MaterialTheme.colorScheme.outline))
        }
        Spacer(Modifier.height(16.dp))

        // Switch auth method hint
        Row(
            Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            SocialButton(
                text = if (authMethod == AuthMethod.PHONE) t(S.useEmail) else t(S.usePhone),
                modifier = Modifier.weight(1f),
                onClick = {
                    authMethod = if (authMethod == AuthMethod.PHONE) AuthMethod.EMAIL else AuthMethod.PHONE
                }
            )
            SocialButton(
                text = if (isLogin) t(S.signUpHint) else t(S.loginHint),
                modifier = Modifier.weight(1f),
                onClick = { isLogin = !isLogin }
            )
        }

        Spacer(Modifier.weight(1f))
        Spacer(Modifier.height(12.dp))

        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            modifier = Modifier.padding(bottom = 20.dp)
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

private enum class AuthMethod { EMAIL, PHONE }

@Composable
private fun EmailAuthFields(
    isLogin: Boolean,
    email: String,
    password: String,
    name: String,
    passwordVisible: Boolean,
    onEmailChange: (String) -> Unit,
    onPasswordChange: (String) -> Unit,
    onNameChange: (String) -> Unit,
    onTogglePassword: () -> Unit
) {
    if (!isLogin) {
        FieldLabel(t(S.yourName))
        HeroTextField(value = name, onValueChange = onNameChange, placeholder = t(S.namePlaceholderAuth).take(25))
        Spacer(Modifier.height(16.dp))
    }

    FieldLabel(t(S.emailLabel))
    HeroTextField(
        value = email,
        onValueChange = onEmailChange,
        placeholder = "parent@example.com",
        keyboardType = KeyboardType.Email
    )
    Spacer(Modifier.height(16.dp))

    FieldLabel(t(S.passwordLabel))
    OutlinedTextField(
        value = password,
        onValueChange = onPasswordChange,
        placeholder = { Text(t(S.passwordPlaceholder).take(20), color = MaterialTheme.colorScheme.onSurfaceVariant) },
        singleLine = true,
        shape = RoundedCornerShape(14.dp),
        visualTransformation = if (passwordVisible) VisualTransformation.None else PasswordVisualTransformation(),
        trailingIcon = {
            IconButton(onClick = onTogglePassword) {
                Icon(
                    if (passwordVisible) Icons.Outlined.VisibilityOff else Icons.Outlined.Visibility,
                    contentDescription = if (passwordVisible) "Hide password" else "Show password"
                )
            }
        },
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
        colors = OutlinedTextFieldDefaults.colors(
            focusedBorderColor = MaterialTheme.colorScheme.primary,
            unfocusedBorderColor = MaterialTheme.colorScheme.outline,
            focusedContainerColor = MaterialTheme.colorScheme.surface,
            unfocusedContainerColor = MaterialTheme.colorScheme.surface,
        ),
        modifier = Modifier.fillMaxWidth()
    )

    if (!isLogin) {
        Spacer(Modifier.height(8.dp))
        Text(
            t(S.emailConfirmNote),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

@Composable
private fun PhoneAuthFields(
    phone: String,
    onPhoneChange: (String) -> Unit
) {
    FieldLabel(t(S.phoneLabel))
    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(
            Modifier
                .height(56.dp)
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
        color = MaterialTheme.colorScheme.onSurfaceVariant
    )
}

@Composable
private fun AuthTab(text: String, selected: Boolean, modifier: Modifier = Modifier, onClick: () -> Unit) {
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(12.dp))
            .background(if (selected) MaterialTheme.colorScheme.surface else Color.Transparent)
            .height(44.dp)
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text,
            style = MaterialTheme.typography.titleSmall,
            fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Medium,
            color = if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(horizontal = 8.dp)
        )
    }
}

@Composable
private fun AuthMethodChip(
    label: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    selected: Boolean,
    modifier: Modifier = Modifier,
    onClick: () -> Unit
) {
    Row(
        modifier = modifier
            .clip(RoundedCornerShape(12.dp))
            .background(if (selected) MaterialTheme.colorScheme.surface else Color.Transparent)
            .height(44.dp)
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center
    ) {
        Icon(
            icon,
            contentDescription = null,
            tint = if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.size(18.dp)
        )
        Spacer(Modifier.width(6.dp))
        Text(
            label,
            style = MaterialTheme.typography.titleSmall,
            fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Medium,
            color = if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

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
    keyboardType: KeyboardType = KeyboardType.Text
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        placeholder = { Text(placeholder, color = MaterialTheme.colorScheme.onSurfaceVariant) },
        singleLine = true,
        shape = RoundedCornerShape(14.dp),
        keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
        colors = OutlinedTextFieldDefaults.colors(
            focusedBorderColor = MaterialTheme.colorScheme.primary,
            unfocusedBorderColor = MaterialTheme.colorScheme.outline,
            focusedContainerColor = MaterialTheme.colorScheme.surface,
            unfocusedContainerColor = MaterialTheme.colorScheme.surface,
        ),
        modifier = modifier.fillMaxWidth()
    )
}

@Composable
private fun SocialButton(text: String, modifier: Modifier = Modifier, onClick: () -> Unit) {
    Box(
        modifier = modifier
            .height(52.dp)
            .clip(RoundedCornerShape(14.dp))
            .border(1.dp, MaterialTheme.colorScheme.outline, RoundedCornerShape(14.dp))
            .background(MaterialTheme.colorScheme.surface)
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center
    ) {
        Text(text, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
    }
}
