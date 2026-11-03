package kallam.healthcare.ui.theme

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val LightColors = lightColorScheme(
    // Primary is ink, not pink: it colours text, icons, links and focus rings,
    // which a pastel cannot do legibly. The pink fill lives in primaryContainer
    // and on the main button (PrimaryGradientButton).
    primary = Ink,
    onPrimary = Cream,
    primaryContainer = Pink,
    onPrimaryContainer = Ink,
    secondary = BlueDeep,
    onSecondary = SurfaceWhite,
    secondaryContainer = BlueLight,
    onSecondaryContainer = Ink,
    tertiary = OliveDeep,
    onTertiary = SurfaceWhite,
    tertiaryContainer = OliveLight,
    onTertiaryContainer = Ink,
    background = Cream,
    onBackground = Ink,
    surface = Beige,
    onSurface = Ink,
    surfaceVariant = BeigeDeep,
    onSurfaceVariant = InkSoft,
    surfaceContainerLowest = SurfaceWhite,
    surfaceContainerLow = Cream,
    surfaceContainer = Beige,
    surfaceContainerHigh = Beige,
    surfaceContainerHighest = BeigeDeep,
    outline = HairLine,
    outlineVariant = HairLine,
    error = FlagAlert,
    onError = SurfaceWhite,
    errorContainer = PinkLight,
    onErrorContainer = Color(0xFF8A1F18),
)

private val DarkColors = darkColorScheme(
    primary = DarkOnBg,
    onPrimary = DarkBg,
    primaryContainer = Pink,
    onPrimaryContainer = Ink,
    secondary = Blue,
    onSecondary = Ink,
    secondaryContainer = Color(0xFF2E3A50),
    onSecondaryContainer = DarkOnBg,
    tertiary = Olive,
    onTertiary = Ink,
    tertiaryContainer = Color(0xFF3A4226),
    onTertiaryContainer = DarkOnBg,
    background = DarkBg,
    onBackground = DarkOnBg,
    surface = DarkSurface,
    onSurface = DarkOnSurface,
    surfaceVariant = DarkSurfaceVariant,
    onSurfaceVariant = DarkOnSurfaceVariant,
    surfaceContainerLowest = DarkBg,
    surfaceContainerLow = DarkBg,
    surfaceContainer = DarkSurface,
    surfaceContainerHigh = DarkSurface,
    surfaceContainerHighest = DarkSurfaceVariant,
    outline = DarkOutline,
    outlineVariant = DarkOutline,
    error = Color(0xFFF2A39C),
    onError = DarkBg,
    errorContainer = Color(0xFF5C1F1A),
    onErrorContainer = Color(0xFFFAD4D0),
)

/** Material components (dialogs, menus, buttons) take the same corners as the kit. */
private val AppShapes = Shapes(
    extraSmall = RoundedCornerShape(AppCorners.small),
    small = RoundedCornerShape(AppCorners.medium),
    medium = RoundedCornerShape(AppCorners.large),
    large = RoundedCornerShape(AppCorners.xlarge),
    extraLarge = RoundedCornerShape(AppCorners.xlarge),
)

@Composable
fun AppTheme(
    darkTheme: Boolean = false,
    content: @Composable () -> Unit
) {
    MaterialTheme(
        colorScheme = if (darkTheme) DarkColors else LightColors,
        typography = AppTypography,
        shapes = AppShapes,
        content = content
    )
}
