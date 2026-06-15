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
import kotlinx.coroutines.withContext

/**
 * Manages authentication state — Supabase email/password and phone OTP.
 * Persists tokens in EncryptedSharedPreferences so sessions survive
 * process death. Handles token refresh on app startup.
 */
class AuthManager(private val app: Application) {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

    private val _isLoggedIn = MutableStateFlow(false)
    val isLoggedIn: StateFlow<Boolean> = _isLoggedIn.asStateFlow()

    private val _onboardingComplete = MutableStateFlow(false)
    val onboardingComplete: StateFlow<Boolean> = _onboardingComplete.asStateFlow()

    private val _authError = MutableStateFlow<String?>(null)
    val authError: StateFlow<String?> = _authError.asStateFlow()

    private val _authLoading = MutableStateFlow(false)
    val authLoading: StateFlow<Boolean> = _authLoading.asStateFlow()

    private val _accessToken = MutableStateFlow<String?>(null)
    val accessToken: StateFlow<String?> = _accessToken.asStateFlow()

    private val _userId = MutableStateFlow("")
    val userId: StateFlow<String> = _userId.asStateFlow()

    private val _email = MutableStateFlow("")
    val email: StateFlow<String> = _email.asStateFlow()

    private val _phone = MutableStateFlow("")
    val phone: StateFlow<String> = _phone.asStateFlow()

    private val _parentName = MutableStateFlow("Priya")
    val parentName: StateFlow<String> = _parentName.asStateFlow()

    /** Try to restore a previous session from encrypted storage. */
    fun tryRestoreSession(): Boolean {
        return try {
            val storedToken = SecureTokenStore.getAccessToken(app)
            val storedRefresh = SecureTokenStore.getRefreshToken(app)
            val storedUserId = SecureTokenStore.getUserId(app)
            if (storedToken != null && storedUserId != null) {
                _accessToken.value = storedToken
                _userId.value = storedUserId
                _isLoggedIn.value = true
                _onboardingComplete.value = true
                // Try to refresh the token in the background
                scope.launch {
                    val result = SupabaseAuth.refreshToken(storedRefresh ?: "")
                    result.onSuccess { resp ->
                        _accessToken.value = resp.access_token
                        SecureTokenStore.saveTokens(
                            app, resp.access_token,
                            resp.refresh_token, storedUserId
                        )
                    }.onFailure {
                        // Token expired beyond refresh — clear session
                        clearSession()
                    }
                }
                true
            } else false
        } catch (e: Exception) {
            // EncryptedSharedPreferences or Keystore unavailable — gracefully continue
            false
        }
    }

    fun onEmailSignInSuccess(resp: SupabaseAuth.AuthResponse, name: String) {
        _accessToken.value = resp.access_token
        val user = resp.user
        if (user != null) {
            SecureTokenStore.saveTokens(app, resp.access_token, resp.refresh_token, user.id)
            _userId.value = user.id
            _email.value = user.email
            _phone.value = user.phone ?: ""
            _parentName.value = name.ifBlank { user.email.substringBefore('@') }
        }
        _isLoggedIn.value = true
        _onboardingComplete.value = true
        _authLoading.value = false
    }

    fun onPhoneOtpSuccess(resp: SupabaseAuth.AuthResponse, rawPhone: String) {
        _accessToken.value = resp.access_token
        val user = resp.user
        if (user != null) {
            SecureTokenStore.saveTokens(app, resp.access_token, resp.refresh_token, user.id)
            _userId.value = user.id
            _email.value = user.email
            _phone.value = user.phone ?: rawPhone
            _parentName.value = user.user_metadata?.get("name") ?: "Parent"
        }
        _isLoggedIn.value = true
        _onboardingComplete.value = true
        _authLoading.value = false
    }

    fun login(phone: String, name: String = "") {
        _isLoggedIn.value = true
        _phone.value = phone
        if (name.isNotBlank()) _parentName.value = name
    }

    fun completeOnboarding() {
        _onboardingComplete.value = true
    }

    fun logout() {
        scope.launch {
            val token = _accessToken.value
            _accessToken.value = null
            if (token != null) {
                try { SupabaseAuth.signOut(token) } catch (_: Exception) { }
            }
        }
        SecureTokenStore.clear(app)
        _isLoggedIn.value = false
        _onboardingComplete.value = false
        _userId.value = ""
        _email.value = ""
    }

    fun clearSession() {
        SecureTokenStore.clear(app)
        _isLoggedIn.value = false
        _accessToken.value = null
        _userId.value = ""
    }

    fun sendPhoneOtp(phone: String) {
        _authLoading.value = true
        _authError.value = null
        scope.launch {
            SupabaseAuth.sendPhoneOtp("+91$phone").fold(
                onSuccess = { _authLoading.value = false },
                onFailure = { e ->
                    _authError.value = e.message ?: "Failed to send OTP"
                    _authLoading.value = false
                }
            )
        }
    }

    fun verifyPhoneOtp(phone: String, token: String) {
        _authLoading.value = true
        _authError.value = null
        scope.launch {
            SupabaseAuth.verifyPhoneOtp("+91$phone", token).fold(
                onSuccess = { resp -> onPhoneOtpSuccess(resp, phone) },
                onFailure = { e ->
                    _authError.value = e.message ?: "Invalid code"
                    _authLoading.value = false
                }
            )
        }
    }

    fun signInWithEmail(email: String, password: String) {
        _authLoading.value = true
        _authError.value = null
        scope.launch {
            SupabaseAuth.signInWithEmail(email, password).fold(
                onSuccess = { resp -> onEmailSignInSuccess(resp, "") },
                onFailure = { e ->
                    _authError.value = e.message ?: "Sign in failed"
                    _authLoading.value = false
                }
            )
        }
    }

    fun signUpWithEmail(email: String, password: String, name: String) {
        _authLoading.value = true
        _authError.value = null
        scope.launch {
            SupabaseAuth.signUpWithEmail(email, password, name).fold(
                onSuccess = { resp -> onEmailSignInSuccess(resp, name) },
                onFailure = { e ->
                    _authError.value = e.message ?: "Sign up failed"
                    _authLoading.value = false
                }
            )
        }
    }

    fun clearAuthError() { _authError.value = null }
    fun clearAuthLoading() { _authLoading.value = false }

    fun setOnboardingComplete(v: Boolean) { _onboardingComplete.value = v }
}
