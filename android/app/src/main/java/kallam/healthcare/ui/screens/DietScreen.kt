package kallam.healthcare.ui.screens

import androidx.compose.animation.animateContentSize
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Restaurant
import androidx.compose.material.icons.outlined.AutoAwesome
import androidx.compose.material.icons.outlined.CameraAlt
import androidx.compose.material.icons.outlined.Check
import androidx.compose.material.icons.outlined.Lightbulb
import androidx.compose.material.icons.outlined.Psychology
import androidx.compose.material.icons.outlined.TipsAndUpdates
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import kallam.healthcare.data.AIDietContent
import kallam.healthcare.data.AppLocale
import kallam.healthcare.data.DietPlanDto
import kallam.healthcare.data.LocalAppLocale
import kallam.healthcare.data.MealItem
import kallam.healthcare.data.S
import kallam.healthcare.ui.components.AppCard
import kallam.healthcare.ui.components.AppScreenHeader
import kallam.healthcare.ui.components.AppSectionTitle
import kallam.healthcare.ui.components.AppTextButton
import kallam.healthcare.ui.components.ProgressRing
import kallam.healthcare.ui.components.SecondaryButton
import kallam.healthcare.ui.components.StatusBarSpacer
import kallam.healthcare.ui.components.StatusPill
import kallam.healthcare.ui.components.Tone
import kallam.healthcare.ui.components.t
import kallam.healthcare.ui.components.tf
import kallam.healthcare.ui.theme.AppCorners
import kallam.healthcare.ui.theme.AppSpacing
import kallam.healthcare.ui.theme.AppTheme
import kallam.healthcare.ui.theme.HeroPurple
import kallam.healthcare.ui.theme.HeroYellow

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DietScreen(
    kidName: String,
    kidId: String,
    meals: List<MealItem>,
    aiContent: AIDietContent?,
    onBack: () -> Unit,
    onToggleMeal: (String) -> Unit,
    onGenerateAI: () -> Unit,
    onOpenFoodRecognition: () -> Unit = {},
    plan: DietPlanDto? = null,
) {
    // With a dietician's plan, the day is the plan's targets. The generated
    // menu is hidden, and photographed snacks stay visible as a log but do
    // not count, because the server counts only plan items toward streaks and
    // badges on a plan day. Without a plan, everything counts as before.
    val hasPlan = plan?.targets?.isNotEmpty() == true
    val shown = if (hasPlan) meals.filter { it.time == "Plan" || (it.time == "Snack" && it.eaten) } else meals
    val counted = if (hasPlan) shown.filter { it.time == "Plan" } else shown
    val eatenCount = counted.count { it.eaten }
    val totalKcal = shown.filter { it.eaten }.sumOf { it.kcal }
    val targetKcal = shown.sumOf { it.kcal }
    val progress = if (counted.isEmpty()) 0f else eatenCount.toFloat() / counted.size

    Column(
        Modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.background)
    ) {
        StatusBarSpacer()
        AppScreenHeader("$kidName — ${t(S.todaysPlan)}", onBack = onBack)
        LazyColumn(
            Modifier.fillMaxWidth(),
            contentPadding = PaddingValues(start = AppSpacing.xl, end = AppSpacing.xl, top = AppSpacing.sm, bottom = AppSpacing.xxxl)
        ) {
            item {
                // Today summary card
                AppCard {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        ProgressRing(progress = progress, size = 72.dp, color = MaterialTheme.colorScheme.primary) {
                            Text("$eatenCount/${counted.size}", style = MaterialTheme.typography.titleMedium)
                        }
                        Spacer(Modifier.width(AppSpacing.lg))
                        Column {
                            Text(t(S.todaysPlan), style = MaterialTheme.typography.titleMedium)
                            Text(
                                "$totalKcal / $targetKcal kcal",
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            Spacer(Modifier.height(AppSpacing.xs))
                            Text(
                                if (progress >= 1f) t(S.allMealsLogged)
                                else t(S.logAllMealsHint),
                                style = MaterialTheme.typography.labelMedium,
                                color = MaterialTheme.colorScheme.primary,
                            )
                        }
                    }
                }
                Spacer(Modifier.height(AppSpacing.md))
            }

            // The dietician's plan, if a dietician has written one.
            //
            // Above the generated tips on purpose. One of these was written by
            // a person who looked at this child's growth and haemoglobin; the
            // other is a generated suggestion. They should not read as equals.
            if (plan != null) {
                item {
                    DietPlanCard(plan)
                    Spacer(Modifier.height(AppSpacing.md))
                }
            }

            // AI Content section
            item {
                if (aiContent != null && aiContent.isGenerating) {
                    GeneratingCard(kidName)
                } else if (aiContent != null && aiContent.greeting.isNotEmpty()) {
                    AIContentCard(content = aiContent, onRegenerate = onGenerateAI)
                } else {
                    AiPromptCard(onGenerate = onGenerateAI)
                }
                Spacer(Modifier.height(AppSpacing.xxl))
                AppSectionTitle(t(S.todaysMeals))
                Spacer(Modifier.height(AppSpacing.md))
            }

            // Food recognition button
            item {
                SecondaryButton(
                    text = t(S.recognizeFood),
                    onClick = onOpenFoodRecognition,
                    modifier = Modifier.fillMaxWidth(),
                    leadingIcon = Icons.Outlined.CameraAlt,
                )
                Spacer(Modifier.height(AppSpacing.md))
            }

            items(shown, key = { it.id }) { meal ->
                MealCard(meal) { onToggleMeal(meal.id) }
                Spacer(Modifier.height(AppSpacing.md))
            }
        }
    }
}

