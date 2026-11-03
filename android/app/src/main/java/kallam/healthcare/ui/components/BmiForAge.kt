package kallam.healthcare.ui.components

import android.graphics.Paint
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import kallam.healthcare.data.GrowthRefs
import kallam.healthcare.data.WhoBmi
import kallam.healthcare.ui.theme.FlagAlert
import kallam.healthcare.ui.theme.FlagGood
import kallam.healthcare.ui.theme.FlagWatch
import kallam.healthcare.ui.theme.HeroBlue
import kallam.healthcare.ui.theme.HeroOrange
import java.util.Locale
import kotlin.math.abs
import kotlin.math.pow

/** Colour of a growth class: green normal, amber past 2 SD (or the 3rd/97th), red past 3 SD. */
fun whoClassColor(cls: String): Color = when (cls) {
    "Normal" -> FlagGood
    "Overweight", "Wasted", "Stunted", "Underweight", "Low", "Above +2 SD", "Below 3rd", "Above 97th" -> FlagWatch
    "Obese", "Severely wasted", "Severely stunted", "Severely underweight", "Severely low" -> FlagAlert
    else -> HeroBlue
}

private fun signed(z: Double) = String.format(Locale.US, "%+.2f", z)
private fun pct(p: Double) = if (p < 1 || p > 99) String.format(Locale.US, "%.1f", p) else "${p.toInt()}"

/** WHO height-for-age class: stunted below -2 SD, severely below -3. */
fun heightClass(z: Double): String = when {
    z < -3 -> "Severely stunted"
    z < -2 -> "Stunted"
    else -> "Normal"
}

/**
 * WHO weight-for-age class. Above +2 SD is not called overweight: the WHO
 * reads that from BMI-for-age, so the card sends the reader there.
 */
fun weightClass(z: Double): String = when {
    z < -3 -> "Severely underweight"
    z < -2 -> "Underweight"
    z > 2 -> "Above +2 SD"
    else -> "Normal"
}

// ---------------------------------------------------------------------------
// The chart: reference lines by age, the bands between them shaded, the child
// as a dot. One drawing for the WHO's SD curves, the IAP's printed centiles and
// the MUAC-for-age SD curves.
// ---------------------------------------------------------------------------

/** One reference line, a value at each of the chart's ages. A null colour is the axis colour. */
private class ChartLine(
    val label: String,
    val values: List<Double>,
    val color: Color? = null,
    val bold: Boolean = false,
    val dashed: Boolean = false,
)

/** A shaded band between two lines, by index (null = the chart's edge). */
private class Fill(val from: Int?, val to: Int?, val color: Color)

private class ChartModel(
    val months: List<Double>,
    val lines: List<ChartLine>,
    val fills: List<Fill>,
    val legend: List<Pair<Color, String>>,
)

private val SDS = listOf(-3, -2, -1, 0, 1, 2, 3)

private fun sdLines(values: (Int) -> List<Double>) = SDS.map { z ->
    ChartLine(
        label = if (z == 0) "0" else String.format(Locale.US, "%+d", z),
        values = values(z),
        color = when (abs(z)) { 0 -> FlagGood; 2 -> FlagWatch; 3 -> FlagAlert; else -> null },
        bold = z == 0,
        dashed = abs(z) == 3,
    )
}

/** Bands of the camp's cut-offs. SD lines are -3..+3 at indices 0..6. */
private val LOW_FILLS = listOf(Fill(null, 0, FlagAlert), Fill(0, 1, FlagWatch), Fill(1, null, FlagGood))
private val LOW_LEGEND = listOf(FlagGood to "Above −2 SD", FlagWatch to "−3 to −2 SD", FlagAlert to "Below −3 SD")

