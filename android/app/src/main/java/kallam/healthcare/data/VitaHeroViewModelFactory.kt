package kallam.healthcare.data

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
            modelClass.isAssignableFrom(AppViewModel::class.java) || AppViewModel::class.java.isAssignableFrom(modelClass) ->
                AppViewModel(application, container) as T
            modelClass.isAssignableFrom(KidsViewModel::class.java) || KidsViewModel::class.java.isAssignableFrom(modelClass) ->
                KidsViewModel(application, container) as T
            modelClass.isAssignableFrom(CampsViewModel::class.java) || CampsViewModel::class.java.isAssignableFrom(modelClass) ->
                CampsViewModel(application, container) as T
            modelClass.isAssignableFrom(BookingViewModel::class.java) || BookingViewModel::class.java.isAssignableFrom(modelClass) ->
                BookingViewModel(application, container) as T
            modelClass.isAssignableFrom(ProfileViewModel::class.java) || ProfileViewModel::class.java.isAssignableFrom(modelClass) ->
                ProfileViewModel(application, container) as T
            modelClass.isAssignableFrom(GuardianViewModel::class.java) || GuardianViewModel::class.java.isAssignableFrom(modelClass) ->
                GuardianViewModel(application, container) as T
            modelClass.isAssignableFrom(ClinicianViewModel::class.java) || ClinicianViewModel::class.java.isAssignableFrom(modelClass) ->
                ClinicianViewModel(application, container) as T
            modelClass.isAssignableFrom(DieticianViewModel::class.java) || DieticianViewModel::class.java.isAssignableFrom(modelClass) ->
                DieticianViewModel(application, container) as T
            else -> runCatching {
                modelClass.getConstructor(Application::class.java, AppContainer::class.java)
                    .newInstance(application, container)
            }.getOrElse {
                throw IllegalArgumentException("Unknown ViewModel: ${modelClass.name}")
            }
        }
    }
}