/**
 * What the dietician wrote, as the family reads it.
 *
 * Their name is on it. A plan that arrives unsigned is advice from an app; a
 * plan with a name on it is advice from a person, which is what it is.
 */
@Composable
private fun DietPlanCard(plan: DietPlanDto) {
    AppCard {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(
                Icons.Outlined.TipsAndUpdates,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.secondary,
                modifier = Modifier.size(20.dp),
            )
            Spacer(Modifier.width(AppSpacing.sm))
            Text(
                plan.title.ifBlank { t(S.dietPlanTitle) },
                style = MaterialTheme.typography.titleMedium,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
        if (plan.authorName.isNotBlank()) {
            Spacer(Modifier.height(AppSpacing.xxs))
            Text(
                tf(S.dietPlanFrom, plan.authorName),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        Spacer(Modifier.height(AppSpacing.sm))
        Text(plan.guidance, style = MaterialTheme.typography.bodyMedium)
        plan.targets.forEach { target ->
            Spacer(Modifier.height(AppSpacing.sm))
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text(
                    target.label,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.weight(1f),
                )
                Text(
                    target.value,
                    style = MaterialTheme.typography.labelLarge,
                    color = MaterialTheme.colorScheme.secondary,
                )
            }
        }
        // A plan written for a group cannot know about this child's milk
        // intolerance or allergy, so the family is asked to phone first.
        Spacer(Modifier.height(AppSpacing.md))
        Column(
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(AppCorners.medium))
                .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.10f))
                .padding(AppSpacing.md)
        ) {
            Text(t(S.dietAllergyNote), style = MaterialTheme.typography.bodySmall)
            if (plan.dieticianPhone.isNotBlank()) {
                val context = LocalContext.current
                val phone = plan.dieticianPhone
                AppTextButton(
                    text = tf(S.dietCallDietician, plan.dieticianName.ifBlank { phone }) + " · " + phone,
                    onClick = {
                        runCatching {
                            context.startActivity(
                                android.content.Intent(
                                    android.content.Intent.ACTION_DIAL,
                                    android.net.Uri.parse("tel:" + phone.filter { it.isDigit() || it == '+' }),
                                )
                            )
                        }
                    },
                )
            }
        }
    }
}

