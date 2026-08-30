package com.rork.vitahero.data

import android.app.Application
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider

class VitaHeroViewModelFactory(
    private val application: Application,
    private val container: AppContainer,
) : ViewModelProvider.Factory {

    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        return when {
            modelClass.isAssignableFrom(AppViewModel::class.java) ->
                AppViewModel(application, container) as T
            modelClass.isAssignableFrom(KidsViewModel::class.java) ->
                KidsViewModel(application, container) as T
            modelClass.isAssignableFrom(CampsViewModel::class.java) ->
                CampsViewModel(application, container) as T
            modelClass.isAssignableFrom(BookingViewModel::class.java) ->
                BookingViewModel(application, container) as T
            modelClass.isAssignableFrom(ProfileViewModel::class.java) ->
                ProfileViewModel(application, container) as T
            modelClass.isAssignableFrom(GuardianViewModel::class.java) ->
                GuardianViewModel(application, container) as T
            else -> throw IllegalArgumentException("Unknown ViewModel: ${modelClass.name}")
        }
    }
}
