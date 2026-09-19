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
                // Our own backend, from the one place that knows where it
                // is. These named Rork's web domain, which was neither where
                // the requests went nor anywhere we control.
                header("Origin", BuildConfig.RORK_FUNCTIONS_URL)
                header("Referer", "${BuildConfig.RORK_FUNCTIONS_URL}/")
                header("X-Requested-With", "com.rork.vitahero")
            }
        }
    }

    /**
     * Base URL for the Cloudflare Worker backend.
     *
     * No fallback here. There used to be one, hardcoded to Rork's worker, so
     * forgetting RORK_FUNCTIONS_URL was the most expensive kind of mistake:
     * the build works, the app signs in, every screen fills — and none of it
     * is talking to our backend. A tester's camp findings land in somebody
     * else's database and nothing anywhere says so.
     *
     * build.gradle.kts now supplies the default, because it also derives the
     * App Link host in the manifest from the same value. A default here as
     * well would be a second place for the two to disagree.
     */
    val baseUrl: String get() = BuildConfig.RORK_FUNCTIONS_URL

    val isConfigured: Boolean get() = baseUrl.isNotBlank()

    /** The current session token, set after successful auth. */
    @Volatile
    var sessionToken: String? = null

    /** Clears the session token (on logout). */
    fun clearSession() { sessionToken = null }
}