@Composable
private fun AiPromptCard(onGenerate: () -> Unit) {
    Box(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(AppCorners.xlarge))
            .background(MaterialTheme.colorScheme.tertiaryContainer)
            .clickable(onClick = onGenerate)
            .padding(AppSpacing.xl)
    ) {
        Column {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    Modifier
                        .size(40.dp)
                        .clip(CircleShape)
                        .background(MaterialTheme.colorScheme.surface),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(Icons.Outlined.Restaurant, contentDescription = null, tint = MaterialTheme.colorScheme.onSurface)
                }
                Spacer(Modifier.width(AppSpacing.md))
                Column {
                    Text(t(S.aiDietCoach), color = MaterialTheme.colorScheme.onSurface, style = MaterialTheme.typography.titleMedium)
                    Text(t(S.aiSubtitle), color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
                }
            }
            Spacer(Modifier.height(AppSpacing.md))
            Box(
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(AppCorners.medium))
                    .background(Color.White)
                    .padding(horizontal = AppSpacing.lg, vertical = AppSpacing.md),
                contentAlignment = Alignment.Center
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Outlined.Restaurant, contentDescription = null, tint = HeroPurple, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(AppSpacing.sm))
                    Text(t(S.generateTips), color = HeroPurple, style = MaterialTheme.typography.labelLarge)
                }
            }
        }
    }
}

@Composable
private fun GeneratingCard(kidName: String) {
    val infinite = rememberInfiniteTransition(label = "shimmer")
    val alpha by infinite.animateFloat(
        initialValue = 0.3f,
        targetValue = 0.8f,
        animationSpec = infiniteRepeatable(tween(700), RepeatMode.Reverse),
        label = "pulse"
    )

    Box(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(AppCorners.xlarge))
            .background(MaterialTheme.colorScheme.tertiaryContainer)
            .padding(AppSpacing.xl)
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    Modifier
                        .size(40.dp)
                        .clip(CircleShape)
                        .background(MaterialTheme.colorScheme.surface),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(Icons.Outlined.Restaurant, contentDescription = null, tint = MaterialTheme.colorScheme.onSurface)
                }
                Spacer(Modifier.width(AppSpacing.md))
                Column {
                    Text(tf(S.analyzing, kidName), color = MaterialTheme.colorScheme.onSurface, style = MaterialTheme.typography.titleMedium)
                    Text(t(S.craftingTips), color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
                }
            }
            Spacer(Modifier.height(AppSpacing.lg))
            LinearProgressIndicator(
                progress = { alpha },
                modifier = Modifier
                    .fillMaxWidth(0.6f)
                    .height(4.dp)
                    .clip(RoundedCornerShape(50)),
                color = MaterialTheme.colorScheme.onSurface,
                trackColor = MaterialTheme.colorScheme.surface,
            )
        }
    }
}

