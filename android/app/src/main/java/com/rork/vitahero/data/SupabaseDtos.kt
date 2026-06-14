package com.rork.vitahero.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/** Supabase DTOs — match the database column names exactly. */

@Serializable
data class ProfileDto(
    val id: String,
    @SerialName("user_id") val userId: String? = null,
    val phone: String? = null,
    val name: String = "",
    @SerialName("onboarding_complete") val onboardingComplete: Boolean = false,
    @SerialName("is_logged_in") val isLoggedIn: Boolean = false,
    @SerialName("dark_theme") val darkTheme: Boolean = false,
    @SerialName("locale_code") val localeCode: String = "en",
    @SerialName("family_code") val familyCode: String = "",
    @SerialName("notifications_enabled") val notificationsEnabled: Boolean = true,
    @SerialName("camp_reminders_enabled") val campRemindersEnabled: Boolean = true,
    @SerialName("consent_accepted") val consentAccepted: Boolean = false,
    @SerialName("consent_declined") val consentDeclined: Boolean = false,
)

@Serializable
data class KidDto(
    val id: String,
    @SerialName("profile_id") val profileId: String,
    val name: String,
    val age: Int,
    val gender: String,
    val school: String = "",
    val grade: String = "",
    @SerialName("height_cm") val heightCm: Double = 0.0,
    @SerialName("weight_kg") val weightKg: Double = 0.0,
    @SerialName("avatar_color") val avatarColor: Long = 0,
    @SerialName("overall_score") val overallScore: Int = 80,
    val dental: String = "GOOD",
    val eyesight: String = "GOOD",
    val nutrition: String = "GOOD",
    @SerialName("last_checkup") val lastCheckup: String = "Not yet",
)

@Serializable
data class CampDto(
    val id: String,
    @SerialName("profile_id") val profileId: String,
    val title: String,
    val school: String,
    val date: String,
    val time: String,
    val status: String = "UPCOMING",
    val checks: List<String> = emptyList(),
    @SerialName("result_summary") val resultSummary: String? = null,
)

@Serializable
data class AppointmentDto(
    val id: String,
    @SerialName("profile_id") val profileId: String,
    @SerialName("doctor_name") val doctorName: String,
    val specialty: String,
    @SerialName("kid_name") val kidName: String,
    val date: String,
    val time: String,
)

@Serializable
data class MealItemDto(
    val id: String,
    @SerialName("profile_id") val profileId: String,
    @SerialName("kid_id") val kidId: String,
    @SerialName("time_slot") val timeSlot: String,
    val name: String,
    val detail: String = "",
    val kcal: Int = 0,
    val eaten: Boolean = false,
)

@Serializable
data class GrowthPointDto(
    val id: String,
    @SerialName("kid_id") val kidId: String,
    val label: String,
    val height: Double = 0.0,
    val weight: Double = 0.0,
)

@Serializable
data class StreakDto(
    @SerialName("kid_id") val kidId: String,
    @SerialName("current_streak") val currentStreak: Int = 0,
    @SerialName("best_streak") val bestStreak: Int = 0,
    @SerialName("last_log_date") val lastLogDate: String = "",
)

@Serializable
data class CoParentDto(
    val id: String,
    @SerialName("profile_id") val profileId: String,
    val name: String,
    val relation: String,
    @SerialName("joined_date") val joinedDate: String = "",
)
