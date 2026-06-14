package com.rork.vitahero.data

import io.ktor.client.call.body
import io.ktor.client.request.delete
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.patch
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.HttpResponse
import io.ktor.http.ContentType
import io.ktor.http.contentType
import io.ktor.http.isSuccess
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.util.UUID

/**
 * Bridges the Android app to Supabase Postgres via the REST API.
 * Uses the existing Ktor HTTP client — no extra supabase-kt library needed.
 */
class SupabaseRepository {

    private val http get() = SupabaseService.http
    private val base get() = "${SupabaseService.baseUrl}/rest/v1"
    private val key get() = SupabaseService.anonKey

    private fun headers() = mapOf(
        "apikey" to key,
        "Authorization" to "Bearer $key",
        "Prefer" to "return=minimal"
    )

    // ─── Profiles ──────────────────────────────────────────────

    suspend fun upsertProfile(dto: ProfileDto) = onIo {
        http.post("$base/profiles") {
            headers().forEach { (k, v) -> header(k, v) }
            header("Prefer", "resolution=merge-duplicates")
            contentType(ContentType.Application.Json)
            setBody(dto)
        }
    }

    suspend fun fetchProfile(profileId: String): ProfileDto? = onIo {
        val resp = http.get("$base/profiles") {
            headers().forEach { (k, v) -> header(k, v) }
            header("Prefer", "return=representation")
            url { parameters.append("id", "eq.$profileId") }
        }
        if (resp.status.isSuccess()) resp.body<List<ProfileDto>>().firstOrNull() else null
    }

    // ─── Kids ──────────────────────────────────────────────────

    suspend fun fetchKids(profileId: String): List<KidDto> = onIo {
        val resp = http.get("$base/kids") {
            headers().forEach { (k, v) -> header(k, v) }
            url { parameters.append("profile_id", "eq.$profileId") }
        }
        if (resp.status.isSuccess()) resp.body<List<KidDto>>() else emptyList()
    }

    suspend fun upsertKid(dto: KidDto) = onIo {
        http.post("$base/kids") {
            headers().forEach { (k, v) -> header(k, v) }
            header("Prefer", "resolution=merge-duplicates")
            contentType(ContentType.Application.Json)
            setBody(dto)
        }
    }

    suspend fun upsertKids(dtos: List<KidDto>) = onIo {
        dtos.forEach { upsertKid(it) }
    }

    suspend fun deleteKid(kidId: String) = onIo {
        http.delete("$base/kids") {
            headers().forEach { (k, v) -> header(k, v) }
            url { parameters.append("id", "eq.$kidId") }
        }
    }

    // ─── Camps ─────────────────────────────────────────────────

    suspend fun fetchCamps(profileId: String): List<CampDto> = onIo {
        val resp = http.get("$base/camps") {
            headers().forEach { (k, v) -> header(k, v) }
            url { parameters.append("profile_id", "eq.$profileId") }
        }
        if (resp.status.isSuccess()) resp.body<List<CampDto>>() else emptyList()
    }

    suspend fun upsertCamp(dto: CampDto) = onIo {
        http.post("$base/camps") {
            headers().forEach { (k, v) -> header(k, v) }
            header("Prefer", "resolution=merge-duplicates")
            contentType(ContentType.Application.Json)
            setBody(dto)
        }
    }

    suspend fun upsertCamps(dtos: List<CampDto>) = onIo {
        dtos.forEach { upsertCamp(it) }
    }

    // ─── Appointments ──────────────────────────────────────────

    suspend fun fetchAppointments(profileId: String): List<AppointmentDto> = onIo {
        val resp = http.get("$base/appointments") {
            headers().forEach { (k, v) -> header(k, v) }
            url { parameters.append("profile_id", "eq.$profileId") }
        }
        if (resp.status.isSuccess()) resp.body<List<AppointmentDto>>() else emptyList()
    }

