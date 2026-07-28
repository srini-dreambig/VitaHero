package com.rork.vitahero.data

import android.app.Application
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseUser
import com.google.firebase.auth.PhoneAuthCredential
import com.google.firebase.auth.PhoneAuthProvider
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.SetOptions
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext

/**
 * Manages authentication state using Firebase Phone Auth.
 * Session is managed by Firebase Auth SDK — no custom session tokens.
 * Profile data lives in Firestore (profiles/{uid}).
 *
 * The Activity calls PhoneAuthProvider.verifyPhoneNumber() directly with Firebase callbacks.
 * This class handles:
 *  - Storing the verificationId from the Activity's callbacks
 *  - Verifying the OTP code (signInWithCredential)
 *  - Creating/updating the user's Firestore profile after auth
 *  - Restoring sessions from Firebase Auth's persisted state
 */
class AuthManager(private val app: Application) {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private val fbAuth: FirebaseAuth get() = FirebaseAuth.getInstance()
    private val db: FirebaseFirestore get() = FirebaseFirestore.getInstance()

    private val _isLoggedIn = MutableStateFlow(false)
    val isLoggedIn: StateFlow<Boolean> = _isLoggedIn.asStateFlow()

    private val _onboardingComplete = MutableStateFlow(false)
    val onboardingComplete: StateFlow<Boolean> = _onboardingComplete.asStateFlow()

    init {
        scope.launch(Dispatchers.IO) {
            _onboardingComplete.value = SessionStore.isOnboardingComplete(app)
        }
        // Listen for server-side sign-out, token revocation, or account deletion.
        // Firebase Auth invokes this callback on cold start and whenever auth state changes.
        fbAuth.addAuthStateListener { auth ->
            val user = auth.currentUser
            if (user == null && _isLoggedIn.value) {
                // Session was revoked or user was signed out remotely — clear local state
                android.util.Log.d("VitaHeroAuth", "AuthStateListener: user signed out remotely")
                clearLocalSessionState()
            }
        }
    }

    private val _authError = MutableStateFlow<String?>(null)
    val authError: StateFlow<String?> = _authError.asStateFlow()

    private val _authLoading = MutableStateFlow(false)
    val authLoading: StateFlow<Boolean> = _authLoading.asStateFlow()

    /** Verification ID from Firebase Phone Auth — set by the Activity's callbacks. */
    private val _verificationId = MutableStateFlow("")
    val verificationId: StateFlow<String> = _verificationId.asStateFlow()

    /** Whether an OTP is currently being sent (Phone Auth verification in progress). */
    private val _otpSending = MutableStateFlow(false)
    val otpSending: StateFlow<Boolean> = _otpSending.asStateFlow()

    /** Firebase Auth UID — the primary user identifier. */
    private val _uid = MutableStateFlow("")
    val uid: StateFlow<String> = _uid.asStateFlow()

    /** Profile PK (same as UID in Firestore). */
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

    private val _role = MutableStateFlow("PARENT")
    val role: StateFlow<String> = _role.asStateFlow()

    /** Screens the doctor is allowed to access (from admin panel). */
    private val _allowedScreens = MutableStateFlow<List<String>>(emptyList())
    val allowedScreens: StateFlow<List<String>> = _allowedScreens.asStateFlow()

    /** Doctor name from admin panel (pre-verified). */
    private val _doctorName = MutableStateFlow("")
    val doctorName: StateFlow<String> = _doctorName.asStateFlow()

    /** Doctor specialty from admin panel — controls which form sections are visible. */
    private val _doctorSpecialty = MutableStateFlow("")
    val doctorSpecialty: StateFlow<String> = _doctorSpecialty.asStateFlow()

    /** Whether the current login is a pre-verified doctor. */
    private val _isDoctor = MutableStateFlow(false)
    val isDoctor: StateFlow<Boolean> = _isDoctor.asStateFlow()

    /** Kept for compatibility — Firebase manages the real session token internally. */
    private val _sessionToken = MutableStateFlow<String?>(null)
    val sessionToken: StateFlow<String?> = _sessionToken.asStateFlow()

    /** Dev OTP placeholder (not used in production Firebase Auth). */
    private val _devOtp = MutableStateFlow<String?>(null)
    val devOtp: StateFlow<String?> = _devOtp.asStateFlow()

    /** Set the verification ID from the Activity's PhoneAuthProvider callbacks. */
    fun setVerificationId(id: String) {
        _verificationId.value = id
    }

    /**
     * Verify the OTP code entered by the user.
     * Uses the stored verificationId + code to create a credential and sign in.
     */
    fun verifyPhoneOtp(verificationId: String, code: String) {
        _authLoading.value = true
        _authError.value = null
        scope.launch {
            try {
                val credential = PhoneAuthProvider.getCredential(verificationId, code)
                val authResult = fbAuth.signInWithCredential(credential).await()
                val user = authResult.user
                if (user != null) {
                    onFirebaseAuthSuccess(user)
                } else {
                    _authError.value = "Sign-in failed. Please try again."
                    _authLoading.value = false
                }
            } catch (e: Exception) {
                val msg = when {
                    e.message?.contains("invalid-verification-code") == true -> "Invalid OTP. Please check and try again."
                    e.message?.contains("session-expired") == true -> "OTP expired. Please request a new one."
                    else -> e.message ?: "Verification failed"
                }
                _authError.value = msg
                _authLoading.value = false
            }
        }
    }

