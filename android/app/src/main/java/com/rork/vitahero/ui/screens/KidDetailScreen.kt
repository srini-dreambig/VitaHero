package com.rork.vitahero.ui.screens

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.RemoveRedEye
import androidx.compose.material.icons.outlined.Restaurant
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.rork.vitahero.data.GrowthPoint
import com.rork.vitahero.data.HealthFlag
import com.rork.vitahero.data.Kid
import com.rork.vitahero.ui.components.FlagChip
import com.rork.vitahero.ui.components.HeroCard
import com.rork.vitahero.ui.components.IconBubble
import com.rork.vitahero.ui.components.KidAvatar
import com.rork.vitahero.ui.components.SectionHeader
import com.rork.vitahero.ui.theme.HeroBlue
import com.rork.vitahero.ui.theme.HeroGreen

private enum class DetailTab(val label: String) {
    GROWTH("Growth"), DENTAL("Dental"), EYE("Eyesight"), NUTRITION("Nutrition")
}

@Composable
fun KidDetailScreen(
    kid: Kid,
    onBack: () -> Unit,
    onOpenDiet: () -> Unit
) {
    var tab by remember { mutableStateOf(DetailTab.GROWTH) }

    LazyColumn(
        modifier = Modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.background),
        contentPadding = PaddingValues(bottom = 32.dp)
    ) {
        // Header
        item {
            Box(
                Modifier
                    .fillMaxWidth()
                    .background(Brush.verticalGradient(listOf(Color(kid.avatarColor).copy(alpha = 0.16f), MaterialTheme.colorScheme.background)))
            ) {
                Column {
                    Spacer(Modifier.height(44.dp))
                    Row(
                        Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 12.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(
                            Modifier
                                .size(44.dp)
                                .clip(RoundedCornerShape(12.dp))
                                .clickable(onClick = onBack),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(Icons.AutoMirrored.Outlined.ArrowBack, contentDescription = "Back")
                        }
                        Spacer(Modifier.weight(1f))
                    }
                    Column(
                        Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 20.dp, vertical = 8.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        KidAvatar(kid.name, kid.avatarColor, size = 84.dp)
                        Spacer(Modifier.height(12.dp))
                        Text(kid.name, style = MaterialTheme.typography.headlineLarge, fontWeight = FontWeight.Bold)
                        Text(
                            "${kid.age} yrs · ${kid.gender} · ${kid.school}",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        Spacer(Modifier.height(16.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            HeaderStat("Height", "${kid.heightCm.toInt()} cm")
                            HeaderStat("Weight", "${kid.weightKg.toInt()} kg")
                            HeaderStat("BMI", "%.1f".format(kid.bmi))
                        }
                    }
                }
            }
        }

        // Tabs
        item {
            Spacer(Modifier.height(16.dp))
            Row(
                Modifier
                    .padding(horizontal = 20.dp)
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(16.dp))
                    .background(MaterialTheme.colorScheme.surfaceVariant)
                    .padding(4.dp)
            ) {
                DetailTab.entries.forEach { t ->
                    val selected = tab == t
                    Box(
                        Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(12.dp))
                            .background(if (selected) MaterialTheme.colorScheme.surface else Color.Transparent)
                            .clickable { tab = t }
                            .padding(vertical = 10.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            t.label,
                            style = MaterialTheme.typography.labelMedium,
                            fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Medium,
                            color = if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }
            Spacer(Modifier.height(20.dp))
        }

        item {
            when (tab) {
                DetailTab.GROWTH -> GrowthTab(kid)
                DetailTab.DENTAL -> FlagTab(
                    "Dental health", kid.dental,
                    if (kid.dental == HealthFlag.GOOD) "No cavities found at last check. Keep brushing twice a day."
                    else "Mild plaque noticed. A dental follow-up is recommended within 2 weeks."
                )
                DetailTab.EYE -> FlagTab(
                    "Eyesight", kid.eyesight,
                    if (kid.eyesight == HealthFlag.GOOD) "Vision is sharp (6/6). No correction needed."
                    else "Mild vision strain detected. Consider an eye specialist follow-up."
                )
                DetailTab.NUTRITION -> NutritionTab(kid, onOpenDiet)
            }
        }
    }
}

@Composable
private fun HeaderStat(label: String, value: String) {
    Column(
        Modifier
            .clip(RoundedCornerShape(16.dp))
            .background(MaterialTheme.colorScheme.surface)
            .padding(horizontal = 18.dp, vertical = 12.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(value, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
        Text(label, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
private fun GrowthTab(kid: Kid) {
    Column(Modifier.padding(horizontal = 20.dp)) {
        HeroCard(Modifier.fillMaxWidth()) {
            Column(Modifier.padding(18.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("Height trend", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
                    FlagChip(HealthFlag.GOOD)
                }
                Spacer(Modifier.height(16.dp))
                GrowthChart(kid.growth, HeroGreen)
                Spacer(Modifier.height(8.dp))
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    kid.growth.forEach {
                        Text(it.label, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }
        }
        Spacer(Modifier.height(14.dp))
        HeroCard(Modifier.fillMaxWidth()) {
            Column(Modifier.padding(18.dp)) {
                Text("Weight trend", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                Spacer(Modifier.height(16.dp))
                GrowthChart(kid.growth, HeroBlue, weight = true)
                Spacer(Modifier.height(8.dp))
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    kid.growth.forEach {
                        Text(it.label, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }
        }
        Spacer(Modifier.height(14.dp))
        InfoNote("Charts are for informational purposes. Always consult your doctor for medical decisions.")
    }
}

@Composable
private fun GrowthChart(points: List<GrowthPoint>, color: Color, weight: Boolean = false) {
    val anim by animateFloatAsState(targetValue = 1f, animationSpec = tween(900), label = "chart")
    val values = points.map { if (weight) it.weight else it.height }
    val minV = (values.minOrNull() ?: 0f)
    val maxV = (values.maxOrNull() ?: 1f)
    val range = (maxV - minV).coerceAtLeast(1f)

    Canvas(
        Modifier
            .fillMaxWidth()
            .height(140.dp)
    ) {
        val w = size.width
        val h = size.height
        val pad = 12f
        val stepX = (w - pad * 2) / (values.size - 1).coerceAtLeast(1)
        fun pointAt(i: Int): Offset {
            val x = pad + stepX * i
            val norm = (values[i] - minV) / range
            val y = h - pad - norm * (h - pad * 2)
            return Offset(x, y)
        }

        // grid lines
        repeat(4) { g ->
            val y = pad + (h - pad * 2) * g / 3f
            drawLine(color.copy(alpha = 0.08f), Offset(0f, y), Offset(w, y), strokeWidth = 2f)
        }

        val linePath = Path()
        val fillPath = Path()
        val count = (values.size * anim).toInt().coerceAtLeast(1)
        for (i in 0 until count) {
            val p = pointAt(i)
            if (i == 0) {
                linePath.moveTo(p.x, p.y)
                fillPath.moveTo(p.x, h - pad)
                fillPath.lineTo(p.x, p.y)
            } else {
                linePath.lineTo(p.x, p.y)
                fillPath.lineTo(p.x, p.y)
            }
        }
        val last = pointAt((count - 1).coerceAtLeast(0))
        fillPath.lineTo(last.x, h - pad)
        fillPath.close()

        drawPath(fillPath, Brush.verticalGradient(listOf(color.copy(alpha = 0.25f), color.copy(alpha = 0f))))
        drawPath(linePath, color, style = Stroke(width = 6f, cap = StrokeCap.Round))
        for (i in 0 until count) {
            val p = pointAt(i)
            drawCircle(Color.White, radius = 8f, center = p)
            drawCircle(color, radius = 5f, center = p)
        }
    }
}

@Composable
private fun FlagTab(title: String, flag: HealthFlag, description: String) {
    Column(Modifier.padding(horizontal = 20.dp)) {
        HeroCard(Modifier.fillMaxWidth()) {
            Column(Modifier.padding(20.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(title, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
                    FlagChip(flag)
                }
                Spacer(Modifier.height(14.dp))
                Text(description, style = MaterialTheme.typography.bodyLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
        Spacer(Modifier.height(14.dp))
        InfoNote("For informational purposes only. Please consult a doctor for diagnosis.")
    }
}

@Composable
private fun NutritionTab(kid: Kid, onOpenDiet: () -> Unit) {
    Column(Modifier.padding(horizontal = 20.dp)) {
        HeroCard(Modifier.fillMaxWidth()) {
            Column(Modifier.padding(20.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    IconBubble(Icons.Outlined.Restaurant, HeroGreen)
                    Spacer(Modifier.width(14.dp))
                    Column(Modifier.weight(1f)) {
                        Text("Diet status", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                        Text("Personalised by our dietician", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    FlagChip(kid.nutrition)
                }
                Spacer(Modifier.height(16.dp))
                Text(
                    if (kid.nutrition == HealthFlag.GOOD) "Balanced diet with good protein and iron intake. Keep it up!"
                    else "Iron and protein intake is a little low. Add more dal, leafy greens and nuts.",
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(Modifier.height(16.dp))
                Box(
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(14.dp))
                        .background(MaterialTheme.colorScheme.primary)
                        .clickable(onClick = onOpenDiet)
                        .padding(vertical = 14.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text("View today's diet plan", color = MaterialTheme.colorScheme.onPrimary, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                }
            }
        }
    }
}

@Composable
private fun InfoNote(text: String) {
    Row(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(MaterialTheme.colorScheme.tertiaryContainer)
            .padding(14.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(text, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onTertiaryContainer)
    }
}
