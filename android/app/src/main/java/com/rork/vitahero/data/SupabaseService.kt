package com.rork.vitahero.data

import com.rork.vitahero.Config
import io.ktor.client.HttpClient
import io.ktor.client.engine.android.Android
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.serialization.kotlinx.json.json
import kotlinx.serialization.json.Json

/**
 * HTTP client configured for Supabase REST API.
 * Uses Ktor (already in the project) instead of supabase-kt
 * for simpler dependency management.
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

    val baseUrl: String get() = Config.allValues["EXPO_PUBLIC_SUPABASE_URL"] ?: ""
    val anonKey: String get() = Config.allValues["EXPO_PUBLIC_SUPABASE_ANON_KEY"] ?: ""
}
