package com.rork.vitahero.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.focusable
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.MarkEmailRead
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.rork.vitahero.data.S
import com.rork.vitahero.ui.components.PrimaryGradientButton
import com.rork.vitahero.ui.components.t
import com.rork.vitahero.ui.components.tf
import com.rork.vitahero.ui.theme.HeroOrange
import kotlinx.coroutines.delay

/**
 * OTP verification screen for Firebase Phone Auth.
 * The verificationId is provided by Firebase Auth callbacks and passed from the Activity.
 */
@Composable
fun OtpScreen(
    phone: String,
    verificationId: String?,
    onBack: () -> Unit,
    onVerified: (code: String) -> Unit,
    onResend: (() -> Unit)? = null,
    isVerifying: Boolean = false,
    isSending: Boolean = false,
    error: String? = null,
    parentName: String = "",
    devOtp: String? = null,
) {
    var code by remember { mutableStateOf("") }
    var seconds by remember { mutableIntStateOf(30) }
    val focus = remember { FocusRequester() }
    val keyboard = LocalSoftwareKeyboardController.current
    val otpReady = !verificationId.isNullOrBlank()

    // The hidden field only accepts focus once it's enabled (verificationId arrived),
    // so re-request focus + show the keyboard every time readiness flips to true.
    LaunchedEffect(otpReady) {
        if (otpReady) {
            focus.requestFocus()
            keyboard?.show()
        }
    }
    LaunchedEffect(seconds) {
        if (seconds > 0) {
            delay(1000)
            seconds -= 1
        }
    }

    Column(
        Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .windowInsetsPadding(WindowInsets.systemBars)
            .padding(horizontal = 24.dp)
    ) {
        IconButton(onClick = onBack, modifier = Modifier.padding(top = 8.dp)) {
            Icon(Icons.AutoMirrored.Outlined.ArrowBack, contentDescription = "Back")
        }
        Spacer(Modifier.height(12.dp))
        Box(
            Modifier
                .size(64.dp)
                .clip(CircleShape)
                .background(HeroOrange.copy(alpha = 0.14f)),
            contentAlignment = Alignment.Center
        ) {
            Icon(Icons.Outlined.MarkEmailRead, contentDescription = null, tint = HeroOrange, modifier = Modifier.size(32.dp))
        }
        Spacer(Modifier.height(20.dp))
        Text(t(S.verifyNumber), style = MaterialTheme.typography.headlineLarge)
        Spacer(Modifier.height(8.dp))
        Text(
            "${t(S.otpSubtitle)} ${if (phone.isNotBlank()) "+91 $phone" else ""}",
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(Modifier.height(32.dp))

        // Error message
        if (error != null) {
            Box(
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .background(Color(0xFFFEE2E2))
                    .padding(12.dp)
            ) {
                Text(
                    error,
                    style = MaterialTheme.typography.bodySmall,
                    color = Color(0xFFDC2626)
                )
            }
            Spacer(Modifier.height(16.dp))
        }

        // Sending OTP state — waiting for Firebase to send the SMS
        if (isSending && verificationId.isNullOrBlank()) {
            Box(
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .background(MaterialTheme.colorScheme.surfaceVariant)
                    .padding(16.dp),
                contentAlignment = Alignment.Center
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(20.dp),
                        strokeWidth = 2.dp,
                        color = HeroOrange
                    )
                    Spacer(Modifier.width(12.dp))
                    Text(
                        "Sending OTP to +91 $phone...",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
            Spacer(Modifier.height(16.dp))
        }

        // OTP input — only show if verificationId is ready (SMS sent)
        Box {
            BasicTextField(
                value = code,
                onValueChange = { if (it.length <= 6) code = it.filter(Char::isDigit) },
                enabled = otpReady,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
                modifier = Modifier
                    .focusRequester(focus)
                    .focusable()
                    .size(1.dp),
                textStyle = TextStyle(color = MaterialTheme.colorScheme.onBackground)
            ) {}

            // Visible digit boxes — tapping anywhere here (re)focuses the hidden field
            // and pops the keyboard back up, in case it was dismissed.
            Row(
                Modifier
                    .fillMaxWidth()
                    .clickable(enabled = otpReady) {
                        focus.requestFocus()
                        keyboard?.show()
                    },
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                repeat(6) { i ->
                    val char = code.getOrNull(i)?.toString() ?: ""
                    val active = i == code.length && otpReady
                    Box(
                        Modifier
                            .weight(1f)
                            .height(58.dp)
                            .clip(RoundedCornerShape(14.dp))
                            .background(
                                if (otpReady) MaterialTheme.colorScheme.surface
                                else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f)
                            )
                            .border(
                                width = if (active) 2.dp else 1.dp,
                                color = if (active) HeroOrange else MaterialTheme.colorScheme.outline,
                                shape = RoundedCornerShape(14.dp)
                            ),
                        contentAlignment = Alignment.Center
                    ) {
                        if (isVerifying && code.length == 6 && i == 5) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(20.dp),
                                strokeWidth = 2.dp,
                                color = HeroOrange
                            )
                        } else {
                            Text(
                                char,
                                fontSize = 24.sp,
                                fontWeight = FontWeight.Bold,
                                color = if (otpReady) MaterialTheme.colorScheme.onSurface
                                        else MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.4f)
                            )
                        }
                    }
                }
            }
        }

        Spacer(Modifier.height(20.dp))
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                t(S.didntGetCode),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            if (seconds > 0) {
                Text(
                    tf(S.resendIn, seconds.toString()),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    fontWeight = FontWeight.SemiBold
                )
            } else {
                TextButton(onClick = {
                    seconds = 30
                    onResend?.invoke()
                }) {
                    Text(t(S.resend), color = HeroOrange, fontWeight = FontWeight.SemiBold)
                }
            }
        }

        Spacer(Modifier.weight(1f))
        PrimaryGradientButton(
            text = when {
                isVerifying -> t(S.pleaseWait)
                isSending && verificationId.isNullOrBlank() -> "Sending OTP..."
                else -> t(S.verify)
            },
            enabled = code.length == 6 && !isVerifying && !isSending && !verificationId.isNullOrBlank(),
            onClick = { onVerified(code) },
            modifier = Modifier
                .fillMaxWidth()
                .padding(bottom = 32.dp)
        )
    }
}
