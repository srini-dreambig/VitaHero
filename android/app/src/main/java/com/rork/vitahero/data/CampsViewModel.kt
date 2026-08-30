package com.rork.vitahero.data

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
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

    fun campById(campId: String): Camp? =
        state.uiState.value.camps.firstOrNull { it.id == campId || it.schoolCampId == campId }

    fun enrollInSchool(partnerCode: String, kidId: String? = null) {
        viewModelScope.launch {
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
        viewModelScope.launch {
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
