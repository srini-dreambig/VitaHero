package com.rork.vitahero.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable

private val VitaHeroColors = lightColorScheme(
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

@Composable
fun AppTheme(
    content: @Composable () -> Unit
) {
    MaterialTheme(
        colorScheme = VitaHeroColors,
        typography = AppTypography,
        content = content
    )
}
