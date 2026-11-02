package kallam.healthcare.data

import java.time.LocalDate
import java.time.temporal.ChronoUnit
import kotlin.math.abs
import kotlin.math.exp
import kotlin.math.floor
import kotlin.math.ln
import kotlin.math.pow
import kotlin.math.sqrt

/**
 * The WHO 2007 growth reference for 5-19 years: BMI-for-age, height-for-age
 * and weight-for-age (to 10 years only), read the way the WHO's own software
 * reads them.
 *
 * Same code as functions/who2007.ts, which is checked against all 933 children
 * in the WHO's own worked survey; the tables in WhoTables.kt are generated from
 * the same files by tools/who2007/gen.py, and who2007.test.ts fails if they
 * drift. Change one and change the other.
 */
object WhoBmi {
    const val MIN_MONTHS = 60.0
    const val MAX_MONTHS = 229.0
    /** Weight-for-age ends at 10 years. */
    const val WFA_MAX_MONTHS = 120.0

    enum class Indicator { BFA, HFA, WFA }

    /** The last month an indicator has a curve for. */
    fun maxMonthsOf(ind: Indicator): Double = if (ind == Indicator.WFA) WFA_MAX_MONTHS else MAX_MONTHS

    data class Lms(val l: Double, val m: Double, val s: Double)

    data class Reading(
        val bmi: Double,          // one decimal, as shown
        val heightCm: Double,
        val weightKg: Double,
        val sex: String,          // "M" or "F"
        val ageMonths: Double,
        val bmiZ: Double,         // two decimals
        val bmiPercentile: Double,
        val heightZ: Double,
        val heightPercentile: Double,
        /** Weight-for-age, two decimals. null past 10 years, where the WHO has no curve. */
        val weightZ: Double?,
        val weightPercentile: Double?,
        val bmiClass: String,
        val stunted: Boolean,
        /** Under 5 or over 19: read against the nearest end of the 5-19 reference. */
        val outsideRange: Boolean,
        /** Sex not recorded: the more serious of the two readings. */
        val sexUnknown: Boolean = false,
    ) {
        /** The paper sheet's one-word nutritional status. */
        val status: String get() = when {
            bmiClass == "Severely wasted" || bmiClass == "Wasted" || bmiClass == "Obese" -> bmiClass
            stunted -> "Stunted"
            else -> bmiClass
        }
    }

    private fun table(ind: Indicator, sex: String): WhoTables.Lms = when (ind) {
        Indicator.BFA -> if (sex == "M") WhoTables.BFA_M else WhoTables.BFA_F
        Indicator.HFA -> if (sex == "M") WhoTables.HFA_M else WhoTables.HFA_F
        Indicator.WFA -> if (sex == "M") WhoTables.WFA_M else WhoTables.WFA_F
    }

    /** L, M and S at an age in months, interpolated as the WHO does. Clamped to 60-229 (weight: 60-120). */
    fun lmsAt(ind: Indicator, sex: String, ageMonths: Double): Lms {
        val t = table(ind, sex)
        val a = ageMonths.coerceIn(MIN_MONTHS, maxMonthsOf(ind))
        val whole = a.toInt()
        val lo = whole - MIN_MONTHS.toInt()
        val hi = minOf(lo + 1, t.m.size - 1)
        val f = a - whole
        fun at(xs: DoubleArray) = xs[lo] + f * (xs[hi] - xs[lo])
        return Lms(at(t.l), at(t.m), at(t.s))
    }

    /** The measurement that sits at a given z, on the LMS curve. */
    fun valueAtZ(c: Lms, z: Double): Double =
        if (c.l == 0.0) c.m * exp(c.s * z) else c.m * (1 + c.l * c.s * z).pow(1 / c.l)

    fun rawZ(y: Double, c: Lms): Double =
        if (c.l == 0.0) ln(y / c.m) / c.s else ((y / c.m).pow(c.l) - 1) / (c.s * c.l)

    /** z-score, unrounded. BMI and weight are restricted past +/-3 SD; height is not. */
    fun z(ind: Indicator, sex: String, ageMonths: Double, y: Double): Double {
        val c = lmsAt(ind, sex, ageMonths)
        return if (ind == Indicator.HFA) rawZ(y, c) else restrictedZ(y, c)
    }

    /** z on an LMS curve, restricted past +/-3 SD the WHO's way. */
    fun restrictedZ(y: Double, c: Lms): Double {
        val z = rawZ(y, c)
        if (z > 3) {
            val sd3 = valueAtZ(c, 3.0)
            return 3 + (y - sd3) / (sd3 - valueAtZ(c, 2.0))
        }
        if (z < -3) {
            val sd3 = valueAtZ(c, -3.0)
            return -3 + (y - sd3) / (valueAtZ(c, -2.0) - sd3)
        }
        return z
    }

    fun normalCdf(z: Double): Double = 0.5 * erfc(-z / sqrt(2.0))

