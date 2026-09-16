package com.rork.vitahero.data

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

/**
 * Encrypted persistence for session token and onboarding flag only.
 * All app data lives on Neon DB — not stored locally.
 */
object SessionStore {

    private const val PREFS = "vitahero_session"
    private const val KEY_TOKEN = "session_token"
    private const val KEY_ONBOARDING = "onboarding_complete"
    private const val KEY_RESCHEDULE = "needs_notification_reschedule"

    /**
     * Built once, not on every call.
     *
     * Each of the seven accessors below used to construct the whole thing:
     * a MasterKey.Builder, which reaches into the AndroidKeyStore, and then an
     * EncryptedSharedPreferences over it. That is a keystore round trip per
     * read of a boolean, several of them during startup, on whatever thread
     * asked — usually the main one.
     *
     * @Volatile with a synchronised check because two coroutines can ask at
     * once on a cold start: the session restore on IO and the onboarding flag
     * on main.
     */
    @Volatile
    private var cached: SharedPreferences? = null

    private fun prefs(context: Context): SharedPreferences =
        cached ?: synchronized(this) {
            cached ?: EncryptedSharedPreferences.create(
                context.applicationContext,
                PREFS,
                MasterKey.Builder(context.applicationContext)
                    .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                    .build(),
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
            ).also { cached = it }
        }

    fun saveToken(context: Context, token: String) {
        prefs(context).edit().putString(KEY_TOKEN, token).apply()
    }

    fun getToken(context: Context): String? =
        prefs(context).getString(KEY_TOKEN, null)?.takeIf { it.length >= 30 }

    fun clearToken(context: Context) {
        prefs(context).edit().remove(KEY_TOKEN).apply()
    }

    fun setOnboardingComplete(context: Context, complete: Boolean) {
        prefs(context).edit().putBoolean(KEY_ONBOARDING, complete).apply()
    }

    fun isOnboardingComplete(context: Context): Boolean =
        prefs(context).getBoolean(KEY_ONBOARDING, false)

    fun setNeedsNotificationReschedule(context: Context, needs: Boolean) {
        prefs(context).edit().putBoolean(KEY_RESCHEDULE, needs).apply()
    }

    fun needsNotificationReschedule(context: Context): Boolean =
        prefs(context).getBoolean(KEY_RESCHEDULE, false)
}
