package kallam.healthcare.ui.theme

import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/**
 * Design Tokens for VitaHero Material 3 Design System.
 * Establishes consistent spacing, corner radii, and elevations
 * across all screens for a professional, UX expert-crafted experience.
 */
object AppSpacing {
    /** 2.dp - Tiny micro-gap */
    val xxs: Dp = 2.dp
    /** 4.dp - Extra small spacing between related inline elements */
    val xs: Dp = 4.dp
    /** 8.dp - Small padding / spacing between compact components */
    val sm: Dp = 8.dp
    /** 12.dp - Medium padding / default item gap */
    val md: Dp = 12.dp
    /** 16.dp - Large padding / card inner padding / section gap */
    val lg: Dp = 16.dp
    /** 20.dp - Extra large screen margin */
    val xl: Dp = 20.dp
    /** 24.dp - Section separation padding */
    val xxl: Dp = 24.dp
    /** 32.dp - Major structural spacing */
    val xxxl: Dp = 32.dp
}

object AppCorners {
    /** 8.dp - Small subtle rounded corners */
    val small: Dp = 8.dp
    /** 12.dp - Medium rounded corners for text inputs & chips */
    val medium: Dp = 12.dp
    /** 16.dp - Large rounded corners for dialogs & dropdown menus */
    val large: Dp = 16.dp
    /** 24.dp - Extra large rounded corners for main HeroCards */
    val xlarge: Dp = 24.dp
    /** 50.dp - Fully rounded pill shape for buttons & chips */
    val pill: Dp = 50.dp
}

object AppElevations {
    val none: Dp = 0.dp
    val low: Dp = 2.dp
    val medium: Dp = 4.dp
    val high: Dp = 8.dp
}
