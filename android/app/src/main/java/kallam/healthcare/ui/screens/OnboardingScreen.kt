package kallam.healthcare.ui.screens

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.LocalHospital
import androidx.compose.material.icons.filled.Psychology
import androidx.compose.material.icons.filled.Restaurant
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material.icons.filled.Verified
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import kallam.healthcare.R
import kallam.healthcare.data.S
import kallam.healthcare.ui.components.IconBubble
import kallam.healthcare.ui.components.PrimaryGradientButton
import kallam.healthcare.ui.components.t
import kallam.healthcare.ui.theme.AppCorners
import kallam.healthcare.ui.theme.AppSpacing
import kallam.healthcare.ui.theme.HeroBlue
import kallam.healthcare.ui.theme.HeroOrange
import kotlinx.coroutines.launch

private data class Slide(
    val image: String,
    val title: String,
    val subtitle: String,
    val accent: Color
)

@Composable
fun OnboardingScreen(
    images: List<String>,
    onFinish: () -> Unit
) {
    val slides = listOf(
        Slide(
            images.getOrElse(0) { "" },
            t(S.onboardingTitle1),
            t(S.onboardingSub1),
            HeroOrange
        ),
        Slide(
            images.getOrElse(1) { "" },
            t(S.onboardingTitle2),
            t(S.onboardingSub2),
            HeroBlue
        ),
        Slide(
            images.getOrElse(2) { "" },
            t(S.onboardingTitle3),
            t(S.onboardingSub3),
            Color(0xFF8B5CF6)
        ),
        Slide(
            images.getOrElse(3) { "" },
            t(S.onboardingTitle4),
            t(S.onboardingSub4),
            Color(0xFFF59E0B)
        ),
    )

    val pager = rememberPagerState { slides.size }
    val scope = rememberCoroutineScope()
    val isLast = pager.currentPage == slides.lastIndex

    Box(
        Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
    ) {
        Column(Modifier.fillMaxSize()) {
            Row(
                Modifier
                    .fillMaxWidth()
                    .windowInsetsPadding(WindowInsets.statusBars)
                    .padding(horizontal = AppSpacing.lg, vertical = AppSpacing.xs),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Image(
                    painter = painterResource(id = R.drawable.vitahero_logo),
                    contentDescription = "VitaHero",
                    modifier = Modifier.height(36.dp)
                )
                TextButton(onClick = onFinish) {
                    Text(
                        t(S.skip),
                        style = MaterialTheme.typography.labelLarge,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            HorizontalPager(
                state = pager,
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth()
            ) { page ->
                val slide = slides[page]
                Column(
                    Modifier
                        .fillMaxSize()
                        .padding(horizontal = AppSpacing.xxl),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Box(
                        Modifier
                            .fillMaxWidth()
                            .weight(1f),
                        contentAlignment = Alignment.Center
                    ) {
                        Box(
                            Modifier
                                .fillMaxHeight()
                                .aspectRatio(0.82f, matchHeightConstraintsFirst = true)
                                .clip(RoundedCornerShape(AppCorners.xlarge))
                                .background(slide.accent.copy(alpha = 0.06f))
                                .border(
                                    1.dp,
                                    slide.accent.copy(alpha = 0.18f),
                                    RoundedCornerShape(AppCorners.xlarge)
                                )
                        ) {
                            if (slide.image.isNotBlank()) {
                                AsyncImage(
                                    model = slide.image,
                                    contentDescription = slide.title,
                                    contentScale = ContentScale.Crop,
                                    modifier = Modifier.fillMaxSize()
                                )
                            } else {
                                OnboardingVisualHero(page = page, accent = slide.accent)
                            }
                        }
                    }
                    Spacer(Modifier.height(AppSpacing.xl))
                    Text(
                        slide.title,
                        style = MaterialTheme.typography.displayMedium,
                        textAlign = TextAlign.Center,
                        color = MaterialTheme.colorScheme.onBackground
                    )
                    Spacer(Modifier.height(AppSpacing.md))
                    Text(
                        slide.subtitle,
                        style = MaterialTheme.typography.bodyLarge,
                        textAlign = TextAlign.Center,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Spacer(Modifier.height(AppSpacing.sm))
                }
            }

            // Dots Indicator
            Row(
                Modifier
                    .fillMaxWidth()
                    .padding(vertical = AppSpacing.lg),
                horizontalArrangement = Arrangement.Center,
                verticalAlignment = Alignment.CenterVertically
            ) {
                repeat(slides.size) { i ->
                    val selected = pager.currentPage == i
                    val width by animateDpAsState(if (selected) 28.dp else 8.dp, label = "dotW")
                    val color by animateColorAsState(
                        if (selected) MaterialTheme.colorScheme.primary
                        else MaterialTheme.colorScheme.outline.copy(alpha = 0.4f),
                        label = "dotC"
                    )
                    Box(
                        Modifier
                            .padding(horizontal = 4.dp)
                            .height(8.dp)
                            .size(width = width, height = 8.dp)
                            .clip(CircleShape)
                            .background(color)
                    )
                }
            }

            Column(
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = AppSpacing.xxl)
                    .padding(bottom = AppSpacing.xxl)
            ) {
                PrimaryGradientButton(
                    text = if (isLast) t(S.createAccount) else t(S.next),
                    onClick = {
                        if (isLast) onFinish()
                        else scope.launch { pager.animateScrollToPage(pager.currentPage + 1) }
                    },
                    modifier = Modifier.fillMaxWidth()
                )
            }
        }
    }
}

/**
 * Handcrafted vector visual hero composable for instant 0ms slide rendering.
 */
@Composable
private fun OnboardingVisualHero(
    page: Int,
    accent: Color
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.verticalGradient(
                    colors = listOf(
                        accent.copy(alpha = 0.12f),
                        accent.copy(alpha = 0.03f)
                    )
                )
            )
            .padding(AppSpacing.lg),
        contentAlignment = Alignment.Center
    ) {
        when (page) {
            0 -> OnboardingVitalsCard(accent)
            1 -> OnboardingTriageCard(accent)
            2 -> OnboardingNutritionCard(accent)
            else -> OnboardingTeleconsultCard(accent)
        }
    }
}

@Composable
private fun OnboardingVitalsCard(accent: Color) {
    Surface(
        shape = RoundedCornerShape(AppCorners.large),
        color = MaterialTheme.colorScheme.surface,
        shadowElevation = 6.dp,
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(
            modifier = Modifier.padding(AppSpacing.lg),
            verticalArrangement = Arrangement.spacedBy(AppSpacing.md)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(AppSpacing.sm)
            ) {
                IconBubble(icon = Icons.Default.Favorite, tint = accent, size = 40.dp)
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        "Live Kid Vitals Tracker",
                        style = MaterialTheme.typography.titleMedium,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                    Text(
                        "Aarav Kallam · 7 Yrs",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                Icon(
                    Icons.Default.Verified,
                    contentDescription = null,
                    tint = HeroBlue,
                    modifier = Modifier.size(20.dp)
                )
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                MetricPill("Height", "122 cm", HeroBlue)
                MetricPill("Weight", "23 kg", HeroOrange)
                MetricPill("Heart Rate", "78 bpm", Color(0xFF10B981))
            }

            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(AppCorners.medium))
                    .background(accent.copy(alpha = 0.1f))
                    .padding(horizontal = AppSpacing.md, vertical = AppSpacing.sm)
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(AppSpacing.xs)
                ) {
                    Icon(
                        Icons.Default.CheckCircle,
                        contentDescription = null,
                        tint = accent,
                        modifier = Modifier.size(16.dp)
                    )
                    Text(
                        "Oakridge Health Camp Sync: Optimal Vitals",
                        style = MaterialTheme.typography.labelMedium,
                        color = accent,
                        fontWeight = FontWeight.SemiBold
                    )
                }
            }
        }
    }
}

