package kallam.healthcare.ui.screens

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
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.Restaurant
import androidx.compose.material.icons.outlined.Share
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch
import kallam.healthcare.data.GrowthAssessment
import kallam.healthcare.data.GrowthPoint
import kallam.healthcare.data.HealthFlag
import kallam.healthcare.data.Kid
import kallam.healthcare.data.ReleasedFindingDto
import kallam.healthcare.ui.components.PrescriptionTables
import kallam.healthcare.data.heightText
import kallam.healthcare.data.weightText
import kallam.healthcare.data.S
import kallam.healthcare.ui.components.AppCard
import kallam.healthcare.ui.components.AppScreenHeader
import kallam.healthcare.ui.components.FlagChip
import kallam.healthcare.ui.components.InfoNote
import kallam.healthcare.ui.components.PrimaryGradientButton
import kallam.healthcare.ui.components.SecondaryButton
import kallam.healthcare.ui.components.SegmentedChoice
import kallam.healthcare.ui.components.StatTile
import kallam.healthcare.ui.components.StatusBarSpacer
import kallam.healthcare.ui.components.IconBubble
import kallam.healthcare.ui.components.KidAvatar
import kallam.healthcare.ui.components.Tone
import kallam.healthcare.ui.components.t
import kallam.healthcare.ui.theme.AppCorners
import kallam.healthcare.ui.theme.AppSpacing

private enum class DetailTab(val labelKey: String) {
    GROWTH(S.growthTabLabel), DENTAL(S.dentalTabLabel), EYE(S.eyeTabLabel), NUTRITION(S.nutritionTabLabel)
}

@Composable
fun KidDetailScreen(
    kid: Kid,
    onBack: () -> Unit,
    onOpenDiet: () -> Unit,
    onShareReport: suspend (Context) -> Unit,
    onLogSymptom: () -> Unit = {},
    onOpenGrowthCharts: () -> Unit = {},
    growthAssessment: GrowthAssessment? = null,
    /** The latest released sheets: every value screened, per check. */
    sheets: List<ReleasedFindingDto> = emptyList(),
) {
    var tab by rememberSaveable { mutableStateOf(DetailTab.GROWTH) }
    var isGeneratingReport by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val context = LocalContext.current

    LazyColumn(
        modifier = Modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.background),
        contentPadding = PaddingValues(bottom = AppSpacing.xxxl)
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
                    AppScreenHeader(
                        title = kid.name,
                        subtitle = "${kid.age} yrs · ${kid.gender} · ${kid.school}",
                        onBack = onBack,
                        actions = {
                            // Share report button
                            Box(
                                Modifier
                                    .clip(RoundedCornerShape(AppCorners.medium))
                                    .background(MaterialTheme.colorScheme.surface)
                                    // The indicator used to be theatre: it showed
                                    // for a fixed 800ms while nothing happened,
                                    // hid itself, and only then ran the work — on
                                    // the main thread, so the UI froze right after
                                    // the progress text disappeared. It now tracks
                                    // the actual job, which runs off the main
                                    // thread.
                                    .clickable(enabled = !isGeneratingReport) {
                                        isGeneratingReport = true
                                        scope.launch {
                                            try {
                                                onShareReport(context)
                                            } finally {
                                                isGeneratingReport = false
                                            }
                                        }
                                    }
                                    .padding(horizontal = AppSpacing.md, vertical = 10.dp)
                            ) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    val brand = MaterialTheme.colorScheme.primary
                                    if (isGeneratingReport) {
                                        Text(t(S.generatingReport), style = MaterialTheme.typography.labelMedium, color = brand)
                                    } else {
                                        Icon(Icons.Outlined.Share, contentDescription = "Share report", tint = brand, modifier = Modifier.size(18.dp))
                                        Spacer(Modifier.width(AppSpacing.xs))
                                        Text(t(S.shareReport), style = MaterialTheme.typography.labelMedium, color = brand)
                                    }
                                }
                            }
                        }
                    )
                    Row(
                        Modifier
                            .fillMaxWidth()
                            .padding(horizontal = AppSpacing.xl, vertical = AppSpacing.sm),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(AppSpacing.md)
                    ) {
                        KidAvatar(kid.name, kid.avatarColor, size = 64.dp)
                        StatTile(t(S.heightLabel), kid.heightText(), Modifier.weight(1f))
                        StatTile(t(S.weightLabel), kid.weightText(), Modifier.weight(1f))
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
            Spacer(Modifier.height(AppSpacing.md))
            InfoNote(
                t(S.measurementsFromSchool),
                Modifier.padding(horizontal = AppSpacing.xl),
                tone = Tone.Neutral,
            )
            Spacer(Modifier.height(AppSpacing.md))
            SecondaryButton(
                text = t(S.logSymptom),
                onClick = onLogSymptom,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = AppSpacing.xl),
                leadingIcon = Icons.Outlined.Add,
            )
        }

        // Tabs
        item {
            Spacer(Modifier.height(AppSpacing.xxl))
            val labels = DetailTab.entries.associateWith { t(it.labelKey) }
            SegmentedChoice(
                options = DetailTab.entries,
                selected = tab,
                onSelect = { tab = it },
                label = { labels.getValue(it) },
                modifier = Modifier.padding(horizontal = AppSpacing.xl),
            )
            Spacer(Modifier.height(AppSpacing.lg))
        }

        item {
            when (tab) {
                DetailTab.GROWTH -> GrowthTab(kid, growthAssessment, onOpenGrowthCharts)
                DetailTab.DENTAL -> FlagTab(
                    t(S.dentalTabLabel), kid.dental, sheets.firstOrNull { it.checkType == "Dental" },
                    when (kid.dental) {
                        HealthFlag.NOT_MEASURED -> t(S.notMeasuredMsg)
                        HealthFlag.GOOD -> t(S.dentalGoodMsg)
                        else -> t(S.dentalWatchMsg)
                    }
                )
                DetailTab.EYE -> FlagTab(
                    t(S.eyeTabLabel), kid.eyesight, sheets.firstOrNull { it.checkType == "Vision" },
                    when (kid.eyesight) {
                        HealthFlag.NOT_MEASURED -> t(S.notMeasuredMsg)
                        HealthFlag.GOOD -> t(S.eyeGoodMsg)
                        else -> t(S.eyeWatchMsg)
                    }
                )
                DetailTab.NUTRITION -> NutritionTab(kid, onOpenDiet)
            }
        }

        item { Spacer(Modifier.height(AppSpacing.xxxl)) }
    }
}

