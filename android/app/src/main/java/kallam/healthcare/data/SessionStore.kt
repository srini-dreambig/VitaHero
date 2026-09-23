package kallam.healthcare.data

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

/**
 * Encrypted persistence for the session token, the onboarding flag and the two
 * display preferences. All app data lives on Neon DB — not stored locally.
 *
 * The language and the theme are the exception, and deliberately so. They used
 * to live only in the server profile, which meant the app opened in English
 * every time and only became Telugu once the backend answered — and stayed
 * English for the whole session if it never did. They are a property of this
 * phone and the person holding it, so this phone remembers them; the server
 * copy is what carries the choice to a second device, not what defines it.
 */
object SessionStore {

    private const val PREFS = "vitahero_session"
    private const val KEY_TOKEN = "session_token"
    private const val KEY_ONBOARDING = "onboarding_complete"
    private const val KEY_RESCHEDULE = "needs_notification_reschedule"
    private const val KEY_LOCALE = "locale_code"
    private const val KEY_DARK_THEME = "dark_theme"
    private const val KEY_ROLE = "session_role"

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

    /**
     * Which product this sign-in opens: PARENT, PHYSICIAN or SCREENER.
     *
     * Kept beside the token so a relaunch draws the right home screen straight
     * away. Without it a doctor sees the family home for as long as the
     * profile takes to come back, which on a school's wifi is not a flicker.
     * It is a hint, never a permission: the server decides what the token can
     * actually reach.
     */
    fun saveRole(context: Context, role: String) {
        prefs(context).edit().putString(KEY_ROLE, role).apply()
    }

    fun role(context: Context): String =
        prefs(context).getString(KEY_ROLE, "PARENT") ?: "PARENT"

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

    /** The language and theme this phone was last set to. */
    fun displayPreferences(context: Context): DisplayPreferences {
        val p = prefs(context)
        val code = p.getString(KEY_LOCALE, null)
        return DisplayPreferences(
            locale = AppLocale.entries.firstOrNull { it.code == code } ?: AppLocale.ENGLISH,
            darkTheme = p.getBoolean(KEY_DARK_THEME, false),
        )
    }

    fun saveDisplayPreferences(context: Context, locale: AppLocale, darkTheme: Boolean) {
        prefs(context).edit()
            .putString(KEY_LOCALE, locale.code)
            .putBoolean(KEY_DARK_THEME, darkTheme)
            .apply()
    }
}

/** What the app looks like before it has spoken to anything. */
data class DisplayPreferences(
    val locale: AppLocale = AppLocale.ENGLISH,
    val darkTheme: Boolean = false,
)
