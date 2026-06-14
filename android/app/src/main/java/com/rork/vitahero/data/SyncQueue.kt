package com.rork.vitahero.data

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.util.concurrent.ConcurrentLinkedQueue

/**
 * Offline-first sync queue for Supabase operations.
 *
 * When the network is unavailable, mutations are queued here and
 * retried automatically once connectivity is restored. Each entry
 * stores the operation parameters so it can be replayed.
 *
 * In production, replace with WorkManager for guaranteed execution
 * across process death. For now this provides same-session durability.
 */
object SyncQueue {

    private val pendingOps = ConcurrentLinkedQueue<SyncOp>()

    data class SyncOp(
        val type: SyncType,
        val payload: String, // JSON serialized DTO
        val retries: Int = 0,
        val createdAt: Long = System.currentTimeMillis()
    )

    enum class SyncType {
        UPSERT_PROFILE,
        UPSERT_KIDS,
        UPSERT_APPOINTMENT,
        UPSERT_MEAL,
        UPSERT_STREAK,
        UPSERT_GROWTH_POINT,
        UPSERT_COPARENT,
    }

    private const val MAX_RETRIES = 5
    private const val BASE_DELAY_MS = 2_000L

    fun enqueue(type: SyncType, payload: String) {
        pendingOps.add(SyncOp(type, payload))
    }

    fun pendingCount(): Int = pendingOps.size

    /**
     * Process all pending sync operations.
     * Call this when connectivity is restored or after auth.
     */
    suspend fun processAll(repository: SupabaseRepository, context: Context) {
        val toRetry = mutableListOf<SyncOp>()
        while (true) {
            val op = pendingOps.poll() ?: break
            try {
                executeOp(op, repository, context)
            } catch (e: Exception) {
                if (op.retries < MAX_RETRIES) {
                    toRetry.add(op.copy(retries = op.retries + 1))
                }
            }
        }
        // Re-enqueue failed ops for later retry
        toRetry.forEach { pendingOps.add(it) }
    }

    private suspend fun executeOp(op: SyncOp, repository: SupabaseRepository, context: Context) {
        // Delay between retries with exponential backoff
        if (op.retries > 0) {
            kotlinx.coroutines.delay(BASE_DELAY_MS * (1L shl (op.retries - 1).coerceAtMost(4)))
        }
        // Parse and execute based on type
        val json = kotlinx.serialization.json.Json { ignoreUnknownKeys = true; isLenient = true }
        when (op.type) {
            SyncType.UPSERT_PROFILE -> {
                val dto = json.decodeFromString<ProfileDto>(op.payload)
                repository.upsertProfile(dto)
            }
            SyncType.UPSERT_KIDS -> {
                val dtos = json.decodeFromString<List<KidDto>>(op.payload)
                repository.upsertKids(dtos)
            }
            SyncType.UPSERT_APPOINTMENT -> {
                val dto = json.decodeFromString<AppointmentDto>(op.payload)
                repository.upsertAppointment(dto)
            }
            SyncType.UPSERT_MEAL -> {
                val dtos = json.decodeFromString<List<MealItemDto>>(op.payload)
                repository.upsertMeals(dtos)
            }
            SyncType.UPSERT_STREAK -> {
                val dto = json.decodeFromString<StreakDto>(op.payload)
                repository.upsertStreak(dto)
            }
            SyncType.UPSERT_GROWTH_POINT -> {
                val dto = json.decodeFromString<GrowthPointDto>(op.payload)
                repository.upsertGrowthPoint(dto)
            }
            SyncType.UPSERT_COPARENT -> {
                val dto = json.decodeFromString<CoParentDto>(op.payload)
                repository.upsertCoParent(dto)
            }
        }
    }
}
