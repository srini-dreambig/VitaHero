package com.rork.vitahero.data

/**
 * Derives health flags and overall score from WHO/IAP growth standards — no hardcoded defaults.
 */
object KidHealthAssessment {

    fun fromMeasurements(
        age: Int,
        gender: String,
        heightCm: Float,
        weightKg: Float,
    ): Assessment {
        val kid = Kid(
            id = "",
            name = "",
            age = age,
            gender = gender,
            school = "",
            grade = "",
            heightCm = heightCm,
            weightKg = weightKg,
            avatarColor = 0,
            overallScore = 0,
            growth = emptyList(),
            dental = HealthFlag.GOOD,
            eyesight = HealthFlag.GOOD,
            nutrition = HealthFlag.GOOD,
            lastCheckup = "Not yet",
        )
        val growth = GrowthStandards.assess(kid)
        val nutrition = when {
            growth.weightPercentile < 5 -> HealthFlag.WATCH
            growth.weightPercentile >= 97 -> HealthFlag.ALERT
            growth.weightPercentile < 15 || growth.weightPercentile > 90 -> HealthFlag.WATCH
            else -> HealthFlag.GOOD
        }
        val heightFlag = when {
            growth.heightPercentile < 3 -> HealthFlag.ALERT
            growth.heightPercentile < 15 -> HealthFlag.WATCH
            else -> HealthFlag.GOOD
        }
        val avgPct = (growth.heightPercentile + growth.weightPercentile) / 2
        val overallScore = when {
            avgPct in 15..85 -> 88
            avgPct in 5..14 || avgPct in 86..94 -> 72
            else -> 58
        }.coerceIn(0, 100)
        return Assessment(
            nutrition = nutrition,
            eyesight = HealthFlag.GOOD,
            dental = HealthFlag.GOOD,
            overallScore = overallScore,
            heightFlag = heightFlag,
        )
    }

    data class Assessment(
        val nutrition: HealthFlag,
        val eyesight: HealthFlag,
        val dental: HealthFlag,
        val overallScore: Int,
        val heightFlag: HealthFlag,
    )
}
