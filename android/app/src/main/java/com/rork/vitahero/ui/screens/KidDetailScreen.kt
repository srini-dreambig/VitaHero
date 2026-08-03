package com.rork.vitahero.ui.screens

import android.content.Context
import android.widget.Toast
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.material.icons.automirrored.outlined.TrendingUp
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
import androidx.compose.runtime.rememberCoroutineScope
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
import com.rork.vitahero.ui.theme.HeroOrange
import com.rork.vitahero.ui.theme.HeroYellow
import com.rork.vitahero.ui.theme.FlagGood
import com.rork.vitahero.ui.theme.FlagWatch
import com.rork.vitahero.ui.theme.FlagAlert
import com.rork.vitahero.data.ApiRepositoryProvider
import com.rork.vitahero.data.HealthCheckupResultDto
import com.rork.vitahero.data.HealthVisitDto
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import androidx.compose.material.icons.outlined.MedicalServices
import androidx.compose.material.icons.outlined.LocalHospital
import androidx.compose.material.icons.outlined.EditNote

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
    onOpenCheckup: (String) -> Unit = {},
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
                                    Text("Generating…", style = MaterialTheme.typography.labelSmall, color = HeroOrange)
                                } else {
                                    Icon(Icons.Outlined.Share, contentDescription = "Share report", tint = HeroOrange, modifier = Modifier.size(18.dp))
                                    Spacer(Modifier.width(6.dp))
                                    Text("Share Report", style = MaterialTheme.typography.labelSmall, color = HeroOrange, fontWeight = FontWeight.SemiBold)
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
                        }
                    }
                }
            }
        }

        // Add growth data entry — hidden for admin-provisioned kids (medical data is read-only).
        if (kid.source == "ADMIN") {
            item {
                Spacer(Modifier.height(12.dp))
                Box(
                    Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 20.dp)
                        .clip(RoundedCornerShape(16.dp))
                        .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f))
                        .padding(14.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        "Health camp data — managed by your school. Contact the camp organizer for changes.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        } else item {
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
                        .background(HeroOrange.copy(alpha = 0.07f))
                        .clickable { showGrowthEntry = true }
                        .padding(14.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Outlined.Add, contentDescription = null, tint = HeroOrange, modifier = Modifier.size(20.dp))
                        Spacer(Modifier.width(8.dp))
                        Text(t(S.logMeasurements), color = HeroOrange, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
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

        // ── Health Checkup Reports ──
        item {
            HealthCheckupReportsSection(kid.id, onOpenCheckup)
        }

        // ── Parent Health Visits (hospital/clinic, non-camp) ──
        if (kid.source != "ADMIN") {
            item {
                HealthVisitSection(kid.id, kid.name)
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
                Icon(Icons.AutoMirrored.Outlined.TrendingUp, contentDescription = null, tint = HeroOrange, modifier = Modifier.size(22.dp))
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
                            focusedBorderColor = HeroOrange,
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
                            focusedBorderColor = HeroOrange,
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

@Composable
private fun HealthCheckupReportsSection(kidId: String, onOpenCheckup: (String) -> Unit) {
    var checkups by remember { mutableStateOf<List<HealthCheckupResultDto>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }

    LaunchedEffect(kidId) {
        loading = true
        try {
            checkups = withContext(Dispatchers.IO) {
                ApiRepositoryProvider.firestoreRepo?.fetchHealthCheckups(kidId) ?: emptyList()
            }
        } catch (_: Exception) {
            checkups = emptyList()
        }
        loading = false
    }

    Column(Modifier.padding(horizontal = 20.dp)) {
        Text(
            "Health Checkup Reports",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.padding(vertical = 12.dp),
        )

        if (loading) {
            Box(Modifier.fillMaxWidth().padding(20.dp), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = HeroOrange, modifier = Modifier.size(28.dp))
            }
        } else if (checkups.isEmpty()) {
            HeroCard {
                Text(
                    "No health checkup reports yet. Reports will appear here after a doctor completes a screening at a camp.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(20.dp),
                )
            }
        } else {
            checkups.forEach { cp ->
                val statusColor = when (cp.overallStatus) {
                    "GOOD" -> FlagGood
                    "WATCH" -> FlagWatch
                    "ALERT" -> FlagAlert
                    else -> MaterialTheme.colorScheme.outline
                }
                HeroCard(
                    Modifier
                        .fillMaxWidth()
                        .padding(bottom = 10.dp)
                        .clickable { onOpenCheckup(cp.id) }
                ) {
                    Row(
                        Modifier.padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        Box(
                            Modifier.size(44.dp).clip(RoundedCornerShape(12.dp))
                                .background(statusColor.copy(alpha = 0.12f)),
                            contentAlignment = Alignment.Center,
                        ) {
                            Icon(
                                Icons.Outlined.MedicalServices,
                                contentDescription = null,
                                tint = statusColor,
                                modifier = Modifier.size(24.dp),
                            )
                        }
                        Column(Modifier.weight(1f)) {
                            Text(
                                cp.campTitle,
                                style = MaterialTheme.typography.titleSmall,
                                fontWeight = FontWeight.SemiBold,
                            )
                            Text(
                                "${cp.schoolName.ifBlank { "" }} · ${cp.campDate}",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                            if (cp.doctorName.isNotBlank()) {
                                Text(
                                    "Dr. ${cp.doctorName}",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                            }
                        }
                        if (cp.referralNeeded) {
                            Text(
                                "Referral",
                                style = MaterialTheme.typography.labelSmall,
                                fontWeight = FontWeight.Bold,
                                color = FlagAlert,
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun HealthVisitSection(kidId: String, kidName: String) {
    var visits by remember { mutableStateOf<List<HealthVisitDto>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var showForm by remember { mutableStateOf(false) }
    var saving by remember { mutableStateOf(false) }
    var visitToDelete by remember { mutableStateOf<HealthVisitDto?>(null) }
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    LaunchedEffect(kidId, showForm) {
        if (!showForm) {
            loading = true
            try {
                visits = withContext(Dispatchers.IO) {
                    ApiRepositoryProvider.repository.fetchHealthVisits(kidId)
                }
            } catch (_: Exception) {
                visits = emptyList()
            }
            loading = false
        }
    }

    if (visitToDelete != null) {
        AlertDialog(
            onDismissRequest = { visitToDelete = null },
            title = { Text("Delete Visit") },
            text = { Text("Remove this health visit record?") },
            confirmButton = {
                TextButton(onClick = {
                    val visit = visitToDelete
                    visitToDelete = null
                    if (visit != null) {
                        scope.launch {
                            try {
                                ApiRepositoryProvider.repository.deleteHealthVisit(visit.id)
                            } catch (_: Exception) {}
                            visits = withContext(Dispatchers.IO) {
                                ApiRepositoryProvider.repository.fetchHealthVisits(kidId)
                            }
                        }
                    }
                }) { Text("Delete", color = MaterialTheme.colorScheme.error) }
            },
            dismissButton = { TextButton(onClick = { visitToDelete = null }) { Text("Cancel") } }
        )
    }

    Column(Modifier.padding(horizontal = 20.dp)) {
        Row(
            Modifier.fillMaxWidth().padding(vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                "Health Visits & Milestones",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.weight(1f),
            )
            if (!showForm) {
                Box(
                    Modifier
                        .clip(RoundedCornerShape(12.dp))
                        .background(HeroOrange.copy(alpha = 0.12f))
                        .clickable { showForm = true }
                        .padding(horizontal = 14.dp, vertical = 8.dp),
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Outlined.EditNote, contentDescription = null, tint = HeroOrange, modifier = Modifier.size(18.dp))
                        Spacer(Modifier.width(4.dp))
                        Text("Log Visit", style = MaterialTheme.typography.labelMedium, color = HeroOrange, fontWeight = FontWeight.SemiBold)
                    }
                }
            }
        }

        if (showForm) {
            HealthVisitForm(
                kidName = kidName,
                isSaving = saving,
                onSave = { visitType, hospital, doctor, date, reason, diagnosis, prescription, notes, followup, height, weight, status ->
                    saving = true
                    scope.launch {
                        try {
                            ApiRepositoryProvider.repository.saveHealthVisit(
                                kidId, visitType, hospital, doctor, date,
                                reason, diagnosis, prescription, notes, followup,
                                height, weight, status,
                            )
                            visits = withContext(Dispatchers.IO) {
                                ApiRepositoryProvider.repository.fetchHealthVisits(kidId)
                            }
                            showForm = false
                        } catch (_: Exception) { }
                        saving = false
                    }
                },
                onCancel = { showForm = false },
            )
        } else if (loading) {
            Box(Modifier.fillMaxWidth().padding(20.dp), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = HeroOrange, modifier = Modifier.size(28.dp))
            }
        } else if (visits.isEmpty()) {
            HeroCard {
                Column(Modifier.padding(20.dp)) {
                    Text(
                        "No health visits logged yet.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Spacer(Modifier.height(4.dp))
                    Text(
                        "Log hospital visits, clinic checkups, and health milestones for $kidName here.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        } else {
            visits.forEach { visit ->
                val statusColor = when (visit.overallStatus) {
                    "GOOD" -> FlagGood
                    "WATCH" -> FlagWatch
                    "ALERT" -> FlagAlert
                    else -> MaterialTheme.colorScheme.outline
                }
                HeroCard(
                    Modifier
                        .fillMaxWidth()
                        .padding(bottom = 10.dp),
                ) {
                    Column(Modifier.padding(16.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Box(
                                Modifier.size(40.dp).clip(RoundedCornerShape(10.dp))
                                    .background(statusColor.copy(alpha = 0.12f)),
                                contentAlignment = Alignment.Center,
                            ) {
                                Icon(Icons.Outlined.LocalHospital, contentDescription = null, tint = statusColor, modifier = Modifier.size(22.dp))
                            }
                            Spacer(Modifier.width(12.dp))
                            Column(Modifier.weight(1f)) {
                                Text(
                                    visit.hospitalName.ifBlank { visit.visitType },
                                    style = MaterialTheme.typography.titleSmall,
                                    fontWeight = FontWeight.SemiBold,
                                )
                                Text(
                                    visit.visitDate,
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                            }
                            Box(
                                Modifier
                                    .size(28.dp)
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(MaterialTheme.colorScheme.surfaceVariant)
                                    .clickable { visitToDelete = visit },
                                contentAlignment = Alignment.Center,
                            ) {
                                Icon(Icons.Outlined.Close, contentDescription = "Delete", modifier = Modifier.size(16.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                        }
                        if (visit.doctorName.isNotBlank()) {
                            Spacer(Modifier.height(8.dp))
                            Text("Dr. ${visit.doctorName}", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                        if (visit.reason.isNotBlank()) {
                            Spacer(Modifier.height(6.dp))
                            Text("Reason: ${visit.reason}", style = MaterialTheme.typography.bodySmall)
                        }
                        if (visit.diagnosis.isNotBlank()) {
                            Spacer(Modifier.height(4.dp))
                            Text("Diagnosis: ${visit.diagnosis}", style = MaterialTheme.typography.bodySmall)
                        }
                        if (visit.prescription.isNotBlank()) {
                            Spacer(Modifier.height(4.dp))
                            Text("Prescription: ${visit.prescription}", style = MaterialTheme.typography.bodySmall)
                        }
                        if (visit.notes.isNotBlank()) {
                            Spacer(Modifier.height(4.dp))
                            Text("Notes: ${visit.notes}", style = MaterialTheme.typography.bodySmall)
                        }
                        if (visit.nextFollowup.isNotBlank()) {
                            Spacer(Modifier.height(4.dp))
                            Text("Follow-up: ${visit.nextFollowup}", style = MaterialTheme.typography.labelSmall, color = HeroOrange, fontWeight = FontWeight.Medium)
                        }
                        if (visit.heightCm != null && visit.heightCm > 0 || visit.weightKg != null && visit.weightKg > 0) {
                            Spacer(Modifier.height(8.dp))
                            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                if (visit.heightCm != null && visit.heightCm > 0) {
                                    Text("${visit.heightCm.toInt()} cm", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                }
                                if (visit.weightKg != null && visit.weightKg > 0) {
                                    Text("${visit.weightKg.toInt()} kg", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun HealthVisitForm(
    kidName: String,
    isSaving: Boolean,
    onSave: (
        visitType: String,
        hospital: String,
        doctor: String,
        date: String,
        reason: String,
        diagnosis: String,
        prescription: String,
        notes: String,
        followup: String,
        height: Double?,
        weight: Double?,
        status: String,
    ) -> Unit,
    onCancel: () -> Unit,
) {
    var visitType by remember { mutableStateOf("HOSPITAL") }
    var hospital by remember { mutableStateOf("") }
    var doctor by remember { mutableStateOf("") }
    var date by remember { mutableStateOf(LocalDate.now().format(DateTimeFormatter.ofPattern("dd MMM yyyy"))) }
    var reason by remember { mutableStateOf("") }
    var diagnosis by remember { mutableStateOf("") }
    var prescription by remember { mutableStateOf("") }
    var notes by remember { mutableStateOf("") }
    var followup by remember { mutableStateOf("") }
    var height by remember { mutableStateOf("") }
    var weight by remember { mutableStateOf("") }
    var status by remember { mutableStateOf("GOOD") }

    val canSave = hospital.isNotBlank() || reason.isNotBlank()

    HeroCard(Modifier.padding(bottom = 12.dp), background = MaterialTheme.colorScheme.surface) {
        Column(
            Modifier.padding(18.dp)
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Outlined.LocalHospital, contentDescription = null, tint = HeroOrange, modifier = Modifier.size(22.dp))
                Spacer(Modifier.width(8.dp))
                Text("Log Health Visit", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
                Box(
                    Modifier.size(32.dp).clip(RoundedCornerShape(10.dp))
                        .background(MaterialTheme.colorScheme.surfaceVariant)
                        .clickable(onClick = onCancel),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(Icons.Outlined.Close, contentDescription = "Cancel", modifier = Modifier.size(18.dp))
                }
            }
            Spacer(Modifier.height(16.dp))

            // Visit type selector
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf("HOSPITAL" to "Hospital", "CLINIC" to "Clinic", "CHECKUP" to "Checkup").forEach { (value, label) ->
                    Box(
                        Modifier
                            .weight(1f)
                            .height(48.dp)
                            .clip(RoundedCornerShape(12.dp))
                            .background(if (visitType == value) HeroOrange.copy(alpha = 0.14f) else MaterialTheme.colorScheme.surface)
                            .border(2.dp, if (visitType == value) HeroOrange else MaterialTheme.colorScheme.outline, RoundedCornerShape(12.dp))
                            .clickable { visitType = value },
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(label, style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.SemiBold, color = if (visitType == value) HeroOrange else MaterialTheme.colorScheme.onSurface)
                    }
                }
            }
            Spacer(Modifier.height(16.dp))

            VisitTextField("Hospital / Clinic name", hospital, { hospital = it }, "e.g. Apollo Hospital")
            Spacer(Modifier.height(12.dp))
            VisitTextField("Doctor name", doctor, { doctor = it }, "e.g. Dr. Sharma")
            Spacer(Modifier.height(12.dp))
            VisitTextField("Visit date", date, { date = it }, "e.g. 15 Aug 2025")
            Spacer(Modifier.height(12.dp))
            VisitTextField("Reason for visit", reason, { reason = it }, "e.g. Fever, routine checkup")
            Spacer(Modifier.height(12.dp))
            VisitTextField("Diagnosis", diagnosis, { diagnosis = it }, "What was diagnosed?")
            Spacer(Modifier.height(12.dp))
            VisitTextField("Prescription", prescription, { prescription = it }, "Medicines prescribed")
            Spacer(Modifier.height(12.dp))
            VisitTextField("Notes", notes, { notes = it }, "Any additional notes")
            Spacer(Modifier.height(12.dp))
            VisitTextField("Next follow-up date", followup, { followup = it }, "e.g. 20 Aug 2025")
            Spacer(Modifier.height(12.dp))

            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Column(Modifier.weight(1f)) {
                    Text("Height (cm)", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Spacer(Modifier.height(4.dp))
                    OutlinedTextField(
                        value = height,
                        onValueChange = { height = it.filter { c -> c.isDigit() || c == '.' } },
                        singleLine = true,
                        shape = RoundedCornerShape(12.dp),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = HeroOrange,
                            unfocusedBorderColor = MaterialTheme.colorScheme.outline,
                            focusedContainerColor = MaterialTheme.colorScheme.surface,
                            unfocusedContainerColor = MaterialTheme.colorScheme.surface,
                        ),
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
                Column(Modifier.weight(1f)) {
                    Text("Weight (kg)", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Spacer(Modifier.height(4.dp))
                    OutlinedTextField(
                        value = weight,
                        onValueChange = { weight = it.filter { c -> c.isDigit() || c == '.' } },
                        singleLine = true,
                        shape = RoundedCornerShape(12.dp),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = HeroOrange,
                            unfocusedBorderColor = MaterialTheme.colorScheme.outline,
                            focusedContainerColor = MaterialTheme.colorScheme.surface,
                            unfocusedContainerColor = MaterialTheme.colorScheme.surface,
                        ),
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
            }
            Spacer(Modifier.height(16.dp))

            // Status selector
            Text("Overall status", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Spacer(Modifier.height(4.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf("GOOD" to "Good", "WATCH" to "Watch", "ALERT" to "Alert").forEach { (value, label) ->
                    val color = when (value) {
                        "GOOD" -> FlagGood
                        "WATCH" -> FlagWatch
                        else -> FlagAlert
                    }
                    Box(
                        Modifier
                            .weight(1f)
                            .height(44.dp)
                            .clip(RoundedCornerShape(12.dp))
                            .background(if (status == value) color.copy(alpha = 0.14f) else MaterialTheme.colorScheme.surface)
                            .border(2.dp, if (status == value) color else MaterialTheme.colorScheme.outline, RoundedCornerShape(12.dp))
                            .clickable { status = value },
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(label, style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.SemiBold, color = if (status == value) color else MaterialTheme.colorScheme.onSurface)
                    }
                }
            }
            Spacer(Modifier.height(24.dp))

            PrimaryGradientButton(
                text = if (isSaving) "Saving..." else "Save Visit",
                enabled = canSave && !isSaving,
                onClick = {
                    onSave(
                        visitType, hospital.trim(), doctor.trim(), date.trim(),
                        reason.trim(), diagnosis.trim(), prescription.trim(),
                        notes.trim(), followup.trim(),
                        height.toDoubleOrNull(), weight.toDoubleOrNull(), status,
                    )
                },
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }
}

@Composable
private fun VisitTextField(label: String, value: String, onValueChange: (String) -> Unit, placeholder: String) {
    Text(label, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
    Spacer(Modifier.height(4.dp))
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        singleLine = true,
        shape = RoundedCornerShape(12.dp),
        placeholder = { Text(placeholder, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f)) },
        colors = OutlinedTextFieldDefaults.colors(
            focusedBorderColor = HeroOrange,
            unfocusedBorderColor = MaterialTheme.colorScheme.outline,
            focusedContainerColor = MaterialTheme.colorScheme.surface,
            unfocusedContainerColor = MaterialTheme.colorScheme.surface,
        ),
        modifier = Modifier.fillMaxWidth(),
    )
}
