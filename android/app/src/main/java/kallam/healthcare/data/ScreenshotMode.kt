package kallam.healthcare.data

import android.app.Activity
import android.content.Intent
import android.util.Log
import com.google.firebase.auth.FirebaseAuth
import kallam.healthcare.BuildConfig
import kotlin.system.exitProcess

/**
 * Signs an emulator in without a person at it, so CI can take the Play Store
 * screenshots (.github/workflows/android-screenshots.yml).
 *
 * Only a debug build listens: any app on the phone can send these extras, so
 * a release build ignores them. The number must be one of Firebase's test
 * phone numbers, which take a fixed code and send no SMS; app verification is
 * switched off for the run so the emulator needs no Play Integrity verdict.
 * The values arrive as launch extras from `adb shell am start`, never from the
 * repository.
 */
object ScreenshotMode {
    private const val TAG = "VH_SHOT"

    var phone: String? = null
        private set
    var code: String? = null
        private set

    /** The tab the family app opens on: 0 Home, 1 Kids, 2 Camps, 3 Rewards, 4 Profile. */
    var tab: Int = 0
        private set

    val isOn: Boolean get() = phone != null && code != null

    fun read(intent: Intent?) {
        if (!BuildConfig.DEBUG || intent == null) return
        phone = intent.getStringExtra("vh_shot_phone")?.takeIf { it.isNotBlank() }
        code = intent.getStringExtra("vh_shot_code")?.takeIf { it.isNotBlank() }
        tab = intent.getStringExtra("vh_shot_tab")?.toIntOrNull() ?: 0
        if (isOn) FirebaseAuth.getInstance().firebaseAuthSettings.setAppVerificationDisabledForTesting(true)
    }

    /** Requests the test number's code and verifies it as a parent would. */
    fun signIn(activity: Activity, viewModel: AppViewModel) {
        val phone = phone ?: return
        val code = code ?: return
        if (viewModel.isLoggedIn.value) return
        viewModel.setOnboardingComplete(true)
        FirebaseOtp.requestCode(
            activity,
            "+91$phone",
            onCodeSent = { viewModel.verifyPhoneOtp(phone, code) },
            onAutoVerified = { fail("auto-verified instead of sending a code") },
            onError = { fail(it) },
        )
    }

    /** Logs and quits, so CI stops instead of photographing the sign-in screen. */
    fun fail(message: String) {
        Log.e(TAG, "sign-in failed: $message")
        exitProcess(1)
    }
}
