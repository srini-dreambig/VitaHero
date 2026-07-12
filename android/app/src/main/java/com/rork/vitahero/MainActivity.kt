package com.rork.vitahero

import android.Manifest
import android.app.AlarmManager
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.core.content.ContextCompat
import androidx.health.connect.client.PermissionController
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.viewmodel.compose.viewModel
import com.google.firebase.FirebaseException
import com.google.firebase.auth.PhoneAuthCredential
import com.google.firebase.auth.PhoneAuthOptions
import com.google.firebase.auth.PhoneAuthProvider
import com.rork.vitahero.data.ApiRepositoryProvider
import com.rork.vitahero.data.AppViewModel
import com.rork.vitahero.data.HealthConnectPermissions
import com.rork.vitahero.data.KidsViewModel
import com.rork.vitahero.data.LocalAppLocale
import com.rork.vitahero.data.NotificationScheduler
import com.rork.vitahero.data.VitaHeroViewModelFactory
import com.rork.vitahero.ui.navigation.AppNavigation
import com.rork.vitahero.ui.theme.AppTheme
import kotlinx.coroutines.launch
import java.util.concurrent.TimeUnit

class MainActivity : ComponentActivity() {

    private val notificationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { }

    private val exactAlarmLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { }

    private val healthConnectPermissionLauncher = registerForActivityResult(
        PermissionController.createRequestPermissionResultContract()
    ) { granted ->
        if (granted.containsAll(HealthConnectPermissions.permissions)) {
            kidsViewModel.onHealthConnectPermissionsGranted()
        }
    }

    private lateinit var appViewModel: AppViewModel
    private lateinit var kidsViewModel: KidsViewModel

    private val invitePhoneState = mutableStateOf("")

    private var resendToken: PhoneAuthProvider.ForceResendingToken? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        NotificationScheduler.createChannels(this)
        handleInviteDeepLink(intent)

        setContent {
            val app = application as VitaHeroApplication
            val factory = remember { VitaHeroViewModelFactory(app, app.appContainer) }
            appViewModel = viewModel(factory = factory)
            kidsViewModel = viewModel(factory = factory)

            kidsViewModel.setHealthConnectRequestHandler {
                healthConnectPermissionLauncher.launch(HealthConnectPermissions.permissions)
            }

            val state by appViewModel.uiState.collectAsState()
            val isLoggedIn by appViewModel.isLoggedIn.collectAsState()
            val syncMessage by appViewModel.syncMessage.collectAsState()
            val snackbarHostState = remember { SnackbarHostState() }

            LaunchedEffect(isLoggedIn) {
                if (isLoggedIn) {
                    requestExactAlarmIfNeeded()
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                        if (ContextCompat.checkSelfPermission(
                                this@MainActivity,
                                Manifest.permission.POST_NOTIFICATIONS,
                            ) != PackageManager.PERMISSION_GRANTED
                        ) {
                            notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                        }
                    }
                }
            }

            LaunchedEffect(syncMessage) {
                syncMessage?.let { msg ->
                    snackbarHostState.showSnackbar(msg)
                    appViewModel.clearSyncMessage()
                }
            }

