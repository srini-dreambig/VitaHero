package com.rork.vitahero.data

import androidx.compose.ui.graphics.Color
import com.rork.vitahero.ui.theme.FlagAlert
import com.rork.vitahero.ui.theme.FlagGood
import com.rork.vitahero.ui.theme.FlagWatch

enum class HealthFlag(val label: String, val color: Color) {
    GOOD("On track", FlagGood),
    WATCH("Needs attention", FlagWatch),
    ALERT("See a doctor", FlagAlert)
}

data class HealthMetric(
    val title: String,
    val value: String,
    val flag: HealthFlag,
    val note: String
)

data class GrowthPoint(
    val label: String,
    val height: Float, // cm
    val weight: Float  // kg
)

data class Kid(
    val id: String,
    val name: String,
    val age: Int,
    val gender: String,
    val school: String,
    val grade: String,
    val heightCm: Float,
    val weightKg: Float,
    val avatarColor: Long,
    val overallScore: Int, // 0..100
    val growth: List<GrowthPoint>,
    val dental: HealthFlag,
    val eyesight: HealthFlag,
    val nutrition: HealthFlag,
    val lastCheckup: String
) {
    val bmi: Float
        get() {
            val m = heightCm / 100f
            return if (m > 0) weightKg / (m * m) else 0f
        }

    val bmiFlag: HealthFlag
        get() = when {
            bmi < 14f -> HealthFlag.WATCH
            bmi > 19.5f -> HealthFlag.ALERT
            else -> HealthFlag.GOOD
        }
}

enum class CampStatus { UPCOMING, COMPLETED }

data class Camp(
    val id: String,
    val title: String,
    val school: String,
    val date: String,
    val time: String,
    val status: CampStatus,
    val checks: List<String>,
    val resultSummary: String?
)

data class Doctor(
    val id: String,
    val name: String,
    val specialty: String,
    val hospital: String,
    val rating: Float,
    val nextSlot: String,
    val avatarColor: Long
)

data class Appointment(
    val id: String,
    val doctorName: String,
    val specialty: String,
    val kidName: String,
    val date: String,
    val time: String
)

data class MealItem(
    val id: String,
    val time: String,
    val name: String,
    val detail: String,
    val kcal: Int,
    var eaten: Boolean
)

data class Badge(
    val id: String,
    val title: String,
    val description: String,
    val earned: Boolean,
    val progress: Float, // 0..1
    val accent: Long
)

data class LeaderEntry(
    val rank: Int,
    val name: String,
    val points: Int,
    val isYou: Boolean
)

data class AppNotification(
    val id: String,
    val title: String,
    val body: String,
    val time: String,
    val type: NotificationType,
    val unread: Boolean
)

enum class NotificationType { CAMP, CHECKUP, DIET, REWARD }
