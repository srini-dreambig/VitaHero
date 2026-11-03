package kallam.healthcare.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.automirrored.outlined.KeyboardArrowRight
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import kallam.healthcare.data.S
import kallam.healthcare.ui.theme.AppCorners
import kallam.healthcare.ui.theme.AppSpacing
import kallam.healthcare.ui.theme.FlagAlert
import kallam.healthcare.ui.theme.FlagGood
import kallam.healthcare.ui.theme.FlagWatch
import kallam.healthcare.ui.theme.BeigeDeep
import kallam.healthcare.ui.theme.BlueLight
import kallam.healthcare.ui.theme.HeroBlue
import kallam.healthcare.ui.theme.OliveLight
import kallam.healthcare.ui.theme.Pink
import kallam.healthcare.ui.theme.PinkLight
import kallam.healthcare.ui.theme.YellowLight

/*
 * The app's design kit: the pieces every screen is built from.
 *
 * One header, one section title, one list row, one chip of each kind, one
 * field, one secondary button. Screens compose these instead of styling their
 * own Box + clip + background, so a radius, a padding or a type size is decided
 * once, here, and the screens cannot drift apart again.
 *
 * Type roles (sizes in Type.kt):
 *   root screen title   headlineLarge   27 Bricolage Grotesque ExtraBold
 *   detail screen title headlineSmall   18 SemiBold
 *   section title       titleLarge      16 SemiBold
 *   row / card title    titleMedium     14 SemiBold
 *   body                bodyMedium      14
 *   supporting / meta   bodySmall       12
 *   chip / status       labelMedium     12 Medium
 * Spacing: 20 screen margin, 16 card padding, 12 between cards, 24 between
 * sections. Corners: 14 controls, 20 cards, 28 hero banners, pill for
 * buttons and chips.
 *
 * Colour: cards are beige on a cream page, with no border. A tone has a deep
 * shade for text and icons ([color]) and a pastel fill ([container]); tinted
 * blocks use the fill with ink text, never the deep shade at low alpha.
 */

/** Tones a status pill, notice or segmented choice can take. */
enum class Tone { Neutral, Info, Good, Watch, Alert, Brand }

@Composable
fun Tone.color(): Color = when (this) {
    Tone.Neutral -> MaterialTheme.colorScheme.onSurfaceVariant
    Tone.Info -> HeroBlue
    Tone.Good -> FlagGood
    Tone.Watch -> FlagWatch
    Tone.Alert -> FlagAlert
    Tone.Brand -> MaterialTheme.colorScheme.primary
}

/** The pastel fill for a tone: chips, notes, stat tiles. Text on it is ink. */
@Composable
fun Tone.container(): Color =
    if (MaterialTheme.colorScheme.background.luminance() < 0.5f) color().copy(alpha = 0.20f)
    else when (this) {
        Tone.Neutral -> BeigeDeep
        Tone.Info -> BlueLight
        Tone.Good -> OliveLight
        Tone.Watch -> YellowLight
        Tone.Alert -> PinkLight
        Tone.Brand -> Pink
    }

/**
 * The one screen header.
 *
 * With [onBack] it is a detail header: back arrow, 18sp title, small subtitle.
 * Without it is a root (tab) header: 24sp title on the screen margin. Titles
 * wrap to two lines rather than clip a child's or a camp's name.
 */
