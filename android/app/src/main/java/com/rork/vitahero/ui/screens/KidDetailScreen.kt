package com.rork.vitahero.ui.screens

import android.content.Context
import android.widget.Toast
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
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material.icons.outlined.RemoveRedEye
import androidx.compose.material.icons.outlined.Restaurant
import androidx.compose.material.icons.outlined.Share
import androidx.compose.material.icons.outlined.TrendingUp
import androidx.compose.material.icons.outlined.Watch
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.AlertDialog
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.rork.vitahero.data.GrowthAssessment
import com.rork.vitahero.data.GrowthPoint
import com.rork.vitahero.data.HealthConnectService
import com.rork.vitahero.data.HealthFlag
import com.rork.vitahero.data.Kid
import com.rork.vitahero.data.S
import com.rork.vitahero.ui.components.FlagChip
import com.rork.vitahero.ui.components.HeroCard
import com.rork.vitahero.ui.components.IconBubble
import com.rork.vitahero.ui.components.KidAvatar
import com.rork.vitahero.ui.components.PrimaryGradientButton
import com.rork.vitahero.ui.components.SectionHeader
import com.rork.vitahero.ui.components.t
import com.rork.vitahero.ui.components.tf
import com.rork.vitahero.ui.theme.HeroBlue
import com.rork.vitahero.ui.theme.HeroGreen
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
    onAddGrowth: (heightCm: Float, weightKg: Float, label: String) -> Unit,
    onRefreshWearable: () -> Unit = {},
    onDeleteKid: () -> Unit = {},
    onOpenGrowthCharts: () -> Unit = {},
    growthAssessment: GrowthAssessment? = null,
) {
    var tab by remember { mutableStateOf(DetailTab.GROWTH) }
    var showGrowthEntry by remember { mutableStateOf(false) }
    var showDeleteConfirm by remember { mutableStateOf(false) }
    var isGeneratingReport by remember { mutableStateOf(false) }
    val context = LocalContext.current

    if (showDeleteConfirm) {
        AlertDialog(
            onDismissRequest = { showDeleteConfirm = false },
            title = { Text(t(S.deleteKidConfirm)) },
            text = { Text(t(S.deleteKidBody)) },
            confirmButton = {
                TextButton(onClick = {
                    showDeleteConfirm = false
                    onDeleteKid()
                }) {
                    Text(t(S.deleteKid), color = MaterialTheme.colorScheme.error)
                }
            },
            dismissButton = {
                TextButton(onClick = { showDeleteConfirm = false }) {
                    Text(t(S.cancel))
                }
            }
        )
    }

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
                                    Text("Generating…", style = MaterialTheme.typography.labelSmall, color = HeroGreen)
                                } else {
                                    Icon(Icons.Outlined.Share, contentDescription = "Share report", tint = HeroGreen, modifier = Modifier.size(18.dp))
                                    Spacer(Modifier.width(6.dp))
                                    Text("Share Report", style = MaterialTheme.typography.labelSmall, color = HeroGreen, fontWeight = FontWeight.SemiBold)
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

        // Add growth data entry
        item {
            Spacer(Modifier.height(12.dp))
            if (showGrowthEntry) {
                GrowthEntryCard(
                    kid = kid,
                    onSave = { h, w, label ->
                        onAddGrowth(h, w, label)
                        showGrowthEntry = false
                    },
                    onDismiss = { showGrowthEntry = false }
                )
            } else {
                Box(
                    Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 20.dp)
                        .clip(RoundedCornerShape(16.dp))
                        .background(HeroGreen.copy(alpha = 0.07f))
                        .clickable { showGrowthEntry = true }
                        .padding(14.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Outlined.Add, contentDescription = null, tint = HeroGreen, modifier = Modifier.size(20.dp))
                        Spacer(Modifier.width(8.dp))
                        Text(t(S.logMeasurements), color = HeroGreen, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
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
                    IconBubble(Icons.Outlined.Refresh, HeroGreen)
                }
            }
            Spacer(Modifier.height(14.dp))
        }

        item {
            when (tab) {
                DetailTab.GROWTH -> GrowthTab(kid, growthAssessment, onOpenGrowthCharts)
                DetailTab.DENTAL -> FlagTab(
                    t(S.dentalTabLabel), kid.dental,
                    if (kid.dental == HealthFlag.GOOD) t(S.dentalGoodMsg)
                    else t(S.dentalWatchMsg)
                )
                DetailTab.EYE -> FlagTab(
                    t(S.eyeTabLabel), kid.eyesight,
                    if (kid.eyesight == HealthFlag.GOOD) t(S.eyeGoodMsg)
                    else t(S.eyeWatchMsg)
                )
                DetailTab.NUTRITION -> NutritionTab(kid, onOpenDiet)
            }
        }

        item {
            Spacer(Modifier.height(24.dp))
            Box(
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp)
                    .clip(RoundedCornerShape(14.dp))
                    .background(MaterialTheme.colorScheme.errorContainer.copy(alpha = 0.35f))
                    .clickable { showDeleteConfirm = true }
                    .padding(vertical = 14.dp),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    t(S.deleteKid),
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.error
                )
            }
            Spacer(Modifier.height(32.dp))
        }
    }
}

