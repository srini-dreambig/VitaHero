package kallam.healthcare.data

import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.viewmodel.compose.viewModel
import kallam.healthcare.VitaHeroApplication

data class VitaHeroViewModels(
    val app: AppViewModel,
    val kids: KidsViewModel,
    val camps: CampsViewModel,
    val booking: BookingViewModel,
    val profile: ProfileViewModel,
    val guardian: GuardianViewModel,
    /** Only ever used when the signed-in person is a clinician. */
    val clinician: ClinicianViewModel,
    /** Only ever used when the signed-in person is a dietician. */
    val dietician: DieticianViewModel,
)

@Composable
fun rememberVitaHeroViewModels(): VitaHeroViewModels {
    val application = LocalContext.current.applicationContext as VitaHeroApplication
    val factory = remember(application) {
        VitaHeroViewModelFactory(application, application.appContainer)
    }
    return VitaHeroViewModels(
        app = viewModel(factory = factory),
        kids = viewModel(factory = factory),
        camps = viewModel(factory = factory),
        booking = viewModel(factory = factory),
        profile = viewModel(factory = factory),
        guardian = viewModel(factory = factory),
        clinician = viewModel(factory = factory),
        dietician = viewModel(factory = factory),
    )
}