@Composable
fun AppScreenHeader(
    title: String,
    modifier: Modifier = Modifier,
    subtitle: String? = null,
    onBack: (() -> Unit)? = null,
    actions: @Composable RowScope.() -> Unit = {},
) {
    Row(
        modifier
            .fillMaxWidth()
            .padding(
                start = if (onBack != null) AppSpacing.xs else AppSpacing.xl,
                end = AppSpacing.md,
                top = AppSpacing.sm,
                bottom = AppSpacing.sm,
            ),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (onBack != null) {
            IconButton(onClick = onBack) {
                Icon(Icons.AutoMirrored.Outlined.ArrowBack, contentDescription = t(S.goBack))
            }
        }
        Column(Modifier.weight(1f).padding(start = if (onBack != null) AppSpacing.xs else 0.dp)) {
            Text(
                title,
                style = if (onBack != null) MaterialTheme.typography.headlineSmall
                else MaterialTheme.typography.headlineLarge,
                color = MaterialTheme.colorScheme.onBackground,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
            if (!subtitle.isNullOrBlank()) {
                Text(
                    subtitle,
                    style = if (onBack != null) MaterialTheme.typography.bodySmall
                    else MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
        Row(verticalAlignment = Alignment.CenterVertically, content = actions)
    }
}

/** A section title inside a screen, with an optional trailing action. */
@Composable
fun AppSectionTitle(
    title: String,
    modifier: Modifier = Modifier,
    subtitle: String? = null,
    actionLabel: String? = null,
    onAction: (() -> Unit)? = null,
) {
    Row(modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f)) {
            Text(title, style = MaterialTheme.typography.titleLarge, color = MaterialTheme.colorScheme.onBackground)
            if (!subtitle.isNullOrBlank()) {
                Text(subtitle, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
        if (actionLabel != null && onAction != null) {
            AppTextButton(actionLabel, onAction)
        }
    }
}

/** A card's surface: the one radius, border and padding for every card. */
@Composable
fun AppCard(
    modifier: Modifier = Modifier,
    onClick: (() -> Unit)? = null,
    background: Color = MaterialTheme.colorScheme.surface,
    contentPadding: PaddingValues = PaddingValues(AppSpacing.lg),
    content: @Composable ColumnScope.() -> Unit,
) {
    val shape = RoundedCornerShape(AppCorners.large)
    val border: BorderStroke? = null
    if (onClick != null) {
        Surface(onClick = onClick, modifier = modifier.fillMaxWidth(), shape = shape, color = background, border = border) {
            Column(Modifier.padding(contentPadding), content = content)
        }
    } else {
        Surface(modifier = modifier.fillMaxWidth(), shape = shape, color = background, border = border) {
            Column(Modifier.padding(contentPadding), content = content)
        }
    }
}

/**
 * The one list row: leading avatar or icon, title, supporting lines, trailing
 * status. The title column always takes the remaining width and the trailing
 * slot is capped, so a long status can never squeeze a child's name to
 * nothing (the roster used to show "Aarav…" or no name at all).
 */
@Composable
fun AppListRow(
    title: String,
    modifier: Modifier = Modifier,
    subtitle: String? = null,
    supporting: String? = null,
    supportingTone: Tone = Tone.Neutral,
    leading: (@Composable () -> Unit)? = null,
    trailing: (@Composable () -> Unit)? = null,
    showChevron: Boolean = false,
    onClick: (() -> Unit)? = null,
) {
    AppCard(modifier, onClick = onClick, contentPadding = PaddingValues(horizontal = AppSpacing.lg, vertical = AppSpacing.md)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            if (leading != null) {
                leading()
                Box(Modifier.size(AppSpacing.md))
            }
            Column(Modifier.weight(1f)) {
                Text(
                    title,
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.onSurface,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                if (!subtitle.isNullOrBlank()) {
                    Text(
                        subtitle,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
                if (!supporting.isNullOrBlank()) {
                    Text(
                        supporting,
                        style = MaterialTheme.typography.bodySmall,
                        color = if (supportingTone == Tone.Neutral) MaterialTheme.colorScheme.onSurfaceVariant
                        else supportingTone.color(),
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
            }
            if (trailing != null) {
                Box(Modifier.padding(start = AppSpacing.sm)) { trailing() }
            }
            if (showChevron) {
                Icon(
                    Icons.AutoMirrored.Outlined.KeyboardArrowRight,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(start = AppSpacing.xs),
                )
            }
        }
    }
}

/** A read-only status: tinted pill, optional dot. Never wraps. */
@Composable
fun StatusPill(text: String, tone: Tone, modifier: Modifier = Modifier, dot: Boolean = false) {
    val c = tone.color()
    Row(
        modifier
            .clip(RoundedCornerShape(50))
            .background(tone.container())
            .padding(horizontal = 10.dp, vertical = AppSpacing.xs),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (dot) {
            Box(Modifier.size(6.dp).clip(CircleShape).background(c))
            Box(Modifier.size(6.dp))
        }
        Text(text, style = MaterialTheme.typography.labelMedium, color = c, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}

/** A tappable filter or choice chip. Selected reads as brand-tinted. */
@Composable
fun SelectChip(
    text: String,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    count: Int? = null,
) {
    Surface(
        onClick = onClick,
        modifier = modifier.defaultMinSize(minHeight = 36.dp),
        shape = RoundedCornerShape(50),
        color = if (selected) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surface,
        border = if (selected) null else BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
    ) {
        Box(Modifier.padding(horizontal = 14.dp, vertical = AppSpacing.sm), contentAlignment = Alignment.Center) {
            Text(
                if (count != null) "$text $count" else text,
                style = MaterialTheme.typography.labelMedium,
                color = if (selected) MaterialTheme.colorScheme.onPrimaryContainer else MaterialTheme.colorScheme.onSurface,
                maxLines = 1,
            )
        }
    }
}

/**
 * A row of mutually exclusive choices in a track, like Normal / Watch / Alert.
 * Each option can carry its own tone so the chosen one reads in its colour.
 * Replaces the bare-text rows the review screens used, which did not look
 * tappable at all.
 */
@Composable
fun <T> SegmentedChoice(
    options: List<T>,
    selected: T?,
    onSelect: (T) -> Unit,
    label: (T) -> String,
    modifier: Modifier = Modifier,
    toneOf: (T) -> Tone = { Tone.Brand },
    enabled: Boolean = true,
) {
    Row(
        modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(50))
            .background(MaterialTheme.colorScheme.surfaceVariant)
            .padding(3.dp),
        horizontalArrangement = Arrangement.spacedBy(AppSpacing.xxs),
    ) {
        options.forEach { option ->
            val isSel = option == selected
            Box(
                Modifier
                    .weight(1f)
                    .heightIn(min = 40.dp)
                    .clip(RoundedCornerShape(50))
                    .background(if (isSel) toneOf(option).container() else Color.Transparent)
                    .clickable(enabled = enabled, role = Role.RadioButton) { onSelect(option) }
                    .padding(horizontal = AppSpacing.xs, vertical = AppSpacing.sm),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    label(option),
                    style = MaterialTheme.typography.labelLarge,
                    color = if (isSel) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    textAlign = TextAlign.Center,
                )
            }
        }
    }
}

/**
 * The one text field. The label sits above the box, not inside it, so a long
 * label ("Mid-arm circ. (cm)") wraps above its own box instead of inside a
 * narrow one, and fields in a row stay aligned on their boxes. Put fields in a
 * Row with `verticalAlignment = Alignment.Bottom`.
 */
@Composable
fun AppTextField(
    value: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    label: String? = null,
    placeholder: String? = null,
    supportingText: String? = null,
    isError: Boolean = false,
    singleLine: Boolean = true,
    minLines: Int = 1,
    enabled: Boolean = true,
    keyboardType: KeyboardType = KeyboardType.Text,
    leadingIcon: ImageVector? = null,
) {
    Column(modifier) {
        if (!label.isNullOrBlank()) {
            Text(
                label,
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(bottom = AppSpacing.xs),
            )
        }
        OutlinedTextField(
            value = value,
            onValueChange = onValueChange,
            modifier = Modifier.fillMaxWidth(),
            placeholder = placeholder?.let { { Text(it, style = MaterialTheme.typography.bodyMedium, maxLines = 1, overflow = TextOverflow.Ellipsis) } },
            supportingText = supportingText?.let { { Text(it, style = MaterialTheme.typography.bodySmall) } },
            leadingIcon = leadingIcon?.let { { Icon(it, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant) } },
            isError = isError,
            singleLine = singleLine,
            minLines = minLines,
            enabled = enabled,
            textStyle = MaterialTheme.typography.bodyLarge,
            shape = RoundedCornerShape(AppCorners.medium),
            keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = MaterialTheme.colorScheme.primary,
                unfocusedBorderColor = MaterialTheme.colorScheme.outline,
                focusedContainerColor = MaterialTheme.colorScheme.surfaceContainerLowest,
                unfocusedContainerColor = MaterialTheme.colorScheme.surfaceContainerLowest,
                errorContainerColor = MaterialTheme.colorScheme.surfaceContainerLowest,
            ),
        )
    }
}

/** The secondary action next to a [PrimaryGradientButton]: a light blue pill, same height. */
@Composable
fun SecondaryButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    leadingIcon: ImageVector? = null,
) {
    OutlinedButton(
        onClick = onClick,
        enabled = enabled,
        modifier = modifier.defaultMinSize(minHeight = 52.dp),
        shape = RoundedCornerShape(50),
        border = null,
        colors = ButtonDefaults.outlinedButtonColors(
            containerColor = MaterialTheme.colorScheme.secondaryContainer,
            contentColor = MaterialTheme.colorScheme.onSecondaryContainer,
            disabledContainerColor = MaterialTheme.colorScheme.surfaceVariant,
            disabledContentColor = MaterialTheme.colorScheme.onSurfaceVariant,
        ),
    ) {
        if (leadingIcon != null) {
            Icon(leadingIcon, contentDescription = null, modifier = Modifier.size(18.dp))
            Box(Modifier.size(AppSpacing.sm))
        }
        Text(text, style = MaterialTheme.typography.labelLarge, textAlign = TextAlign.Center)
    }
}

/** A low-emphasis inline action ("All camps", "Cancel"). */
@Composable
fun AppTextButton(text: String, onClick: () -> Unit, modifier: Modifier = Modifier, enabled: Boolean = true, tone: Tone = Tone.Brand) {
    TextButton(onClick = onClick, modifier = modifier, enabled = enabled) {
        Text(text, style = MaterialTheme.typography.labelLarge, color = if (enabled) tone.color() else MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

/** A tinted information block inside a screen. [Notice] is this on the screen margin. */
@Composable
fun InfoNote(
    text: String,
    modifier: Modifier = Modifier,
    tone: Tone = Tone.Info,
    icon: ImageVector? = null,
) {
    val c = tone.color()
    Row(
        modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(AppCorners.medium))
            .background(tone.container())
            .padding(AppSpacing.md),
        verticalAlignment = Alignment.Top,
    ) {
        if (icon != null) {
            Icon(icon, contentDescription = null, tint = c, modifier = Modifier.size(18.dp))
            Box(Modifier.size(AppSpacing.sm))
        }
        Text(text, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurface)
    }
}

/** A labelled number: "Height / 132 cm". Tiles in a row share the width. */
@Composable
fun StatTile(label: String, value: String, modifier: Modifier = Modifier, tone: Tone = Tone.Neutral) {
    Column(
        modifier
            .clip(RoundedCornerShape(AppCorners.medium))
            .background(tone.container())
            .padding(horizontal = AppSpacing.md, vertical = AppSpacing.sm),
    ) {
        Text(label, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis)
        Text(
            value,
            style = MaterialTheme.typography.titleMedium,
            color = MaterialTheme.colorScheme.onSurface,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}
