package com.rork.vitahero.data

/**
 * WHO 2007 growth reference (used by IAP for Indian paediatric practice).
 * Median (P50) values at integer ages; percentile bands derived via LMS-style spread.
 */
object GrowthStandards {

    enum class Metric { HEIGHT, WEIGHT }

    private data class Ref(val age: Int, val p50: Float)

    private val heightBoys = listOf(
        Ref(2, 87.8f), Ref(3, 96.1f), Ref(4, 103.3f), Ref(5, 110.0f), Ref(6, 116.1f),
        Ref(7, 121.7f), Ref(8, 127.1f), Ref(9, 132.2f), Ref(10, 137.2f), Ref(11, 142.8f),
        Ref(12, 149.1f), Ref(13, 156.2f), Ref(14, 163.5f), Ref(15, 168.7f), Ref(16, 171.6f),
        Ref(17, 172.8f), Ref(18, 172.9f),
    )
    private val heightGirls = listOf(
        Ref(2, 86.4f), Ref(3, 95.1f), Ref(4, 102.7f), Ref(5, 109.4f), Ref(6, 115.6f),
        Ref(7, 121.4f), Ref(8, 127.0f), Ref(9, 132.4f), Ref(10, 137.8f), Ref(11, 143.7f),
        Ref(12, 150.0f), Ref(13, 155.7f), Ref(14, 159.5f), Ref(15, 161.2f), Ref(16, 161.8f),
        Ref(17, 162.1f), Ref(18, 162.2f),
    )
    private val weightBoys = listOf(
        Ref(2, 12.2f), Ref(3, 14.3f), Ref(4, 16.3f), Ref(5, 18.3f), Ref(6, 20.5f),
        Ref(7, 22.9f), Ref(8, 25.6f), Ref(9, 28.6f), Ref(10, 32.0f), Ref(11, 36.0f),
        Ref(12, 40.7f), Ref(13, 45.8f), Ref(14, 51.0f), Ref(15, 55.5f), Ref(16, 58.5f),
        Ref(17, 60.0f), Ref(18, 61.0f),
    )
    private val weightGirls = listOf(
        Ref(2, 11.5f), Ref(3, 13.5f), Ref(4, 15.5f), Ref(5, 17.4f), Ref(6, 19.5f),
        Ref(7, 21.9f), Ref(8, 24.6f), Ref(9, 27.8f), Ref(10, 31.4f), Ref(11, 35.5f),
        Ref(12, 40.1f), Ref(13, 44.8f), Ref(14, 48.5f), Ref(15, 50.8f), Ref(16, 52.0f),
        Ref(17, 52.5f), Ref(18, 53.0f),
    )
    /**
     * Which reference table applies, or null when the record does not say.
     *
     * This used to be a boolean — boy, or else — so a child whose sex was not
     * recorded, or recorded as neither, was charted against the girls' table
     * and shown a percentile as though it were the right one. At fourteen the
     * two medians are four centimetres and two and a half kilograms apart.
     * Mirrors referenceSex() in clinical.ts; functions/growth.test.ts fails if
     * the two drift.
     */
    fun referenceSex(gender: String): String? {
        val g = gender.trim().lowercase()
        if (g.startsWith("b") || g == "male" || g == "m") return "M"
        if (g.startsWith("g") || g == "female" || g == "f") return "F"
        return null
    }

    private fun refs(metric: Metric, isBoy: Boolean): List<Ref> = when (metric) {
        Metric.HEIGHT -> if (isBoy) heightBoys else heightGirls
        Metric.WEIGHT -> if (isBoy) weightBoys else weightGirls
    }

    private fun medianFor(ageYears: Int, sex: String, metric: Metric): Float {
        val table = refs(metric, sex == "M")
        val age = ageYears.coerceIn(2, 18)
        return table.firstOrNull { it.age == age }?.p50 ?: table.last().p50
    }

    /** P50 at an age, against the reference for a recorded sex. */
    fun medianAtAge(ageYears: Int, gender: String, metric: Metric): Float =
        medianFor(ageYears, referenceSex(gender) ?: "F", metric)

    /** Percentile curve value at age for chart drawing (3, 15, 50, 85, 97). */
    fun percentileValue(ageYears: Int, gender: String, metric: Metric, percentile: Int): Float {
        val p50 = medianAtAge(ageYears, gender, metric)
        val spread = when (metric) {
            Metric.HEIGHT -> 0.045f
            Metric.WEIGHT -> 0.14f
        }
        val z = when (percentile) {
            3 -> -1.88f
            15 -> -1.04f
            50 -> 0f
            85 -> 1.04f
            97 -> 1.88f
            else -> 0f
        }
        return p50 * (1f + spread * z)
    }

    /** Estimate percentile (1–99) for a measured value. */
    fun estimatePercentile(value: Float, ageYears: Int, gender: String, metric: Metric): Int {
        val sex = referenceSex(gender)
            ?: // Nothing here can say which reference is right, so take the one
               // that reads lower. Guessing the other way means telling a
               // family a child is fine when the other table would have
               // flagged them.
                return minOf(
                    percentileAgainst(value, ageYears, "M", metric),
                    percentileAgainst(value, ageYears, "F", metric),
                )
        return percentileAgainst(value, ageYears, sex, metric)
    }

    private fun percentileAgainst(value: Float, ageYears: Int, sex: String, metric: Metric): Int {
        val spread = when (metric) {
            Metric.HEIGHT -> 0.045f
            Metric.WEIGHT -> 0.14f
        }
        val p50 = medianFor(ageYears, sex, metric)
        if (p50 <= 0f) return 50
        val z = ((value / p50) - 1f) / spread
        val pct = when {
            z <= -1.88f -> 3
            z <= -1.04f -> 3 + ((z + 1.88f) / 0.84f * 12f).toInt()
            z <= 0f -> 15 + ((z + 1.04f) / 1.04f * 35f).toInt()
            z <= 1.04f -> 50 + (z / 1.04f * 35f).toInt()
            z <= 1.88f -> 85 + ((z - 1.04f) / 0.84f * 12f).toInt()
            else -> 97
        }
        return pct.coerceIn(1, 99)
    }

    fun statusLabel(percentile: Int, metric: Metric): String = when (metric) {
        Metric.HEIGHT -> when {
            percentile < 3 -> "Short stature"
            percentile < 15 -> "Below average"
            percentile <= 85 -> "Normal"
            percentile <= 97 -> "Above average"
            else -> "Tall stature"
        }
        Metric.WEIGHT -> when {
            percentile < 3 -> "Underweight"
            percentile < 15 -> "Low weight"
            percentile <= 85 -> "Normal weight"
            percentile <= 97 -> "High weight"
            else -> "Overweight"
        }
    }

    fun assess(kid: Kid): GrowthAssessment {
        val hPct = estimatePercentile(kid.heightCm, kid.age, kid.gender, Metric.HEIGHT)
        val wPct = estimatePercentile(kid.weightKg, kid.age, kid.gender, Metric.WEIGHT)
        return GrowthAssessment(
            heightPercentile = hPct,
            weightPercentile = wPct,
            heightStatus = statusLabel(hPct, Metric.HEIGHT),
            weightStatus = statusLabel(wPct, Metric.WEIGHT),
        )
    }

    fun chartAges(): List<Int> = (2..18).toList()
}
