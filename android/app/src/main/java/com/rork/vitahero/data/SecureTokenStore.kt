package com.rork.vitahero.data

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

/**
 * Encrypted token persistence using AndroidX Security Crypto.
 * Tokens survive process death and are stored in Android Keystore-backed
 * encrypted shared preferences.
 *
 * On cloud emulators where the hardware-backed Keystore may be unavailable,
 * gracefully falls back to regular SharedPreferences so the app doesn't
 * crash during startup.
 */
object SecureTokenStore {

    private const val PREFS_NAME = "vitahero_secure_tokens"
    private const val FALLBACK_PREFS_NAME = "vitahero_tokens_fallback"
    private const val KEY_ACCESS_TOKEN = "access_token"
    private const val KEY_REFRESH_TOKEN = "refresh_token"
    private const val KEY_USER_ID = "user_id"

    @Volatile
    private var prefs: SharedPreferences? = null
    @Volatile
    private var useFallback = false

    private fun getPrefs(context: Context): SharedPreferences {
        val cached = prefs
        if (cached != null) return cached

        return synchronized(this) {
            prefs ?: run {
                val result = try {
                    val masterKey = MasterKey.Builder(context)
                        .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                        .build()
                    EncryptedSharedPreferences.create(
                        context,
                        PREFS_NAME,
                        masterKey,
                        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
                    )
                } catch (_: Exception) {
                    useFallback = true
                    context.getSharedPreferences(FALLBACK_PREFS_NAME, Context.MODE_PRIVATE)
                }
                prefs = result
                result
            }
        }
    }

    fun saveTokens(context: Context, accessToken: String, refreshToken: String, userId: String) {
        try {
            getPrefs(context).edit()
                .putString(KEY_ACCESS_TOKEN, accessToken)
                .putString(KEY_REFRESH_TOKEN, refreshToken)
                .putString(KEY_USER_ID, userId)
                .apply()
        } catch (_: Exception) { }
    }

    fun getAccessToken(context: Context): String? {
        return try {
            getPrefs(context).getString(KEY_ACCESS_TOKEN, null)
        } catch (_: Exception) { null }
    }

    fun getRefreshToken(context: Context): String? {
        return try {
            getPrefs(context).getString(KEY_REFRESH_TOKEN, null)
        } catch (_: Exception) { null }
    }

    fun getUserId(context: Context): String? {
        return try {
            getPrefs(context).getString(KEY_USER_ID, null)
        } catch (_: Exception) { null }
    }

    fun clear(context: Context) {
        try {
            getPrefs(context).edit().clear().apply()
        } catch (_: Exception) { }
    }
}
