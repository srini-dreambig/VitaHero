package com.rork.vitahero.data

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

/**
 * Encrypted token persistence using AndroidX Security Crypto.
 * Stores session token (from Neon DB backend) and user profile info.
 *
 * On cloud emulators where the hardware-backed Keystore may be unavailable,
 * gracefully falls back to regular SharedPreferences.
 */
object SecureTokenStore {

    private const val PREFS_NAME = "vitahero_secure_tokens"
    private const val FALLBACK_PREFS_NAME = "vitahero_tokens_fallback"
    private const val KEY_SESSION_TOKEN = "session_token"
    private const val KEY_USER_ID = "user_id"
    private const val KEY_PARENT_NAME = "parent_name"
    private const val KEY_PHONE = "phone"

    @Volatile
    private var prefs: SharedPreferences? = null

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
                    context.getSharedPreferences(FALLBACK_PREFS_NAME, Context.MODE_PRIVATE)
                }
                prefs = result
                result
            }
        }
    }

    fun saveSession(
        context: Context,
        sessionToken: String,
        userId: String,
        parentName: String,
        phone: String
    ) {
        try {
            getPrefs(context).edit()
                .putString(KEY_SESSION_TOKEN, sessionToken)
                .putString(KEY_USER_ID, userId)
                .putString(KEY_PARENT_NAME, parentName)
                .putString(KEY_PHONE, phone)
                .apply()
        } catch (_: Exception) { }
    }

    fun getSessionToken(context: Context): String? {
        return try {
            getPrefs(context).getString(KEY_SESSION_TOKEN, null)
        } catch (_: Exception) { null }
    }

    fun getUserId(context: Context): String? {
        return try {
            getPrefs(context).getString(KEY_USER_ID, null)
        } catch (_: Exception) { null }
    }

    fun getParentName(context: Context): String? {
        return try {
            getPrefs(context).getString(KEY_PARENT_NAME, null)
        } catch (_: Exception) { null }
    }

    fun getPhone(context: Context): String? {
        return try {
            getPrefs(context).getString(KEY_PHONE, null)
        } catch (_: Exception) { null }
    }

    fun clear(context: Context) {
        try {
            getPrefs(context).edit().clear().apply()
        } catch (_: Exception) { }
    }
}
