package com.rork.vitahero.ui.screens

import android.content.Context
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
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material.icons.outlined.Restaurant
import androidx.compose.material.icons.outlined.Share
import androidx.compose.material.icons.outlined.Watch
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.rork.vitahero.data.GrowthAssessment
import com.rork.vitahero.data.GrowthPoint
import com.rork.vitahero.data.HealthConnectService
import com.rork.vitahero.data.HealthFlag
import com.rork.vitahero.data.Kid
import com.rork.vitahero.data.heightText
import com.rork.vitahero.data.weightText
import com.rork.vitahero.data.S
import com.rork.vitahero.ui.components.FlagChip
import com.rork.vitahero.ui.components.HeroCard
import com.rork.vitahero.ui.components.StatusBarSpacer
import com.rork.vitahero.ui.components.IconBubble
import com.rork.vitahero.ui.components.KidAvatar
import com.rork.vitahero.ui.components.t
import com.rork.vitahero.ui.components.tf
import com.rork.vitahero.ui.theme.HeroBlue
import com.rork.vitahero.ui.theme.HeroOrange
import com.rork.vitahero.ui.theme.HeroYellow

private enum class DetailTab(val labelKey: String) {
    GROWTH(S.growthTabLabel), DENTAL(S.dentalTabLabel), EYE(S.eyeTabLabel), NUTRITION(S.nutritionTabLabel)
}