    /** Sign in with a credential (used for auto-verification). */
    fun signInWithCredential(credential: PhoneAuthCredential) {
        _authLoading.value = true
        _authError.value = null
        scope.launch {
            try {
                val authResult = fbAuth.signInWithCredential(credential).await()
                val user = authResult.user
                if (user != null) {
                    onFirebaseAuthSuccess(user)
                } else {
                    _authError.value = "Sign-in failed. Please try again."
                    _authLoading.value = false
                }
            } catch (e: Exception) {
                _authError.value = e.message ?: "Sign-in failed"
                _authLoading.value = false
            }
        }
    }

    /**
     * Called after Firebase Auth succeeds. Creates/updates the user's profile in Firestore.
     * Also resolves admin-provisioned data (imported kids, school enrollment) by phone number.
     */
    private suspend fun onFirebaseAuthSuccess(user: FirebaseUser) {
        val uid = user.uid
        val phone = user.phoneNumber ?: ""

        val profileData = mutableMapOf<String, Any>(
            "id" to uid,
            "user_id" to uid,
            "phone" to phone,
            "is_logged_in" to true,
            "auth_provider" to "PHONE",
        )

        // Check if profile already exists
        val profileSnap = db.collection("profiles").document(uid).get().await()
        if (!profileSnap.exists()) {
            // If this was pre-verified as a doctor, set role=DOCTOR
            val initialRole = if (_isDoctor.value) "DOCTOR" else "PARENT"
            val initialName = if (_isDoctor.value && _doctorName.value.isNotBlank()) _doctorName.value else "Parent"
            profileData["name"] = initialName
            profileData["role"] = initialRole
            profileData["onboarding_complete"] = false
            profileData["dark_theme"] = false
            profileData["locale_code"] = "en"
            profileData["notifications_enabled"] = true
            profileData["camp_reminders_enabled"] = true
            profileData["consent_accepted"] = false
            profileData["consent_declined"] = false
            if (_isDoctor.value) {
                profileData["allowed_screens"] = _allowedScreens.value
                profileData["doctor_specialty"] = _doctorSpecialty.value
            }
            db.collection("profiles").document(uid).set(profileData).await()
        } else {
            // Role is always re-derived from the fresh backend pre-verification
            // (doctor_assignments / provisioned_parents) on every login, so a
            // doctor whose assignment was revoked is correctly downgraded back
            // to PARENT instead of keeping a stale DOCTOR role forever.
            val finalRole = if (_isDoctor.value) "DOCTOR" else "PARENT"
            profileData["role"] = finalRole
            if (_isDoctor.value) {
                profileData["allowed_screens"] = _allowedScreens.value
                profileData["doctor_specialty"] = _doctorSpecialty.value
                // Update name if doctor name is available and profile name is default
                val existingName = profileSnap.getString("name") ?: ""
                if (existingName.isBlank() || existingName == "Parent") {
                    profileData["name"] = _doctorName.value
                }
            } else {
                // Clear stale doctor-only fields if this account was previously a doctor
                profileData["allowed_screens"] = emptyList<String>()
                profileData["doctor_specialty"] = ""
            }
            db.collection("profiles").document(uid).set(profileData, SetOptions.merge()).await()
        }

        // Resolve admin-provisioned data (imported kids, school enrollment) by phone number
        if (phone.isNotBlank()) {
            try {
                val repo = FirestoreRepository(app)
                repo.resolveProvisionedData(phone)
            } catch (_: Exception) { }
        }

        // Fetch the full profile
        val fullProfile = db.collection("profiles").document(uid).get().await()
        val name = fullProfile.getString("name") ?: "Parent"
        val role = fullProfile.getString("role") ?: "PARENT"
        val email = fullProfile.getString("email") ?: ""
        val onboardingDone = fullProfile.getBoolean("onboarding_complete") ?: false

        withContext(Dispatchers.Main) {
            _uid.value = uid
            _profileId.value = uid
            _userId.value = uid
            _phone.value = phone
            _email.value = email
            _parentName.value = name
            _role.value = role
            _isLoggedIn.value = true
            _onboardingComplete.value = onboardingDone || SessionStore.isOnboardingComplete(app)
            _authLoading.value = false
            try {
                val token = user.getIdToken(false).await().token
                _sessionToken.value = token
                ApiService.sessionToken = token
            } catch (_: Exception) { }
        }
    }

