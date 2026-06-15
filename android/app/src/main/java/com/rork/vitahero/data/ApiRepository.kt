package com.rork.vitahero.data

import io.ktor.client.call.body
import io.ktor.client.request.delete
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.http.ContentType
import io.ktor.http.contentType
import io.ktor.http.isSuccess
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.util.UUID

/**
 * Bridges the Android app to the Cloudflare Worker API (Neon DB).
 *
 * Uses the session token for authentication. When not configured,
 * all network calls return empty results silently.
 */
class ApiRepository {

    private val http get() = ApiService.http
    private val base get() = ApiService.baseUrl
    private val skipNetwork: Boolean get() = !ApiService.isConfigured

    private fun authHeaders(): Map<String, String> {
        val headers = mutableMapOf("Content-Type" to "application/json")
        ApiService.sessionToken?.let { headers["Authorization"] = "Bearer $it" }
        return headers
    }

    // ─── Auth ───────────────────────────────────────────────────

    /** Sign in with Google ID token. Returns session token + profile info. */
    suspend fun googleSignIn(idToken: String): Result<GoogleAuthResponse> = onIo {
        if (skipNetwork) return@onIo Result.failure(Exception("Backend not configured"))
        try {
            val resp = http.post("$base/api/auth/google") {
                header("Content-Type", "application/json")
                contentType(ContentType.Application.Json)
                setBody(mapOf("id_token" to idToken))
            }
            if (resp.status.isSuccess()) {
                Result.success(resp.body<GoogleAuthResponse>())
            } else {
                val err = try { resp.body<ErrorBody>() } catch (_: Exception) { null }
                Result.failure(Exception(err?.error ?: "Google sign-in failed"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /** Sign up with email + password via Neon Auth. */
    suspend fun signUpWithEmail(name: String, email: String, password: String): Result<GoogleAuthResponse> = onIo {
        if (skipNetwork) return@onIo Result.failure(Exception("Backend not configured"))
        try {
            val resp = http.post("$base/api/auth/signup") {
                header("Content-Type", "application/json")
                contentType(ContentType.Application.Json)
                setBody(mapOf("name" to name, "email" to email, "password" to password))
            }
            if (resp.status.isSuccess()) {
                Result.success(resp.body<GoogleAuthResponse>())
            } else {
                val err = try { resp.body<ErrorBody>() } catch (_: Exception) { null }
                Result.failure(Exception(err?.error ?: "Sign up failed"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /** Sign in with email + password via Neon Auth. */
    suspend fun signInWithEmail(email: String, password: String): Result<GoogleAuthResponse> = onIo {
        if (skipNetwork) return@onIo Result.failure(Exception("Backend not configured"))
        try {
            val resp = http.post("$base/api/auth/signin") {
                header("Content-Type", "application/json")
                contentType(ContentType.Application.Json)
                setBody(mapOf("email" to email, "password" to password))
            }
            if (resp.status.isSuccess()) {
                Result.success(resp.body<GoogleAuthResponse>())
            } else {
                val err = try { resp.body<ErrorBody>() } catch (_: Exception) { null }
                Result.failure(Exception(err?.error ?: "Invalid email or password"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /** Send phone OTP via Twilio through the Worker. */
    suspend fun sendPhoneOtp(phone: String): Result<Unit> = onIo {
        if (skipNetwork) return@onIo Result.failure(Exception("Backend not configured"))
        try {
            val resp = http.post("$base/api/auth/phone/send") {
                header("Content-Type", "application/json")
                contentType(ContentType.Application.Json)
                setBody(mapOf("phone" to phone))
            }
            if (resp.status.isSuccess()) Result.success(Unit)
            else {
                val err = try { resp.body<ErrorBody>() } catch (_: Exception) { null }
                Result.failure(Exception(err?.error ?: "Failed to send OTP"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /** Verify phone OTP. Returns session token + profile info. */
    suspend fun verifyPhoneOtp(phone: String, otp: String): Result<GoogleAuthResponse> = onIo {
        if (skipNetwork) return@onIo Result.failure(Exception("Backend not configured"))
        try {
            val resp = http.post("$base/api/auth/phone/verify") {
                header("Content-Type", "application/json")
                contentType(ContentType.Application.Json)
                setBody(mapOf("phone" to phone, "otp" to otp))
            }
            if (resp.status.isSuccess()) {
                Result.success(resp.body<GoogleAuthResponse>())
            } else {
                val err = try { resp.body<ErrorBody>() } catch (_: Exception) { null }
                Result.failure(Exception(err?.error ?: "Invalid OTP"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /** Verify the current session token and return the profile. */
    suspend fun fetchMyProfile(): ProfileDto? = onIo {
        if (skipNetwork) return@onIo null
        try {
            val resp = http.get("$base/api/auth/me") {
                authHeaders().forEach { (k, v) -> header(k, v) }
            }
            if (resp.status.isSuccess()) resp.body<ProfileDto>() else null
        } catch (_: Exception) { null }
    }

    /** Log out (clear server-side session). */
    suspend fun logout(): Result<Unit> = onIo {
        if (skipNetwork) return@onIo Result.success(Unit)
        try {
            http.post("$base/api/auth/logout") {
                authHeaders().forEach { (k, v) -> header(k, v) }
            }
            Result.success(Unit)
        } catch (_: Exception) { Result.success(Unit) }
    }

    // ─── Profiles ──────────────────────────────────────────────

    suspend fun upsertProfile(dto: ProfileDto) = onIo {
        val h = authHeaders()
        http.post("$base/api/profiles") {
            h.forEach { (k, v) -> header(k, v) }
            contentType(ContentType.Application.Json)
            setBody(dto)
        }
    }

    // ─── Kids ──────────────────────────────────────────────────

    suspend fun fetchKids(): List<KidDto> = onIo {
        val resp = http.get("$base/api/kids") {
            authHeaders().forEach { (k, v) -> header(k, v) }
        }
        if (resp.status.isSuccess()) resp.body<List<KidDto>>() else emptyList()
    }

    suspend fun upsertKid(dto: KidDto) = onIo {
        val h = authHeaders()
        http.post("$base/api/kids") {
            h.forEach { (k, v) -> header(k, v) }
            contentType(ContentType.Application.Json)
            setBody(dto)
        }
    }

    suspend fun deleteKid(kidId: String) = onIo {
        val h = authHeaders()
        http.delete("$base/api/kids/$kidId") {
            h.forEach { (k, v) -> header(k, v) }
        }
    }

    // ─── Camps ─────────────────────────────────────────────────

    suspend fun fetchCamps(): List<CampDto> = onIo {
        val resp = http.get("$base/api/camps") {
            authHeaders().forEach { (k, v) -> header(k, v) }
        }
        if (resp.status.isSuccess()) resp.body<List<CampDto>>() else emptyList()
    }

    suspend fun upsertCamp(dto: CampDto) = onIo {
        val h = authHeaders()
        http.post("$base/api/camps") {
            h.forEach { (k, v) -> header(k, v) }
            contentType(ContentType.Application.Json)
            setBody(dto)
        }
    }

    // ─── Appointments ──────────────────────────────────────────

    suspend fun fetchAppointments(): List<AppointmentDto> = onIo {
        val resp = http.get("$base/api/appointments") {
            authHeaders().forEach { (k, v) -> header(k, v) }
        }
        if (resp.status.isSuccess()) resp.body<List<AppointmentDto>>() else emptyList()
    }

    suspend fun upsertAppointment(dto: AppointmentDto) = onIo {
        val h = authHeaders()
        http.post("$base/api/appointments") {
            h.forEach { (k, v) -> header(k, v) }
            contentType(ContentType.Application.Json)
            setBody(dto)
        }
    }

    suspend fun deleteAppointment(appointmentId: String) = onIo {
        val h = authHeaders()
        http.delete("$base/api/appointments/$appointmentId") {
            h.forEach { (k, v) -> header(k, v) }
        }
    }

    // ─── Meals ─────────────────────────────────────────────────

    suspend fun fetchAllMeals(): List<MealItemDto> = onIo {
        val resp = http.get("$base/api/meals") {
            authHeaders().forEach { (k, v) -> header(k, v) }
        }
        if (resp.status.isSuccess()) resp.body<List<MealItemDto>>() else emptyList()
    }

    suspend fun upsertMeals(dtos: List<MealItemDto>) = onIo {
        val h = authHeaders()
        http.post("$base/api/meals") {
            h.forEach { (k, v) -> header(k, v) }
            contentType(ContentType.Application.Json)
            setBody(dtos)
        }
    }

    // ─── Growth Points ─────────────────────────────────────────

    suspend fun fetchGrowthPoints(kidId: String): List<GrowthPointDto> = onIo {
        val resp = http.get("$base/api/growth-points") {
            authHeaders().forEach { (k, v) -> header(k, v) }
            url { parameters.append("kid_id", kidId) }
        }
        if (resp.status.isSuccess()) resp.body<List<GrowthPointDto>>() else emptyList()
    }

    suspend fun upsertGrowthPoint(dto: GrowthPointDto) = onIo {
        val h = authHeaders()
        http.post("$base/api/growth-points") {
            h.forEach { (k, v) -> header(k, v) }
            contentType(ContentType.Application.Json)
            setBody(dto)
        }
    }

    // ─── Streaks ───────────────────────────────────────────────

    suspend fun fetchStreak(kidId: String): StreakDto? = onIo {
        val resp = http.get("$base/api/streaks") {
            authHeaders().forEach { (k, v) -> header(k, v) }
            url { parameters.append("kid_id", kidId) }
        }
        if (resp.status.isSuccess()) resp.body<List<StreakDto>>().firstOrNull() else null
    }

    suspend fun upsertStreak(dto: StreakDto) = onIo {
        val h = authHeaders()
        http.post("$base/api/streaks") {
            h.forEach { (k, v) -> header(k, v) }
            contentType(ContentType.Application.Json)
            setBody(dto)
        }
    }

    // ─── Co-Parents ────────────────────────────────────────────

    suspend fun fetchCoParents(): List<CoParentDto> = onIo {
        val resp = http.get("$base/api/co-parents") {
            authHeaders().forEach { (k, v) -> header(k, v) }
        }
        if (resp.status.isSuccess()) resp.body<List<CoParentDto>>() else emptyList()
    }

    suspend fun upsertCoParent(dto: CoParentDto) = onIo {
        val h = authHeaders()
        http.post("$base/api/co-parents") {
            h.forEach { (k, v) -> header(k, v) }
            contentType(ContentType.Application.Json)
            setBody(dto)
        }
    }

    // ─── Family Lookup ─────────────────────────────────────────

    suspend fun lookupFamily(code: String): ProfileDto? = onIo {
        val resp = http.get("$base/api/family-lookup") {
            authHeaders().forEach { (k, v) -> header(k, v) }
            url { parameters.append("code", code) }
        }
        if (resp.status.isSuccess()) resp.body<ProfileDto>() else null
    }

    // ─── Helpers ───────────────────────────────────────────────

    fun newId(): String = UUID.randomUUID().toString().take(12)

    private suspend fun <T> onIo(block: suspend () -> T): T =
        withContext(Dispatchers.IO) { block() }
}

@kotlinx.serialization.Serializable
data class GoogleAuthResponse(
    val token: String = "",
    val profile: AuthProfile? = null
)

@kotlinx.serialization.Serializable
data class AuthProfile(
    val id: String = "",
    val user_id: String = "",
    val name: String = "",
    val email: String? = null,
    val phone: String? = null,
    val auth_provider: String = "",
)

@kotlinx.serialization.Serializable
data class ErrorBody(
    val error: String = "",
)
