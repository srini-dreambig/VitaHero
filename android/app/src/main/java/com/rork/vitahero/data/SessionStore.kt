package com.rork.vitahero.data

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

/**
 * Encrypted persistence for onboarding flag only.
 * Session is managed by Firebase Auth SDK — no custom session tokens.
 */
object SessionStore {

    private const val PREFS = "vitahero_session"
    private const val KEY_ONBOARDING = "onboarding_complete"
    private const val KEY_RESCHEDULE = "needs_notification_reschedule"

    @Volatile
    private var cachedPrefs: SharedPreferences? = null

    private fun prefs(context: Context): SharedPreferences {
        cachedPrefs?.let { return it }
        synchronized(this) {
            cachedPrefs?.let { return it }
            val prefs = EncryptedSharedPreferences.create(
                context.applicationContext,
                PREFS,
                MasterKey.Builder(context.applicationContext)
                    .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                    .build(),
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
            )
            cachedPrefs = prefs
            return prefs
        }
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

    /** Clears all stored data. */
    fun clearToken(context: Context) {
        prefs(context).edit().clear().apply()
    }
}
