package com.rork.vitahero.data

import com.rork.vitahero.BuildConfig
import io.ktor.client.HttpClient
import io.ktor.client.engine.android.Android
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.serialization.kotlinx.json.json
import kotlinx.serialization.json.Json

/**
 * HTTP client configured for Supabase REST API.
 * Uses Ktor (already in the project) instead of supabase-kt
 * for simpler dependency management.
 *
 * When credentials are not configured (empty env vars), network
 * calls are silently skipped instead of spamming the console with
 * connection errors.
 */
object SupabaseService {
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
        BuildConfig.SUPABASE_URL.ifBlank { "https://klmgvvsikkhzgfxfujua.supabase.co" }
    }
    val anonKey: String by lazy { BuildConfig.SUPABASE_ANON_KEY }

    val isConfigured: Boolean get() = baseUrl.isNotBlank() && anonKey.isNotBlank()
}
