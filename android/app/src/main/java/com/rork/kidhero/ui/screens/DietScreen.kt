package com.rork.kidhero.ui.screens

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
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
import androidx.compose.material.icons.outlined.Check
import androidx.compose.material.icons.outlined.PlayArrow
import androidx.compose.material.icons.outlined.SmartDisplay
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
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
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import com.rork.kidhero.data.MealItem
import com.rork.kidhero.ui.components.HeroCard
import com.rork.kidhero.ui.components.ProgressRing
import com.rork.kidhero.ui.theme.HeroBlue
import com.rork.kidhero.ui.theme.HeroGreen
import com.rork.kidhero.ui.theme.HeroPurple
import com.rork.kidhero.ui.theme.HeroYellow

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DietScreen(
    kidName: String,
    meals: List<MealItem>,
    onBack: () -> Unit,
    onToggleMeal: (String) -> Unit
) {
    val eatenCount = meals.count { it.eaten }
    val totalKcal = meals.filter { it.eaten }.sumOf { it.kcal }
    val targetKcal = meals.sumOf { it.kcal }
    val progress = if (meals.isEmpty()) 0f else eatenCount.toFloat() / meals.size

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = { Text("$kidName's Diet", style = MaterialTheme.typography.titleLarge) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Outlined.ArrowBack, contentDescription = "Back")
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
                        ProgressRing(progress = progress, size = 72.dp, color = HeroGreen) {
                            Text("$eatenCount/${meals.size}", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                        }
                        Spacer(Modifier.width(18.dp))
                        Column {
                            Text("Today's plan", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                            Text(
                                "$totalKcal of $targetKcal kcal logged",
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            Spacer(Modifier.height(6.dp))
                            Text(
                                "Log all meals to earn the Super Eater badge",
                                style = MaterialTheme.typography.bodySmall,
                                color = HeroGreen,
                                fontWeight = FontWeight.SemiBold
                            )
                        }
                    }
                }
                Spacer(Modifier.height(16.dp))
            }

            // AI video card
            item {
                AiVideoCard()
                Spacer(Modifier.height(24.dp))
                Text("Today's meals", style = MaterialTheme.typography.headlineSmall)
                Spacer(Modifier.height(12.dp))
            }

            items(meals, key = { it.id }) { meal ->
                MealCard(meal) { onToggleMeal(meal.id) }
                Spacer(Modifier.height(10.dp))
            }
        }
    }
}

@Composable
private fun AiVideoCard() {
    Box(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(24.dp))
            .background(Brush.linearGradient(listOf(HeroPurple, HeroBlue)))
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
                    Icon(Icons.Outlined.SmartDisplay, contentDescription = null, tint = Color.White)
                }
                Spacer(Modifier.width(12.dp))
                Column {
                    Text("AI Diet Video", color = Color.White, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                    Text("Personalised, fun & easy to follow", color = Color.White.copy(alpha = 0.9f), style = MaterialTheme.typography.bodySmall)
                }
            }
            Spacer(Modifier.height(16.dp))
            Box(
                Modifier
                    .fillMaxWidth()
                    .height(120.dp)
                    .clip(RoundedCornerShape(16.dp))
                    .background(Color.White.copy(alpha = 0.15f)),
                contentAlignment = Alignment.Center
            ) {
                Box(
                    Modifier
                        .size(56.dp)
                        .clip(CircleShape)
                        .background(Color.White),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(Icons.Outlined.PlayArrow, contentDescription = "Play", tint = HeroPurple, modifier = Modifier.size(30.dp))
                }
            }
            Spacer(Modifier.height(14.dp))
            Box(
                Modifier
                    .clip(RoundedCornerShape(12.dp))
                    .background(Color.White)
                    .clickable { }
                    .padding(horizontal = 18.dp, vertical = 12.dp)
            ) {
                Text("Generate AI Video", color = HeroPurple, style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.SemiBold)
            }
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
        background = if (meal.eaten) HeroGreen.copy(alpha = 0.07f) else MaterialTheme.colorScheme.surface
    ) {
        Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        Modifier
                            .clip(RoundedCornerShape(50))
                            .background(HeroYellow.copy(alpha = 0.2f))
                            .padding(horizontal = 8.dp, vertical = 3.dp)
                    ) {
                        Text(meal.time, style = MaterialTheme.typography.labelSmall, color = Color(0xFFB45309), fontWeight = FontWeight.SemiBold)
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
                    color = if (meal.eaten) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.onSurface
                )
                Text(meal.detail, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Spacer(Modifier.width(12.dp))
            Box(
                Modifier
                    .size(32.dp)
                    .clip(CircleShape)
                    .background(if (meal.eaten) HeroGreen else MaterialTheme.colorScheme.surfaceVariant),
                contentAlignment = Alignment.Center
            ) {
                if (scale > 0.1f) {
                    Icon(Icons.Outlined.Check, contentDescription = "Eaten", tint = Color.White, modifier = Modifier.size(20.dp * scale))
                }
            }
        }
    }
}