@Composable
private fun GrowthEntryCard(
    kid: Kid,
    onSave: (heightCm: Float, weightKg: Float, label: String) -> Unit,
    onDismiss: () -> Unit
) {
    var height by remember { mutableStateOf(kid.heightCm.toString()) }
    var weight by remember { mutableStateOf(kid.weightKg.toString()) }
    val canSave = height.toFloatOrNull() != null && weight.toFloatOrNull() != null

    HeroCard(Modifier.padding(horizontal = 20.dp), background = MaterialTheme.colorScheme.surface) {
        Column(Modifier.padding(18.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Outlined.TrendingUp, contentDescription = null, tint = HeroGreen, modifier = Modifier.size(22.dp))
                Spacer(Modifier.width(8.dp))
                Text(t(S.newMeasurement), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
                Box(
                    Modifier
                        .size(32.dp)
                        .clip(RoundedCornerShape(10.dp))
                        .background(MaterialTheme.colorScheme.surfaceVariant)
                        .clickable(onClick = onDismiss),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(Icons.Outlined.Close, contentDescription = "Dismiss", modifier = Modifier.size(18.dp))
                }
            }
            Spacer(Modifier.height(14.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Column(Modifier.weight(1f)) {
                    Text(t(S.kidHeight), style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Spacer(Modifier.height(4.dp))
                    OutlinedTextField(
                        value = height,
                        onValueChange = { height = it.filter { c -> c.isDigit() || c == '.' } },
                        singleLine = true,
                        shape = RoundedCornerShape(12.dp),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = HeroGreen,
                            unfocusedBorderColor = MaterialTheme.colorScheme.outline,
                            focusedContainerColor = MaterialTheme.colorScheme.surface,
                            unfocusedContainerColor = MaterialTheme.colorScheme.surface,
                        ),
                        modifier = Modifier.fillMaxWidth()
                    )
                }
                Column(Modifier.weight(1f)) {
                    Text(t(S.kidWeight), style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Spacer(Modifier.height(4.dp))
                    OutlinedTextField(
                        value = weight,
                        onValueChange = { weight = it.filter { c -> c.isDigit() || c == '.' } },
                        singleLine = true,
                        shape = RoundedCornerShape(12.dp),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = HeroGreen,
                            unfocusedBorderColor = MaterialTheme.colorScheme.outline,
                            focusedContainerColor = MaterialTheme.colorScheme.surface,
                            unfocusedContainerColor = MaterialTheme.colorScheme.surface,
                        ),
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            }
            Spacer(Modifier.height(14.dp))
            PrimaryGradientButton(
                text = t(S.saveMeasurements),
                enabled = canSave,
                onClick = {
                    val h = height.toFloatOrNull() ?: return@PrimaryGradientButton
                    val w = weight.toFloatOrNull() ?: return@PrimaryGradientButton
                    val label = java.time.LocalDate.now().let { d ->
                        val fmt = java.time.format.DateTimeFormatter.ofPattern("dd MMM")
                        d.format(fmt)
                    }
                    onSave(h, w, label)
                },
                modifier = Modifier.fillMaxWidth()
            )
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
private fun GrowthTab(kid: Kid, assessment: GrowthAssessment?, onOpenClinicalCharts: () -> Unit) {
    Column(Modifier.padding(horizontal = 20.dp)) {
        assessment?.let { a ->
            HeroCard(Modifier.fillMaxWidth(), background = HeroGreen.copy(alpha = 0.06f)) {
                Column(Modifier.padding(16.dp)) {
                    Text(t(S.currentAssessment), style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                    Spacer(Modifier.height(8.dp))
                    Text("${t(S.heightPercentile)}: ${a.heightPercentile}% · ${a.heightStatus}", style = MaterialTheme.typography.bodySmall)
                    Text("${t(S.bmiPercentile)}: ${a.bmiPercentile}% · ${a.bmiStatus}", style = MaterialTheme.typography.bodySmall)
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
                    IconBubble(Icons.Outlined.Restaurant, HeroGreen)
                    Spacer(Modifier.width(14.dp))
                    Column(Modifier.weight(1f)) {
                        Text(t(S.dietStatus), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                        Text(t(S.dietSubtitle), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    FlagChip(kid.nutrition)
                }
                Spacer(Modifier.height(16.dp))
                Text(
                    if (kid.nutrition == HealthFlag.GOOD) t(S.balancedDietMsg)
                    else t(S.ironLowMsg),
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
