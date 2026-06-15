package com.rork.vitahero.data

import com.rork.vitahero.BuildConfig
import io.ktor.client.HttpClient
import io.ktor.client.engine.android.Android
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.serialization.kotlinx.json.json
import kotlinx.serialization.json.Json

/**
 * HTTP client configured for the VitaHero Cloudflare Worker API
 * (Neon DB backend).
 *
 * When the functions URL is not configured, network calls are
 * silently skipped instead of spamming the console with errors.
 */
object ApiService {
    val http: HttpClient by lazy {
        HttpClient(Android) {
            install(ContentNegotiation) {
                json(Json {
                    ignoreUnknownKeys = true
                    isLenient = true
                    coerceInputValues = true
                })
            }
        }
    }

    val baseUrl: String by lazy {
        BuildConfig.RORK_FUNCTIONS_URL.ifBlank { "" }
    }

    val isConfigured: Boolean get() = baseUrl.isNotBlank()

    /** The current session token, set after successful auth. */
    @Volatile
    var sessionToken: String? = null

    /** Clears the session token (on logout). */
    fun clearSession() { sessionToken = null }
}
