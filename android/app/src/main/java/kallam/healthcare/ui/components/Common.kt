package kallam.healthcare.ui.components

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
import androidx.compose.foundation.layout.defaultMinSize
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
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import kallam.healthcare.ui.theme.HeroBlue
import androidx.compose.ui.unit.Dp
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.ui.unit.dp
import kallam.healthcare.data.HealthFlag
import kallam.healthcare.data.LocalAppLocale
import kallam.healthcare.data.tr

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
        shape = RoundedCornerShape(kallam.healthcare.ui.theme.AppCorners.large),
        color = background,
        border = if (border) BorderStroke(1.dp, MaterialTheme.colorScheme.outline) else null,
        content = content
    )
}

/** Kept for existing callers; the section title is [AppSectionTitle]. */
@Composable
fun SectionHeader(
    title: String,
    modifier: Modifier = Modifier,
    actionLabel: String? = null,
    onAction: (() -> Unit)? = null
) = AppSectionTitle(title, modifier, actionLabel = actionLabel, onAction = onAction)

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

/** A health flag as a [StatusPill], in the flag's own colour. */
@Composable
fun FlagChip(flag: HealthFlag, modifier: Modifier = Modifier) {
    Row(
        modifier = modifier
            .clip(RoundedCornerShape(50))
            .background(flag.color.copy(alpha = 0.13f))
            .padding(horizontal = 10.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        Box(
            Modifier
                .size(6.dp)
                .clip(CircleShape)
                .background(flag.color)
        )
        Text(flag.label, style = MaterialTheme.typography.labelMedium, color = flag.color, maxLines = 1)
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

/** Initial-letter avatar on the child's chosen colour. */
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
            .background(base),
        contentAlignment = Alignment.Center
    ) {
        Text(
            name.take(1).uppercase(),
            color = if (base.luminance() > 0.5f) kallam.healthcare.ui.theme.Ink else Color.White,
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
    // The one primary action: a pink pill with ink text. The name predates the
    // palette; it no longer draws a gradient.
    val colors = MaterialTheme.colorScheme
    val content = if (enabled) colors.onPrimaryContainer else colors.onSurfaceVariant
    Surface(
        onClick = onClick,
        enabled = enabled,
        shape = RoundedCornerShape(50),
        color = if (enabled) colors.primaryContainer else colors.surfaceVariant,
        // A floor, not a ceiling. This is the app's main button and its label
        // is translated: "Confirm registration" in Telugu needs two lines on a
        // narrow phone, and at a raised font scale so does the English. A fixed
        // 56dp cut the second line off, and the button read as a half-sentence.
        modifier = modifier.defaultMinSize(minHeight = 56.dp)
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .defaultMinSize(minHeight = 56.dp),
            contentAlignment = Alignment.Center
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.padding(horizontal = 20.dp, vertical = 10.dp),
            ) {
                if (leadingIcon != null) {
                    Icon(leadingIcon, contentDescription = null, tint = content, modifier = Modifier.size(20.dp))
                }
                Text(
                    text,
                    color = content,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.weight(1f, fill = false),
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

/**
 * A line of explanation the screen owes the person, not an error dialog.
 *
 * Used where something is true about the record in front of them and the
 * absence would otherwise read as a bug: a guardian declined a check, another
 * clinician owns the rest of the round, a save was refused and the server said
 * why. Lived in the screening screen until the review screens needed the same
 * shape; two copies of a notice is two places for them to drift apart.
 */
@Composable
fun Notice(text: String, error: Boolean) {
    InfoNote(
        text,
        Modifier.padding(horizontal = 20.dp, vertical = 6.dp),
        tone = if (error) Tone.Alert else Tone.Info,
    )
}