@Composable
private fun GrowthTab(kid: Kid, assessment: GrowthAssessment?, onOpenClinicalCharts: () -> Unit) {
    Column(Modifier.padding(horizontal = AppSpacing.xl)) {
        assessment?.let { a ->
            AppCard(background = MaterialTheme.colorScheme.primary.copy(alpha = 0.06f)) {
                Text(t(S.currentAssessment), style = MaterialTheme.typography.titleMedium)
                Spacer(Modifier.height(AppSpacing.sm))
                Text("${t(S.heightPercentile)}: ${a.heightPercentile}% · ${a.heightStatus}", style = MaterialTheme.typography.bodySmall)
                Text("${t(S.weightPercentile)}: ${a.weightPercentile}% · ${a.weightStatus}", style = MaterialTheme.typography.bodySmall)
                Text("${t(S.referenceStandard)}: ${a.chartSource}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Spacer(Modifier.height(AppSpacing.md))
            SecondaryButton(
                text = t(S.viewClinicalCharts),
                onClick = onOpenClinicalCharts,
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.height(AppSpacing.md))
        }
        AppCard {
            // No chip here: nothing computes a growth flag, and a constant
            // "On track" told parents so even before anything was measured.
            Text(t(S.heightTrend), style = MaterialTheme.typography.titleMedium)
            Spacer(Modifier.height(AppSpacing.lg))
            GrowthChart(kid.growth, MaterialTheme.colorScheme.primary)
            Spacer(Modifier.height(AppSpacing.sm))
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                kid.growth.forEach {
                    Text(it.label, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
        Spacer(Modifier.height(AppSpacing.md))
        AppCard {
            Text(t(S.weightTrend), style = MaterialTheme.typography.titleMedium)
            Spacer(Modifier.height(AppSpacing.lg))
            GrowthChart(kid.growth, MaterialTheme.colorScheme.secondary, weight = true)
            Spacer(Modifier.height(AppSpacing.sm))
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                kid.growth.forEach {
                    Text(it.label, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
        Spacer(Modifier.height(AppSpacing.md))
        InfoNote(t(S.disclaimerChart))
    }
}

@Composable
private fun GrowthChart(points: List<GrowthPoint>, color: Color, weight: Boolean = false) {
    val values = points.map { if (weight) it.weight else it.height }
    if (values.isEmpty()) {
        // A child nobody has measured has no trend to draw — the old code
        // indexed values[0] of this empty list and took the whole screen down.
        Box(
            Modifier
                .fillMaxWidth()
                .height(140.dp),
            contentAlignment = Alignment.Center
        ) {
            Text(
                t(S.notMeasuredMsg),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(horizontal = AppSpacing.xl)
            )
        }
        return
    }
    val anim by animateFloatAsState(targetValue = 1f, animationSpec = tween(900), label = "chart")
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
private fun FlagTab(title: String, flag: HealthFlag, finding: ReleasedFindingDto?, description: String) {
    val rows = finding?.sheet?.listedRows.orEmpty()
    val rx = finding?.sheet?.rx.orEmpty()
    Column(Modifier.padding(horizontal = AppSpacing.xl)) {
        AppCard {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(title, style = MaterialTheme.typography.titleLarge, modifier = Modifier.weight(1f))
                FlagChip(finding?.let { sheetFlag(it.flag) } ?: flag)
            }
            Spacer(Modifier.height(AppSpacing.md))
            if (finding == null || (rows.isEmpty() && rx.isEmpty())) {
                Text(description, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            } else {
                // Every value screened at the camp, as the doctor recorded it.
                val where = listOf(finding.campTitle, finding.date).filter { it.isNotBlank() }.joinToString(" · ")
                if (where.isNotBlank()) {
                    Text(where, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Spacer(Modifier.height(AppSpacing.sm))
                }
                rows.forEach { row ->
                    Row(Modifier.fillMaxWidth().padding(vertical = AppSpacing.xxs)) {
                        Text(
                            row.label,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.weight(0.42f),
                        )
                        Text(
                            row.value,
                            style = MaterialTheme.typography.bodySmall,
                            fontWeight = FontWeight.Medium,
                            modifier = Modifier.weight(0.58f),
                        )
                    }
                }
                if (rx.isNotEmpty()) PrescriptionTables(rx, Modifier.fillMaxWidth())
                if (finding.note.isNotBlank()) {
                    Spacer(Modifier.height(AppSpacing.sm))
                    Text(finding.note, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
        Spacer(Modifier.height(AppSpacing.md))
        InfoNote(t(S.disclaimerShort))
    }
}

private fun sheetFlag(raw: String): HealthFlag = when (raw.uppercase()) {
    "GOOD" -> HealthFlag.GOOD
    "WATCH" -> HealthFlag.WATCH
    "ALERT" -> HealthFlag.ALERT
    else -> HealthFlag.NOT_MEASURED
}

@Composable
private fun NutritionTab(kid: Kid, onOpenDiet: () -> Unit) {
    Column(Modifier.padding(horizontal = AppSpacing.xl)) {
        AppCard {
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconBubble(Icons.Outlined.Restaurant, MaterialTheme.colorScheme.primary)
                Spacer(Modifier.width(AppSpacing.md))
                Column(Modifier.weight(1f)) {
                    Text(t(S.dietStatus), style = MaterialTheme.typography.titleMedium)
                    Text(t(S.dietSubtitle), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                FlagChip(kid.nutrition)
            }
            Spacer(Modifier.height(AppSpacing.lg))
            Text(
                when (kid.nutrition) {
                    HealthFlag.NOT_MEASURED -> t(S.notMeasuredMsg)
                    HealthFlag.GOOD -> t(S.balancedDietMsg)
                    else -> t(S.ironLowMsg)
                },
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(Modifier.height(AppSpacing.lg))
            PrimaryGradientButton(
                text = t(S.viewDietPlan),
                onClick = onOpenDiet,
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }
}

/**
 * Shown when the id in the navigation route matches no child the app knows —
 * for example after the record was removed server-side. A blank screen here
 * would look exactly like a freeze; this explains itself and offers the way out.
 */
@Composable
fun KidDetailMissingScreen(onBack: () -> Unit) {
    Column(
        Modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.background)
            .padding(horizontal = AppSpacing.xxl),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        StatusBarSpacer()
        Spacer(Modifier.height(96.dp))
        Text(
            t(S.recordUnavailable),
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center
        )
        Spacer(Modifier.height(AppSpacing.xxl))
        SecondaryButton(text = t(S.back), onClick = onBack)
    }
}
