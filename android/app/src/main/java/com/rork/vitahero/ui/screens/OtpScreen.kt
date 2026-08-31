package com.rork.vitahero.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.systemBars
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
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
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
 * OTP verification screen for phone OTP via the Cloudflare Worker.
 */
@Composable
fun OtpScreen(
    phone: String,
    parentName: String,
    onBack: () -> Unit,
    onVerified: (code: String) -> Unit,
    onResend: (() -> Unit)? = null,
    isVerifying: Boolean = false,
    error: String? = null
) {
    var code by remember { mutableStateOf("") }
    var seconds by remember { mutableIntStateOf(30) }
    val focus = remember { FocusRequester() }
    val keyboard = LocalSoftwareKeyboardController.current

    LaunchedEffect(Unit) {
        // A frame's grace: requesting focus before the window has it is a
        // no-op, and then nothing would open the keypad at all.
        delay(150)
        runCatching {
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
            // MainActivity runs edge-to-edge, and systemBars insets do not
            // include the keyboard. Without this the keypad covers the digit
            // boxes and the Verify button the moment it opens.
            .imePadding()
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

        // OTP input.
        //
        // The digit boxes ARE the text field, drawn as its decoration. They
        // used to be a separate Row painted on top of a 1.dp invisible field:
        // the boxes had no tap handler and covered the field, so a tap landed
        // on nothing and the keypad never opened. The only thing that ever
        // focused the field was the one-shot LaunchedEffect below, so once the
        // keyboard was dismissed — a back gesture is enough — there was no way
        // left to bring it back.
        BasicTextField(
            value = code,
            onValueChange = { entered ->
                val digits = entered.filter(Char::isDigit).take(6)
                if (digits != code) code = digits
            },
            keyboardOptions = KeyboardOptions(
                keyboardType = KeyboardType.Number,
                imeAction = ImeAction.Done
            ),
            singleLine = true,
            modifier = Modifier
                .fillMaxWidth()
                .focusRequester(focus)
                // Tapping an already-focused field does not re-open a keyboard
                // the user has dismissed, so ask for it explicitly every time
                // rather than relying on the focus change alone.
                .pointerInput(Unit) {
                    detectTapGestures {
                        focus.requestFocus()
                        keyboard?.show()
                    }
                },
            // Digits are drawn in the boxes below; the field's own text must
            // not also paint on top of them.
            textStyle = TextStyle(color = Color.Transparent),
            cursorBrush = SolidColor(Color.Transparent),
            decorationBox = { innerTextField ->
                Box {
                    // The real input node still has to be placed, even though
                    // nothing of it is visible.
                    Box(Modifier.size(1.dp)) { innerTextField() }

                    Row(
                        Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        repeat(6) { i ->
                            val char = code.getOrNull(i)?.toString() ?: ""
                            val active = i == code.length
                            Box(
                                Modifier
                                    .weight(1f)
                                    .height(58.dp)
                                    .clip(RoundedCornerShape(14.dp))
                                    .background(MaterialTheme.colorScheme.surface)
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
                                        color = MaterialTheme.colorScheme.onSurface
                                    )
                                }
                            }
                        }
                    }
                }
            }
        )

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
                    Text(t(S.resend).take(10), color = HeroOrange, fontWeight = FontWeight.SemiBold)
                }
            }
        }

        Spacer(Modifier.weight(1f))
        PrimaryGradientButton(
            text = if (isVerifying) t(S.pleaseWait) else t(S.verify),
            enabled = code.length == 6 && !isVerifying,
            onClick = { onVerified(code) },
            modifier = Modifier
                .fillMaxWidth()
                .padding(bottom = 32.dp)
        )
    }
}
