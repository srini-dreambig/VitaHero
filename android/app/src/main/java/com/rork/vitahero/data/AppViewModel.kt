package com.rork.vitahero.data

import android.app.Activity
import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * App shell: auth, consent, onboarding, sync bootstrap, session lifecycle.
 */
class AppViewModel(
    application: Application,
    private val container: AppContainer,
) : AndroidViewModel(application) {

    private val auth get() = container.auth
    private val state get() = container.state

    // Built once, not on every read. asStateFlow() allocates a fresh read-only
    // wrapper each time it is called, and both collectAsState and selectAsState
    // key their collector on the flow's identity — so a `get()` here handed out
    // a different object on every recomposition, tore down the collector and
    // started a new one each frame, and made narrowing a read impossible.
    val uiState: StateFlow<AppUiState> = state.uiState.asStateFlow()
    val syncMessage: StateFlow<String?> = state.syncMessage.asStateFlow()

    val onboardingComplete: StateFlow<Boolean> get() = auth.onboardingComplete
    val isLoggedIn: StateFlow<Boolean> get() = auth.isLoggedIn
    val authError: StateFlow<String?> get() = auth.authError
    val authLoading: StateFlow<Boolean> get() = auth.authLoading
    val sessionToken: StateFlow<String?> get() = auth.sessionToken

    /**
     * True when the app could not reach the server on its last try.
     *
     * Screens use this to say so instead of drawing an empty, confident-looking
     * app. "No camps" and "we could not ask about camps" are not the same
     * sentence, and a parent waiting on a child's screening result deserves to
     * be told which one they are reading.
     */
    val serverUnreachable: StateFlow<Boolean> = SessionSignals.reach
        .map { it == SessionSignals.Reach.UNREACHABLE }
        .stateIn(viewModelScope, SharingStarted.Eagerly, false)

    /** The wording for [serverUnreachable], in the parent's own language. */
    fun unreachableMessage(): String = tr(S.serverUnreachable, state.uiState.value.locale)

    private var initComplete = false

    init {
        container.attachSync(viewModelScope)
        initApp()
        // AuthManager writes its errors before any screen is composed and has
        // no view of app state, so the chosen language is handed to it here.
        viewModelScope.launch {
            state.uiState.collect { auth.locale = it.locale }
        }
        viewModelScope.launch {
            var wasLoggedIn = auth.isLoggedIn.value
            auth.isLoggedIn.collect { nowLoggedIn ->
                if (initComplete && nowLoggedIn && !wasLoggedIn && auth.profileId.value.isNotBlank()) {
                    onBackendLogin(
                        userId = auth.profileId.value,
                        email = auth.email.value,
                        phone = auth.phone.value,
                        name = auth.parentName.value,
                    )
                }
                wasLoggedIn = nowLoggedIn
            }
        }
    }

    fun clearSyncMessage() = container.clearSyncMessage()

    private fun initApp() {
        viewModelScope.launch {
            val app = getApplication<Application>()
            val restored = withContext(Dispatchers.IO) { auth.tryRestoreSession() }
            withContext(Dispatchers.Main) {
                state.resetSession()
                if (restored) {
                    container.retryPendingSync()
                    fetchAndApplyBackendData()
                    if (SessionStore.needsNotificationReschedule(app)) {
                        NotificationCoordinator.scheduleAll(app, state.uiState.value)
                        SessionStore.setNeedsNotificationReschedule(app, false)
                    } else {
                        NotificationCoordinator.scheduleAll(app, state.uiState.value)
                    }
                }
                initComplete = true
            }
        }
    }

    fun fetchAndApplyBackendData(onKidIdsLoaded: suspend (List<String>) -> Unit = {}) {
        container.fetchAndApplyBackendData(viewModelScope, onKidIdsLoaded)
    }

    fun acceptConsent(familyCode: String) {
        state.uiState.update {
            it.copy(consentAccepted = true, consentDeclined = false, familyCode = familyCode)
        }
        container.persist(SyncEntity.PROFILE)
    }

    fun declineConsent() {
        state.uiState.update { it.copy(consentDeclined = true, consentAccepted = false) }
        container.persist(SyncEntity.PROFILE)
    }

    fun completeOnboarding() = auth.completeOnboarding()

    fun signInWithGoogle(idToken: String) = auth.signInWithGoogle(idToken)
    fun signUpWithEmail(name: String, email: String, password: String) =
        auth.signUpWithEmail(name, email, password)
    fun signInWithEmail(email: String, password: String) = auth.signInWithEmail(email, password)
    fun requestPhoneOtp(activity: Activity, phone: String) = auth.requestPhoneOtp(activity, phone)
    fun resendPhoneOtp(activity: Activity, phone: String) = auth.resendPhoneOtp(activity, phone)
    fun verifyPhoneOtp(phone: String, token: String) = auth.verifyPhoneOtp(phone, token)
    fun clearAuthError() = auth.clearAuthError()
    fun clearAuthLoading() = auth.clearAuthLoading()

    fun onBackendLogin(userId: String, email: String, phone: String, name: String) {
        // Somebody has just signed in, and it may not be the person who was
        // here before. Everything the previous session put in memory goes,
        // through the one method that knows what a session owns — this used to
        // clear seven fields and three caches by hand and had already drifted,
        // leaving the last family's leaderboards and booking slots behind.
        val previousName = state.uiState.value.parentName
        state.resetSession()
        state.uiState.update {
            it.copy(
                userId = auth.profileId.value.ifBlank { userId },
                email = email,
                phone = phone,
                parentName = name.ifBlank { previousName },
                consentAccepted = true,
                authProvider = when {
                    email.isNotBlank() -> "EMAIL"
                    phone.isNotBlank() -> "PHONE"
                    else -> "GOOGLE"
                },
            )
        }
        fetchAndApplyBackendData()
        container.persistNow(
            SyncEntity.PROFILE,
            SyncEntity.CAMPS,
            SyncEntity.MEALS,
            SyncEntity.STREAKS,
            SyncEntity.APPOINTMENTS,
            SyncEntity.GROWTH,
        )
        NotificationCoordinator.scheduleAll(getApplication(), state.uiState.value)
    }

    fun logout() {
        // Before the state goes, not after: the state is the only record of
        // what was scheduled, and an alarm outlives the session that set it.
        // Without this the next person to pick the phone up would be reminded
        // about another family's camp, by name, on their lock screen.
        NotificationCoordinator.cancelAll(getApplication(), state.uiState.value)
        auth.logout()
        state.resetSession()
    }
}
