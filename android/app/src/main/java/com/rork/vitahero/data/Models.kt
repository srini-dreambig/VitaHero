package com.rork.vitahero.data

import androidx.compose.ui.graphics.Color
import com.rork.vitahero.ui.theme.FlagAlert
import com.rork.vitahero.ui.theme.FlagGood
import com.rork.vitahero.ui.theme.FlagNeutral
import com.rork.vitahero.ui.theme.FlagWatch

enum class HealthFlag(val label: String, val color: Color) {
    GOOD("On track", FlagGood),
    WATCH("Needs attention", FlagWatch),
    ALERT("See a doctor", FlagAlert),

    /**
     * Nothing has been measured yet — no camp has screened this, or the camp
     * did not include this check. Distinct from GOOD on purpose: silence is
     * not a clean bill of health, and showing it as one misleads a parent.
     */
    NOT_MEASURED("Not measured yet", FlagNeutral)
}

data class HealthMetric(
    val title: String,
    val value: String,
    val flag: HealthFlag,
    val note: String
)

data class GrowthPoint(
    val id: String = "",
    val label: String,
    val height: Float, // cm
    val weight: Float, // kg
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
    val lastCheckup: String,
    val source: String = "PARENT", // ADMIN = provisioned from a school camp (medical data is read-only)
)

enum class CampStatus { UPCOMING, COMPLETED }

data class Camp(
    val id: String,
    val title: String,
    val school: String,
    val date: String,
    val time: String,
    val status: CampStatus,
    val checks: List<String>,
    val resultSummary: String?,
    val isPartnerCamp: Boolean = false,
    val schoolId: String = "",
    val schoolCampId: String = "",
    val description: String = "",
    val grades: List<String> = emptyList(),
    val capacity: Int = 0,
    val registeredKidIds: List<String> = emptyList(),
)

data class PartnerSchool(
    val id: String,
    val name: String,
    val city: String,
    val district: String,
    val description: String,
    val enrolledAt: String = "",
    val kidId: String? = null,
)

data class GrowthAssessment(
    val heightPercentile: Int,
    val weightPercentile: Int,
    val heightStatus: String,
    val weightStatus: String,
    val chartSource: String = "WHO/IAP 2007",
)

data class Doctor(
    val id: String,
    val name: String,
    val specialty: String,
    val hospital: String,
    val rating: Float,
    val nextSlot: String,
    val avatarColor: Long,
    val hospitalId: String = "",
    val city: String = "",
    val isCampPartner: Boolean = false,
)

data class Hospital(
    val id: String,
    val name: String,
    val city: String,
    val district: String,
    val address: String,
    val rating: Float,
    val isCampPartner: Boolean,
    val conductedCamps: Int,
    val userCampLinked: Boolean,
    val distanceKm: Float?,
    val specialties: List<String>,
    val doctors: List<Doctor>,
)

data class BookingDirectory(
    val city: String,
    val hospitals: List<Hospital>,
    val specialties: List<String>,
)

data class BookingTimeSlot(
    val label: String,
    val date: String,
    val time: String,
)

data class Appointment(
    val id: String,
    val doctorId: String = "",
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
    /**
     * Locale keys, not English. A badge is chrome a child reads, and it was
     * the last place in the app still hardcoding English.
     */
    val titleKey: String,
    val descriptionKey: String,
    val earned: Boolean,
    val progress: Float, // 0..1
    val accent: Long,
    val targetCount: Int = 7,
    val currentCount: Int = 0
)

data class LeaderEntry(
    val rank: Int,
    val name: String,
    val points: Int,
    val isYou: Boolean
)

data class StreakInfo(
    val currentStreak: Int = 0,
    val bestStreak: Int = 0,
    val lastLogDate: String = ""
)

data class CoParent(
    val id: String,
    val name: String,
    val relation: String,
    val joinedDate: String = ""
)

data class PersonalizedDietTip(
    val greeting: String,
    val insight: String,
    val suggestion: String,
    val funFact: String
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

/**
 * A measurement as a parent should see it.
 *
 * Height and weight default to zero for a child no camp has screened, and
 * "0 cm" is not a height — it is the absence of one, and it must not be
 * rendered as a number.
 */
fun Kid.heightText(): String = if (heightCm > 0f) "${heightCm.toInt()} cm" else "\u2014"

fun Kid.weightText(): String = if (weightKg > 0f) "${weightKg.toInt()} kg" else "\u2014"
