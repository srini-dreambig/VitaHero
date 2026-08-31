package com.rork.vitahero.data

import android.app.Activity
import android.app.Application
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * Manages authentication state — Google Sign-In, email/password, and phone OTP.
 * Session token is stored encrypted locally; all profile data comes from Neon DB.
 */
class AuthManager(private val app: Application) {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private val api get() = ApiRepositoryProvider.repository

    private val _isLoggedIn = MutableStateFlow(false)
    val isLoggedIn: StateFlow<Boolean> = _isLoggedIn.asStateFlow()

    private val _onboardingComplete = MutableStateFlow(SessionStore.isOnboardingComplete(app))
    val onboardingComplete: StateFlow<Boolean> = _onboardingComplete.asStateFlow()

    private val _authError = MutableStateFlow<String?>(null)
    val authError: StateFlow<String?> = _authError.asStateFlow()

    private val _authLoading = MutableStateFlow(false)
    val authLoading: StateFlow<Boolean> = _authLoading.asStateFlow()

    private val _sessionToken = MutableStateFlow<String?>(null)
    val sessionToken: StateFlow<String?> = _sessionToken.asStateFlow()

    /** Profile PK in vita_hero.profiles (na_* or ph_*). */
    private val _profileId = MutableStateFlow("")
    val profileId: StateFlow<String> = _profileId.asStateFlow()

    private val _userId = MutableStateFlow("")
    val userId: StateFlow<String> = _userId.asStateFlow()

    private val _email = MutableStateFlow("")
    val email: StateFlow<String> = _email.asStateFlow()

    private val _phone = MutableStateFlow("")
    val phone: StateFlow<String> = _phone.asStateFlow()

    private val _parentName = MutableStateFlow("Parent")
    val parentName: StateFlow<String> = _parentName.asStateFlow()

    suspend fun tryRestoreSession(): Boolean = withContext(Dispatchers.IO) {
        val token = SessionStore.getToken(app) ?: return@withContext false
        ApiService.sessionToken = token
        val profile = api.fetchMyProfile() ?: run {
            SessionStore.clearToken(app)
            ApiService.clearSession()
            return@withContext false
        }
        withContext(Dispatchers.Main) {
            applyProfile(profile, token)
            _isLoggedIn.value = true
            _onboardingComplete.value = profile.onboardingComplete || SessionStore.isOnboardingComplete(app)
        }
        true
    }

    fun signInWithGoogle(idToken: String) {
        _authLoading.value = true
        _authError.value = null
        scope.launch {
            api.googleSignIn(idToken).fold(
                onSuccess = { resp -> onAuthSuccess(resp) },
                onFailure = { e ->
                    _authError.value = e.message ?: tr(S.authGoogleFailed, AppLocale.ENGLISH)
                    _authLoading.value = false
                }
            )
        }
    }

    fun signUpWithEmail(name: String, email: String, password: String) {
        _authLoading.value = true
        _authError.value = null
        scope.launch {
            api.signUpWithEmail(name, email, password).fold(
                onSuccess = { resp -> onAuthSuccess(resp) },
                onFailure = { e ->
                    _authError.value = e.message ?: tr(S.authSignupFailed, AppLocale.ENGLISH)
                    _authLoading.value = false
                }
            )
        }
    }

    fun signInWithEmail(email: String, password: String) {
        _authLoading.value = true
        _authError.value = null
        scope.launch {
            api.signInWithEmail(email, password).fold(
                onSuccess = { resp -> onAuthSuccess(resp) },
                onFailure = { e ->
                    _authError.value = e.message ?: tr(S.authSigninFailed, AppLocale.ENGLISH)
                    _authLoading.value = false
                }
            )
        }
    }

    private fun onAuthSuccess(resp: GoogleAuthResponse) {
        val token = resp.token
        val profile = resp.profile
        if (profile != null && token.isNotBlank()) {
            SessionStore.saveToken(app, token)
            applyAuthProfile(profile, token)
            _isLoggedIn.value = true
            _onboardingComplete.value = true
            SessionStore.setOnboardingComplete(app, true)
        } else {
            _authError.value = tr(S.authMissingToken, AppLocale.ENGLISH)
        }
        _authLoading.value = false
    }

