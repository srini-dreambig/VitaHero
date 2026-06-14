package com.rork.vitahero

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.lifecycle.viewmodel.compose.viewModel
import com.rork.vitahero.data.AppViewModel
import com.rork.vitahero.data.NotificationScheduler
import com.rork.vitahero.ui.navigation.AppNavigation
import com.rork.vitahero.ui.theme.AppTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        NotificationScheduler.createChannels(this)
        super.onCreate(savedInstanceState)
        setContent {
            val appViewModel: AppViewModel = viewModel()
            val state by appViewModel.uiState.collectAsState()
            AppTheme(darkTheme = state.darkTheme) {
                AppNavigation()
            }
        }
    }
}