private fun whoModel(ind: WhoBmi.Indicator, sex: String): ChartModel {
    val end = WhoBmi.maxMonthsOf(ind).toInt().coerceAtMost(228)
    val months = (60..end step 2).map { it.toDouble() }
    val lines = sdLines { z -> months.map { WhoBmi.valueAtZ(WhoBmi.lmsAt(ind, sex, it), z.toDouble()) } }
    return if (ind == WhoBmi.Indicator.BFA) {
        ChartModel(
            months, lines,
            listOf(
                Fill(null, 0, FlagAlert), Fill(0, 1, FlagWatch), Fill(1, 5, FlagGood),
                Fill(5, 6, FlagWatch), Fill(6, null, FlagAlert),
            ),
            listOf(FlagGood to "Normal", FlagWatch to "Wasted / Overweight", FlagAlert to "Severely wasted / Obese"),
        )
    } else {
        ChartModel(months, lines, LOW_FILLS, LOW_LEGEND)
    }
}

private fun iapModel(m: GrowthRefs.Measure, sex: String): ChartModel {
    val t = GrowthRefs.chart(m, sex)
    // The printed rows, every half year; the chart's lines are straight between them.
    val months = (0 until 27).map { 60.0 + it * 6 }
    val lines = t.labels.mapIndexed { k, label ->
        ChartLine(
            label = label,
            values = t.centiles[k].toList(),
            color = when (label) {
                "50" -> FlagGood
                "3", "97", "23 AE" -> FlagWatch
                "27 AE" -> FlagAlert
                else -> null
            },
            bold = label == "50",
        )
    }
    val last = lines.size - 1
    return when (m) {
        GrowthRefs.Measure.BMI -> ChartModel(
            months, lines,
            listOf(
                Fill(null, 0, FlagWatch), Fill(0, last - 1, FlagGood),
                Fill(last - 1, last, FlagWatch), Fill(last, null, FlagAlert),
            ),
            listOf(FlagGood to "3rd–23 AE", FlagWatch to "Below 3rd / 23–27 AE", FlagAlert to "Above 27 AE"),
        )
        GrowthRefs.Measure.HT -> ChartModel(
            months, lines,
            listOf(Fill(null, 0, FlagWatch), Fill(0, null, FlagGood)),
            listOf(FlagGood to "From the 3rd", FlagWatch to "Below 3rd"),
        )
        GrowthRefs.Measure.WT -> ChartModel(
            months, lines,
            listOf(Fill(null, 0, FlagWatch), Fill(0, last, FlagGood), Fill(last, null, FlagWatch)),
            listOf(FlagGood to "3rd–97th", FlagWatch to "Below 3rd / above 97th"),
        )
    }
}

private fun muacModel(sex: String): ChartModel {
    val months = (60..228 step 2).map { it.toDouble() }
    val lines = sdLines { z -> months.map { WhoBmi.valueAtZ(GrowthRefs.muacLmsAt(sex, it), z.toDouble()) } }
    return ChartModel(months, lines, LOW_FILLS, LOW_LEGEND)
}

