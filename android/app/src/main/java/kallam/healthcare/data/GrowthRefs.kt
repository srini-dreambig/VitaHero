package kallam.healthcare.data

import kotlin.math.floor

/**
 * The IAP 2015 Indian growth charts (height, weight and BMI, 5 to 18 years)
 * and the Mramba 2017 MUAC-for-age reference (5 to 19 years), read beside the
 * WHO's.
 *
 * Same code as functions/growthrefs.ts, which is checked against the papers'
 * printed tables; the tables in GrowthRefTables.kt are generated from the same
 * files by tools/growthrefs/gen.py. Change one and change the other.
 *
 * IAP: the chart's lines are the printed centiles, at every half year. A child
 * between two lines is read between them, linearly in z, so the centile always
 * agrees with the dot on the chart; past the outer lines, the distance is read
 * off the LMS curve fitted to that row.
 */
object GrowthRefs {
    const val IAP_MIN_MONTHS = 60.0
    const val IAP_MAX_MONTHS = 216.0
    const val MUAC_MIN_MONTHS = 60.0
    const val MUAC_MAX_MONTHS = 228.0

    enum class Measure { HT, WT, BMI }

    internal fun chart(m: Measure, sex: String): GrowthRefTables.Iap = when (m) {
        Measure.HT -> if (sex == "M") GrowthRefTables.IAP_HT_M else GrowthRefTables.IAP_HT_F
        Measure.WT -> if (sex == "M") GrowthRefTables.IAP_WT_M else GrowthRefTables.IAP_WT_F
        Measure.BMI -> if (sex == "M") GrowthRefTables.IAP_BMI_M else GrowthRefTables.IAP_BMI_F
    }

    /** Row index and fraction between half years, clamped to 5-18. */
    private fun rowAt(months: Double): Pair<Int, Double> {
        val x = (months.coerceIn(IAP_MIN_MONTHS, IAP_MAX_MONTHS) - IAP_MIN_MONTHS) / 6
        val lo = minOf(floor(x).toInt(), 25)
        return lo to (x - lo)
    }

    private fun between(xs: DoubleArray, lo: Int, f: Double) = xs[lo] + f * (xs[lo + 1] - xs[lo])

    /** The chart's lines (3rd to 97th, or the BMI chart's 3rd to 27 AE) at an age in months. */
    fun linesAt(m: Measure, sex: String, months: Double): List<Double> {
        val (lo, f) = rowAt(months)
        return chart(m, sex).centiles.map { between(it, lo, f) }
    }

    fun lmsAt(m: Measure, sex: String, months: Double): WhoBmi.Lms {
        val t = chart(m, sex).lms
        val (lo, f) = rowAt(months)
        return WhoBmi.Lms(between(t.l, lo, f), between(t.m, lo, f), between(t.s, lo, f))
    }

    private val qCache = HashMap<Double, Double>()

    /** Inverse normal CDF by bisection; only ever asked for the charts' few centiles. */
    fun zOfPercent(p: Double): Double = qCache.getOrPut(p) {
        var lo = -10.0
        var hi = 10.0
        repeat(100) {
            val mid = (lo + hi) / 2
            if (WhoBmi.normalCdf(mid) < p / 100) lo = mid else hi = mid
        }
        (lo + hi) / 2
    }

    /** z on the IAP chart, unrounded. */
    fun z(m: Measure, sex: String, months: Double, y: Double): Double {
        val t = chart(m, sex)
        val lines = linesAt(m, sex, months)
        val zs = t.percents.map { zOfPercent(it) }
        val last = lines.size - 1
        if (y <= lines[0] || y >= lines[last]) {
            val c = lmsAt(m, sex, months)
            val k = if (y <= lines[0]) 0 else last
            return zs[k] + WhoBmi.rawZ(y, c) - WhoBmi.rawZ(lines[k], c)
        }
        var k = 0
        while (y > lines[k + 1]) k++
        return zs[k] + (zs[k + 1] - zs[k]) * (y - lines[k]) / (lines[k + 1] - lines[k])
    }

    private fun lineName(label: String) =
        if (label.all { it.isDigit() }) label + (if (label.endsWith("3") && label != "13") "rd" else "th") else label

    /** Which two lines the reading sits between, in the chart's words. */
    fun band(m: Measure, sex: String, months: Double, y: Double): String {
        val t = chart(m, sex)
        val lines = linesAt(m, sex, months)
        val last = lines.size - 1
        fun name(k: Int) = if (t.labels[k].all { it.isDigit() }) lineName(t.labels[k]) else "the ${t.labels[k]} line"
        if (y < lines[0]) return "below ${name(0)}"
        if (y > lines[last]) return "above ${name(last)}"
        // A reading exactly on a line counts as on its way up: the 50th reads "50th–75th".
        var k = 0
        while (k < last - 1 && y >= lines[k + 1]) k++
        return "${lineName(t.labels[k])}–${lineName(t.labels[k + 1])}"
    }

    data class IapReading(val z: Double, val percentile: Double, val band: String)

    /** null under 5 or past 18, where the IAP charts have no lines. */
    fun iapReading(m: Measure, sex: String, months: Double, y: Double): IapReading? {
        if (!(y > 0) || !months.isFinite() || months < IAP_MIN_MONTHS || months >= IAP_MAX_MONTHS + 1) return null
        val z = WhoBmi.round2(z(m, sex, months, y))
        return IapReading(z, WhoBmi.percentileOf(z), band(m, sex, months, y))
    }

    /** Mramba L, M, S at an age in months, interpolated between whole months. Clamped to 60-228. */
    fun muacLmsAt(sex: String, months: Double): WhoBmi.Lms {
        val t = if (sex == "M") GrowthRefTables.MUAC_M else GrowthRefTables.MUAC_F
        val a = months.coerceIn(MUAC_MIN_MONTHS, MUAC_MAX_MONTHS)
        val whole = a.toInt()
        val lo = whole - MUAC_MIN_MONTHS.toInt()
        val hi = minOf(lo + 1, t.m.size - 1)
        val f = a - whole
        fun at(xs: DoubleArray) = xs[lo] + f * (xs[hi] - xs[lo])
        return WhoBmi.Lms(at(t.l), at(t.m), at(t.s))
    }

    data class MuacReading(val z: Double, val percentile: Double)

    /** null under 5 or past 19 (under 5 the camp uses the WHO's 11.5 and 12.5 cm). */
    fun muacReading(sex: String, months: Double, cm: Double): MuacReading? {
        if (!(cm > 0) || !months.isFinite() || months < MUAC_MIN_MONTHS || months >= MUAC_MAX_MONTHS + 1) return null
        val z = WhoBmi.round2(WhoBmi.restrictedZ(cm, muacLmsAt(sex, months)))
        return MuacReading(z, WhoBmi.percentileOf(z))
    }

    /** MUAC class, on the same cut-offs as the clinical rules (muacBand in clinical.ts). */
    fun muacClass(z: Double): String = when {
        z < -3 -> "Severely low"
        z < -2 -> "Low"
        else -> "Normal"
    }

    /** Under five: the WHO's screening cut-offs in cm. */
    fun muacClassUnderFive(cm: Double): String = when {
        cm < 11.5 -> "Severely low"
        cm < 12.5 -> "Low"
        else -> "Normal"
    }
}
