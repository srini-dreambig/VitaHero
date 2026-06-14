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
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

/**
 * Supabase Auth REST client — calls the GoTrue API directly via Ktor.
 * No supabase-kt dependency needed for auth operations.
 */
object SupabaseAuth {

    private val http get() = SupabaseService.http
    private val baseUrl get() = SupabaseService.baseUrl
    private val anonKey get() = SupabaseService.anonKey

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

    /** Sign up with email + password. Returns the access token on success. */
    suspend fun signUpWithEmail(email: String, password: String, name: String): Result<AuthResponse> = onIo {
        try {
            val body = buildJsonObject {
                put("email", email)
                put("password", password)
                put("data", buildJsonObject {
                    put("name", name)
                })
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

    /** Sign in with email + password. Returns the access token on success. */
    suspend fun signInWithEmail(email: String, password: String): Result<AuthResponse> = onIo {
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

    // ─── Phone OTP ─────────────────────────────────────────

    @Serializable
    data class OtpRequest(
        val phone: String
    )

    @Serializable
    data class OtpVerifyRequest(
        val phone: String,
        val token: String,
        val type: String = "sms"
    )

    /** Send OTP to phone number (format: +919876543210). */
    suspend fun sendPhoneOtp(phone: String): Result<Unit> = onIo {
        try {
            val body = buildJsonObject {
                put("phone", phone)
            }
            http.post("$baseUrl/auth/v1/otp") {
                authHeaders().forEach { (k, v) -> header(k, v) }
                contentType(ContentType.Application.Json)
                setBody(body.toString())
            }
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /** Verify phone OTP. Returns the access token on success. */
    suspend fun verifyPhoneOtp(phone: String, token: String): Result<AuthResponse> = onIo {
        try {
            val body = buildJsonObject {
                put("phone", phone)
                put("token", token)
                put("type", "sms")
            }
            val resp = http.post("$baseUrl/auth/v1/verify") {
                authHeaders().forEach { (k, v) -> header(k, v) }
                contentType(ContentType.Application.Json)
                setBody(body.toString())
            }
            Result.success(resp.body<AuthResponse>())
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    // ─── Session ───────────────────────────────────────────

    /** Refresh the access token using a refresh token. */
    suspend fun refreshToken(refreshToken: String): Result<AuthResponse> = onIo {
        try {
            val body = buildJsonObject {
                put("refresh_token", refreshToken)
            }
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