@Composable
private fun GrowthChart(model: ChartModel, ageMonths: Double, value: Double, modifier: Modifier = Modifier) {
    val axis = MaterialTheme.colorScheme.onSurfaceVariant
    val grid = MaterialTheme.colorScheme.outlineVariant
    val surface = MaterialTheme.colorScheme.surface
    val months = model.months
    val start = months.first()
    val end = months.last()
    Canvas(modifier) {
        val padL = 34.dp.toPx()
        val padR = 36.dp.toPx()
        val padT = 8.dp.toPx()
        val padB = 22.dp.toPx()
        val cw = size.width - padL - padR
        val ch = size.height - padT - padB
        val dot = ageMonths.coerceIn(start, end)
        val lo0 = minOf(model.lines.first().values.min(), value)
        val hi0 = maxOf(model.lines.last().values.max(), value)
        val margin = (hi0 - lo0) * 0.04
        val lo = lo0 - margin
        val hi = hi0 + margin
        fun x(m: Double) = padL + ((m - start) / (end - start)).toFloat() * cw
        fun y(v: Double) = padT + ch - ((v - lo) / (hi - lo)).toFloat() * ch

        val paint = Paint().apply {
            isAntiAlias = true
            textSize = 10.dp.toPx()
            color = axis.toArgb()
        }
        // Horizontal grid, labelled in the measure's own units.
        val step = when {
            hi - lo > 60 -> 10
            hi - lo > 24 -> 5
            hi - lo > 10 -> 2
            else -> 1
        }
        var g = (lo / step).toInt() * step + step
        while (g < hi) {
            val gy = y(g.toDouble())
            drawLine(grid, Offset(padL, gy), Offset(padL + cw, gy), strokeWidth = 1f)
            paint.textAlign = Paint.Align.RIGHT
            drawContext.canvas.nativeCanvas.drawText("$g", padL - 4.dp.toPx(), gy + 3.dp.toPx(), paint)
            g += step
        }
        // Year ticks: every year to 10 years' span, every other year past it.
        paint.textAlign = Paint.Align.CENTER
        val y0 = (start / 12).toInt()
        val y1 = (end / 12).toInt()
        for (yr in y0..y1 step (if (y1 - y0 > 8) 2 else 1)) {
            val gx = x(yr * 12.0)
            drawLine(grid, Offset(gx, padT), Offset(gx, padT + ch), strokeWidth = 1f)
            drawContext.canvas.nativeCanvas.drawText("${yr}y", gx, size.height - 6.dp.toPx(), paint)
        }

        model.fills.forEach { b ->
            val from = b.from?.let { model.lines[it].values }
            val to = b.to?.let { model.lines[it].values }
            val p = Path()
            months.forEachIndexed { i, m ->
                val v = from?.get(i) ?: lo
                if (i == 0) p.moveTo(x(m), y(v)) else p.lineTo(x(m), y(v))
            }
            for (i in months.indices.reversed()) p.lineTo(x(months[i]), y(to?.get(i) ?: hi))
            p.close()
            drawPath(p, b.color.copy(alpha = 0.14f))
        }

        model.lines.forEach { line ->
            val p = Path()
            line.values.forEachIndexed { i, v ->
                if (i == 0) p.moveTo(x(months[i]), y(v)) else p.lineTo(x(months[i]), y(v))
            }
            drawPath(
                p,
                line.color ?: axis.copy(alpha = 0.6f),
                style = Stroke(
                    width = if (line.bold) 2.5.dp.toPx() else 1.3.dp.toPx(),
                    cap = StrokeCap.Round,
                    pathEffect = if (line.dashed) PathEffect.dashPathEffect(floatArrayOf(8f, 6f)) else null,
                ),
            )
        }

        // Line names at the right end, nudged apart where lines run close.
        paint.textAlign = Paint.Align.LEFT
        val gap = 10.dp.toPx()
        val ends = model.lines.map { y(it.values.last()) + 3.dp.toPx() }
        val order = ends.indices.sortedByDescending { ends[it] }
        val placed = FloatArray(ends.size)
        var prev = Float.MAX_VALUE
        order.forEach { i ->
            val yy = minOf(ends[i], prev - gap)
            placed[i] = yy
            prev = yy
        }
        model.lines.forEachIndexed { i, line ->
            paint.color = (line.color ?: axis).toArgb()
            paint.isFakeBoldText = line.bold
            drawContext.canvas.nativeCanvas.drawText(line.label, padL + cw + 4.dp.toPx(), placed[i], paint)
        }

        // The child: a guide at their age, and the dot.
        val c = Offset(x(dot), y(value))
        drawLine(
            HeroOrange.copy(alpha = 0.5f), Offset(c.x, padT), Offset(c.x, padT + ch),
            strokeWidth = 1.dp.toPx(), pathEffect = PathEffect.dashPathEffect(floatArrayOf(6f, 6f)),
        )
        drawCircle(HeroOrange, radius = 7.dp.toPx(), center = c)
        drawCircle(surface, radius = 3.dp.toPx(), center = c)
    }
}

