package com.rork.vitahero.ui.screens

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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.rork.vitahero.data.GrowthAssessment
import com.rork.vitahero.data.GrowthStandards
import com.rork.vitahero.data.Kid
import com.rork.vitahero.data.S
import com.rork.vitahero.ui.components.HeroCard
import com.rork.vitahero.ui.components.StatusBarSpacer
import com.rork.vitahero.ui.components.t
import com.rork.vitahero.ui.components.tf
import com.rork.vitahero.ui.theme.HeroBlue
import com.rork.vitahero.ui.theme.HeroOrange
import com.rork.vitahero.ui.theme.HeroYellow

private enum class ChartMetric { HEIGHT, WEIGHT }

@Composable
fun GrowthChartsScreen(
    kid: Kid,
    assessment: GrowthAssessment?,
    onBack: () -> Unit,
) {
    var metric by remember { mutableStateOf(ChartMetric.HEIGHT) }
    val growthMetric = when (metric) {
        ChartMetric.HEIGHT -> GrowthStandards.Metric.HEIGHT
        ChartMetric.WEIGHT -> GrowthStandards.Metric.WEIGHT
    }
    val unit = when (metric) {
        ChartMetric.HEIGHT -> "cm"
        ChartMetric.WEIGHT -> "kg"
    }
    val currentValue = when (metric) {
        ChartMetric.HEIGHT -> kid.heightCm
        ChartMetric.WEIGHT -> kid.weightKg
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.background),
        contentPadding = PaddingValues(start = 20.dp, end = 20.dp, bottom = 32.dp)
    ) {
        item {
            StatusBarSpacer()
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(vertical = 8.dp)) {
                Box(
                    Modifier.size(44.dp).clip(RoundedCornerShape(12.dp)).clickable(onClick = onBack),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(Icons.AutoMirrored.Outlined.ArrowBack, contentDescription = null)
                }
                Spacer(Modifier.width(12.dp))
                Column {
                    Text(t(S.clinicalGrowthCharts), style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                    Text(tf(S.growthChartsFor, kid.name), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            Spacer(Modifier.height(12.dp))
        }

        assessment?.let { a ->
            item {
                HeroCard(Modifier.fillMaxWidth(), background = HeroOrange.copy(alpha = 0.06f)) {
                    Column(Modifier.padding(16.dp)) {
                        Text(t(S.currentAssessment), style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                        Spacer(Modifier.height(10.dp))
                        AssessmentRow(t(S.heightPercentile), "${a.heightPercentile}%", a.heightStatus)
                        AssessmentRow(t(S.weightPercentile), "${a.weightPercentile}%", a.weightStatus)
                        Spacer(Modifier.height(8.dp))
                        Text("${t(S.referenceStandard)}: ${a.chartSource}", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
                Spacer(Modifier.height(16.dp))
            }
        }

        item {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                ChartMetric.entries.forEach { m ->
                    val selected = metric == m
                    val label = when (m) {
                        ChartMetric.HEIGHT -> t(S.heightChart)
                        ChartMetric.WEIGHT -> t(S.weightChart)
                    }
                    Text(
                        label,
                        modifier = Modifier
                            .clip(RoundedCornerShape(50))
                            .clickable { metric = m }
                            .background(if (selected) HeroBlue.copy(alpha = 0.14f) else MaterialTheme.colorScheme.surfaceVariant)
                            .padding(horizontal = 14.dp, vertical = 8.dp),
                        style = MaterialTheme.typography.labelLarge,
                        fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium,
                        color = if (selected) HeroBlue else MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
            Spacer(Modifier.height(16.dp))
        }

        item {
            HeroCard(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(16.dp)) {
                    Text(
                        "${t(S.yourChild)}: %.1f $unit".format(currentValue),
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold,
                        color = HeroOrange,
                    )
                    Spacer(Modifier.height(8.dp))
                    PercentileLegend()
                    Spacer(Modifier.height(12.dp))
                    ClinicalPercentileChart(
                        kid = kid,
                        metric = growthMetric,
                        currentValue = currentValue,
                    )
                }
            }
            Spacer(Modifier.height(12.dp))
            Text(t(S.growthChartDisclaimer), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
private fun AssessmentRow(label: String, percentile: String, status: String) {
    Row(Modifier.fillMaxWidth().padding(vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(label, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.weight(1f))
        Text(percentile, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold, color = HeroBlue)
        Spacer(Modifier.width(12.dp))
        Text(status, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
private fun PercentileLegend() {
    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        LegendDot(HeroYellow, "P97")
        LegendDot(HeroBlue.copy(alpha = 0.5f), "P85")
        LegendDot(HeroOrange, "P50")
        LegendDot(HeroBlue.copy(alpha = 0.35f), "P15")
        LegendDot(Color(0xFF94A3B8), "P3")
    }
}

@Composable
private fun LegendDot(color: Color, label: String) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(8.dp).clip(RoundedCornerShape(50)).background(color))
        Spacer(Modifier.width(4.dp))
        Text(label, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
private fun ClinicalPercentileChart(
    kid: Kid,
    metric: GrowthStandards.Metric,
    currentValue: Float,
) {
    val ages = GrowthStandards.chartAges()
    val percentiles = listOf(3, 15, 50, 85, 97)
    val colors = listOf(
        Color(0xFF94A3B8), HeroBlue.copy(alpha = 0.35f), HeroOrange,
        HeroBlue.copy(alpha = 0.5f), HeroYellow,
    )

    Canvas(Modifier.fillMaxWidth().height(220.dp)) {
        val w = size.width
        val h = size.height
        val padL = 36f
        val padR = 12f
        val padT = 12f
        val padB = 28f
        val chartW = w - padL - padR
        val chartH = h - padT - padB

        val allValues = percentiles.flatMap { p ->
            ages.map { age -> GrowthStandards.percentileValue(age, kid.gender, metric, p) }
        } + currentValue
        val minV = allValues.minOrNull() ?: 0f
        val maxV = allValues.maxOrNull() ?: 1f
        val range = (maxV - minV).coerceAtLeast(1f)

        fun xAt(ageIndex: Int) = padL + chartW * ageIndex / (ages.size - 1).coerceAtLeast(1)
        fun yAt(v: Float) = padT + chartH - (v - minV) / range * chartH

        percentiles.forEachIndexed { idx, p ->
            val path = Path()
            ages.forEachIndexed { i, age ->
                val v = GrowthStandards.percentileValue(age, kid.gender, metric, p)
                val pt = Offset(xAt(i), yAt(v))
                if (i == 0) path.moveTo(pt.x, pt.y) else path.lineTo(pt.x, pt.y)
            }
            drawPath(path, colors[idx], style = Stroke(width = if (p == 50) 3f else 2f, cap = StrokeCap.Round))
        }

        val kidX = padL + chartW * ((kid.age.coerceIn(2, 18) - 2) / 16f)
        val kidY = yAt(currentValue)
        drawCircle(HeroOrange, radius = 10f, center = Offset(kidX, kidY))
        drawCircle(Color.White, radius = 5f, center = Offset(kidX, kidY))
    }
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text("2y", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text("10y", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text("18y", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}
