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
 * On Android 6+ the MasterKey is hardware-backed (TEE/StrongBox).
 * On older devices a software fallback is used automatically.
 */
object SecureTokenStore {

    private const val PREFS_NAME = "vitahero_secure_tokens"
    private const val KEY_ACCESS_TOKEN = "access_token"
    private const val KEY_REFRESH_TOKEN = "refresh_token"
    private const val KEY_USER_ID = "user_id"

    @Volatile
    private var prefs: SharedPreferences? = null

    private fun getPrefs(context: Context): SharedPreferences {
        return prefs ?: synchronized(this) {
            prefs ?: run {
                val masterKey = MasterKey.Builder(context)
                    .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                    .build()
                EncryptedSharedPreferences.create(
                    context,
                    PREFS_NAME,
                    masterKey,
                    EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                    EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
                ).also { prefs = it }
            }
        }
    }

    fun saveTokens(context: Context, accessToken: String, refreshToken: String, userId: String) {
        getPrefs(context).edit()
            .putString(KEY_ACCESS_TOKEN, accessToken)
            .putString(KEY_REFRESH_TOKEN, refreshToken)
            .putString(KEY_USER_ID, userId)
            .apply()
    }

    fun getAccessToken(context: Context): String? =
        getPrefs(context).getString(KEY_ACCESS_TOKEN, null)

    fun getRefreshToken(context: Context): String? =
        getPrefs(context).getString(KEY_REFRESH_TOKEN, null)

    fun getUserId(context: Context): String? =
        getPrefs(context).getString(KEY_USER_ID, null)

    fun clear(context: Context) {
        getPrefs(context).edit().clear().apply()
    }
}