// ---------------------------------------------------------------------------
// The cards: one per measure, IAP 2015 and WHO 2007 side by side on a toggle,
// the way growth-chart apps show them.
// ---------------------------------------------------------------------------

/** One reference's view of a measure: its stats, its chart, its note. */
private class Side(
    val name: String,
    val stats: List<Pair<String, String>>,
    val model: ChartModel,
    val note: String,
)

@Composable
private fun Stat(label: String, value: String, modifier: Modifier) {
    Column(modifier) {
        Text(label, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(value, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun Chip(text: String, tone: Color) {
    Text(
        text,
        Modifier
            .clip(RoundedCornerShape(50))
            .background(tone.copy(alpha = 0.16f))
            .padding(horizontal = 12.dp, vertical = 6.dp),
        style = MaterialTheme.typography.labelLarge,
        fontWeight = FontWeight.Bold,
        color = tone,
    )
}

@Composable
private fun LegendSwatch(color: Color, label: String) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(10.dp).clip(RoundedCornerShape(3.dp)).background(color.copy(alpha = 0.35f)))
        Spacer(Modifier.width(4.dp))
        Text(label, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
private fun MeasureCard(
    title: String,
    value: String,
    cls: String,
    sides: List<Side>,
    ageMonths: Double,
    y: Double,
    note: String?,
    modifier: Modifier = Modifier,
) {
    val tone = whoClassColor(cls)
    var pick by remember(title, sides.size) { mutableIntStateOf(0) }
    val side = sides.getOrNull(pick)
    Column(
        modifier
            .clip(RoundedCornerShape(14.dp))
            .background(tone.copy(alpha = 0.07f))
            .padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(title, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text(value, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            }
            Chip(cls, tone)
        }
        if (sides.size > 1) {
            Row(
                Modifier
                    .clip(RoundedCornerShape(50))
                    .background(MaterialTheme.colorScheme.surfaceVariant)
                    .padding(3.dp),
            ) {
                sides.forEachIndexed { i, s ->
                    val on = i == pick
                    Text(
                        s.name,
                        Modifier
                            .clip(RoundedCornerShape(50))
                            .background(if (on) MaterialTheme.colorScheme.surface else Color.Transparent)
                            .clickable { pick = i }
                            .padding(horizontal = 14.dp, vertical = 6.dp),
                        style = MaterialTheme.typography.labelMedium,
                        fontWeight = if (on) FontWeight.Bold else FontWeight.Normal,
                        color = if (on) HeroBlue else MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        } else if (side != null) {
            Text(side.name, style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.Bold, color = HeroBlue)
        }
        if (side != null) {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                side.stats.forEach { (l, v) -> Stat(l, v, Modifier.weight(1f)) }
            }
            GrowthChart(side.model, ageMonths, y, Modifier.fillMaxWidth().height(220.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                side.model.legend.forEach { (c, l) -> LegendSwatch(c, l) }
            }
            Text(side.note, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        if (note != null) {
            Text(note, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

private const val IAP_NOTE = "IAP 2015 Indian charts, 5–18 y. The lines are the printed centiles; " +
    "the z-score is read between them."

private fun iapSide(m: GrowthRefs.Measure, sex: String, r: GrowthRefs.IapReading, note: String = IAP_NOTE) = Side(
    "IAP 2015",
    listOf("Centile" to r.band, "z-score" to signed(r.z), "Percentile" to pct(r.percentile)),
    iapModel(m, sex),
    note,
)

private fun whoSide(ind: WhoBmi.Indicator, sex: String, z: Double, p: Double, note: String) = Side(
    "WHO 2007",
    listOf("z-score" to signed(z), "Percentile" to pct(p)),
    whoModel(ind, sex),
    note,
)

/** Class from an IAP reading alone, where the WHO has no chart: outside the 3rd or 97th line. */
private fun iapClass(r: GrowthRefs.IapReading?): String = when {
    r == null -> "Normal"
    r.band.startsWith("below") -> "Below 3rd"
    r.band.startsWith("above") -> "Above 97th"
    else -> "Normal"
}

/**
 * Every growth chart for a child of 5 to 19, drawn as soon as the numbers are
 * in: height, weight and BMI on the IAP 2015 Indian charts and the WHO 2007
 * reference, and mid-arm circumference on the Mramba 2017 MUAC-for-age
 * reference. The nutritional status at the top is the WHO reading the server
 * saves, on the camp's cut-offs.
 */
@Composable
fun GrowthChartsPanel(r: WhoBmi.Reading, muacCm: Double?, modifier: Modifier = Modifier, bmiOnly: Boolean = false) {
    val sex = r.sex
    val age = r.ageMonths
    val sexLabel = if (r.sexUnknown) "sex not recorded" else if (sex == "M") "Boy" else "Girl"
    val rawBmi = r.weightKg / (r.heightCm / 100).pow(2)
    val iapH = remember(r) { GrowthRefs.iapReading(GrowthRefs.Measure.HT, sex, age, r.heightCm) }
    val iapW = remember(r) { GrowthRefs.iapReading(GrowthRefs.Measure.WT, sex, age, r.weightKg) }
    val iapB = remember(r) { GrowthRefs.iapReading(GrowthRefs.Measure.BMI, sex, age, rawBmi) }
    val years = (age / 12).toInt()
    val months = (age - years * 12).toInt()
    val iapGone = if (age < GrowthRefs.IAP_MIN_MONTHS || age >= GrowthRefs.IAP_MAX_MONTHS + 1) {
        "The IAP charts run 5 to 18 years, so only the WHO chart is shown."
    } else null

    Column(modifier, verticalArrangement = Arrangement.spacedBy(12.dp)) {
        // Nutritional status, as the sheet records it.
        val tone = whoClassColor(r.status)
        Column(
            Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(14.dp))
                .background(tone.copy(alpha = 0.07f))
                .padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text(
                        "Nutritional status · $sexLabel, ${years}y ${months}m",
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Text(
                        String.format(Locale.US, "BMI %.1f kg/m²", r.bmi),
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                    )
                }
                Chip(r.status, tone)
            }
            val notes = buildList {
                add(
                    "WHO BMI-for-age: normal −2 to +2 SD; overweight above +2, obese above +3; " +
                        "wasted below −2, severely wasted below −3. Stunted: height-for-age below −2 SD.",
                )
                if (r.sexUnknown) add("Sex not recorded: read against both boys' and girls' curves, the more serious shown.")
                if (r.outsideRange) add("Outside 5–19 years: read against the nearest end of the WHO reference.")
            }
            notes.forEach {
                Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }

        // The clinician's growth form asks for BMI for age and nothing more.
        if (!bmiOnly) {
            // Height.
            MeasureCard(
                title = "Height-for-age",
                value = String.format(Locale.US, "%.1f cm", r.heightCm),
                cls = heightClass(r.heightZ),
                sides = listOfNotNull(
                    iapH?.let { iapSide(GrowthRefs.Measure.HT, sex, it) },
                    whoSide(
                        WhoBmi.Indicator.HFA, sex, r.heightZ, r.heightPercentile,
                        "WHO 2007, 5–19 y. Stunted below −2 SD, severely stunted below −3 SD.",
                    ),
                ),
                ageMonths = age,
                y = r.heightCm,
                note = iapGone,
                modifier = Modifier.fillMaxWidth(),
            )

            // Weight. The WHO's weight-for-age stops at 10.
            val wz = r.weightZ
            val wp = r.weightPercentile
            val weightSides = listOfNotNull(
                iapW?.let { iapSide(GrowthRefs.Measure.WT, sex, it) },
                if (wz != null && wp != null) {
                    whoSide(
                        WhoBmi.Indicator.WFA, sex, wz, wp,
                        "WHO 2007, 5–10 y. Underweight below −2 SD, severely below −3 SD. " +
                            "Above +2 SD, read BMI-for-age for overweight.",
                    )
                } else null,
            )
            MeasureCard(
                title = "Weight-for-age",
                value = String.format(Locale.US, "%.1f kg", r.weightKg),
                cls = if (wz != null) weightClass(wz) else iapClass(iapW),
                sides = weightSides,
                ageMonths = age,
                y = r.weightKg,
                note = when {
                    wz == null && iapW == null -> "No weight-for-age chart at this age: the WHO's ends at 10 years and the IAP's at 18. BMI-for-age is the measure."
                    wz == null -> "The WHO's weight-for-age chart ends at 10 years; BMI-for-age is the WHO measure from 10."
                    else -> iapGone
                },
                modifier = Modifier.fillMaxWidth(),
            )
        }

        // BMI.
        MeasureCard(
            title = "BMI-for-age",
            value = String.format(Locale.US, "%.1f kg/m²", r.bmi),
            cls = r.bmiClass,
            sides = listOfNotNull(
                iapB?.let {
                    iapSide(
                        GrowthRefs.Measure.BMI, sex, it,
                        "$IAP_NOTE 23 AE and 27 AE are the lines that meet adult BMI 23 (overweight) and 27 (obese) at 18.",
                    )
                },
                whoSide(
                    WhoBmi.Indicator.BFA, sex, r.bmiZ, r.bmiPercentile,
                    "WHO 2007, 5–19 y. The class above is read from this chart.",
                ),
            ),
            ageMonths = age,
            y = rawBmi,
            note = iapGone,
            modifier = Modifier.fillMaxWidth(),
        )

        // Mid-arm circumference.
        if (!bmiOnly && muacCm != null && muacCm > 0) MuacCard(r, muacCm, Modifier.fillMaxWidth())
    }
}

@Composable
private fun MuacCard(r: WhoBmi.Reading, cm: Double, modifier: Modifier) {
    val age = r.ageMonths
    // Sex not recorded: the lower of the two readings, as the clinical rules do.
    val (sex, reading) = remember(r, cm) {
        if (r.sexUnknown) {
            val m = GrowthRefs.muacReading("M", age, cm)
            val f = GrowthRefs.muacReading("F", age, cm)
            if (m != null && f != null && f.z < m.z) "F" to f else "M" to m
        } else r.sex to GrowthRefs.muacReading(r.sex, age, cm)
    }
    val value = String.format(Locale.US, "%.1f cm", cm)
    if (reading != null) {
        MeasureCard(
            title = "Mid-arm circumference-for-age",
            value = value,
            cls = GrowthRefs.muacClass(reading.z),
            sides = listOf(
                Side(
                    "Mramba 2017",
                    listOf("z-score" to signed(reading.z), "Percentile" to pct(reading.percentile)),
                    muacModel(sex),
                    "MUAC-for-age, 5–19 y (BMJ 2017). Low below −2 SD, severely low below −3 SD.",
                ),
            ),
            ageMonths = age,
            y = cm,
            note = null,
            modifier = modifier,
        )
    } else {
        val under5 = age < GrowthRefs.MUAC_MIN_MONTHS
        MeasureCard(
            title = "Mid-arm circumference",
            value = value,
            cls = if (under5) GrowthRefs.muacClassUnderFive(cm) else "Not read",
            sides = emptyList(),
            ageMonths = age,
            y = cm,
            note = if (under5) {
                "Under 5: the WHO's cut-offs, low below 12.5 cm, severely low below 11.5 cm."
            } else {
                "The MUAC-for-age reference ends at 19 years."
            },
            modifier = modifier,
        )
    }
}
