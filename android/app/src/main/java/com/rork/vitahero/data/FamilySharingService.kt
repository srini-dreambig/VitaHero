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
 * Family Sharing — calls the Cloudflare Worker API for code validation,
 * joining families, and fetching shared kid data.
 */
object FamilySharingService {

    private val http get() = ApiService.http
    private val apiBase: String get() = ApiService.baseUrl

    private fun authHeaders(accessToken: String?) = buildMap {
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

    suspend fun validateCode(code: String, accessToken: String): Result<ValidateCodeResponse> = onIo {
        if (!ApiService.isConfigured) return@onIo Result.failure(Exception("Not configured"))
        try {
            val body = buildJsonObject { put("code", code) }
            val headers = authHeaders(accessToken)
            val resp = http.post("$apiBase/api/family-sharing/validate") {
                headers.forEach { (k, v) -> header(k, v) }
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
        if (!ApiService.isConfigured) return@onIo Result.failure(Exception("Not configured"))
        try {
            val body = buildJsonObject {
                put("action", "join_family")
                put("code", code)
                put("coParentName", coParentName)
                put("relation", relation)
            }
            val headers = authHeaders(accessToken)
            val resp = http.post("$apiBase/api/family-sharing/join") {
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
        if (!ApiService.isConfigured) return@onIo Result.failure(Exception("Not configured"))
        try {
            val headers = authHeaders(accessToken)
            val resp = http.get("$apiBase/api/family-sharing/kids") {
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