    /**
     * Try to restore the session from Firebase Auth's persisted state.
     * If the Firebase user exists but their Firestore profile was deleted (admin action),
     * signs out the orphaned Firebase session and returns false.
     */
    suspend fun tryRestoreSession(): Boolean = withContext(Dispatchers.IO) {
        val user = fbAuth.currentUser ?: return@withContext false
        try {
            val tokenResult = user.getIdToken(false).await()
            val token = tokenResult.token
            if (token != null) {
                ApiService.sessionToken = token
                _sessionToken.value = token
            }

            val uid = user.uid
            val profileSnap = db.collection("profiles").document(uid).get().await()
            if (!profileSnap.exists()) {
                // Profile was deleted (admin action) — sign out the orphaned session
                android.util.Log.d("VitaHeroAuth", "tryRestoreSession: profile missing, signing out orphaned session")
                fbAuth.signOut()
                clearLocalSessionState()
                return@withContext false
            }

            val name = profileSnap.getString("name") ?: "Parent"
            val role = profileSnap.getString("role") ?: "PARENT"
            val phone = profileSnap.getString("phone") ?: user.phoneNumber ?: ""
            val email = profileSnap.getString("email") ?: ""
            val onboardingDone = profileSnap.getBoolean("onboarding_complete") ?: false
            // Restore doctor allowed screens if present
            val restoredScreens = (profileSnap.get("allowed_screens") as? List<*>)?.filterIsInstance<String>() ?: emptyList()
            val restoredSpecialty = profileSnap.getString("doctor_specialty") ?: ""
            if (restoredScreens.isNotEmpty()) {
                _allowedScreens.value = restoredScreens
                _isDoctor.value = role == "DOCTOR"
                _doctorName.value = name
                _doctorSpecialty.value = restoredSpecialty
            }

            withContext(Dispatchers.Main) {
                _uid.value = uid
                _profileId.value = uid
                _userId.value = uid
                _phone.value = phone
                _email.value = email
                _parentName.value = name
                _role.value = role
                _isLoggedIn.value = true
                _onboardingComplete.value = onboardingDone || SessionStore.isOnboardingComplete(app)
            }
            true
        } catch (_: Exception) {
            false
        }
    }

    fun completeOnboarding() {
        _onboardingComplete.value = true
        SessionStore.setOnboardingComplete(app, true)
        scope.launch(Dispatchers.IO) {
            try {
                val uid = fbAuth.currentUser?.uid ?: return@launch
                db.collection("profiles").document(uid)
                    .set(mapOf("onboarding_complete" to true), SetOptions.merge()).await()
            } catch (_: Exception) { }
        }
    }

    fun logout() {
        scope.launch {
            try {
                val uid = fbAuth.currentUser?.uid
                if (uid != null) {
                    db.collection("profiles").document(uid)
                        .set(mapOf("is_logged_in" to false), SetOptions.merge()).await()
                }
            } catch (_: Exception) { }
            fbAuth.signOut()
            // Clear Firestore persistence cache so a different parent's data
            // doesn't flash briefly on the next sign-in
            try { db.clearPersistence() } catch (_: Exception) { }
        }
        SessionStore.clearToken(app)
        _sessionToken.value = null
        ApiService.clearSession()
        clearLocalSessionState()
    }

    fun clearSession() {
        fbAuth.signOut()
        try { db.clearPersistence() } catch (_: Exception) { }
        SessionStore.clearToken(app)
        _sessionToken.value = null
        ApiService.clearSession()
        clearLocalSessionState()
    }

    /** Clears all local auth state fields (does not sign out Firebase). */
    private fun clearLocalSessionState() {
        _isLoggedIn.value = false
        _uid.value = ""
        _profileId.value = ""
        _userId.value = ""
        _email.value = ""
        _phone.value = ""
        _role.value = "PARENT"
        _allowedScreens.value = emptyList()
        _doctorName.value = ""
        _doctorSpecialty.value = ""
        _isDoctor.value = false
        _verificationId.value = ""
    }

    /** Set doctor pre-verification info (from phone pre-check before OTP). */
    fun setDoctorVerification(isDoctor: Boolean, doctorName: String, specialty: String, allowedScreens: List<String>) {
        _isDoctor.value = isDoctor
        _doctorName.value = doctorName
        _doctorSpecialty.value = specialty
        _allowedScreens.value = allowedScreens
    }

    /** Check if a screen is allowed for the current doctor. */
    fun isScreenAllowed(screen: String): Boolean {
        val screens = _allowedScreens.value
        if (screens.isEmpty()) return true // No restriction set
        return screens.contains(screen)
    }

    fun clearAuthError() { _authError.value = null }
    fun clearAuthLoading() { _authLoading.value = false }
    fun clearDevOtp() { _devOtp.value = null }

    /** Set loading state — used by Activity when starting Phone Auth verification. */
    fun setAuthLoading(loading: Boolean) { _authLoading.value = loading }

    /** Set an auth error message — used by Activity when Phone Auth fails. */
    fun setAuthError(msg: String?) { _authError.value = msg }

    /** Set OTP sending state — used by Activity when starting/resending Phone Auth. */
    fun setOtpSending(sending: Boolean) { _otpSending.value = sending }

    /** Clear the verification ID (e.g. when going back from OTP screen). */
    fun clearVerificationId() { _verificationId.value = "" }
    fun setOnboardingComplete(v: Boolean) {
        _onboardingComplete.value = v
        SessionStore.setOnboardingComplete(app, v)
    }

    fun onDestroy() {
        scope.cancel()
    }
}
