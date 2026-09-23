package kallam.healthcare.data

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
/**
 * School camps, partner schools, and camp registration.
 */
class CampsViewModel(
    application: Application,
    private val container: AppContainer,
) : AndroidViewModel(application) {

    private val state get() = container.state
    private val auth get() = container.auth
    private val api get() = container.api

    /**
     * Whether a write is with the server.
     *
     * Linking a school and registering for a camp had no in-flight state at
     * all, so on a slow connection the screen did not change when the parent
     * tapped, and the only thing left to do was tap again. Both are guarded by
     * this now, and both buttons say what is happening.
     */
    private val _busy = MutableStateFlow(false)
    val busy: StateFlow<Boolean> = _busy.asStateFlow()

    private inline fun write(crossinline block: suspend () -> Unit) {
        if (_busy.value) return
        _busy.value = true
        viewModelScope.launch {
            try { block() } finally { _busy.value = false }
        }
    }

    fun campById(campId: String): Camp? =
        state.uiState.value.camps.firstOrNull { it.id == campId || it.schoolCampId == campId }

    // enrollInSchool and registerForCamp used to live here.
    //
    // Both wrote something only a school may decide: which families are in a
    // school, and which children are screened at a camp. The server refuses
    // both for a parent now, and keeping the view model functions would leave
    // two loaded guns for the next screen that needs a button.
    //
    // What a parent does with a camp is answer the consent request, which is
    // GuardianViewModel.recordConsent.
}
