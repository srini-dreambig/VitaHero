package com.rork.vitahero.data

import android.app.Activity
import com.google.firebase.FirebaseException
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.PhoneAuthCredential
import com.google.firebase.auth.PhoneAuthOptions
import com.google.firebase.auth.PhoneAuthProvider
import java.util.concurrent.TimeUnit
import kotlin.coroutines.resume
import kotlinx.coroutines.suspendCancellableCoroutine

/**
 * Firebase phone OTP. The code is requested and verified on-device via
 * Firebase Auth's Phone provider — Firebase only allows the request to come
 * from the parent's own phone, so no server-side SMS gateway is involved.
 * On success we hand back a Firebase ID token which the backend exchanges
 * for a VitaHero session.
 */
object FirebaseOtp {

    private val auth: FirebaseAuth by lazy { FirebaseAuth.getInstance() }

    private var verificationId: String? = null
    private var resendToken: PhoneAuthProvider.ForceResendingToken? = null

    /** Requests the OTP SMS for [phoneE164] (e.g. "+919876543210"). */
    fun requestCode(
        activity: Activity,
        phoneE164: String,
        onCodeSent: () -> Unit,
        onAutoVerified: (idToken: String) -> Unit,
        onError: (message: String) -> Unit
    ) {
        start(activity, phoneE164, null, onCodeSent, onAutoVerified, onError)
    }

    /** Resends the code using Firebase's force-resending token. */
    fun resendCode(
        activity: Activity,
        phoneE164: String,
        onCodeSent: () -> Unit,
        onAutoVerified: (idToken: String) -> Unit,
        onError: (message: String) -> Unit
    ) {
        start(activity, phoneE164, resendToken, onCodeSent, onAutoVerified, onError)
    }

    private fun start(
        activity: Activity,
        phoneE164: String,
        token: PhoneAuthProvider.ForceResendingToken?,
        onCodeSent: () -> Unit,
        onAutoVerified: (idToken: String) -> Unit,
        onError: (message: String) -> Unit
    ) {
        val builder = PhoneAuthOptions.newBuilder(auth)
            .setPhoneNumber(phoneE164)
            .setTimeout(60L, TimeUnit.SECONDS)
            .setActivity(activity)
            .setCallbacks(object : PhoneAuthProvider.OnVerificationStateChangedCallbacks() {
                override fun onVerificationCompleted(credential: PhoneAuthCredential) {
                    // Auto-verification (e.g. instant validation or SMS
                    // retrieval) — sign in straight away.
                    signIn(credential, onAutoVerified, onError)
                }

                override fun onVerificationFailed(e: FirebaseException) {
                    onError(friendlyError(e))
                }

                override fun onCodeSent(
                    id: String,
                    forceResendingToken: PhoneAuthProvider.ForceResendingToken
                ) {
                    verificationId = id
                    resendToken = forceResendingToken
                    onCodeSent()
                }
            })
        token?.let { builder.setForceResendingToken(it) }
        PhoneAuthProvider.verifyPhoneNumber(builder.build())
    }

    /**
     * Verifies the 6-digit code, signs in with Firebase and resolves the
     * Firebase ID token.
     */
    suspend fun verifyCode(code: String): Result<String> =
        suspendCancellableCoroutine { cont ->
            val id = verificationId
            if (id.isNullOrBlank()) {
                cont.resume(
                    Result.failure(Exception("No verification in progress. Please request a new code."))
                )
                return@suspendCancellableCoroutine
            }
            val credential = PhoneAuthProvider.getCredential(id, code)
            signIn(
                credential,
                onToken = { cont.resume(Result.success(it)) },
                onError = { cont.resume(Result.failure(Exception(it))) }
            )
        }

    private fun signIn(
        credential: PhoneAuthCredential,
        onToken: (String) -> Unit,
        onError: (String) -> Unit
    ) {
        auth.signInWithCredential(credential)
            .addOnCompleteListener { signInTask ->
                val user = signInTask.result?.user
                if (!signInTask.isSuccessful || user == null) {
                    onError(friendlyError(signInTask.exception))
                    return@addOnCompleteListener
                }
                user.getIdToken(true).addOnCompleteListener { tokenTask ->
                    val token = tokenTask.result?.token
                    if (tokenTask.isSuccessful && !token.isNullOrBlank()) {
                        onToken(token)
                    } else {
                        onError(friendlyError(tokenTask.exception))
                    }
                }
            }
    }

    private fun friendlyError(e: Exception?): String {
        val message = e?.localizedMessage?.takeIf { it.isNotBlank() }
        return message ?: "Verification failed. Please try again."
    }
}
