package com.rork.vitahero

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.core.content.ContextCompat
import androidx.lifecycle.viewmodel.compose.viewModel
import com.rork.vitahero.data.AppViewModel
import com.rork.vitahero.data.NotificationScheduler
import com.rork.vitahero.ui.navigation.AppNavigation
import com.rork.vitahero.data.LocalAppLocale
import com.rork.vitahero.ui.theme.AppTheme

class MainActivity : ComponentActivity() {

    private val notificationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { /* granted or denied — channels already created, notifs will silently drop if denied */ }

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        NotificationScheduler.createChannels(this)
        super.onCreate(savedInstanceState)

        // Android 13+ requires runtime permission for notifications
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED
            ) {
                notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
            }
        }

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
}
