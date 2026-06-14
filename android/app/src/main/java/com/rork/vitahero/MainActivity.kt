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
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.core.content.ContextCompat
import androidx.lifecycle.viewmodel.compose.viewModel
import com.rork.vitahero.data.AppViewModel
import com.rork.vitahero.data.LocalAppLocale
import com.rork.vitahero.data.NotificationScheduler
import com.rork.vitahero.ui.navigation.AppNavigation
import com.rork.vitahero.ui.theme.AppTheme

class MainActivity : ComponentActivity() {

    private val notificationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { /* granted or denied — channels already created */ }

    private val exactAlarmLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { /* User returned from Settings — alarms may now be schedulable */ }

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        NotificationScheduler.createChannels(this)
        super.onCreate(savedInstanceState)

        // Android 13+: Request POST_NOTIFICATIONS at runtime
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED
            ) {
                notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
            }
        }

        // Android 14+: Request SCHEDULE_EXACT_ALARM at runtime
        requestExactAlarmIfNeeded()

        // Handle vitahero://auth deep link (Supabase OTP/OAuth callback)
        handleDeepLink(intent)

        setContent {
            val appViewModel: AppViewModel = viewModel()
            val state by appViewModel.uiState.collectAsState()

            androidx.compose.runtime.CompositionLocalProvider(LocalAppLocale provides state.locale) {
                AppTheme(darkTheme = state.darkTheme) {
                    AppNavigation()
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleDeepLink(intent)
    }

    private fun handleDeepLink(intent: Intent?) {
        val data: Uri? = intent?.data
        if (data != null && data.scheme == "vitahero" && data.host == "auth") {
            // Supabase OAuth/OTP callback — extract tokens from URL fragment or query
            val accessToken = data.getQueryParameter("access_token")
                ?: data.fragment?.split("&")?.firstOrNull { it.startsWith("access_token=") }?.substringAfter("=")
            val refreshToken = data.getQueryParameter("refresh_token")
                ?: data.fragment?.split("&")?.firstOrNull { it.startsWith("refresh_token=") }?.substringAfter("=")

            if (accessToken != null && refreshToken != null) {
                // Tokens will be picked up by AuthManager via AppViewModel
                Toast.makeText(this, "Authentication successful", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun requestExactAlarmIfNeeded() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            val alarmManager = getSystemService(ALARM_SERVICE) as AlarmManager
            if (!alarmManager.canScheduleExactAlarms()) {
                // Direct user to Settings > Apps > VitaHero > Alarms & reminders
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
