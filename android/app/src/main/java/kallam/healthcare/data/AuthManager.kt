package kallam.healthcare.data

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

    /**
     * The language to write errors in, kept in step by [AppViewModel].
     *
     * Every message here used to be resolved against English regardless of
     * what the parent had chosen, because this class has no view of app state.
     * A parent reading the app in Telugu should not be told in English that
     * they have been signed out.
     */
    @Volatile
    var locale: AppLocale = AppLocale.ENGLISH

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

    /**
     * Which product this sign-in opens: PARENT, PHYSICIAN or SCREENER.
     *
     * Seeded from disk rather than from a default, so a doctor reopening the
     * app goes straight to their camps instead of watching the family home
     * screen for as long as a school's wifi takes to answer /auth/me. It is a
     * hint for drawing the right screen and never a permission — every
     * clinician endpoint is scoped by the session on the server.
     */
    private val _role = MutableStateFlow(SessionStore.role(app))
    val role: StateFlow<String> = _role.asStateFlow()

    /** The school a staff sign-in belongs to, or "" for a parent. */
    private val _schoolId = MutableStateFlow("")
    val schoolId: StateFlow<String> = _schoolId.asStateFlow()

    init {
        // One place decides what a rejected token means. Every read in the app
        // reports one here; before this, none of them did, and an ended session
        // simply looked to a parent like a family with no records.
        SessionSignals.onSessionEnded = {
            scope.launch { if (_isLoggedIn.value) endSession() }
        }
    }

    /**
     * Pick up the stored session on launch.
     *
     * This used to throw the token away whenever `/api/auth/me` came back
     * null, which it does for a rejected token *and* for a server it could not
     * reach. So opening the app on a bad connection signed the parent out, and
     * the next launch — now with no token at all — showed an empty app. Only a
     * rejection clears the token now; anything else leaves it alone and says
     * the server is unreachable.
     */
    suspend fun tryRestoreSession(): Boolean = withContext(Dispatchers.IO) {
        val token = SessionStore.getToken(app) ?: return@withContext false
        ApiService.sessionToken = token
        when (val outcome = api.fetchMyProfileOutcome()) {
            is RestoreOutcome.Ok -> {
                SessionSignals.reset()
                withContext(Dispatchers.Main) {
                    applyProfile(outcome.profile, token)
                    _isLoggedIn.value = true
                    _onboardingComplete.value =
                        outcome.profile.onboardingComplete || SessionStore.isOnboardingComplete(app)
                }
                true
            }
            RestoreOutcome.Rejected -> {
                withContext(Dispatchers.Main) { endSession() }
                false
            }
            RestoreOutcome.Unreachable -> {
                // Keep the token. The parent stays signed in and the app says
                // it cannot reach the server, which is the truth and is also
                // recoverable without anyone typing a code from an SMS.
                SessionSignals.noteUnreachable()
                false
            }
        }
    }

    /**
     * End the session because the server rejected it, not because anyone asked.
     *
     * Wired to [SessionSignals] in `init`, so a 401 from any screen lands here
     * once rather than each screen inventing its own handling — or, as before,
     * no screen handling it at all and the app drawing itself empty.
     */
    private fun endSession() {
        SessionStore.clearToken(app)
        _sessionToken.value = null
        ApiService.clearSession()
        _isLoggedIn.value = false
        _profileId.value = ""
        _userId.value = ""
        _email.value = ""
        _phone.value = ""
        _authError.value = tr(S.authSessionEnded, locale)
    }




    private fun onAuthSuccess(resp: PhoneAuthResponse) {
        SessionSignals.reset()
        val token = resp.token
        val profile = resp.profile
        if (profile != null && token.isNotBlank()) {
            SessionStore.saveToken(app, token)
            applyAuthProfile(profile, token)
            _isLoggedIn.value = true
            _onboardingComplete.value = true
            SessionStore.setOnboardingComplete(app, true)
        } else {
            _authError.value = tr(S.authMissingToken, locale)
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
        // Kept on disk beside the token so the next launch draws the right
        // home screen before anything is asked of the network.
        val role = profile.role.ifBlank { "PARENT" }
        _role.value = role
        _schoolId.value = profile.school_id ?: ""
        SessionStore.saveRole(app, role)
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
                    _authError.value = e.message ?: tr(S.authOtpInvalid, locale)
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
                    _authError.value = e.message ?: tr(S.authOtpInvalid, locale)
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
        SessionSignals.reset()
        SessionStore.clearToken(app)
        _sessionToken.value = null
        ApiService.clearSession()
        _isLoggedIn.value = false
        _profileId.value = ""
        _userId.value = ""
        _email.value = ""
        _phone.value = ""
        // A shared phone in a school office: the next person to open this must
        // not land in the product the last one was using.
        _role.value = "PARENT"
        _schoolId.value = ""
        SessionStore.saveRole(app, "PARENT")
    }

    fun clearSession() {
        SessionSignals.reset()
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
