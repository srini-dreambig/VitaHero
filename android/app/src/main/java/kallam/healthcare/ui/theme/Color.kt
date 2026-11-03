package kallam.healthcare.ui.theme

import androidx.compose.ui.graphics.Color

// VitaHero palette. The same hex values are in ios/VitaHero/Support/Theme.swift
// and in the :root block of functions/portal.ts; change all three together.
//
// Fills are the soft pastels: pink for the main action, yellow, olive and blue
// for cards, tags and stat tiles, all on a cream page. Text and icons never use
// a pastel; they use the deep shade of the same hue so they stay readable.

// Fills
val Cream = Color(0xFFFFFCF5)        // page background
val Beige = Color(0xFFF8F3E7)        // cards
val BeigeDeep = Color(0xFFEFE8D7)    // tracks, pressed cards, dividers on beige
val Pink = Color(0xFFFFB2DD)         // primary button, selected chip
val PinkLight = Color(0xFFFAE0E4)
val Yellow = Color(0xFFF7D66E)
val YellowLight = Color(0xFFFEEFBF)
val Olive = Color(0xFF9AAB65)
val OliveLight = Color(0xFFE1E6D1)
val Blue = Color(0xFFB6CAEB)
val BlueLight = Color(0xFFEAF0F9)

// Text
val Ink = Color(0xFF2D2D2B)
val InkSoft = Color(0xFF66625A)
val InkFaint = Color(0xFF9C978C)

// Deep shades of the fills, for text and icons on cream or on their own tint
val PinkDeep = Color(0xFFB0457C)
val YellowDeep = Color(0xFF8A6A0C)
val OliveDeep = Color(0xFF55642A)
val BlueDeep = Color(0xFF3B5B94)

// Older names, kept so screens read the new palette without a rename sweep.
val HeroOrange = PinkDeep
val HeroOrangeDark = Color(0xFF8E3260)
val HeroOrangeSoft = PinkLight
val HeroBlue = BlueDeep
val HeroBlueDark = Color(0xFF2C4777)
val HeroBlueSoft = BlueLight
val HeroYellow = YellowDeep
val HeroYellowSoft = YellowLight
val HeroCoral = Pink
val HeroPurple = OliveDeep

val Canvas = Cream
val SurfaceWhite = Color(0xFFFFFFFF)
val SurfaceMuted = BeigeDeep
val HairLine = Color(0xFFE6DFCC)

// Health status. Alert stays red: a clinical alert must never read as decoration.
val FlagGood = OliveDeep
val FlagWatch = Color(0xFFA86E12)
val FlagAlert = Color(0xFFC8372D)
val FlagNeutral = InkFaint

// Dark theme
val DarkBg = Color(0xFF1C1B19)
val DarkSurface = Color(0xFF282724)
val DarkSurfaceVariant = Color(0xFF34322E)
val DarkOnBg = Color(0xFFF6F1E6)
val DarkOnSurface = Color(0xFFEDE7DA)
val DarkOnSurfaceVariant = Color(0xFFB3AD9F)
val DarkOutline = Color(0xFF45423C)
val DarkHeroOrange = Pink
val DarkHeroBlue = Blue
val DarkHeroYellow = Yellow
val DarkHeroPurple = Olive
