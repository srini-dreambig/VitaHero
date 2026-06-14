package com.rork.vitahero.data

import android.content.Context
import com.rork.vitahero.data.db.VitaHeroDatabase
import com.rork.vitahero.data.db.KidDao
import com.rork.vitahero.data.db.KidEntity
import com.rork.vitahero.data.db.MealItemEntity
import com.rork.vitahero.data.db.AppointmentEntity
import com.rork.vitahero.data.db.StreakEntity
import com.rork.vitahero.data.db.ParentProfileEntity
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.coroutines.flow.first
import kotlinx.serialization.json.Json
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.UUID

/**
 * Room-first data manager — the single source of truth for all local data.
 *
 * - Room DB is the primary read/write path.
 * - JSON file storage is the emergency fallback.
 * - All mutations go through Room first, then JSON for backup.
 */
class DataManager(context: Context) {

    private val db = VitaHeroDatabase.getInstance(context)
    private val storage = StorageService(context)
    private val json = Json { ignoreUnknownKeys = true; prettyPrint = false }

    // ─── Load / Restore ──────────────────────────────────────

    suspend fun loadKids(): List<Kid> = withContext(Dispatchers.IO) {
        try {
            val entities = db.kidDao().allKidsOnce()
            if (entities.isNotEmpty()) return@withContext entities.map { it.toKid() }
        } catch (_: Exception) { }
        // Fallback to JSON
        val saved = storage.load()
        saved.kids.map { it.toKid() }
    }

    suspend fun loadAppointments(): List<Appointment> = withContext(Dispatchers.IO) {
        try {
            val entities = db.appointmentDao().allAppointmentsOnce()
            if (entities.isNotEmpty()) return@withContext entities.map { it.toAppointment() }
        } catch (_: Exception) { }
        storage.load().appointments.map { it.toAppointment() }
    }

    suspend fun loadMeals(kidIds: List<String>): Map<String, List<MealItem>> = withContext(Dispatchers.IO) {
        val result = mutableMapOf<String, List<MealItem>>()
        for (kidId in kidIds) {
            try {
                val entities = db.mealDao().mealsForKidOnce(kidId)
                if (entities.isNotEmpty()) {
                    result[kidId] = entities.map { it.toMealItem() }
                    continue
                }
            } catch (_: Exception) { }
        }
        // Fallback to JSON for any missing
        val saved = storage.load()
        saved.meals.forEach { (kidId, meals) ->
            if (kidId !in result) {
                result[kidId] = meals.map { it.toMealItem() }
            }
        }
        result
    }

    suspend fun loadStreaks(kidIds: List<String>): Map<String, StreakInfo> = withContext(Dispatchers.IO) {
        val result = mutableMapOf<String, StreakInfo>()
        for (kidId in kidIds) {
            try {
                val entity = db.streakDao().streakForKidOnce(kidId)
                if (entity != null) {
                    result[kidId] = StreakInfo(entity.currentStreak, entity.bestStreak, entity.lastLogDate)
                    continue
                }
            } catch (_: Exception) { }
        }
        val saved = storage.load()
        saved.streaks.forEach { (kidId, streak) ->
            if (kidId !in result) result[kidId] = streak.toStreakInfo()
        }
        result
    }

    suspend fun loadParentProfile(): ParentProfileEntity? = withContext(Dispatchers.IO) {
        try { db.parentDao().profile() } catch (_: Exception) { null }
    }

    suspend fun loadPersistedState(): PersistentState = withContext(Dispatchers.IO) {
        try { storage.load() } catch (_: Exception) { PersistentState() }
    }

    // ─── Kids ────────────────────────────────────────────────

    suspend fun saveKid(kid: Kid) = withContext(Dispatchers.IO) {
        try {
            db.kidDao().upsert(kid.toEntity())
        } catch (_: Exception) {
            db.kidDao().upsert(kid.toEntity())
        }
    }

    suspend fun saveKids(kids: List<Kid>) = withContext(Dispatchers.IO) {
        try {
            db.kidDao().upsertAll(kids.map { it.toEntity() })
        } catch (_: Exception) { }
    }

