package com.rork.vitahero.data

import io.ktor.client.call.body
import io.ktor.client.request.delete
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.parameter
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
 */
class ApiRepository {

    private val http get() = ApiService.http
    private val base get() = ApiService.baseUrl
    private val skipNetwork: Boolean get() = !ApiService.isConfigured

    private fun authHeaders(): Map<String, String> {
        val headers = mutableMapOf<String, String>()
        ApiService.sessionToken?.let { headers["Authorization"] = "Bearer $it" }
        return headers
    }

    // ─── Auth ───────────────────────────────────────────────────

    suspend fun googleSignIn(idToken: String): Result<GoogleAuthResponse> = onIo {
        if (skipNetwork) return@onIo Result.failure(Exception("Backend not configured"))
        try {
            val resp = http.post("$base/api/auth/google") {
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

    suspend fun signUpWithEmail(name: String, email: String, password: String): Result<GoogleAuthResponse> = onIo {
        if (skipNetwork) return@onIo Result.failure(Exception("Backend not configured"))
        try {
            val resp = http.post("$base/api/auth/signup") {
                contentType(ContentType.Application.Json)
                setBody(mapOf(
                    "name" to name,
                    "email" to email,
                    "password" to password
                ))
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

    suspend fun signInWithEmail(email: String, password: String): Result<GoogleAuthResponse> = onIo {
        if (skipNetwork) return@onIo Result.failure(Exception("Backend not configured"))
        try {
            val resp = http.post("$base/api/auth/signin") {
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

    suspend fun sendPhoneOtp(phone: String): Result<Unit> = onIo {
        if (skipNetwork) return@onIo Result.failure(Exception("Backend not configured"))
        try {
            val resp = http.post("$base/api/auth/phone/send") {
                contentType(ContentType.Application.Json)
                setBody(mapOf("phone" to phone))
            }
            if (resp.status.isSuccess()) {
                val body = try { resp.body<PhoneSendResponse>() } catch (_: Exception) { PhoneSendResponse(true) }
                if (body.success) Result.success(Unit)
                else Result.failure(Exception(body.note ?: "SMS delivery failed"))
            } else {
                val err = try { resp.body<ErrorBody>() } catch (_: Exception) { null }
                Result.failure(Exception(err?.error ?: "Failed to send OTP"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun verifyPhoneOtp(phone: String, otp: String): Result<GoogleAuthResponse> = onIo {
        if (skipNetwork) return@onIo Result.failure(Exception("Backend not configured"))
        try {
            val resp = http.post("$base/api/auth/phone/verify") {
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

    /** Exchanges a Firebase phone-auth ID token for a VitaHero session. */
    suspend fun firebasePhoneSignIn(idToken: String): Result<GoogleAuthResponse> = onIo {
        if (skipNetwork) return@onIo Result.failure(Exception("Backend not configured"))
        try {
            val resp = http.post("$base/api/auth/phone/firebase-verify") {
                contentType(ContentType.Application.Json)
                setBody(mapOf("idToken" to idToken))
            }
            if (resp.status.isSuccess()) {
                Result.success(resp.body<GoogleAuthResponse>())
            } else {
                val err = try { resp.body<ErrorBody>() } catch (_: Exception) { null }
                Result.failure(Exception(err?.error ?: "Sign-in failed"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun fetchMyProfile(): ProfileDto? = onIo {
        if (skipNetwork) return@onIo null
        try {
            val resp = http.get("$base/api/auth/me") {
                authHeaders().forEach { (k, v) -> header(k, v) }
            }
            if (resp.status.isSuccess()) resp.body<ProfileDto>() else null
        } catch (_: Exception) { null }
    }

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

    suspend fun upsertProfile(dto: ProfileDto): Result<Unit> = onIo {
        postResult("/api/profiles", dto)
    }

    // ─── Kids ──────────────────────────────────────────────────

    suspend fun fetchKids(): List<KidDto> = onIo {
        val resp = http.get("$base/api/kids") {
            authHeaders().forEach { (k, v) -> header(k, v) }
        }
        if (resp.status.isSuccess()) resp.body<List<KidDto>>() else emptyList()
    }

    suspend fun upsertKid(dto: KidDto): Result<Unit> = onIo {
        postResult("/api/kids", dto)
    }


    // ─── Camps ─────────────────────────────────────────────────

    suspend fun fetchCamps(): List<CampDto> = onIo {
        val resp = http.get("$base/api/camps") {
            authHeaders().forEach { (k, v) -> header(k, v) }
        }
        if (resp.status.isSuccess()) resp.body<List<CampDto>>() else emptyList()
    }

    suspend fun upsertCamp(dto: CampDto): Result<Unit> = onIo {
        postResult("/api/camps", dto)
    }

    // ─── Appointments ──────────────────────────────────────────

    suspend fun fetchAppointments(): List<AppointmentDto> = onIo {
        val resp = http.get("$base/api/appointments") {
            authHeaders().forEach { (k, v) -> header(k, v) }
        }
        if (resp.status.isSuccess()) resp.body<List<AppointmentDto>>() else emptyList()
    }

    suspend fun upsertAppointment(dto: AppointmentDto): Result<Unit> = onIo {
        postResult("/api/appointments", dto)
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

    suspend fun upsertMeals(dtos: List<MealItemDto>): Result<Unit> = onIo {
        postResult("/api/meals", dtos)
    }

    // ─── Growth Points ─────────────────────────────────────────

    suspend fun fetchGrowthPoints(kidId: String): List<GrowthPointDto> = onIo {
        val resp = http.get("$base/api/growth-points") {
            authHeaders().forEach { (k, v) -> header(k, v) }
            url { parameters.append("kid_id", kidId) }
        }
        if (resp.status.isSuccess()) resp.body<List<GrowthPointDto>>() else emptyList()
    }

    suspend fun upsertGrowthPoint(dto: GrowthPointDto): Result<Unit> = onIo {
        postResult("/api/growth-points", dto)
    }

    // ─── Streaks ───────────────────────────────────────────────

    suspend fun fetchStreak(kidId: String): StreakDto? = onIo {
        val resp = http.get("$base/api/streaks") {
            authHeaders().forEach { (k, v) -> header(k, v) }
            url { parameters.append("kid_id", kidId) }
        }
        if (!resp.status.isSuccess()) return@onIo null
        try {
            resp.body<StreakDto?>()
        } catch (_: Exception) {
            null
        }
    }

    suspend fun upsertStreak(dto: StreakDto): Result<Unit> = onIo {
        postResult("/api/streaks", dto)
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

    suspend fun fetchDoctors(city: String = "", hospitalId: String = "", specialty: String = ""): List<DoctorDto> = onIo {
        if (skipNetwork) return@onIo emptyList()
        val resp = http.get("$base/api/doctors") {
            authHeaders().forEach { (k, v) -> header(k, v) }
            url {
                if (city.isNotBlank()) parameters.append("city", city)
                if (hospitalId.isNotBlank()) parameters.append("hospital_id", hospitalId)
                if (specialty.isNotBlank()) parameters.append("specialty", specialty)
            }
        }
        if (resp.status.isSuccess()) resp.body<List<DoctorDto>>() else emptyList()
    }

    suspend fun fetchBookingSlots(doctorId: String): List<BookingSlotDto> = onIo {
        if (skipNetwork || doctorId.isBlank()) return@onIo emptyList()
        val resp = http.get("$base/api/booking/slots") {
            authHeaders().forEach { (k, v) -> header(k, v) }
            url { parameters.append("doctor_id", doctorId) }
        }
        if (resp.status.isSuccess()) {
            resp.body<BookingSlotsResponse>().slots
        } else emptyList()
    }

    suspend fun fetchBookingDirectory(
        city: String,
        specialty: String = "",
        lat: Double? = null,
        lng: Double? = null,
    ): BookingDirectoryDto? = onIo {
        if (skipNetwork) return@onIo null
        val resp = http.get("$base/api/booking/directory") {
            authHeaders().forEach { (k, v) -> header(k, v) }
            url {
                parameters.append("city", city)
                if (specialty.isNotBlank()) parameters.append("specialty", specialty)
                lat?.let { parameters.append("lat", it.toString()) }
                lng?.let { parameters.append("lng", it.toString()) }
            }
        }
        if (resp.status.isSuccess()) resp.body<BookingDirectoryDto>() else null
    }

    suspend fun fetchNotifications(): List<NotificationDto> = onIo {
        if (skipNetwork) return@onIo emptyList()
        val resp = http.get("$base/api/notifications") {
            authHeaders().forEach { (k, v) -> header(k, v) }
        }
        if (resp.status.isSuccess()) resp.body<List<NotificationDto>>() else emptyList()
    }

    suspend fun fetchSchools(): List<SchoolDto> = onIo {
        if (skipNetwork) return@onIo emptyList()
        val resp = http.get("$base/api/schools") {
            authHeaders().forEach { (k, v) -> header(k, v) }
        }
        if (resp.status.isSuccess()) resp.body<List<SchoolDto>>() else emptyList()
    }

    suspend fun fetchMySchools(): List<MySchoolDto> = onIo {
        if (skipNetwork) return@onIo emptyList()
        val resp = http.get("$base/api/schools/my") {
            authHeaders().forEach { (k, v) -> header(k, v) }
        }
        if (resp.status.isSuccess()) resp.body<List<MySchoolDto>>() else emptyList()
    }

    suspend fun enrollSchool(partnerCode: String, kidId: String?): Result<SchoolEnrollResponse> = onIo {
        if (skipNetwork) return@onIo Result.failure(Exception("Backend not configured"))
        try {
            val body = buildMap {
                put("partner_code", partnerCode.uppercase().trim())
                if (!kidId.isNullOrBlank()) put("kid_id", kidId)
            }
            val resp = http.post("$base/api/schools/enroll") {
                authHeaders().forEach { (k, v) -> header(k, v) }
                contentType(ContentType.Application.Json)
                setBody(body)
            }
            if (resp.status.isSuccess()) {
                Result.success(resp.body<SchoolEnrollResponse>())
            } else {
                val err = try { resp.body<ErrorBody>() } catch (_: Exception) { null }
                Result.failure(Exception(err?.error ?: "Enrollment failed"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun registerForCamp(schoolCampId: String, kidId: String): Result<CampRegisterResponse> = onIo {
        if (skipNetwork) return@onIo Result.failure(Exception("Backend not configured"))
        try {
            val resp = http.post("$base/api/school-camps/register") {
                authHeaders().forEach { (k, v) -> header(k, v) }
                contentType(ContentType.Application.Json)
                setBody(mapOf("school_camp_id" to schoolCampId, "kid_id" to kidId))
            }
            if (resp.status.isSuccess()) {
                Result.success(resp.body<CampRegisterResponse>())
            } else {
                val err = try { resp.body<ErrorBody>() } catch (_: Exception) { null }
                Result.failure(Exception(err?.error ?: "Registration failed"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun markNotificationsRead(ids: List<String>) = onIo {
        if (skipNetwork || ids.isEmpty()) return@onIo
        val h = authHeaders()
        http.post("$base/api/notifications/read") {
            h.forEach { (k, v) -> header(k, v) }
            contentType(ContentType.Application.Json)
            setBody(mapOf("ids" to ids))
        }
    }

    suspend fun fetchAiDietTip(kidId: String): AiDietTipDto? = onIo {
        if (skipNetwork) return@onIo null
        val resp = http.get("$base/api/ai-diet-tips") {
            authHeaders().forEach { (k, v) -> header(k, v) }
            url { parameters.append("kid_id", kidId) }
        }
        if (resp.status.isSuccess()) {
            try { resp.body<AiDietTipDto?>() } catch (_: Exception) { null }
        } else null
    }

    suspend fun generateAiDietTip(kidId: String): AiDietTipDto? = onIo {
        if (skipNetwork) return@onIo null
        val resp = http.post("$base/api/ai-diet-tips/generate") {
            authHeaders().forEach { (k, v) -> header(k, v) }
            contentType(ContentType.Application.Json)
            setBody(mapOf("kid_id" to kidId))
        }
        if (resp.status.isSuccess()) {
            try { resp.body<AiDietTipDto>() } catch (_: Exception) { null }
        } else null
    }

    suspend fun recognizeFood(imageBase64: String, mime: String = "image/jpeg"): FoodRecognitionResponseDto? = onIo {
        if (skipNetwork) return@onIo null
        val resp = http.post("$base/api/food-recognition") {
            authHeaders().forEach { (k, v) -> header(k, v) }
            contentType(ContentType.Application.Json)
            setBody(mapOf(
                "image_base64" to imageBase64,
                "mime" to mime,
            ))
        }
        if (resp.status.isSuccess()) {
            try { resp.body<FoodRecognitionResponseDto>() } catch (_: Exception) { null }
        } else null
    }

    /** Resolve an invite token (from an SMS link) to the registered 10-digit phone. */
    suspend fun resolveInvite(token: String): String? = onIo {
        if (skipNetwork) return@onIo null
        return@onIo try {
            val resp = http.get("$base/api/invite/resolve") {
                parameter("token", token)
            }
            if (!resp.status.isSuccess()) return@onIo null
            val dto = resp.body<InviteResolveDto>()
            if (dto.valid && !dto.last10.isNullOrBlank()) dto.last10 else null
        } catch (_: Exception) {
            null
        }
    }

    suspend fun saveAiDietTip(kidId: String, content: AIDietContent) = onIo {
        if (skipNetwork) return@onIo
        val h = authHeaders()
        http.post("$base/api/ai-diet-tips") {
            h.forEach { (k, v) -> header(k, v) }
            contentType(ContentType.Application.Json)
            setBody(mapOf(
                "kid_id" to kidId,
                "content" to mapOf(
                    "greeting" to content.greeting,
                    "insight" to content.insight,
                    "suggestion" to content.suggestion,
                    "funFact" to content.funFact,
                    "generatedAt" to content.generatedAt,
                )
            ))
        }
    }

    // ─── Helpers ───────────────────────────────────────────────

    fun newId(): String = UUID.randomUUID().toString().take(12)

    private suspend fun postResult(path: String, body: Any): Result<Unit> {
        return try {
            val resp = http.post("$base$path") {
                authHeaders().forEach { (k, v) -> header(k, v) }
                contentType(ContentType.Application.Json)
                setBody(body)
            }
            if (resp.status.isSuccess()) {
                Result.success(Unit)
            } else {
                Result.failure(Exception("Sync failed (${resp.status.value})"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

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

@kotlinx.serialization.Serializable
data class PhoneSendResponse(
    val success: Boolean = false,
    val note: String? = null,
)
