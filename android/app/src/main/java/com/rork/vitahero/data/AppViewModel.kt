package com.rork.vitahero.data

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * App shell: auth, consent, onboarding, sync bootstrap, session lifecycle.
 * Uses Firebase Auth for authentication — no custom session tokens.
 */
class AppViewModel(
    application: Application,
    private val container: AppContainer,
) : AndroidViewModel(application) {

    private val auth get() = container.auth
    private val state get() = container.state

    val uiState: StateFlow<AppUiState> get() = state.uiState.asStateFlow()
    val syncMessage: StateFlow<String?> get() = state.syncMessage.asStateFlow()

    val onboardingComplete: StateFlow<Boolean> get() = auth.onboardingComplete
    val isLoggedIn: StateFlow<Boolean> get() = auth.isLoggedIn
    val authError: StateFlow<String?> get() = auth.authError
    val authLoading: StateFlow<Boolean> get() = auth.authLoading
    val devOtp: StateFlow<String?> get() = auth.devOtp
    val verificationId: StateFlow<String?> get() = auth.verificationId
    val otpSending: StateFlow<Boolean> get() = auth.otpSending
    val sessionToken: StateFlow<String?> get() = auth.sessionToken
    val role: StateFlow<String> get() = auth.role

    private var initComplete = false

    init {
        container.attachSync(viewModelScope)
        initApp()
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

    // ─── Firebase Phone Auth ───────────────────────────────────

    /** Verify the OTP code with the stored verificationId. */
    fun verifyPhoneOtp(verificationId: String, code: String) {
        auth.verifyPhoneOtp(verificationId, code)
    }

    /** Sign in with auto-verified credential. */
    fun signInWithCredential(credential: com.google.firebase.auth.PhoneAuthCredential) {
        auth.signInWithCredential(credential)
    }

    fun setVerificationId(id: String) = auth.setVerificationId(id)
    fun clearAuthError() = auth.clearAuthError()
    fun clearAuthLoading() = auth.clearAuthLoading()
    fun clearDevOtp() = auth.clearDevOtp()
    fun setAuthLoading(loading: Boolean) = auth.setAuthLoading(loading)
    fun setAuthError(msg: String?) = auth.setAuthError(msg)
    fun setOtpSending(sending: Boolean) = auth.setOtpSending(sending)
    fun clearVerificationId() = auth.clearVerificationId()

    fun onBackendLogin(userId: String, email: String, phone: String, name: String) {
        val userRole = auth.role.value
        state.uiState.update {
            it.copy(
                userId = auth.profileId.value.ifBlank { userId },
                email = email,
                phone = phone,
                parentName = name.ifBlank { it.parentName },
                role = userRole,
                consentAccepted = true,
                kids = emptyList(),
                camps = emptyList(),
                appointments = emptyList(),
                notifications = emptyList(),
                doctors = emptyList(),
                wearableData = emptyMap(),
                coParents = emptyList(),
                authProvider = when {
                    email.isNotBlank() -> "EMAIL"
                    phone.isNotBlank() -> "PHONE"
                    else -> "GOOGLE"
                },
            )
        }
        state.meals.value = emptyMap()
        state.streaks.value = emptyMap()
        state.aiContent.value = emptyMap()
        fetchAndApplyBackendData()
        container.persistNow(
            SyncEntity.PROFILE,
            SyncEntity.KIDS,
            SyncEntity.CAMPS,
            SyncEntity.MEALS,
            SyncEntity.STREAKS,
            SyncEntity.APPOINTMENTS,
            SyncEntity.GROWTH,
        )
        NotificationCoordinator.scheduleAll(getApplication(), state.uiState.value)
    }

    fun logout() {
        auth.logout()
        state.resetSession()
    }
}
