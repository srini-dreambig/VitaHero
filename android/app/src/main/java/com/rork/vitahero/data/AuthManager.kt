package com.rork.vitahero.data

import android.app.Application
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/**
 * Manages authentication state — Google Sign-In and phone OTP (Twilio).
 * Persists session token in EncryptedSharedPreferences so sessions survive
 * process death.
 *
 * No longer uses Supabase Auth — all auth goes through the Cloudflare Worker
 * backed by Neon DB.
 */
class AuthManager(private val app: Application) {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private val api = ApiRepository()

    private val _isLoggedIn = MutableStateFlow(false)
    val isLoggedIn: StateFlow<Boolean> = _isLoggedIn.asStateFlow()

    private val _onboardingComplete = MutableStateFlow(false)
    val onboardingComplete: StateFlow<Boolean> = _onboardingComplete.asStateFlow()

    private val _authError = MutableStateFlow<String?>(null)
    val authError: StateFlow<String?> = _authError.asStateFlow()

    private val _authLoading = MutableStateFlow(false)
    val authLoading: StateFlow<Boolean> = _authLoading.asStateFlow()

    private val _sessionToken = MutableStateFlow<String?>(null)
    val sessionToken: StateFlow<String?> = _sessionToken.asStateFlow()

    private val _userId = MutableStateFlow("")
    val userId: StateFlow<String> = _userId.asStateFlow()

    private val _email = MutableStateFlow("")
    val email: StateFlow<String> = _email.asStateFlow()

    private val _phone = MutableStateFlow("")
    val phone: StateFlow<String> = _phone.asStateFlow()

    private val _parentName = MutableStateFlow("Parent")
    val parentName: StateFlow<String> = _parentName.asStateFlow()

    /** Try to restore a previous session from encrypted storage. */
    fun tryRestoreSession(): Boolean {
        return try {
            val storedToken = SecureTokenStore.getSessionToken(app)
            val storedUserId = SecureTokenStore.getUserId(app)
            val storedName = SecureTokenStore.getParentName(app)
            val storedPhone = SecureTokenStore.getPhone(app)
            if (storedToken != null && storedUserId != null) {
                _sessionToken.value = storedToken
                _userId.value = storedUserId
                _isLoggedIn.value = true
                _onboardingComplete.value = true
                if (storedName != null) _parentName.value = storedName
                if (storedPhone != null) _phone.value = storedPhone
                ApiService.sessionToken = storedToken
                true
            } else false
        } catch (_: Exception) {
            false
        }
    }

    // ─── Google Sign-In ───────────────────────────────────────

    /**
     * Exchange a Google ID token for a session.
     * Called after CredentialManager returns the ID token.
     */
    fun signInWithGoogle(idToken: String) {
        _authLoading.value = true
        _authError.value = null
        scope.launch {
            api.googleSignIn(idToken).fold(
                onSuccess = { resp ->
                    val token = resp.token
                    val profile = resp.profile
                    if (profile != null) {
                        _sessionToken.value = token
                        _userId.value = profile.user_id.ifBlank { profile.id }
                        _email.value = profile.email ?: ""
                        _parentName.value = profile.name.ifBlank { "Parent" }
                        _phone.value = profile.phone ?: ""
                        ApiService.sessionToken = token
                        SecureTokenStore.saveSession(
                            app, token,
                            _userId.value,
                            _parentName.value,
                            _phone.value
                        )
                        _isLoggedIn.value = true
                        _onboardingComplete.value = true
                    } else {
                        _authError.value = "Google sign-in response missing profile"
                    }
                    _authLoading.value = false
                },
                onFailure = { e ->
                    _authError.value = e.message ?: "Google sign-in failed"
                    _authLoading.value = false
                }
            )
        }
    }

    // ─── Phone OTP ───────────────────────────────────────────

    fun sendPhoneOtp(phone: String) {
        _authLoading.value = true
        _authError.value = null
        scope.launch {
            // Format phone with +91 prefix if not already present
            val formatted = if (phone.startsWith("+")) phone else "+91$phone"
            api.sendPhoneOtp(formatted).fold(
                onSuccess = { _authLoading.value = false },
                onFailure = { e ->
                    _authError.value = e.message ?: "Failed to send OTP"
                    _authLoading.value = false
                }
            )
        }
    }

    fun verifyPhoneOtp(phone: String, otp: String) {
        _authLoading.value = true
        _authError.value = null
        scope.launch {
            val formatted = if (phone.startsWith("+")) phone else "+91$phone"
            api.verifyPhoneOtp(formatted, otp).fold(
                onSuccess = { resp ->
                    val token = resp.token
                    val profile = resp.profile
                    if (profile != null) {
                        _sessionToken.value = token
                        _userId.value = profile.id
                        _phone.value = profile.phone ?: phone
                        _parentName.value = profile.name.ifBlank { "Parent" }
                        ApiService.sessionToken = token
                        SecureTokenStore.saveSession(
                            app, token,
                            _userId.value,
                            _parentName.value,
                            _phone.value
                        )
                        _isLoggedIn.value = true
                        _onboardingComplete.value = true
                    } else {
                        _authError.value = "Phone verification response missing profile"
                    }
                    _authLoading.value = false
                },
                onFailure = { e ->
                    _authError.value = e.message ?: "Invalid OTP"
                    _authLoading.value = false
                }
            )
        }
    }

    // ─── Legacy / Local login (kept for offline/demo fallback) ─

    fun login(phone: String, name: String = "") {
        _isLoggedIn.value = true
        _phone.value = phone
        if (name.isNotBlank()) _parentName.value = name
    }

    fun completeOnboarding() {
        _onboardingComplete.value = true
    }

    // ─── Logout ──────────────────────────────────────────────

    fun logout() {
        scope.launch {
            try { api.logout() } catch (_: Exception) { }
        }
        _sessionToken.value = null
        ApiService.clearSession()
        SecureTokenStore.clear(app)
        _isLoggedIn.value = false
        _onboardingComplete.value = false
        _userId.value = ""
        _email.value = ""
        _phone.value = ""
    }

    fun clearSession() {
        _sessionToken.value = null
        ApiService.clearSession()
        SecureTokenStore.clear(app)
        _isLoggedIn.value = false
        _userId.value = ""
    }

    fun clearAuthError() { _authError.value = null }
    fun clearAuthLoading() { _authLoading.value = false }
    fun setOnboardingComplete(v: Boolean) { _onboardingComplete.value = v }
}
