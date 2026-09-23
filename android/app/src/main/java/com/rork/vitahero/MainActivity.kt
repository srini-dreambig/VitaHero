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
import com.rork.vitahero.data.ApiRepositoryProvider
import com.rork.vitahero.data.AppViewModel
import com.rork.vitahero.data.HealthConnectPermissions
import com.rork.vitahero.data.KidsViewModel
import com.rork.vitahero.data.LocalAppLocale
import com.rork.vitahero.data.NotificationScheduler
import com.rork.vitahero.data.VitaHeroViewModelFactory
import com.rork.vitahero.ui.components.selectAsState
import com.rork.vitahero.ui.navigation.AppNavigation
import com.rork.vitahero.ui.theme.AppTheme
import kotlinx.coroutines.launch

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

    // Phone resolved from an invite deep link (SMS), used to prefill the sign-in screen.
    private val invitePhoneState = mutableStateOf("")

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

            // The root of the app. It needs the language and the theme and nothing else,
            // but it used to collect all thirty fields of AppUiState — so logging a meal
            // or syncing a watch invalidated the scope that holds the entire app.
            val darkTheme by appViewModel.uiState.selectAsState { it.darkTheme }
            val locale by appViewModel.uiState.selectAsState { it.locale }
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

            CompositionLocalProvider(LocalAppLocale provides locale) {
                AppTheme(darkTheme = darkTheme) {
                    Scaffold(snackbarHost = { SnackbarHost(snackbarHostState) }) { _ ->
                        AppNavigation(
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

    /**
     * Handles invite links from the SMS landing page:
     *  - custom scheme: vitahero://invite?token=...
     *  - app link:      https://<host>/i/<token>
     * Resolves the token to the registered phone and prefills the sign-in screen.
     */
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