    suspend fun upsertAppointment(dto: AppointmentDto) = onIo {
        http.post("$base/appointments") {
            headers().forEach { (k, v) -> header(k, v) }
            header("Prefer", "resolution=merge-duplicates")
            contentType(ContentType.Application.Json)
            setBody(dto)
        }
    }

    suspend fun deleteAppointment(appointmentId: String) = onIo {
        http.delete("$base/appointments") {
            headers().forEach { (k, v) -> header(k, v) }
            url { parameters.append("id", "eq.$appointmentId") }
        }
    }

    // ─── Meals ─────────────────────────────────────────────────

    suspend fun fetchAllMeals(profileId: String): List<MealItemDto> = onIo {
        val resp = http.get("$base/meal_items") {
            headers().forEach { (k, v) -> header(k, v) }
            url { parameters.append("profile_id", "eq.$profileId") }
        }
        if (resp.status.isSuccess()) resp.body<List<MealItemDto>>() else emptyList()
    }

    suspend fun upsertMeal(dto: MealItemDto) = onIo {
        http.post("$base/meal_items") {
            headers().forEach { (k, v) -> header(k, v) }
            header("Prefer", "resolution=merge-duplicates")
            contentType(ContentType.Application.Json)
            setBody(dto)
        }
    }

    suspend fun upsertMeals(dtos: List<MealItemDto>) = onIo {
        dtos.forEach { upsertMeal(it) }
    }

    // ─── Growth Points ─────────────────────────────────────────

    suspend fun fetchGrowthPoints(kidId: String): List<GrowthPointDto> = onIo {
        val resp = http.get("$base/growth_points") {
            headers().forEach { (k, v) -> header(k, v) }
            url { parameters.append("kid_id", "eq.$kidId") }
        }
        if (resp.status.isSuccess()) resp.body<List<GrowthPointDto>>() else emptyList()
    }

    suspend fun upsertGrowthPoint(dto: GrowthPointDto) = onIo {
        http.post("$base/growth_points") {
            headers().forEach { (k, v) -> header(k, v) }
            header("Prefer", "resolution=merge-duplicates")
            contentType(ContentType.Application.Json)
            setBody(dto)
        }
    }

    // ─── Streaks ───────────────────────────────────────────────

    suspend fun fetchStreak(kidId: String): StreakDto? = onIo {
        val resp = http.get("$base/streaks") {
            headers().forEach { (k, v) -> header(k, v) }
            header("Prefer", "return=representation")
            url { parameters.append("kid_id", "eq.$kidId") }
        }
        if (resp.status.isSuccess()) resp.body<List<StreakDto>>().firstOrNull() else null
    }

    suspend fun upsertStreak(dto: StreakDto) = onIo {
        http.post("$base/streaks") {
            headers().forEach { (k, v) -> header(k, v) }
            header("Prefer", "resolution=merge-duplicates")
            contentType(ContentType.Application.Json)
            setBody(dto)
        }
    }

    // ─── Co-Parents ────────────────────────────────────────────

    suspend fun fetchCoParents(profileId: String): List<CoParentDto> = onIo {
        val resp = http.get("$base/co_parents") {
            headers().forEach { (k, v) -> header(k, v) }
            url { parameters.append("profile_id", "eq.$profileId") }
        }
        if (resp.status.isSuccess()) resp.body<List<CoParentDto>>() else emptyList()
    }

    suspend fun upsertCoParent(dto: CoParentDto) = onIo {
        http.post("$base/co_parents") {
            headers().forEach { (k, v) -> header(k, v) }
            header("Prefer", "resolution=merge-duplicates")
            contentType(ContentType.Application.Json)
            setBody(dto)
        }
    }

    // ─── Helpers ───────────────────────────────────────────────

    fun newId(): String = UUID.randomUUID().toString().take(12)

    private suspend fun <T> onIo(block: suspend () -> T): T =
        withContext(Dispatchers.IO) { block() }
}
