package com.rork.vitahero.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/** DTOs — match the database column names exactly. */

@Serializable
data class InviteResolveDto(
    val valid: Boolean = false,
    val phone: String? = null,
    val last10: String? = null,
)

@Serializable
data class ProfileDto(
    val id: String,
    @SerialName("user_id") val userId: String? = null,
    val phone: String? = null,
    val name: String = "",
    val email: String? = null,
    @SerialName("onboarding_complete") val onboardingComplete: Boolean = false,
    @SerialName("is_logged_in") val isLoggedIn: Boolean = false,
    @SerialName("dark_theme") val darkTheme: Boolean = false,
    @SerialName("locale_code") val localeCode: String = "en",
    @SerialName("family_code") val familyCode: String = "",
    @SerialName("notifications_enabled") val notificationsEnabled: Boolean = true,
    @SerialName("camp_reminders_enabled") val campRemindersEnabled: Boolean = true,
    @SerialName("consent_accepted") val consentAccepted: Boolean = false,
    @SerialName("consent_declined") val consentDeclined: Boolean = false,
    @SerialName("auth_provider") val authProvider: String? = null,
)

@Serializable
data class KidDto(
    val id: String,
    @SerialName("profile_id") val profileId: String,
    @SerialName("user_id") val userId: String? = null,
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
    val source: String = "PARENT",
)

@Serializable
data class CampDto(
    val id: String,
    @SerialName("profile_id") val profileId: String = "",
    @SerialName("user_id") val userId: String? = null,
    val title: String,
    val school: String,
    val date: String,
    val time: String,
    // The server's camp lifecycle has no UPCOMING; a camp starts at DRAFT and
    // is SCHEDULED once it has a date. Defaulting to a status the server never
    // sends meant a malformed payload rendered as a scheduled camp.
    val status: String = "DRAFT",
    val venue: String = "",
    @SerialName("consent_deadline") val consentDeadline: String = "",
    val checks: List<String> = emptyList(),
    @SerialName("result_summary") val resultSummary: String? = null,
    @SerialName("is_partner") val isPartner: Boolean = false,
    @SerialName("school_id") val schoolId: String? = null,
    @SerialName("school_camp_id") val schoolCampId: String? = null,
    val description: String = "",
    val grades: List<String> = emptyList(),
    val capacity: Int = 0,
    @SerialName("registered_kid_ids") val registeredKidIds: List<String> = emptyList(),
)

@Serializable
data class AppointmentDto(
    val id: String,
    @SerialName("profile_id") val profileId: String,
    @SerialName("user_id") val userId: String? = null,
    @SerialName("doctor_name") val doctorName: String,
    @SerialName("doctor_id") val doctorId: String? = null,
    val specialty: String,
    @SerialName("kid_name") val kidName: String,
    val date: String,
    val time: String,
)

@Serializable
data class MealItemDto(
    val id: String,
    @SerialName("profile_id") val profileId: String,
    @SerialName("user_id") val userId: String? = null,
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
    @SerialName("user_id") val userId: String? = null,
    val label: String,
    val height: Double = 0.0,
    val weight: Double = 0.0,
)

@Serializable
data class StreakDto(
    @SerialName("kid_id") val kidId: String,
    @SerialName("user_id") val userId: String? = null,
    @SerialName("current_streak") val currentStreak: Int = 0,
    @SerialName("best_streak") val bestStreak: Int = 0,
    @SerialName("last_log_date") val lastLogDate: String = "",
)

@Serializable
data class CoParentDto(
    val id: String,
    @SerialName("profile_id") val profileId: String,
    @SerialName("user_id") val userId: String? = null,
    val name: String,
    val relation: String,
    @SerialName("joined_date") val joinedDate: String = "",
)

@Serializable
data class DoctorDto(
    val id: String,
    val name: String,
    val specialty: String,
    val hospital: String = "",
    val city: String = "",
    val rating: Double = 4.5,
    @SerialName("hospital_id") val hospitalId: String? = null,
    @SerialName("is_camp_partner") val isCampPartner: Boolean = false,
)

@Serializable
data class BookingDirectoryDoctorDto(
    val id: String,
    val name: String,
    val specialty: String,
    val hospital: String = "",
    @SerialName("hospital_id") val hospitalId: String? = null,
    val city: String = "",
    val rating: Double = 4.5,
    @SerialName("is_camp_partner") val isCampPartner: Boolean = false,
)

@Serializable
data class BookingHospitalDto(
    val id: String,
    val name: String,
    val city: String = "",
    val district: String = "",
    val address: String = "",
    val lat: Double? = null,
    val lng: Double? = null,
    val phone: String = "",
    val rating: Double = 4.5,
    @SerialName("is_camp_partner") val isCampPartner: Boolean = false,
    @SerialName("conducted_camps") val conductedCamps: Int = 0,
    @SerialName("user_camp_linked") val userCampLinked: Boolean = false,
    @SerialName("user_linked_camps") val userLinkedCamps: Int = 0,
    @SerialName("distance_km") val distanceKm: Double? = null,
    val specialties: List<String> = emptyList(),
    val doctors: List<BookingDirectoryDoctorDto> = emptyList(),
)

@Serializable
data class BookingDirectoryDto(
    val city: String,
    val hospitals: List<BookingHospitalDto> = emptyList(),
    val specialties: List<String> = emptyList(),
)

@Serializable
data class BookingSlotDto(
    val date: String,
    val time: String,
    val label: String,
)

@Serializable
data class BookingSlotsResponse(
    @SerialName("doctor_id") val doctorId: String,
    val slots: List<BookingSlotDto> = emptyList(),
)

@Serializable
data class NotificationDto(
    val id: String,
    val title: String,
    val body: String,
    val time: String = "",
    val type: String = "CAMP",
    val unread: Boolean = true,
)

@Serializable
data class SchoolDto(
    val id: String,
    val name: String,
    val city: String = "",
    val district: String = "",
    val description: String = "",
    val active: Boolean = true,
)

@Serializable
data class MySchoolDto(
    val id: String,
    val name: String,
    val city: String = "",
    val district: String = "",
    val description: String = "",
    @SerialName("enrolled_at") val enrolledAt: String? = null,
    @SerialName("kid_id") val kidId: String? = null,
)

@Serializable
data class SchoolEnrollResponse(
    val success: Boolean = false,
    @SerialName("schoolId") val schoolId: String? = null,
    @SerialName("schoolName") val schoolName: String? = null,
    val error: String? = null,
)

@Serializable
data class CampRegisterResponse(
    val success: Boolean = false,
    @SerialName("registrationId") val registrationId: String? = null,
    val error: String? = null,
)

@Serializable
data class AiDietTipDto(
    val content: AiDietTipContentDto = AiDietTipContentDto(),
    @SerialName("generated_at") val generatedAt: String? = null,
)

@Serializable
data class AiDietTipContentDto(
    val greeting: String = "",
    val insight: String = "",
    val suggestion: String = "",
    @SerialName("funFact") val funFact: String = "",
    @SerialName("generatedAt") val generatedAt: String = "",
)

@Serializable
data class FoodRecognitionResponseDto(
    val items: List<DetectedFoodDto> = emptyList(),
    val error: String? = null,
)

@Serializable
data class DetectedFoodDto(
    val name: String = "",
    val kcal: Int = 0,
    val confidence: Float = 0.6f,
)
