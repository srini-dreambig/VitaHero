package com.rork.vitahero.data

import kotlinx.serialization.Serializable

@Serializable
data class PersistentState(
    val onboardingComplete: Boolean = false,
    val isLoggedIn: Boolean = false,
    val parentName: String = "Priya",
    val phone: String = "",
    val kids: List<SerializableKid> = emptyList(),
    val appointments: List<SerializableAppointment> = emptyList(),
    val meals: Map<String, List<SerializableMealItem>> = emptyMap(),
    val streaks: Map<String, SerializableStreakInfo> = emptyMap(),
    val darkTheme: Boolean = false,
    val localeCode: String = "en",
    val familyCode: String = "",
    val coParents: List<SerializableCoParent> = emptyList(),
)

@Serializable
data class SerializableKid(
    val id: String,
    val name: String,
    val age: Int,
    val gender: String,
    val school: String,
    val grade: String,
    val heightCm: Float,
    val weightKg: Float,
    val avatarColor: Long,
    val overallScore: Int,
    val growth: List<SerializableGrowthPoint>,
    val dental: String,
    val eyesight: String,
    val nutrition: String,
    val lastCheckup: String,
)

@Serializable
data class SerializableGrowthPoint(
    val label: String,
    val height: Float,
    val weight: Float,
)

@Serializable
data class SerializableAppointment(
    val id: String,
    val doctorName: String,
    val specialty: String,
    val kidName: String,
    val date: String,
    val time: String,
)

@Serializable
data class SerializableMealItem(
    val id: String,
    val time: String,
    val name: String,
    val detail: String,
    val kcal: Int,
    val eaten: Boolean,
)

@Serializable
data class SerializableStreakInfo(
    val currentStreak: Int = 0,
    val bestStreak: Int = 0,
    val lastLogDate: String = "",
)

@Serializable
data class SerializableCoParent(
    val id: String,
    val name: String,
    val relation: String,
    val joinedDate: String = "",
)
