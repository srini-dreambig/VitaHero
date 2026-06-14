package com.rork.vitahero.data.db

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

@Database(
    entities = [
        KidEntity::class,
        MealItemEntity::class,
        AppointmentEntity::class,
        StreakEntity::class,
        ParentProfileEntity::class,
    ],
    version = 1,
    exportSchema = false
)
abstract class VitaHeroDatabase : RoomDatabase() {

    abstract fun kidDao(): KidDao
    abstract fun mealDao(): MealDao
    abstract fun appointmentDao(): AppointmentDao
    abstract fun streakDao(): StreakDao
    abstract fun parentDao(): ParentDao

    companion object {
        @Volatile
        private var INSTANCE: VitaHeroDatabase? = null

        fun getInstance(context: Context): VitaHeroDatabase {
            return INSTANCE ?: synchronized(this) {
                INSTANCE ?: Room.databaseBuilder(
                    context.applicationContext,
                    VitaHeroDatabase::class.java,
                    "vitahero.db"
                )
                    .fallbackToDestructiveMigration()
                    .build()
                    .also { INSTANCE = it }
            }
        }
    }
}
