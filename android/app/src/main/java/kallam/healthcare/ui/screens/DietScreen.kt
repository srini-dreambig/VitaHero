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
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.AutoAwesome
import androidx.compose.material.icons.outlined.CameraAlt
import androidx.compose.material.icons.outlined.Check
import androidx.compose.material.icons.outlined.Lightbulb
import androidx.compose.material.icons.outlined.Psychology
import androidx.compose.material.icons.outlined.TipsAndUpdates
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
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
import kallam.healthcare.ui.components.HeroCard
import kallam.healthcare.ui.components.ProgressRing
import kallam.healthcare.ui.components.t
import kallam.healthcare.ui.components.tf
import kallam.healthcare.ui.theme.AppTheme
import kallam.healthcare.ui.theme.HeroBlue
import kallam.healthcare.ui.theme.HeroOrange
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

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = { Text("$kidName — ${t(S.todaysPlan)}", style = MaterialTheme.typography.titleLarge,
                              maxLines = 1,
                              overflow = TextOverflow.Ellipsis,
                          ) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Outlined.ArrowBack, contentDescription = t(S.goBack))
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background)
            )
        }
    ) { pad ->
        LazyColumn(
            Modifier
                .fillMaxWidth()
                .padding(pad),
            contentPadding = PaddingValues(start = 20.dp, end = 20.dp, bottom = 32.dp)
        ) {
            item {
                // Today summary card
                HeroCard(Modifier.fillMaxWidth(), background = MaterialTheme.colorScheme.surface) {
                    Row(Modifier.padding(20.dp), verticalAlignment = Alignment.CenterVertically) {
                        ProgressRing(progress = progress, size = 72.dp, color = HeroOrange) {
                            Text("$eatenCount/${counted.size}", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                        }
                        Spacer(Modifier.width(18.dp))
                        Column {
                            Text(t(S.todaysPlan), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                            Text(
                                "$totalKcal / $targetKcal kcal",
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            Spacer(Modifier.height(6.dp))
                            Text(
                                if (progress >= 1f) t(S.allMealsLogged)
                                else t(S.logAllMealsHint),
                                style = MaterialTheme.typography.bodySmall,
                                color = HeroOrange,
                                fontWeight = FontWeight.SemiBold
                            )
                        }
                    }
                }
                Spacer(Modifier.height(16.dp))
            }

            // The dietician's plan, if a dietician has written one.
            //
            // Above the generated tips on purpose. One of these was written by
            // a person who looked at this child's growth and haemoglobin; the
            // other is a generated suggestion. They should not read as equals.
            if (plan != null) {
                item {
                    DietPlanCard(plan)
                    Spacer(Modifier.height(16.dp))
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
                Spacer(Modifier.height(24.dp))
                Text(t(S.todaysMeals), style = MaterialTheme.typography.headlineSmall)
                Spacer(Modifier.height(12.dp))
            }

            // Food recognition button
            item {
                Box(
                    Modifier
                        .fillMaxWidth()
                        .padding(vertical = 4.dp)
                        .clip(RoundedCornerShape(16.dp))
                        .background(MaterialTheme.colorScheme.tertiaryContainer)
                        .clickable(onClick = onOpenFoodRecognition)
                        .padding(14.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Outlined.CameraAlt, contentDescription = null, tint = MaterialTheme.colorScheme.onTertiaryContainer, modifier = Modifier.size(20.dp))
                        Spacer(Modifier.width(8.dp))
                        Text(t(S.recognizeFood), color = MaterialTheme.colorScheme.onTertiaryContainer, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                    }
                }
                Spacer(Modifier.height(12.dp))
            }

            items(shown, key = { it.id }) { meal ->
                MealCard(meal) { onToggleMeal(meal.id) }
                Spacer(Modifier.height(10.dp))
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
    HeroCard(Modifier.fillMaxWidth(), background = MaterialTheme.colorScheme.surface) {
        Column(Modifier.padding(18.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    Icons.Outlined.TipsAndUpdates,
                    contentDescription = null,
                    tint = HeroBlue,
                    modifier = Modifier.size(20.dp),
                )
                Spacer(Modifier.width(8.dp))
                Text(
                    plan.title.ifBlank { t(S.dietPlanTitle) },
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            if (plan.authorName.isNotBlank()) {
                Spacer(Modifier.height(2.dp))
                Text(
                    tf(S.dietPlanFrom, plan.authorName),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Spacer(Modifier.height(10.dp))
            Text(plan.guidance, style = MaterialTheme.typography.bodyMedium)
            plan.targets.forEach { target ->
                Spacer(Modifier.height(8.dp))
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        target.label,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.weight(1f),
                    )
                    Text(
                        target.value,
                        style = MaterialTheme.typography.bodySmall,
                        fontWeight = FontWeight.SemiBold,
                        color = HeroBlue,
                    )
                }
            }
        }
    }
}

@Composable
private fun AiPromptCard(onGenerate: () -> Unit) {
    Box(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(24.dp))
            .background(Brush.linearGradient(listOf(HeroPurple, HeroBlue)))
            .clickable(onClick = onGenerate)
            .padding(20.dp)
    ) {
        Column {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    Modifier
                        .size(40.dp)
                        .clip(CircleShape)
                        .background(Color.White.copy(alpha = 0.2f)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(Icons.Outlined.Psychology, contentDescription = null, tint = Color.White)
                }
                Spacer(Modifier.width(12.dp))
                Column {
                    Text(t(S.aiDietCoach), color = Color.White, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    Text(t(S.aiSubtitle), color = Color.White.copy(alpha = 0.9f), style = MaterialTheme.typography.bodySmall)
                }
            }
            Spacer(Modifier.height(14.dp))
            Box(
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(14.dp))
                    .background(Color.White)
                    .padding(horizontal = 18.dp, vertical = 13.dp),
                contentAlignment = Alignment.Center
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Outlined.AutoAwesome, contentDescription = null, tint = HeroPurple, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(8.dp))
                    Text(t(S.generateTips), color = HeroPurple, style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.SemiBold)
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
            .clip(RoundedCornerShape(24.dp))
            .background(Brush.linearGradient(listOf(HeroPurple, HeroBlue)))
            .padding(20.dp)
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    Modifier
                        .size(40.dp)
                        .clip(CircleShape)
                        .background(Color.White.copy(alpha = 0.2f)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(Icons.Outlined.Psychology, contentDescription = null, tint = Color.White)
                }
                Spacer(Modifier.width(12.dp))
                Column {
                    Text(tf(S.analyzing, kidName), color = Color.White, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    Text(t(S.craftingTips), color = Color.White.copy(alpha = 0.9f), style = MaterialTheme.typography.bodySmall)
                }
            }
            Spacer(Modifier.height(16.dp))
            LinearProgressIndicator(
                progress = { alpha },
                modifier = Modifier
                    .fillMaxWidth(0.6f)
                    .height(4.dp)
                    .clip(RoundedCornerShape(2.dp)),
                color = Color.White,
                trackColor = Color.White.copy(alpha = 0.2f),
            )
        }
    }
}

@Composable
private fun AIContentCard(content: AIDietContent, onRegenerate: () -> Unit) {
    Column(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(24.dp))
            .background(HeroPurple.copy(alpha = 0.06f))
            .animateContentSize()
    ) {
        // Header
        Row(
            Modifier
                .fillMaxWidth()
                .background(Brush.linearGradient(listOf(HeroOrange, HeroBlue)))
                .padding(20.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                Modifier
                    .size(40.dp)
                    .clip(CircleShape)
                    .background(Color.White.copy(alpha = 0.2f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(Icons.Outlined.AutoAwesome, contentDescription = null, tint = Color.White)
            }
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(t(S.aiDietCoach), color = Color.White, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                Text(content.generatedAt, color = Color.White.copy(alpha = 0.85f), style = MaterialTheme.typography.labelSmall)
            }
        }

        Column(Modifier.padding(20.dp)) {
            // Greeting
            Text(content.greeting, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)

            Spacer(Modifier.height(14.dp))

            // Insight
            AITipRow(Icons.Outlined.Lightbulb, HeroYellow, t(S.whyMatters), content.insight)
            Spacer(Modifier.height(12.dp))

            // Suggestion
            AITipRow(Icons.Outlined.TipsAndUpdates, HeroOrange, t(S.tryToday), content.suggestion)
            Spacer(Modifier.height(12.dp))

            // Fun fact
            AITipRow(Icons.Outlined.Psychology, HeroBlue, t(S.funFact), content.funFact)

            Spacer(Modifier.height(16.dp))
            Box(
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(14.dp))
                    .background(MaterialTheme.colorScheme.surface)
                    .clickable(onClick = onRegenerate)
                    .padding(vertical = 13.dp),
                contentAlignment = Alignment.Center
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Outlined.AutoAwesome, contentDescription = null, tint = HeroPurple, modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(6.dp))
                    Text(t(S.refreshTips), color = HeroPurple, style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.SemiBold)
                }
            }
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
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(label, style = MaterialTheme.typography.labelSmall, color = tint, fontWeight = FontWeight.SemiBold)
            Spacer(Modifier.height(2.dp))
            Text(text, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurface)
        }
    }
}

@Composable
private fun MealCard(meal: MealItem, onToggle: () -> Unit) {
    val scale by animateFloatAsState(if (meal.eaten) 1f else 0f, tween(300), label = "check")
    HeroCard(
        Modifier
            .fillMaxWidth()
            .clickable(onClick = onToggle),
        background = if (meal.eaten) HeroOrange.copy(alpha = 0.07f) else MaterialTheme.colorScheme.surface
    ) {
        Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        Modifier
                            .clip(RoundedCornerShape(50))
                            .background(MaterialTheme.colorScheme.tertiaryContainer)
                            .padding(horizontal = 8.dp, vertical = 3.dp)
                    ) {
                        Text(meal.time, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onTertiaryContainer, fontWeight = FontWeight.SemiBold)
                    }
                    Spacer(Modifier.width(8.dp))
                    Text("${meal.kcal} kcal", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                Spacer(Modifier.height(6.dp))
                Text(
                    meal.name,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
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
            Spacer(Modifier.width(12.dp))
            Box(
                Modifier
                    .size(32.dp)
                    .clip(CircleShape)
                    .background(if (meal.eaten) HeroOrange else MaterialTheme.colorScheme.surfaceVariant),
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