    suspend fun deleteKid(kidId: String) = withContext(Dispatchers.IO) {
        db.kidDao().deleteById(kidId)
    }

    // ─── Appointments ────────────────────────────────────────

    suspend fun saveAppointment(appt: Appointment) = withContext(Dispatchers.IO) {
        db.appointmentDao().upsert(appt.toEntity())
    }

    suspend fun deleteAppointment(id: String) = withContext(Dispatchers.IO) {
        db.appointmentDao().deleteById(id)
    }

    // ─── Meals ───────────────────────────────────────────────

    suspend fun saveMeal(meal: MealItem, kidId: String) = withContext(Dispatchers.IO) {
        db.mealDao().upsert(meal.toEntity(kidId))
    }

    suspend fun saveMeals(kidId: String, meals: List<MealItem>) = withContext(Dispatchers.IO) {
        db.mealDao().upsertAll(meals.map { it.toEntity(kidId) })
    }

    suspend fun toggleMealEaten(mealId: String, eaten: Boolean) = withContext(Dispatchers.IO) {
        db.mealDao().setEaten(mealId, eaten)
    }

    // ─── Streaks ─────────────────────────────────────────────

    suspend fun saveStreak(kidId: String, streak: StreakInfo) = withContext(Dispatchers.IO) {
        db.streakDao().upsert(StreakEntity(kidId, streak.currentStreak, streak.bestStreak, streak.lastLogDate))
    }

    // ─── Parent Profile ──────────────────────────────────────

    suspend fun saveParentProfile(state: AppUiState) = withContext(Dispatchers.IO) {
        db.parentDao().upsert(ParentProfileEntity(
            name = state.parentName,
            phone = state.phone,
            onboardingComplete = state.consentAccepted,
            isLoggedIn = true,
            darkTheme = state.darkTheme,
            localeCode = state.locale.code,
            familyCode = state.familyCode,
        ))
    }

    // ─── JSON Backup ─────────────────────────────────────────

    suspend fun saveJsonBackup(state: PersistentState) = withContext(Dispatchers.IO) {
        storage.save(state)
    }

    suspend fun clearAll() = withContext(Dispatchers.IO) {
        storage.clear()
        // Note: Room DB clear would require dropping tables or deleting DB file
    }
}

// ─── Entity ↔ Model Converters ──────────────────────────

fun Kid.toEntity() = KidEntity(
    id, name, age, gender, school, grade, heightCm, weightKg,
    avatarColor, overallScore,
    Json.encodeToString(
        kotlinx.serialization.builtins.ListSerializer(SerializableGrowthPoint.serializer()),
        growth.map { SerializableGrowthPoint(it.label, it.height, it.weight) }
    ),
    dental.name, eyesight.name, nutrition.name, lastCheckup
)

fun KidEntity.toKid(): Kid = Kid(
    id, name, age, gender, school, grade, heightCm, weightKg,
    avatarColor, overallScore,
    try {
        Json.decodeFromString<List<SerializableGrowthPoint>>(growthJson)
            .map { GrowthPoint(it.label, it.height, it.weight) }
    } catch (_: Exception) { emptyList() },
    try { HealthFlag.valueOf(dental) } catch (_: Exception) { HealthFlag.GOOD },
    try { HealthFlag.valueOf(eyesight) } catch (_: Exception) { HealthFlag.GOOD },
    try { HealthFlag.valueOf(nutrition) } catch (_: Exception) { HealthFlag.GOOD },
    lastCheckup
)

fun Appointment.toEntity() = AppointmentEntity(id, doctorName, specialty, kidName, date, time)

fun AppointmentEntity.toAppointment() = Appointment(id, doctorName, specialty, kidName, date, time)

fun MealItem.toEntity(kidId: String) = MealItemEntity(id, kidId, time, name, detail, kcal, eaten)

fun MealItemEntity.toMealItem() = MealItem(id, timeSlot, name, detail, kcal, eaten)

suspend fun KidDao.allKidsOnce(): List<KidEntity> = try {
    allKids().first()
} catch (_: Exception) { emptyList() }