@Composable
private fun AIContentCard(content: AIDietContent, onRegenerate: () -> Unit) {
    Column(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(AppCorners.xlarge))
            .background(HeroPurple.copy(alpha = 0.06f))
            .animateContentSize()
    ) {
        // Header
        Row(
            Modifier
                .fillMaxWidth()
                .background(MaterialTheme.colorScheme.secondaryContainer)
                .padding(AppSpacing.xl),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                Modifier
                    .size(40.dp)
                    .clip(CircleShape)
                    .background(MaterialTheme.colorScheme.surface),
                contentAlignment = Alignment.Center
            ) {
                Icon(Icons.Outlined.Restaurant, contentDescription = null, tint = MaterialTheme.colorScheme.onSurface)
            }
            Spacer(Modifier.width(AppSpacing.md))
            Column(Modifier.weight(1f)) {
                Text(t(S.aiDietCoach), color = MaterialTheme.colorScheme.onSurface, style = MaterialTheme.typography.titleMedium)
                Text(content.generatedAt, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.labelMedium)
            }
        }

        Column(Modifier.padding(AppSpacing.xl)) {
            // Greeting
            Text(content.greeting, style = MaterialTheme.typography.titleMedium)

            Spacer(Modifier.height(AppSpacing.md))

            // Insight
            AITipRow(Icons.Outlined.Lightbulb, HeroYellow, t(S.whyMatters), content.insight)
            Spacer(Modifier.height(AppSpacing.md))

            // Suggestion
            AITipRow(Icons.Outlined.TipsAndUpdates, MaterialTheme.colorScheme.primary, t(S.tryToday), content.suggestion)
            Spacer(Modifier.height(AppSpacing.md))

            // Fun fact
            AITipRow(Icons.Outlined.Restaurant, MaterialTheme.colorScheme.secondary, t(S.funFact), content.funFact)

            Spacer(Modifier.height(AppSpacing.lg))
            SecondaryButton(
                text = t(S.refreshTips),
                onClick = onRegenerate,
                modifier = Modifier.fillMaxWidth(),
                leadingIcon = Icons.Outlined.AutoAwesome,
            )
        }
    }
}

@Composable
private fun AITipRow(icon: androidx.compose.ui.graphics.vector.ImageVector, tint: Color, label: String, text: String) {
    Row(Modifier.fillMaxWidth()) {
        Box(
            Modifier
                .size(36.dp)
                .clip(CircleShape)
                .background(tint.copy(alpha = 0.12f)),
            contentAlignment = Alignment.Center
        ) {
            Icon(icon, contentDescription = null, tint = tint, modifier = Modifier.size(18.dp))
        }
        Spacer(Modifier.width(AppSpacing.md))
        Column(Modifier.weight(1f)) {
            Text(label, style = MaterialTheme.typography.labelMedium, color = tint)
            Spacer(Modifier.height(AppSpacing.xxs))
            Text(text, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurface)
        }
    }
}

@Composable
private fun MealCard(meal: MealItem, onToggle: () -> Unit) {
    val scale by animateFloatAsState(if (meal.eaten) 1f else 0f, tween(300), label = "check")
    AppCard(
        onClick = onToggle,
        background = if (meal.eaten) MaterialTheme.colorScheme.primary.copy(alpha = 0.07f) else MaterialTheme.colorScheme.surface
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    StatusPill(meal.time, Tone.Neutral)
                    Spacer(Modifier.width(AppSpacing.sm))
                    Text("${meal.kcal} kcal", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                Spacer(Modifier.height(AppSpacing.sm))
                Text(
                    meal.name,
                    style = MaterialTheme.typography.titleMedium,
                    textDecoration = if (meal.eaten) TextDecoration.LineThrough else null,
                    color = if (meal.eaten) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.onSurface,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(meal.detail, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            Spacer(Modifier.width(AppSpacing.md))
            Box(
                Modifier
                    .size(32.dp)
                    .clip(CircleShape)
                    .background(if (meal.eaten) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surfaceVariant),
                contentAlignment = Alignment.Center
            ) {
                if (scale > 0.1f) {
                    Icon(Icons.Outlined.Check, contentDescription = "Eaten", tint = Color.White, modifier = Modifier.size(20.dp * scale))
                }
            }
        }
    }
}

@Preview(showBackground = true)
@Composable
private fun DietScreenPreview() {
    androidx.compose.runtime.CompositionLocalProvider(LocalAppLocale provides AppLocale.ENGLISH) {
        AppTheme {
            DietScreen(
                kidName = "Preview",
                kidId = "k1",
                meals = emptyList(),
                aiContent = AIDietContent(
                    greeting = "",
                    insight = "",
                    suggestion = "Try adding some spinach to his lunch today.",
                    funFact = "Spinach is packed with iron and vitamins!"
                ),
                onBack = {},
                onToggleMeal = {},
                onGenerateAI = {}
            )
        }
    }
}
