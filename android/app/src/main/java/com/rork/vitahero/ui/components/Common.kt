package com.rork.vitahero.ui.components

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.Dp
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.ui.unit.dp
import com.rork.vitahero.data.AppLocale
import com.rork.vitahero.data.HealthFlag
import com.rork.vitahero.data.LocalAppLocale
import com.rork.vitahero.data.tr

/**
 * How much room the bottom navigation bar takes, plus the system navigation
 * inset beneath it.
 *
 * Every tab screen scrolls its own content behind that bar, so each one has to
 * end with this much padding or its last row sits underneath the tabs. They
 * used to end with a flat 24.dp, which is roughly a third of what is needed —
 * on every phone, on all five tabs, the last child, camp and badge were clipped.
 */
@Composable
fun bottomBarClearance(): Dp =
    72.dp + WindowInsets.navigationBars.asPaddingValues().calculateBottomPadding()

@Composable
fun StatusBarSpacer() {
    Spacer(Modifier.height(WindowInsets.statusBars.asPaddingValues().calculateTopPadding()))
}

/** A soft, rounded card used everywhere for a consistent friendly look. */
@Composable
fun HeroCard(
    modifier: Modifier = Modifier,
    background: Color = MaterialTheme.colorScheme.surface,
    border: Boolean = true,
    content: @Composable () -> Unit
) {
    Surface(
        modifier = modifier,
        shape = RoundedCornerShape(24.dp),
        color = background,
        border = if (border) BorderStroke(1.dp, MaterialTheme.colorScheme.outline) else null,
        content = content
    )
}

@Composable
fun SectionHeader(
    title: String,
    modifier: Modifier = Modifier,
    actionLabel: String? = null,
    onAction: (() -> Unit)? = null
) {
    Row(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(title, style = MaterialTheme.typography.headlineSmall)
        if (actionLabel != null && onAction != null) {
            Text(
                actionLabel,
                style = MaterialTheme.typography.labelLarge,
                color = MaterialTheme.colorScheme.primary,
                modifier = Modifier
                    .clip(RoundedCornerShape(8.dp))
                    .background(MaterialTheme.colorScheme.primaryContainer)
                    .padding(horizontal = 10.dp, vertical = 4.dp)
            )
        }
    }
}

/** Circular tinted container holding a linear icon. */
@Composable
fun IconBubble(
    icon: ImageVector,
    tint: Color,
    modifier: Modifier = Modifier,
    size: Dp = 44.dp,
    bg: Color = tint.copy(alpha = 0.14f)
) {
    Box(
        modifier = modifier
            .size(size)
            .clip(CircleShape)
            .background(bg),
        contentAlignment = Alignment.Center
    ) {
        Icon(icon, contentDescription = null, tint = tint, modifier = Modifier.size(size * 0.5f))
    }
}

/** Small colored pill showing a health status flag with a dot. */
@Composable
fun FlagChip(flag: HealthFlag, modifier: Modifier = Modifier) {
    Row(
        modifier = modifier
            .clip(RoundedCornerShape(50))
            .background(flag.color.copy(alpha = 0.13f))
            .padding(horizontal = 10.dp, vertical = 5.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        Box(
            Modifier
                .size(7.dp)
                .clip(CircleShape)
                .background(flag.color)
        )
        Text(
            flag.label,
            style = MaterialTheme.typography.labelMedium,
            color = flag.color,
            fontWeight = FontWeight.SemiBold
        )
    }
}

/** Animated circular progress ring with a value in the center. */
@Composable
fun ProgressRing(
    progress: Float,
    modifier: Modifier = Modifier,
    size: Dp = 64.dp,
    stroke: Dp = 7.dp,
    color: Color = MaterialTheme.colorScheme.primary,
    track: Color = MaterialTheme.colorScheme.surfaceVariant,
    center: @Composable () -> Unit = {}
) {
    val animated by animateFloatAsState(
        targetValue = progress.coerceIn(0f, 1f),
        animationSpec = tween(900),
        label = "ring"
    )
    Box(modifier = modifier.size(size), contentAlignment = Alignment.Center) {
        Canvas(Modifier.size(size)) {
            val sw = stroke.toPx()
            drawArc(
                color = track,
                startAngle = 0f,
                sweepAngle = 360f,
                useCenter = false,
                style = Stroke(width = sw, cap = StrokeCap.Round)
            )
            drawArc(
                color = color,
                startAngle = -90f,
                sweepAngle = 360f * animated,
                useCenter = false,
                style = Stroke(width = sw, cap = StrokeCap.Round)
            )
        }
        center()
    }
}

/** Initial-letter avatar with a colored gradient background. */
@Composable
fun KidAvatar(
    name: String,
    colorValue: Long,
    modifier: Modifier = Modifier,
    size: Dp = 48.dp
) {
    val base = Color(colorValue)
    Box(
        modifier = modifier
            .size(size)
            .clip(CircleShape)
            .background(
                Brush.linearGradient(
                    listOf(base, base.copy(alpha = 0.7f))
                )
            ),
        contentAlignment = Alignment.Center
    ) {
        Text(
            name.take(1).uppercase(),
            color = Color.White,
            fontWeight = FontWeight.Bold,
            style = MaterialTheme.typography.titleLarge
        )
    }
}

@Composable
fun PrimaryGradientButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    leadingIcon: ImageVector? = null
) {
    val colors = MaterialTheme.colorScheme
    Surface(
        onClick = onClick,
        enabled = enabled,
        shape = RoundedCornerShape(18.dp),
        color = Color.Transparent,
        modifier = modifier.height(56.dp)
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .background(
                    if (enabled) Brush.horizontalGradient(listOf(colors.primary, colors.secondary))
                    else Brush.horizontalGradient(listOf(colors.outline, colors.outline))
                ),
            contentAlignment = Alignment.Center
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                if (leadingIcon != null) {
                    Icon(leadingIcon, contentDescription = null, tint = Color.White, modifier = Modifier.size(20.dp))
                }
                Text(
                    text,
                    color = Color.White,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold
                )
            }
        }
    }
}