    private fun applyAuthProfile(profile: AuthProfile, token: String) {
        _sessionToken.value = token
        _profileId.value = profile.id
        _userId.value = profile.user_id.ifBlank { profile.id }
        _email.value = profile.email ?: ""
        _parentName.value = profile.name.ifBlank { "Parent" }
        _phone.value = profile.phone ?: ""
        ApiService.sessionToken = token
    }

    private fun applyProfile(profile: ProfileDto, token: String) {
        _sessionToken.value = token
        _profileId.value = profile.id
        _userId.value = profile.userId ?: profile.id
        _email.value = profile.email ?: ""
        _parentName.value = profile.name.ifBlank { "Parent" }
        _phone.value = profile.phone ?: ""
        ApiService.sessionToken = token
    }

    /**
     * Requests the login OTP via Firebase's Phone provider. Firebase only
     * allows the request to originate from the parent's own device; the SMS
     * is sent by Google, not our backend.
     */
    fun requestPhoneOtp(activity: Activity, phone: String) {
        _authLoading.value = true
        _authError.value = null
        val formatted = if (phone.startsWith("+")) phone else "+91$phone"
        FirebaseOtp.requestCode(
            activity,
            formatted,
            onCodeSent = { _authLoading.value = false },
            onAutoVerified = { idToken -> signInWithFirebaseToken(idToken) },
            onError = { message ->
                _authError.value = message
                _authLoading.value = false
            }
        )
    }

    /** Resends the Firebase OTP using the force-resending token. */
    fun resendPhoneOtp(activity: Activity, phone: String) {
        _authLoading.value = true
        _authError.value = null
        val formatted = if (phone.startsWith("+")) phone else "+91$phone"
        FirebaseOtp.resendCode(
            activity,
            formatted,
            onCodeSent = { _authLoading.value = false },
            onAutoVerified = { idToken -> signInWithFirebaseToken(idToken) },
            onError = { message ->
                _authError.value = message
                _authLoading.value = false
            }
        )
    }

    fun verifyPhoneOtp(phone: String, otp: String) {
        _authLoading.value = true
        _authError.value = null
        scope.launch {
            FirebaseOtp.verifyCode(otp).fold(
                onSuccess = { idToken -> signInWithFirebaseToken(idToken) },
                onFailure = { e ->
                    _authError.value = e.message ?: tr(S.authOtpInvalid, AppLocale.ENGLISH)
                    _authLoading.value = false
                }
            )
        }
    }

    /** Exchanges the Firebase ID token for a VitaHero backend session. */
    private fun signInWithFirebaseToken(idToken: String) {
        _authLoading.value = true
        scope.launch {
            api.firebasePhoneSignIn(idToken).fold(
                onSuccess = { resp -> onAuthSuccess(resp) },
                onFailure = { e ->
                    _authError.value = e.message ?: tr(S.authOtpInvalid, AppLocale.ENGLISH)
                    _authLoading.value = false
                }
            )
        }
    }

    fun completeOnboarding() {
        _onboardingComplete.value = true
        SessionStore.setOnboardingComplete(app, true)
    }

    fun logout() {
        scope.launch {
            try { api.logout() } catch (_: Exception) { }
        }
        SessionStore.clearToken(app)
        _sessionToken.value = null
        ApiService.clearSession()
        _isLoggedIn.value = false
        _profileId.value = ""
        _userId.value = ""
        _email.value = ""
        _phone.value = ""
    }

    fun clearSession() {
        SessionStore.clearToken(app)
        _sessionToken.value = null
        ApiService.clearSession()
        _isLoggedIn.value = false
        _profileId.value = ""
        _userId.value = ""
    }

    fun clearAuthError() { _authError.value = null }
    fun clearAuthLoading() { _authLoading.value = false }
    fun setOnboardingComplete(v: Boolean) {
        _onboardingComplete.value = v
        SessionStore.setOnboardingComplete(app, v)
    }

    fun onDestroy() {
        scope.cancel()
    }
}
