package com.rork.vitahero.data.db

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.PrimaryKey
import com.rork.vitahero.data.CampStatus
import com.rork.vitahero.data.HealthFlag
import com.rork.vitahero.data.NotificationType
import com.rork.vitahero.data.SerializableGrowthPoint
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

@Entity(tableName = "kids")
data class KidEntity(
    @PrimaryKey val id: String,
    @ColumnInfo(name = "name") val name: String,
    @ColumnInfo(name = "age") val age: Int,
    @ColumnInfo(name = "gender") val gender: String,
    @ColumnInfo(name = "school") val school: String,
    @ColumnInfo(name = "grade") val grade: String,
    @ColumnInfo(name = "height_cm") val heightCm: Float,
    @ColumnInfo(name = "weight_kg") val weightKg: Float,
    @ColumnInfo(name = "avatar_color") val avatarColor: Long,
    @ColumnInfo(name = "overall_score") val overallScore: Int,
    @ColumnInfo(name = "growth_json") val growthJson: String = "[]",
    @ColumnInfo(name = "dental") val dental: String = "GOOD",
    @ColumnInfo(name = "eyesight") val eyesight: String = "GOOD",
    @ColumnInfo(name = "nutrition") val nutrition: String = "GOOD",
    @ColumnInfo(name = "last_checkup") val lastCheckup: String = "",
)

@Entity(tableName = "meal_items")
data class MealItemEntity(
    @PrimaryKey val id: String,
    @ColumnInfo(name = "kid_id") val kidId: String,
    @ColumnInfo(name = "time_slot") val timeSlot: String,
    @ColumnInfo(name = "name") val name: String,
    @ColumnInfo(name = "detail") val detail: String,
    @ColumnInfo(name = "kcal") val kcal: Int,
    @ColumnInfo(name = "eaten") val eaten: Boolean = false,
)

@Entity(tableName = "appointments")
data class AppointmentEntity(
    @PrimaryKey val id: String,
    @ColumnInfo(name = "doctor_name") val doctorName: String,
    @ColumnInfo(name = "specialty") val specialty: String,
    @ColumnInfo(name = "kid_name") val kidName: String,
    @ColumnInfo(name = "date") val date: String,
    @ColumnInfo(name = "time") val time: String,
)

@Entity(tableName = "streaks")
data class StreakEntity(
    @PrimaryKey @ColumnInfo(name = "kid_id") val kidId: String,
    @ColumnInfo(name = "current_streak") val currentStreak: Int = 0,
    @ColumnInfo(name = "best_streak") val bestStreak: Int = 0,
    @ColumnInfo(name = "last_log_date") val lastLogDate: String = "",
)

@Entity(tableName = "parent_profile")
data class ParentProfileEntity(
    @PrimaryKey val id: String = "parent_default",
    @ColumnInfo(name = "name") val name: String = "Priya",
    @ColumnInfo(name = "phone") val phone: String = "",
    @ColumnInfo(name = "onboarding_complete") val onboardingComplete: Boolean = false,
    @ColumnInfo(name = "is_logged_in") val isLoggedIn: Boolean = false,
    @ColumnInfo(name = "dark_theme") val darkTheme: Boolean = false,
    @ColumnInfo(name = "locale_code") val localeCode: String = "en",
    @ColumnInfo(name = "family_code") val familyCode: String = "",
)
