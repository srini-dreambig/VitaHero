package com.rork.vitahero.data

import kotlinx.coroutines.flow.MutableStateFlow

data class AppUiState(
    val parentName: String = "Parent",
    val phone: String = "",
    val email: String = "",
    val userId: String = "",
    val kids: List<Kid> = emptyList(),
    val camps: List<Camp> = emptyList(),
    val doctors: List<Doctor> = emptyList(),
    val appointments: List<Appointment> = emptyList(),
    val notifications: List<AppNotification> = emptyList(),
    val consentAccepted: Boolean = false,
    val consentDeclined: Boolean = false,
    val darkTheme: Boolean = false,
    val locale: AppLocale = AppLocale.ENGLISH,
    val familyCode: String = "",
    val coParents: List<CoParent> = emptyList(),
    val wearableData: Map<String, HealthConnectService.WearableData> = emptyMap(),
    val notificationsEnabled: Boolean = true,
    val campRemindersEnabled: Boolean = true,
    val authProvider: String = "",
    val partnerSchools: List<PartnerSchool> = emptyList(),
    val availableSchools: List<PartnerSchool> = emptyList(),
    val bookingDirectory: BookingDirectory? = null,
    val bookingCity: String = "Hyderabad",
    val userLat: Double? = null,
    val userLng: Double? = null,
    val locationEnabled: Boolean = false,
)

data class BadgeProgress(
    val badges: List<Badge> = emptyList(),
    val leaderboard: List<LeaderEntry> = emptyList(),
)

data class AIDietContent(
    val greeting: String = "",
    val insight: String = "",
    val suggestion: String = "",
    val funFact: String = "",
    val generatedAt: String = "",
    val isGenerating: Boolean = false,
)

/** Shared in-memory app state — single source of truth for all feature ViewModels.
 *
 * [display] is what this phone was last set to, read from local storage before
 * anything is on screen, so the first frame is already in the parent's own
 * language and theme rather than English until the backend answers.
 */
class AppStateHolder(display: DisplayPreferences = DisplayPreferences()) {
    val uiState = MutableStateFlow(
        AppUiState(locale = display.locale, darkTheme = display.darkTheme)
    )
    val meals = MutableStateFlow<Map<String, List<MealItem>>>(emptyMap())
    val streaks = MutableStateFlow<Map<String, StreakInfo>>(emptyMap())
    val aiContent = MutableStateFlow<Map<String, AIDietContent>>(emptyMap())
    val leaderboards = MutableStateFlow<Map<String, List<LeaderEntry>>>(emptyMap())
    val bookingSlots = MutableStateFlow<Map<String, List<BookingTimeSlot>>>(emptyMap())
    val syncMessage = MutableStateFlow<String?>(null)

    /**
     * Forget the session, not the phone.
     *
     * The language and the theme are the parent's choice about this device and
     * survive a sign-out — reverting them used to drop a Telugu-speaking parent
     * onto an English sign-in screen. The sync message goes, because a failure
     * from the session that just ended has nothing to say to the next one.
     */
    fun resetSession() {
        val now = uiState.value
        uiState.value = AppUiState(locale = now.locale, darkTheme = now.darkTheme)
        meals.value = emptyMap()
        streaks.value = emptyMap()
        aiContent.value = emptyMap()
        leaderboards.value = emptyMap()
        bookingSlots.value = emptyMap()
        syncMessage.value = null
    }
}