/** Centered empty state with icon, title, subtitle and optional action. */
@Composable
fun EmptyState(
    icon: ImageVector,
    title: String,
    subtitle: String,
    modifier: Modifier = Modifier,
    tint: Color = MaterialTheme.colorScheme.onSurfaceVariant,
    actionLabel: String? = null,
    onAction: (() -> Unit)? = null
) {
    Column(
        modifier = modifier.padding(40.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Box(
            Modifier
                .size(80.dp)
                .clip(CircleShape)
                .background(tint.copy(alpha = 0.1f)),
            contentAlignment = Alignment.Center
        ) {
            Icon(icon, contentDescription = null, tint = tint, modifier = Modifier.size(40.dp))
        }
        Spacer(Modifier.height(20.dp))
        Text(
            title,
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.SemiBold,
            color = MaterialTheme.colorScheme.onBackground
        )
        Spacer(Modifier.height(8.dp))
        Text(
            subtitle,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        if (actionLabel != null && onAction != null) {
            Spacer(Modifier.height(24.dp))
            PrimaryGradientButton(text = actionLabel, onClick = onAction, modifier = Modifier.fillMaxWidth(0.6f))
        }
    }
}

@Composable
fun FieldLabel(text: String, modifier: Modifier = Modifier) {
    Text(
        text,
        style = MaterialTheme.typography.labelLarge,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = modifier
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
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        placeholder = { Text(placeholder, color = MaterialTheme.colorScheme.onSurfaceVariant) },
        singleLine = true,
        shape = RoundedCornerShape(14.dp),
        keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
        visualTransformation = if (isPassword) PasswordVisualTransformation() else VisualTransformation.None,
        colors = OutlinedTextFieldDefaults.colors(
            focusedBorderColor = MaterialTheme.colorScheme.primary,
            unfocusedBorderColor = MaterialTheme.colorScheme.outline,
            focusedContainerColor = MaterialTheme.colorScheme.surface,
            unfocusedContainerColor = MaterialTheme.colorScheme.surface,
        ),
        modifier = modifier
    )
}

/** Resolve a translated string for the current locale. */
@Composable
fun t(key: String): String = tr(key, LocalAppLocale.current)

/** Resolve a translated format string (supports one %s replacement). */
@Composable
fun tf(key: String, arg: String): String = tr(key, LocalAppLocale.current).replace("%s", arg)

/** Resolve a translated format string (supports two %s replacements). */
@Composable
fun tf2(key: String, arg1: String, arg2: String): String =
    tr(key, LocalAppLocale.current).replace("%s1", arg1).replace("%s2", arg2)

/** Full-screen loading placeholder with a subtle shimmer. */
@Composable
fun LoadingPlaceholder(
    modifier: Modifier = Modifier,
    message: String = "Loading…"
) {
    Box(
        modifier = modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.background),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            ProgressRing(progress = 1f, size = 52.dp, stroke = 5.dp)
            Spacer(Modifier.height(16.dp))
            Text(
                message,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}