    private fun erfc(x: Double): Double {
        // Numerical Recipes erfc; |error| < 1.2e-7.
        val zz = abs(x)
        val t = 1 / (1 + 0.5 * zz)
        val r = t * exp(
            -zz * zz - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 +
                t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 +
                t * (-0.82215223 + t * 0.17087277))))))))
        )
        return if (x >= 0) r else 2 - r
    }

    /** Percentile, 0.1 to 99.9, one decimal. */
    fun percentileOf(z: Double): Double = (jsRound(normalCdf(z) * 1000) / 10).coerceIn(0.1, 99.9)

    /** Two decimals. `+ 0.0` turns -0.0 into 0.0, which would print as -0.00. */
    fun round2(z: Double): Double = (jsRound(z * 100) / 100) + 0.0

    /** Halves up, as the server's Math.round; kotlin.math.round sends halves to even. */
    private fun jsRound(x: Double): Double = floor(x + 0.5)

    /**
     * BMI-for-age class, on the camp's own cut-offs: normal from -2 to +2 SD,
     * above +2 overweight, above +3 obese, below -2 wasted, below -3 severely
     * wasted. Boundaries are strict. Same as bmiClass in who2007.ts.
     */
    fun bmiClass(z: Double): String = when {
        z < -3 -> "Severely wasted"
        z < -2 -> "Wasted"
        z > 3 -> "Obese"
        z > 2 -> "Overweight"
        else -> "Normal"
    }

    /** Mirrors referenceSex() in clinical.ts. null when the sex is not recorded. */
    fun referenceSex(gender: String): String? = GrowthStandards.referenceSex(gender)

    /**
     * Age in months today, from a date of birth, or failing that from whole
     * years read as the middle of that year. WHO counts a month as 365.25 / 12 days.
     */
    fun ageInMonths(dob: String?, ageYears: Int?, on: LocalDate = LocalDate.now()): Double? {
        parseDob(dob.orEmpty())?.let { born ->
            val days = ChronoUnit.DAYS.between(born, on).toDouble()
            if (days > 0 && days < 30 * 365.25) return days / (365.25 / 12)
        }
        val y = ageYears ?: return null
        return if (y in 1..29) y * 12.0 + 6 else null
    }

    private val ISO = Regex("""^(\d{4})-(\d{1,2})-(\d{1,2})""")
    private val DMY = Regex("""^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$""")

    /** YYYY-MM-DD (or a timestamp), DD-MM-YYYY and DD/MM/YYYY. null for anything else. */
    fun parseDob(s: String): LocalDate? {
        val v = s.trim()
        val (y, mo, d) = ISO.find(v)?.destructured?.let { (a, b, c) -> Triple(a.toInt(), b.toInt(), c.toInt()) }
            ?: DMY.find(v)?.destructured?.let { (a, b, c) -> Triple(c.toInt(), b.toInt(), a.toInt()) }
            ?: return null
        if (y < 1900) return null
        return runCatching { LocalDate.of(y, mo, d) }.getOrNull()
    }

    /** One child's reading against one sex's curves. null when the numbers cannot be read. */
    fun reading(heightCm: Double, weightKg: Double, sex: String, ageMonths: Double): Reading? {
        if (!(heightCm > 0) || !(weightKg > 0) || !ageMonths.isFinite()) return null
        val raw = weightKg / (heightCm / 100).pow(2)
        val bmiZ = round2(z(Indicator.BFA, sex, ageMonths, raw))
        val heightZ = round2(z(Indicator.HFA, sex, ageMonths, heightCm))
        val weightZ = if (ageMonths < WFA_MAX_MONTHS + 1) round2(z(Indicator.WFA, sex, ageMonths, weightKg)) else null
        return Reading(
            bmi = jsRound(raw * 10) / 10,
            heightCm = heightCm,
            weightKg = weightKg,
            sex = sex,
            ageMonths = ageMonths,
            bmiZ = bmiZ,
            bmiPercentile = percentileOf(bmiZ),
            heightZ = heightZ,
            heightPercentile = percentileOf(heightZ),
            weightZ = weightZ,
            weightPercentile = weightZ?.let { percentileOf(it) },
            bmiClass = bmiClass(bmiZ),
            stunted = heightZ < -2,
            outsideRange = ageMonths < MIN_MONTHS || ageMonths > MAX_MONTHS + 1,
        )
    }

    private val SEVERITY = mapOf(
        "Normal" to 0, "Overweight" to 1, "Stunted" to 1, "Wasted" to 1,
        "Obese" to 2, "Severely wasted" to 2,
    )

    /**
     * The reading for a child as recorded. With the sex not recorded, both
     * references are read and the more serious one is shown — as the server does.
     */
    fun forChild(heightCm: Double, weightKg: Double, gender: String, dob: String?, ageYears: Int?): Reading? {
        val months = ageInMonths(dob, ageYears) ?: return null
        referenceSex(gender)?.let { return reading(heightCm, weightKg, it, months) }
        val m = reading(heightCm, weightKg, "M", months) ?: return null
        val f = reading(heightCm, weightKg, "F", months) ?: return null
        val sm = SEVERITY[m.status] ?: 0
        val sf = SEVERITY[f.status] ?: 0
        val pick = if (sm != sf) (if (sm > sf) m else f) else if (abs(m.bmiZ) >= abs(f.bmiZ)) m else f
        return pick.copy(sexUnknown = true)
    }
}
