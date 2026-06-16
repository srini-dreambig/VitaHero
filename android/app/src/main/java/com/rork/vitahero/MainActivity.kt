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
import androidx.compose.runtime.remember
import androidx.core.content.ContextCompat
import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.credentials.GetCredentialResponse
import androidx.credentials.exceptions.GetCredentialException
import androidx.credentials.exceptions.NoCredentialException
import androidx.health.connect.client.PermissionController
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.viewmodel.compose.viewModel
import com.google.android.libraries.identity.googleid.GetGoogleIdOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import com.google.android.libraries.identity.googleid.GoogleIdTokenParsingException
import com.rork.vitahero.data.AppViewModel
import com.rork.vitahero.data.HealthConnectPermissions
import com.rork.vitahero.data.KidsViewModel
import com.rork.vitahero.data.LocalAppLocale
import com.rork.vitahero.data.NotificationScheduler
import com.rork.vitahero.data.VitaHeroViewModelFactory
import com.rork.vitahero.ui.navigation.AppNavigation
import com.rork.vitahero.ui.theme.AppTheme
import kotlinx.coroutines.launch
import java.security.MessageDigest
import java.util.UUID

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

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        NotificationScheduler.createChannels(this)

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
                            onGoogleSignInRequest = { launchGoogleSignIn() }
                        )
                    }
                }
            }
        }
    }

    private fun launchGoogleSignIn() {
        val webClientId = BuildConfig.GOOGLE_WEB_CLIENT_ID
        if (webClientId.isBlank()) {
            Toast.makeText(this, "Google Sign-In is not configured. Add GOOGLE_WEB_CLIENT_ID.", Toast.LENGTH_LONG).show()
            return
        }

        val credentialManager = CredentialManager.create(this)
        val rawNonce = UUID.randomUUID().toString()
        val digest = MessageDigest.getInstance("SHA-256").digest(rawNonce.toByteArray())
        val hashedNonce = digest.fold("") { str, it -> str + "%02x".format(it) }

        val googleIdOption = GetGoogleIdOption.Builder()
            .setServerClientId(webClientId)
            .setFilterByAuthorizedAccounts(false)
            .setAutoSelectEnabled(true)
            .setNonce(hashedNonce)
            .build()

        val request = GetCredentialRequest.Builder()
            .addCredentialOption(googleIdOption)
            .build()

        lifecycleScope.launch {
            try {
                val result = credentialManager.getCredential(
                    request = request,
                    context = this@MainActivity,
                )
                handleGoogleSignInResult(result)
            } catch (_: NoCredentialException) {
                Toast.makeText(this@MainActivity, "No Google accounts found. Try phone sign-in.", Toast.LENGTH_SHORT).show()
            } catch (e: GetCredentialException) {
                Toast.makeText(this@MainActivity, "Google Sign-In failed: ${e.message}", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun handleGoogleSignInResult(result: GetCredentialResponse) {
        val credential = result.credential
        if (credential is CustomCredential &&
            credential.type == GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL
        ) {
            try {
                val googleIdTokenCredential = GoogleIdTokenCredential.createFrom(credential.data)
                appViewModel.signInWithGoogle(googleIdTokenCredential.idToken)
            } catch (_: GoogleIdTokenParsingException) {
                Toast.makeText(this, "Failed to parse Google ID token", Toast.LENGTH_SHORT).show()
            }
        } else {
            Toast.makeText(this, "Unexpected credential type", Toast.LENGTH_SHORT).show()
        }
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
