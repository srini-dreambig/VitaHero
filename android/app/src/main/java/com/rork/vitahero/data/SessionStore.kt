package com.rork.vitahero.data

import android.content.Context
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

    private fun prefs(context: Context) = EncryptedSharedPreferences.create(
        context,
        PREFS,
        MasterKey.Builder(context).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build(),
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
    )

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