            CompositionLocalProvider(LocalAppLocale provides state.locale) {
                AppTheme(darkTheme = state.darkTheme) {
                    Scaffold(snackbarHost = { SnackbarHost(snackbarHostState) }) { _ ->
                        AppNavigation(
                            onSendPhoneOtp = { phone ->
                                preVerifyAndStartOtp(phone)
                            },
                            onResendOtp = { phone ->
                                resendFirebasePhoneVerification(phone)
                            },
                            invitePhone = invitePhoneState.value,
                        )
                    }
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleInviteDeepLink(intent)
    }

    private fun handleInviteDeepLink(intent: Intent?) {
        val data = intent?.data ?: return
        val token = when {
            data.scheme == "vitahero" -> data.getQueryParameter("token")
            data.path?.startsWith("/i/") == true -> data.lastPathSegment
            else -> null
        }
        if (token.isNullOrBlank()) return
        lifecycleScope.launch {
            val phone = runCatching { ApiRepositoryProvider.repository.resolveInvite(token) }.getOrNull()
            if (!phone.isNullOrBlank()) invitePhoneState.value = phone
        }
    }

    // ─── Firebase Phone Auth ───────────────────────────────────

    private val phoneCallbacks = object : PhoneAuthProvider.OnVerificationStateChangedCallbacks() {
        override fun onVerificationCompleted(credential: PhoneAuthCredential) {
            android.util.Log.d("VitaHeroAuth", "onVerificationCompleted (auto-verified)")
            appViewModel.setOtpSending(false)
            appViewModel.setAuthLoading(false)
            appViewModel.signInWithCredential(credential)
        }

        override fun onVerificationFailed(e: FirebaseException) {
            android.util.Log.e("VitaHeroAuth", "onVerificationFailed: ${e.message}", e)
            appViewModel.setOtpSending(false)
            appViewModel.setAuthLoading(false)
            val rawMsg = e.message ?: "Verification failed"
            val msg = when {
                rawMsg.contains("NETWORK", ignoreCase = true) ->
                    "Network error. Check your internet connection and try again."
                rawMsg.contains("quota", ignoreCase = true) ->
                    "SMS quota exceeded. Please try again later."
                rawMsg.contains("INVALID_PHONE", ignoreCase = true) ->
                    "Invalid phone number. Please check and try again."
                rawMsg.contains("TOO_SHORT", ignoreCase = true) ->
                    "Phone number is too short. Please enter a valid 10-digit number."
                rawMsg.contains("credential-manager", ignoreCase = true) ||
                rawMsg.contains("PLAY_SERVICES", ignoreCase = true) ->
                    "Google Play Services required for OTP verification."
                rawMsg.contains("MISSING_MFA_ENROLLMENT", ignoreCase = true) ||
                rawMsg.contains("CAPTCHA", ignoreCase = true) ->
                    "Verification blocked by reCAPTCHA. Please try again."
                rawMsg.contains("OPERATION_NOT_ALLOWED", ignoreCase = true) ->
                    "Phone Auth is not enabled in Firebase Console. Please enable it."
                rawMsg.contains("BILLING", ignoreCase = true) ->
                    "Firebase billing issue: $rawMsg"
                else -> "Verification failed: $rawMsg"
            }
            appViewModel.setAuthError(msg)
        }

        override fun onCodeSent(
            verificationId: String,
            token: PhoneAuthProvider.ForceResendingToken,
        ) {
            super.onCodeSent(verificationId, token)
            android.util.Log.d("VitaHeroAuth", "onCodeSent: verificationId received")
            resendToken = token
            appViewModel.setOtpSending(false)
            appViewModel.setAuthLoading(false)
            appViewModel.setVerificationId(verificationId)
        }
    }

    private fun preVerifyAndStartOtp(phone: String) {
        val formatted = if (phone.startsWith("+")) phone else "+91$phone"
        android.util.Log.d("VitaHeroAuth", "Pre-verifying phone: $formatted")
        appViewModel.setAuthError(null)
        appViewModel.setAuthLoading(true)
        appViewModel.setOtpSending(true)

        lifecycleScope.launch {
            val result = appViewModel.verifyPhoneForLogin(formatted)
            if (!result.valid) {
                android.util.Log.d("VitaHeroAuth", "Phone pre-verification denied: ${result.error}")
                appViewModel.setAuthLoading(false)
                appViewModel.setOtpSending(false)
                appViewModel.setAuthError(result.error ?: "This phone number is not registered. Please contact your administrator.")
                return@launch
            }
            android.util.Log.d("VitaHeroAuth", "Phone pre-verified. isDoctor=${result.isDoctor}, screens=${result.allowedScreens}")
            startFirebasePhoneVerification(phone)
        }
    }

    private fun startFirebasePhoneVerification(phone: String) {
        val formatted = if (phone.startsWith("+")) phone else "+91$phone"
        android.util.Log.d("VitaHeroAuth", "Starting Phone verification for: $formatted")
        appViewModel.setAuthError(null)
        appViewModel.setAuthLoading(true)
        appViewModel.setOtpSending(true)
        val options = PhoneAuthOptions.newBuilder()
            .setPhoneNumber(formatted)
            .setTimeout(60L, TimeUnit.SECONDS)
            .setActivity(this)
            .setCallbacks(phoneCallbacks)
            .build()
        PhoneAuthProvider.verifyPhoneNumber(options)
    }

    private fun resendFirebasePhoneVerification(phone: String) {
        val formatted = if (phone.startsWith("+")) phone else "+91$phone"
        android.util.Log.d("VitaHeroAuth", "Resending Phone verification for: $formatted")
        appViewModel.setAuthError(null)
        appViewModel.setOtpSending(true)
        val builder = PhoneAuthOptions.newBuilder()
            .setPhoneNumber(formatted)
            .setTimeout(60L, TimeUnit.SECONDS)
            .setActivity(this)
            .setCallbacks(phoneCallbacks)
        resendToken?.let { builder.setForceResendingToken(it) }
        PhoneAuthProvider.verifyPhoneNumber(builder.build())
    }

    private fun requestExactAlarmIfNeeded() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val alarmManager = getSystemService(ALARM_SERVICE) as AlarmManager
            if (!alarmManager.canScheduleExactAlarms()) {
                Toast.makeText(
                    this,
                    "VitaHero needs exact alarm permission for reminders. Please enable it in Settings.",
                    Toast.LENGTH_LONG
                ).show()
                val intent = Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM).apply {
                    data = Uri.parse("package:$packageName")
                }
                exactAlarmLauncher.launch(intent)
            }
        }
    }
}
