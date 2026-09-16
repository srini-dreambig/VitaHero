package com.rork.vitahero.data

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

    fun enrollInSchool(partnerCode: String, kidId: String? = null) {
        write {
            val locale = state.uiState.value.locale
            api.enrollSchool(partnerCode, kidId).fold(
                onSuccess = {
                    container.fetchAndApplyBackendData(viewModelScope)
                    state.syncMessage.value = tr(S.schoolLinked, locale).replace("%s", it.schoolName ?: "")
                },
                onFailure = { e ->
                    state.syncMessage.value = e.message ?: tr(S.schoolEnrollFailed, locale)
                },
            )
        }
    }

    fun registerForCamp(camp: Camp, kidId: String, onScheduled: () -> Unit = {}) {
        if (!camp.isPartnerCamp) return
        write {
            val locale = state.uiState.value.locale
            api.registerForCamp(camp.schoolCampId.ifBlank { camp.id }, kidId).fold(
                onSuccess = {
                    container.fetchAndApplyBackendData(viewModelScope)
                    onScheduled()
                    state.syncMessage.value = tr(S.campRegistered, locale)
                },
                onFailure = { e ->
                    state.syncMessage.value = e.message ?: tr(S.campRegisterFailed, locale)
                },
            )
        }
    }
}
