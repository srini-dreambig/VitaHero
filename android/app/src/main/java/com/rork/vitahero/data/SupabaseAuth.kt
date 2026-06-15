package com.rork.vitahero.data

import io.ktor.client.call.body
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.http.ContentType
import io.ktor.http.contentType
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

/**
 * Supabase Auth REST client — dual-path phone auth:
 *
 * Path 1 — Email/Password: calls GoTrue directly (always works).
 *
 * Path 2 — Phone OTP: calls the VitaHero send-sms Edge Function for
 *   OTP generation + Twilio SMS delivery + verification.
 *   This is self-contained and does NOT require Twilio to be
 *   configured in the Supabase dashboard.
 */
object SupabaseAuth {

    private val http get() = SupabaseService.http
    private val baseUrl get() = SupabaseService.baseUrl
    private val anonKey get() = SupabaseService.anonKey
    private val edgeFnUrl: String get() {
        val base = SupabaseService.baseUrl
        return if (base.isNotBlank()) "$base/functions/v1/send-sms" else ""
    }

    private fun authHeaders() = mapOf(
        "apikey" to anonKey,
        "Content-Type" to "application/json"
    )

    // ─── Email + Password ──────────────────────────────────

    @Serializable
    data class SignUpRequest(
        val email: String,
        val password: String,
        val data: Map<String, String> = emptyMap()
    )

    @Serializable
    data class SignInRequest(
        val email: String,
        val password: String
    )

    @Serializable
    data class AuthResponse(
        val access_token: String = "",
        val refresh_token: String = "",
        val user: AuthUser? = null
    )

    @Serializable
    data class AuthUser(
        val id: String = "",
        val email: String = "",
        val phone: String? = null,
        val user_metadata: Map<String, String>? = null
    )

    /** Sign up with email + password. */
    suspend fun signUpWithEmail(email: String, password: String, name: String): Result<AuthResponse> = onIo {
        if (!SupabaseService.isConfigured) return@onIo Result.failure(Exception("Supabase not configured"))
        try {
            val body = buildJsonObject {
                put("email", email)
                put("password", password)
                put("data", buildJsonObject { put("name", name) })
            }
            val resp = http.post("$baseUrl/auth/v1/signup") {
                authHeaders().forEach { (k, v) -> header(k, v) }
                contentType(ContentType.Application.Json)
                setBody(body.toString())
            }
            Result.success(resp.body<AuthResponse>())
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /** Sign in with email + password. */
    suspend fun signInWithEmail(email: String, password: String): Result<AuthResponse> = onIo {
        if (!SupabaseService.isConfigured) return@onIo Result.failure(Exception("Supabase not configured"))
        try {
            val body = buildJsonObject {
                put("email", email)
                put("password", password)
            }
            val resp = http.post("$baseUrl/auth/v1/token?grant_type=password") {
                authHeaders().forEach { (k, v) -> header(k, v) }
                contentType(ContentType.Application.Json)
                setBody(body.toString())
            }
            Result.success(resp.body<AuthResponse>())
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    // ─── Phone OTP via Edge Function ────────────────────────

    @Serializable
    data class EdgeFnSendResponse(
        val success: Boolean = false,
        val expiresIn: Int? = null,
        val error: String? = null
    )

    @Serializable
    data class EdgeFnVerifyResponse(
        val success: Boolean = false,
        val user_id: String? = null,
        val phone: String? = null,
        val access_token: String? = null,
        val refresh_token: String? = null,
        val user: EdgeFnUser? = null,
        val error: String? = null,
        val note: String? = null
    )

    @Serializable
    data class EdgeFnUser(
        val id: String = "",
        val email: String? = null,
        val phone: String? = null
    )

    /**
     * Send OTP to phone via the Edge Function.
     * The Edge Function generates a 6-digit OTP, stores it, and sends SMS via Twilio.
     */
    /**
     * Send OTP to phone via the Edge Function.
     * @param phone phone number WITH country code (e.g. "+919876543210")
     */
    suspend fun sendPhoneOtp(phone: String): Result<Unit> = onIo {
        if (!SupabaseService.isConfigured) return@onIo Result.failure(Exception("Supabase not configured"))
        try {
            val body = buildJsonObject {
                put("action", "send_otp")
                put("phone", phone)
            }
            http.post(edgeFnUrl) {
                header("Content-Type", "application/json")
                contentType(ContentType.Application.Json)
                setBody(body.toString())
            }
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Verify phone OTP via the Edge Function.
     * On success, the Edge Function creates/finds the Supabase Auth user.
     * We then call GoTrue's token endpoint to get the session tokens.
     */
    /**
     * Verify phone OTP via the Edge Function.
     * The Edge Function verifies the OTP, provisions the user in Supabase Auth,
     * signs them in, and returns the access_token + refresh_token directly.
     * @param phone phone number WITH country code (e.g. "+919876543210")
     */
    suspend fun verifyPhoneOtp(phone: String, token: String): Result<AuthResponse> = onIo {
        if (!SupabaseService.isConfigured) return@onIo Result.failure(Exception("Supabase not configured"))
        try {
            val verifyBody = buildJsonObject {
                put("action", "verify_otp")
                put("phone", phone)
                put("otp", token)
            }
            val verifyResp = http.post(edgeFnUrl) {
                header("Content-Type", "application/json")
                contentType(ContentType.Application.Json)
                setBody(verifyBody.toString())
            }
            val result = verifyResp.body<EdgeFnVerifyResponse>()

            if (!result.success) {
                return@onIo Result.failure(Exception(result.error ?: "Invalid OTP"))
            }

            // Edge Function returns tokens directly — map to AuthResponse
            val authResp = AuthResponse(
                access_token = result.access_token ?: "",
                refresh_token = result.refresh_token ?: "",
                user = if (result.user != null) AuthUser(
                    id = result.user.id,
                    email = result.user.email ?: "",
                    phone = result.user.phone ?: phone
                ) else null
            )

            if (authResp.access_token.isBlank()) {
                // Session creation failed (note from edge function)
                return@onIo Result.failure(Exception(result.note ?: "Session creation failed"))
            }

            Result.success(authResp)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    // ─── Session ───────────────────────────────────────────

    /** Refresh the access token using a refresh token. */
    suspend fun refreshToken(refreshToken: String): Result<AuthResponse> = onIo {
        if (!SupabaseService.isConfigured) return@onIo Result.failure(Exception("Supabase not configured"))
        try {
            val body = buildJsonObject { put("refresh_token", refreshToken) }
            val resp = http.post("$baseUrl/auth/v1/token?grant_type=refresh_token") {
                authHeaders().forEach { (k, v) -> header(k, v) }
                contentType(ContentType.Application.Json)
                setBody(body.toString())
            }
            Result.success(resp.body<AuthResponse>())
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /** Sign out (revoke the token on the server). */
    suspend fun signOut(accessToken: String): Result<Unit> = onIo {
        if (!SupabaseService.isConfigured) return@onIo Result.success(Unit)
        try {
            http.post("$baseUrl/auth/v1/logout") {
                header("apikey", anonKey)
                header("Authorization", "Bearer $accessToken")
            }
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    // ─── Helpers ───────────────────────────────────────────

    private suspend fun <T> onIo(block: suspend () -> T): T =
        withContext(Dispatchers.IO) { block() }
}
