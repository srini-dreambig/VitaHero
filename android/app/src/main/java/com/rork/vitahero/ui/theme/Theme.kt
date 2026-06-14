package com.rork.vitahero.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val LightColors = lightColorScheme(
    primary = HeroGreen,
    onPrimary = SurfaceWhite,
    primaryContainer = HeroGreenSoft,
    onPrimaryContainer = HeroGreenDark,
    secondary = HeroBlue,
    onSecondary = SurfaceWhite,
    secondaryContainer = HeroBlueSoft,
    onSecondaryContainer = HeroBlueDark,
    tertiary = HeroYellow,
    onTertiary = Ink,
    tertiaryContainer = HeroYellowSoft,
    onTertiaryContainer = Ink,
    background = Canvas,
    onBackground = Ink,
    surface = SurfaceWhite,
    onSurface = Ink,
    surfaceVariant = SurfaceMuted,
    onSurfaceVariant = InkSoft,
    outline = HairLine,
    outlineVariant = HairLine,
    error = FlagAlert,
    onError = SurfaceWhite,
)

private val DarkColors = darkColorScheme(
    primary = DarkHeroGreen,
    onPrimary = DarkBg,
    primaryContainer = Color(0xFF065F46),
    onPrimaryContainer = DarkHeroGreen,
    secondary = DarkHeroBlue,
    onSecondary = DarkBg,
    secondaryContainer = Color(0xFF1E3A5F),
    onSecondaryContainer = DarkHeroBlue,
    tertiary = DarkHeroYellow,
    onTertiary = DarkBg,
    tertiaryContainer = Color(0xFF713F12),
    onTertiaryContainer = DarkHeroYellow,
    background = DarkBg,
    onBackground = DarkOnBg,
    surface = DarkSurface,
    onSurface = DarkOnSurface,
    surfaceVariant = DarkSurfaceVariant,
    onSurfaceVariant = DarkOnSurfaceVariant,
    outline = DarkOutline,
    outlineVariant = DarkOutline,
    error = Color(0xFFFCA5A5),
    onError = DarkBg,
)

@Composable
fun AppTheme(
    darkTheme: Boolean = false,
    content: @Composable () -> Unit
) {
    MaterialTheme(
        colorScheme = if (darkTheme) DarkColors else LightColors,
        typography = AppTypography,
        content = content
    )
}
