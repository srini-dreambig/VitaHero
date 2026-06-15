package com.rork.vitahero.data

import io.ktor.client.call.body
import io.ktor.client.request.get
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
 * Family Sharing — calls the VitaHero family-sharing edge function
 * for code validation, joining families, and fetching shared kid data.
 *
 * Endpoint: SUPABASE_URL/functions/v1/family-sharing
 */
object FamilySharingService {

    private val http get() = SupabaseService.http
    private val baseUrl get() = SupabaseService.baseUrl
    private val anonKey get() = SupabaseService.anonKey
    private val edgeFnUrl: String get() {
        val base = SupabaseService.baseUrl
        return if (base.isNotBlank()) "$base/functions/v1/family-sharing" else ""
    }

    private fun authHeaders(accessToken: String?) = buildMap {
        put("apikey", anonKey)
        put("Content-Type", "application/json")
        accessToken?.let { put("Authorization", "Bearer $it") }
    }

    @Serializable
    data class ValidateCodeResponse(
        val valid: Boolean = false,
        val familyOwner: String? = null,
        val profileId: String? = null,
        val error: String? = null,
    )

    @Serializable
    data class JoinFamilyResponse(
        val success: Boolean = false,
        val coParentId: String? = null,
        val familyCode: String? = null,
        val error: String? = null,
    )

    @Serializable
    data class SharedKidsResponse(
        val kids: List<SharedKidDto> = emptyList(),
        val isOwner: Boolean = false,
        val error: String? = null,
    )

    @Serializable
    data class SharedKidDto(
        val id: String = "",
        val name: String = "",
        val age: Int = 0,
        val gender: String = "",
        val school: String = "",
        val grade: String = "",
        val heightCm: Double = 0.0,
        val weightKg: Double = 0.0,
        val overallScore: Int = 80,
        val dental: String = "GOOD",
        val eyesight: String = "GOOD",
        val nutrition: String = "GOOD",
        val lastCheckup: String = "",
    )

    /**
     * Validate a family code via the edge function.
     * Returns the family owner name and profile ID if valid.
     */
    suspend fun validateCode(code: String): Result<ValidateCodeResponse> = onIo {
        if (!SupabaseService.isConfigured) return@onIo Result.failure(Exception("Not configured"))
        try {
            val body = buildJsonObject {
                put("action", "validate_code")
                put("code", code)
            }
            val resp = http.post(edgeFnUrl) {
                header("Content-Type", "application/json")
                contentType(ContentType.Application.Json)
                setBody(body.toString())
            }
            Result.success(resp.body<ValidateCodeResponse>())
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Join a family by code. Requires the user's access token.
     */
    suspend fun joinFamily(
        code: String,
        coParentName: String,
        relation: String,
        accessToken: String,
    ): Result<JoinFamilyResponse> = onIo {
        if (!SupabaseService.isConfigured) return@onIo Result.failure(Exception("Not configured"))
        try {
            val body = buildJsonObject {
                put("action", "join_family")
                put("code", code)
                put("coParentName", coParentName)
                put("relation", relation)
            }
            val headers = authHeaders(accessToken)
            val resp = http.post(edgeFnUrl) {
                headers.forEach { (k, v) -> header(k, v) }
                contentType(ContentType.Application.Json)
                setBody(body.toString())
            }
            Result.success(resp.body<JoinFamilyResponse>())
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Fetch shared kids for a family code. Requires auth.
     */
    suspend fun fetchSharedKids(
        familyCode: String,
        accessToken: String,
    ): Result<SharedKidsResponse> = onIo {
        if (!SupabaseService.isConfigured) return@onIo Result.failure(Exception("Not configured"))
        try {
            val headers = authHeaders(accessToken)
            val resp = http.get("$edgeFnUrl/shared-kids") {
                headers.forEach { (k, v) -> header(k, v) }
                url { parameters.append("familyCode", familyCode) }
            }
            Result.success(resp.body<SharedKidsResponse>())
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    private suspend fun <T> onIo(block: suspend () -> T): T =
        withContext(Dispatchers.IO) { block() }
}
