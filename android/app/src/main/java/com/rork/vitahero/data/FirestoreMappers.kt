package com.rork.vitahero.data

/**
 * Converts DTOs to Maps for Firestore writes.
 * Firestore supports nested maps and arrays natively.
 */

fun ProfileDto.toMap(): Map<String, Any?> = mapOf(
    "id" to id,
    "user_id" to (userId ?: id),
    "phone" to phone,
    "name" to name,
    "email" to email,
    "onboarding_complete" to onboardingComplete,
    "is_logged_in" to isLoggedIn,
    "dark_theme" to darkTheme,
    "locale_code" to localeCode,
    "family_code" to familyCode,
    "notifications_enabled" to notificationsEnabled,
    "camp_reminders_enabled" to campRemindersEnabled,
    "consent_accepted" to consentAccepted,
    "consent_declined" to consentDeclined,
    "auth_provider" to authProvider,
    "role" to role,
)

fun KidDto.toMap(): Map<String, Any?> = mapOf(
    "id" to id,
    "profile_id" to profileId,
    "user_id" to (userId ?: profileId),
    "name" to name,
    "age" to age,
    "gender" to gender,
    "school" to school,
    "grade" to grade,
    "height_cm" to heightCm,
    "weight_kg" to weightKg,
    "avatar_color" to avatarColor,
    "overall_score" to overallScore,
    "dental" to dental,
    "eyesight" to eyesight,
    "nutrition" to nutrition,
    "last_checkup" to lastCheckup,
    "source" to source,
)

fun MealItemDto.toMap(): Map<String, Any?> = mapOf(
    "id" to id,
    "profile_id" to profileId,
    "user_id" to (userId ?: profileId),
    "kid_id" to kidId,
    "time_slot" to timeSlot,
    "name" to name,
    "detail" to detail,
    "kcal" to kcal,
    "eaten" to eaten,
)

fun GrowthPointDto.toMap(): Map<String, Any?> = mapOf(
    "id" to id,
    "kid_id" to kidId,
    "user_id" to (userId ?: ""),
    "label" to label,
    "height" to height,
    "weight" to weight,
)

fun StreakDto.toMap(): Map<String, Any?> = mapOf(
    "kid_id" to kidId,
    "user_id" to (userId ?: ""),
    "current_streak" to currentStreak,
    "best_streak" to bestStreak,
    "last_log_date" to lastLogDate,
)

fun AppointmentDto.toMap(): Map<String, Any?> = mapOf(
    "id" to id,
    "profile_id" to profileId,
    "user_id" to (userId ?: profileId),
    "doctor_name" to doctorName,
    "doctor_id" to (doctorId ?: ""),
    "specialty" to specialty,
    "kid_name" to kidName,
    "date" to date,
    "time" to time,
)

fun CampDto.toMap(): Map<String, Any?> = mapOf(
    "id" to id,
    "profile_id" to profileId,
    "user_id" to (userId ?: profileId),
    "title" to title,
    "school" to school,
    "date" to date,
    "time" to time,
    "status" to status,
    "checks" to checks,
    "result_summary" to resultSummary,
    "is_partner" to isPartner,
    "school_id" to (schoolId ?: ""),
    "school_camp_id" to (schoolCampId ?: ""),
    "description" to description,
    "grades" to grades,
    "capacity" to capacity,
    "registered_kid_ids" to registeredKidIds,
)

fun CoParentDto.toMap(): Map<String, Any?> = mapOf(
    "id" to id,
    "profile_id" to profileId,
    "user_id" to (userId ?: profileId),
    "name" to name,
    "relation" to relation,
    "joined_date" to joinedDate,
)
