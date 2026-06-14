package com.rork.vitahero.data.db

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import kotlinx.coroutines.flow.Flow

@Dao
interface KidDao {
    @Query("SELECT * FROM kids ORDER BY name ASC")
    fun allKids(): Flow<List<KidEntity>>

    @Query("SELECT * FROM kids WHERE id = :kidId")
    suspend fun byId(kidId: String): KidEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(kid: KidEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(kids: List<KidEntity>)

    @Delete
    suspend fun delete(kid: KidEntity)

    @Query("DELETE FROM kids WHERE id = :kidId")
    suspend fun deleteById(kidId: String)
}

@Dao
interface MealDao {
    @Query("SELECT * FROM meal_items WHERE kid_id = :kidId ORDER BY time_slot ASC")
    fun mealsForKid(kidId: String): Flow<List<MealItemEntity>>

    @Query("SELECT * FROM meal_items WHERE kid_id = :kidId ORDER BY time_slot ASC")
    suspend fun mealsForKidOnce(kidId: String): List<MealItemEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(meal: MealItemEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(meals: List<MealItemEntity>)

    @Query("UPDATE meal_items SET eaten = :eaten WHERE id = :mealId")
    suspend fun setEaten(mealId: String, eaten: Boolean)

    @Delete
    suspend fun delete(meal: MealItemEntity)
}

@Dao
interface AppointmentDao {
    @Query("SELECT * FROM appointments ORDER BY date ASC")
    fun allAppointments(): Flow<List<AppointmentEntity>>

    @Query("SELECT * FROM appointments ORDER BY date ASC")
    suspend fun allAppointmentsOnce(): List<AppointmentEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(appointment: AppointmentEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(appointments: List<AppointmentEntity>)

    @Query("DELETE FROM appointments WHERE id = :appointmentId")
    suspend fun deleteById(appointmentId: String)
}

@Dao
interface StreakDao {
    @Query("SELECT * FROM streaks WHERE kid_id = :kidId")
    fun streakForKid(kidId: String): Flow<StreakEntity?>

    @Query("SELECT * FROM streaks WHERE kid_id = :kidId")
    suspend fun streakForKidOnce(kidId: String): StreakEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(streak: StreakEntity)

    @Query("UPDATE streaks SET current_streak = :currentStreak, best_streak = :bestStreak, last_log_date = :lastLogDate WHERE kid_id = :kidId")
    suspend fun updateStreak(kidId: String, currentStreak: Int, bestStreak: Int, lastLogDate: String)
}

@Dao
interface ParentDao {
    @Query("SELECT * FROM parent_profile WHERE id = 'parent_default'")
    suspend fun profile(): ParentProfileEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(profile: ParentProfileEntity)

    @Query("UPDATE parent_profile SET is_logged_in = :loggedIn WHERE id = 'parent_default'")
    suspend fun setLoggedIn(loggedIn: Boolean)
}
