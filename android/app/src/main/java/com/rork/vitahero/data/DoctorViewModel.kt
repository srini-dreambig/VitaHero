package com.rork.vitahero.data

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * Manages doctor state: assigned camps, camp kid lists, checkup form data,
 * and submission of health checkup forms.
 */
class DoctorViewModel(
    application: Application,
    private val container: AppContainer,
) : AndroidViewModel(application) {

    private val api get() = container.api

    data class DoctorUiState(
        val camps: List<DoctorCampDto> = emptyList(),
        val selectedCamp: DoctorCampDto? = null,
        val campKids: List<DoctorCampKidDto> = emptyList(),
        val isLoading: Boolean = false,
        val isSubmitting: Boolean = false,
        val error: String? = null,
        val submitSuccess: Boolean = false,
    )

    private val _uiState = MutableStateFlow(DoctorUiState())
    val uiState: StateFlow<DoctorUiState> = _uiState.asStateFlow()

    fun loadCamps() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            try {
                val camps = withContext(Dispatchers.IO) { api.fetchDoctorCamps() }
                _uiState.update { it.copy(camps = camps, isLoading = false) }
            } catch (e: Exception) {
                _uiState.update { it.copy(isLoading = false, error = e.message) }
            }
        }
    }

    fun selectCamp(camp: DoctorCampDto) {
        _uiState.update { it.copy(selectedCamp = camp, campKids = emptyList(), error = null) }
        loadCampKids(camp.campId)
    }

    fun loadCampKids(campId: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            try {
                val kids = withContext(Dispatchers.IO) { api.fetchDoctorCampKids(campId) }
                _uiState.update { it.copy(campKids = kids, isLoading = false) }
            } catch (e: Exception) {
                _uiState.update { it.copy(isLoading = false, error = e.message) }
            }
        }
    }

    fun loadExistingCheckup(kidId: String, campId: String, onResult: (HealthCheckupDto?) -> Unit) {
        viewModelScope.launch {
            try {
                val checkup = withContext(Dispatchers.IO) { api.fetchDoctorCheckup(kidId, campId) }
                onResult(checkup)
            } catch (_: Exception) {
                onResult(null)
            }
        }
    }

    fun submitCheckup(
        kidId: String,
        campId: String,
        formData: Map<String, Any>,
        summary: String,
        referralNeeded: Boolean,
        referralNotes: String,
        overallStatus: String,
        onSuccess: () -> Unit,
    ) {
        viewModelScope.launch {
            _uiState.update { it.copy(isSubmitting = true, submitSuccess = false, error = null) }
            try {
                val result = withContext(Dispatchers.IO) {
                    api.submitDoctorCheckup(
                        kidId, campId, formData, summary,
                        referralNeeded, referralNotes, overallStatus,
                    )
                }
                result.fold(
                    onSuccess = {
                        _uiState.update { it.copy(isSubmitting = false, submitSuccess = true) }
                        loadCampKids(campId)
                        onSuccess()
                    },
                    onFailure = { e ->
                        _uiState.update { it.copy(isSubmitting = false, error = e.message) }
                    },
                )
            } catch (e: Exception) {
                _uiState.update { it.copy(isSubmitting = false, error = e.message) }
            }
        }
    }

    fun clearError() {
        _uiState.update { it.copy(error = null, submitSuccess = false) }
    }
}
