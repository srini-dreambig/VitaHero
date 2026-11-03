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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import kallam.healthcare.R
import kallam.healthcare.data.S
import kallam.healthcare.ui.components.AppTextButton
import kallam.healthcare.ui.components.IconBubble
import kallam.healthcare.ui.components.PrimaryGradientButton
import kallam.healthcare.ui.components.StatTile
import kallam.healthcare.ui.components.Illustration
import kallam.healthcare.ui.components.Scene
import kallam.healthcare.ui.components.StatusPill
import kallam.healthcare.ui.components.Tone
import kallam.healthcare.ui.components.t
import kallam.healthcare.ui.theme.AppCorners
import kallam.healthcare.ui.theme.AppSpacing
import kallam.healthcare.ui.theme.FlagWatch
import kallam.healthcare.ui.theme.HeroPurple
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
            MaterialTheme.colorScheme.primary
        ),
        Slide(
            images.getOrElse(1) { "" },
            t(S.onboardingTitle2),
            t(S.onboardingSub2),
            MaterialTheme.colorScheme.secondary
        ),
        Slide(
            images.getOrElse(2) { "" },
            t(S.onboardingTitle3),
            t(S.onboardingSub3),
            HeroPurple
        ),
        Slide(
            images.getOrElse(3) { "" },
            t(S.onboardingTitle4),
            t(S.onboardingSub4),
            FlagWatch
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
                    modifier = Modifier.height(48.dp)
                )
                AppTextButton(t(S.skip), onClick = onFinish, tone = Tone.Neutral)
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
                                .fillMaxSize()
                                .padding(horizontal = AppSpacing.xl)
                                .clip(RoundedCornerShape(AppCorners.xlarge))
                                .background(MaterialTheme.colorScheme.surface)
                        ) {
                            if (slide.image.isNotBlank()) {
                                AsyncImage(
                                    model = slide.image,
                                    contentDescription = slide.title,
                                    contentScale = ContentScale.Crop,
                                    modifier = Modifier.fillMaxSize()
                                )
                            } else {
                                Illustration(
                                    scene = listOf(Scene.Growth, Scene.Checkup, Scene.Food, Scene.Doctor)[page],
                                    modifier = Modifier.fillMaxSize().padding(AppSpacing.lg)
                                )
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
                            .padding(horizontal = AppSpacing.xs)
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

