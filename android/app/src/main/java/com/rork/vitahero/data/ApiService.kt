package com.rork.vitahero.data

import com.rork.vitahero.BuildConfig
import io.ktor.client.HttpClient
import io.ktor.client.engine.android.Android
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.plugins.defaultRequest
import io.ktor.client.request.header
import io.ktor.serialization.kotlinx.json.json
import kotlinx.serialization.json.Json

/**
 * HTTP client configured for the VitaHero Cloudflare Worker API
 * (Neon DB backend).
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
            
            // Set global headers that are required by the backend Auth proxy
            defaultRequest {
                header("Origin", "https://kidhero.rork.app")
                header("Referer", "https://kidhero.rork.app/")
                header("X-Requested-With", "com.rork.vitahero")
            }
        }
    }

    /**
     * Base URL for the Cloudflare Worker backend.
     */
    val baseUrl: String by lazy {
        BuildConfig.RORK_FUNCTIONS_URL.ifBlank {
            "https://kidhero-health-sync-backend.rork.app"
        }
    }

    val isConfigured: Boolean get() = baseUrl.isNotBlank()

    /** The current session token, set after successful auth. */
    @Volatile
    var sessionToken: String? = null

    /** Clears the session token (on logout). */
    fun clearSession() { sessionToken = null }
}