@Composable
private fun OnboardingTriageCard(accent: Color) {
    Surface(
        shape = RoundedCornerShape(AppCorners.large),
        color = MaterialTheme.colorScheme.surface,
        shadowElevation = 6.dp,
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(
            modifier = Modifier.padding(AppSpacing.lg),
            verticalArrangement = Arrangement.spacedBy(AppSpacing.md)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(AppSpacing.sm)
            ) {
                IconBubble(icon = Icons.Default.Psychology, tint = accent, size = 40.dp)
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        "AI Symptom Triage Engine",
                        style = MaterialTheme.typography.titleMedium,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                    Text(
                        "Instant Pediatric Guidance",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                Box(
                    modifier = Modifier
                        .clip(CircleShape)
                        .background(accent.copy(alpha = 0.15f))
                        .padding(horizontal = AppSpacing.sm, vertical = AppSpacing.xxs)
                ) {
                    Text(
                        "98.4% Confidence",
                        style = MaterialTheme.typography.labelSmall,
                        color = accent
                    )
                }
            }

            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(AppCorners.medium))
                    .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f))
                    .padding(AppSpacing.md)
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(AppSpacing.xs)) {
                    Text(
                        "Triage Finding: Mild Seasonal Runny Nose",
                        style = MaterialTheme.typography.labelLarge,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                    Text(
                        "Recommendation: Warm fluids, rest, monitor temp.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }
    }
}

@Composable
private fun OnboardingNutritionCard(accent: Color) {
    Surface(
        shape = RoundedCornerShape(AppCorners.large),
        color = MaterialTheme.colorScheme.surface,
        shadowElevation = 6.dp,
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(
            modifier = Modifier.padding(AppSpacing.lg),
            verticalArrangement = Arrangement.spacedBy(AppSpacing.md)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(AppSpacing.sm)
            ) {
                IconBubble(icon = Icons.Default.Restaurant, tint = accent, size = 40.dp)
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        "AI Snap Meal Analyzer",
                        style = MaterialTheme.typography.titleMedium,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                    Text(
                        "Balanced Meal Certified",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                Icon(
                    Icons.Default.AutoAwesome,
                    contentDescription = null,
                    tint = accent,
                    modifier = Modifier.size(22.dp)
                )
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                MetricPill("Protein", "18g", accent)
                MetricPill("Carbs", "42g", HeroBlue)
                MetricPill("Fiber", "8g", Color(0xFF10B981))
            }
        }
    }
}

@Composable
private fun OnboardingTeleconsultCard(accent: Color) {
    Surface(
        shape = RoundedCornerShape(AppCorners.large),
        color = MaterialTheme.colorScheme.surface,
        shadowElevation = 6.dp,
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(
            modifier = Modifier.padding(AppSpacing.lg),
            verticalArrangement = Arrangement.spacedBy(AppSpacing.md)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(AppSpacing.sm)
            ) {
                IconBubble(icon = Icons.Default.LocalHospital, tint = accent, size = 40.dp)
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        "Dr. Ananya Sharma",
                        style = MaterialTheme.typography.titleMedium,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                    Text(
                        "Senior Pediatrician · Rainbow Children's",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(AppCorners.medium))
                    .background(accent.copy(alpha = 0.12f))
                    .padding(AppSpacing.md)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text(
                            "Next Teleconsult Available",
                            style = MaterialTheme.typography.labelMedium,
                            color = accent
                        )
                        Text(
                            "Today · 5:30 PM",
                            style = MaterialTheme.typography.titleMedium,
                            color = MaterialTheme.colorScheme.onSurface
                        )
                    }
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(AppCorners.pill))
                            .background(accent)
                            .padding(horizontal = AppSpacing.md, vertical = AppSpacing.xs)
                    ) {
                        Text(
                            "Book",
                            style = MaterialTheme.typography.labelMedium,
                            color = Color.White
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun MetricPill(label: String, value: String, accent: Color) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier
            .clip(RoundedCornerShape(AppCorners.medium))
            .background(accent.copy(alpha = 0.08f))
            .padding(horizontal = AppSpacing.md, vertical = AppSpacing.sm)
    ) {
        Text(
            label,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Text(
            value,
            style = MaterialTheme.typography.titleSmall,
            color = accent,
            fontWeight = FontWeight.Bold
        )
    }
}