@Composable
fun KidDetailScreen(
    kid: Kid,
    wearableData: HealthConnectService.WearableData? = null,
    onBack: () -> Unit,
    onOpenDiet: () -> Unit,
    onShareReport: (Context) -> Unit,
    onRefreshWearable: () -> Unit = {},
    onLogSymptom: () -> Unit = {},
    onOpenGrowthCharts: () -> Unit = {},
    growthAssessment: GrowthAssessment? = null,
) {
    var tab by remember { mutableStateOf(DetailTab.GROWTH) }
    var isGeneratingReport by remember { mutableStateOf(false) }
    val context = LocalContext.current

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
                    StatusBarSpacer()
                    Spacer(Modifier.height(8.dp))
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
                        // Share report button
                        Box(
                            Modifier
                                .clip(RoundedCornerShape(12.dp))
                                .background(MaterialTheme.colorScheme.surface)
                                .clickable {
                                    isGeneratingReport = true
                                    android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
                                        isGeneratingReport = false
                                        onShareReport(context)
                                    }, 800)
                                }
                                .padding(horizontal = 14.dp, vertical = 10.dp)
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                if (isGeneratingReport) {
                                    Text("Generating…", style = MaterialTheme.typography.labelSmall, color = HeroOrange)
                                } else {
                                    Icon(Icons.Outlined.Share, contentDescription = "Share report", tint = HeroOrange, modifier = Modifier.size(18.dp))
                                    Spacer(Modifier.width(6.dp))
                                    Text(t(S.shareReport), style = MaterialTheme.typography.labelSmall, color = HeroOrange, fontWeight = FontWeight.SemiBold)
                                }
                            }
                        }
                    }
                    Column(
                        Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 20.dp, vertical = 8.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        KidAvatar(kid.name, kid.avatarColor, size = 84.dp)
                        Spacer(Modifier.height(12.dp))
                        Text(kid.name, style = MaterialTheme.typography.headlineLarge, fontWeight = FontWeight.Bold,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                        Text(
                            "${kid.age} yrs · ${kid.gender} · ${kid.school}",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                        Spacer(Modifier.height(16.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            HeaderStat(t(S.heightLabel), kid.heightText())
                            HeaderStat(t(S.weightLabel), kid.weightText())
                        }
                    }
                }
            }
        }

        // Height and weight come from the school's screening, not from a
        // parent's tape measure. A guardian who thinks a number is wrong asks
        // for a correction, which the school checks — that is the whole point
        // of a record a clinician can rely on. What a parent *can* add is the
        // everyday illness the school never sees.
        item {
            Spacer(Modifier.height(12.dp))
            Box(
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp)
                    .clip(RoundedCornerShape(16.dp))
                    .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f))
                    .padding(14.dp),
            ) {
                Text(
                    t(S.measurementsFromSchool),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Spacer(Modifier.height(10.dp))
            Box(
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp)
                    .clip(RoundedCornerShape(16.dp))
                    .background(HeroOrange.copy(alpha = 0.07f))
                    .clickable(onClick = onLogSymptom)
                    .padding(14.dp),
                contentAlignment = Alignment.Center,
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        Icons.Outlined.Add,
                        contentDescription = null,
                        tint = HeroOrange,
                        modifier = Modifier.size(20.dp),
                    )
                    Spacer(Modifier.width(8.dp))
                    Text(
                        t(S.logSymptom),
                        color = HeroOrange,
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.SemiBold,
                    )
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
                            t(t.labelKey),
                            style = MaterialTheme.typography.labelMedium,
                            fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Medium,
                            color = if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }
            Spacer(Modifier.height(14.dp))
        }

        // Wearable / Health Connect card
        item {
            HeroCard(
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp)
                    .clickable { onRefreshWearable() }
            ) {
                Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                    IconBubble(Icons.Outlined.Watch, HeroYellow)
                    Spacer(Modifier.width(14.dp))
                    Column(Modifier.weight(1f)) {
                        Text(t(S.activityData), style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                        Text(
                            when {
                                wearableData?.isConnected == true ->
                                    "${wearableData.stepsToday} ${t(S.stepsToday)} · ${wearableData.activeMinutes} ${t(S.activeMinutes)}"
                                else -> t(S.wearableSub)
                            },
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                    IconBubble(Icons.Outlined.Refresh, HeroOrange)
                }
            }
            Spacer(Modifier.height(14.dp))
        }

        item {
            when (tab) {
                DetailTab.GROWTH -> GrowthTab(kid, growthAssessment, onOpenGrowthCharts)
                DetailTab.DENTAL -> FlagTab(
                    t(S.dentalTabLabel), kid.dental,
                    when (kid.dental) {
                        HealthFlag.NOT_MEASURED -> t(S.notMeasuredMsg)
                        HealthFlag.GOOD -> t(S.dentalGoodMsg)
                        else -> t(S.dentalWatchMsg)
                    }
                )
                DetailTab.EYE -> FlagTab(
                    t(S.eyeTabLabel), kid.eyesight,
                    when (kid.eyesight) {
                        HealthFlag.NOT_MEASURED -> t(S.notMeasuredMsg)
                        HealthFlag.GOOD -> t(S.eyeGoodMsg)
                        else -> t(S.eyeWatchMsg)
                    }
                )
                DetailTab.NUTRITION -> NutritionTab(kid, onOpenDiet)
            }
        }

        item { Spacer(Modifier.height(32.dp)) }
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
private fun GrowthTab(kid: Kid, assessment: GrowthAssessment?, onOpenClinicalCharts: () -> Unit) {
    Column(Modifier.padding(horizontal = 20.dp)) {
        assessment?.let { a ->
            HeroCard(Modifier.fillMaxWidth(), background = HeroOrange.copy(alpha = 0.06f)) {
                Column(Modifier.padding(16.dp)) {
                    Text(t(S.currentAssessment), style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                    Spacer(Modifier.height(8.dp))
                    Text("${t(S.heightPercentile)}: ${a.heightPercentile}% · ${a.heightStatus}", style = MaterialTheme.typography.bodySmall)
                    Text("${t(S.weightPercentile)}: ${a.weightPercentile}% · ${a.weightStatus}", style = MaterialTheme.typography.bodySmall)
                    Text("${t(S.referenceStandard)}: ${a.chartSource}", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            Spacer(Modifier.height(12.dp))
            Box(
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(14.dp))
                    .background(HeroBlue.copy(alpha = 0.1f))
                    .clickable(onClick = onOpenClinicalCharts)
                    .padding(vertical = 14.dp),
                contentAlignment = Alignment.Center
            ) {
                Text(t(S.viewClinicalCharts), color = HeroBlue, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
            }
            Spacer(Modifier.height(14.dp))
        }
        HeroCard(Modifier.fillMaxWidth()) {
            Column(Modifier.padding(18.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(t(S.heightTrend), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
                    FlagChip(HealthFlag.GOOD)
                }
                Spacer(Modifier.height(16.dp))
                GrowthChart(kid.growth, HeroOrange)
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
                Text(t(S.weightTrend), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
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
        InfoNote(t(S.disclaimerChart))
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
        InfoNote(t(S.disclaimerShort))
    }
}

@Composable
private fun NutritionTab(kid: Kid, onOpenDiet: () -> Unit) {
    Column(Modifier.padding(horizontal = 20.dp)) {
        HeroCard(Modifier.fillMaxWidth()) {
            Column(Modifier.padding(20.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    IconBubble(Icons.Outlined.Restaurant, HeroOrange)
                    Spacer(Modifier.width(14.dp))
                    Column(Modifier.weight(1f)) {
                        Text(t(S.dietStatus), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                        Text(t(S.dietSubtitle), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    FlagChip(kid.nutrition)
                }
                Spacer(Modifier.height(16.dp))
                Text(
                    when (kid.nutrition) {
                        HealthFlag.NOT_MEASURED -> t(S.notMeasuredMsg)
                        HealthFlag.GOOD -> t(S.balancedDietMsg)
                        else -> t(S.ironLowMsg)
                    },
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
                    Text(t(S.viewDietPlan), color = MaterialTheme.colorScheme.onPrimary, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
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
