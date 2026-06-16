package com.rork.vitahero.data

import android.app.Application
import android.content.Context
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * Hospital directory, doctor booking, appointments, and location.
 */
class BookingViewModel(
    application: Application,
    private val container: AppContainer,
) : AndroidViewModel(application) {

    private val state get() = container.state
    private val auth get() = container.auth
    private val api get() = container.api

    val bookingSlots get() = state.bookingSlots

    fun loadBookingSlots(doctorId: String) {
        if (doctorId.isBlank()) return
        viewModelScope.launch {
            try {
                val slots = api.fetchBookingSlots(doctorId).map {
                    BookingTimeSlot(label = it.label, date = it.date, time = it.time)
                }
                state.bookingSlots.update { it + (doctorId to slots) }
            } catch (e: Exception) {
                container.reportSyncError(e)
            }
        }
    }

    fun refreshBookingDirectory(city: String? = null) {
        viewModelScope.launch {
            val targetCity = city?.ifBlank { null }
                ?: state.uiState.value.bookingCity.ifBlank { null }
                ?: state.uiState.value.partnerSchools.firstOrNull()?.city?.ifBlank { null }
                ?: "Hyderabad"
            val lat = state.uiState.value.userLat
            val lng = state.uiState.value.userLng
            try {
                val dto = api.fetchBookingDirectory(targetCity, lat = lat, lng = lng) ?: return@launch
                val directory = mapBookingDirectory(dto)
                val flatDoctors = directory.hospitals.flatMap { it.doctors }
                withContext(Dispatchers.Main) {
                    state.uiState.update { ui ->
                        ui.copy(
                            bookingDirectory = directory,
                            bookingCity = targetCity,
                            doctors = flatDoctors.ifEmpty { ui.doctors },
                        )
                    }
                }
            } catch (e: Exception) {
                container.reportSyncError(e)
            }
        }
    }

    fun applyUserLocation(lat: Double, lng: Double) {
        state.uiState.update { it.copy(userLat = lat, userLng = lng, locationEnabled = true) }
        refreshBookingDirectory()
    }

    fun fetchLocationAndRefresh(context: Context) {
        viewModelScope.launch {
            val loc = LocationHelper.getLastKnownLocation(context) ?: return@launch
            applyUserLocation(loc.first, loc.second)
        }
    }

    fun bookAppointment(doctor: Doctor, kidName: String, date: String, time: String) {
        val appt = Appointment(
            id = "a${System.currentTimeMillis()}",
            doctorId = doctor.id,
            doctorName = doctor.name,
            specialty = doctor.specialty,
            kidName = kidName,
            date = date,
            time = time,
        )
        state.uiState.update { it.copy(appointments = it.appointments + appt) }
        NotificationScheduler.scheduleCheckupReminder(
            getApplication(), doctor.name, kidName, date, time, state.uiState.value.locale,
        )
        container.persistNow(SyncEntity.APPOINTMENTS)
        container.fetchAndApplyBackendData(viewModelScope)
    }

    fun cancelAppointment(appointmentId: String) {
        viewModelScope.launch {
            try {
                if (auth.isLoggedIn.value) api.deleteAppointment(appointmentId)
            } catch (e: Exception) {
                container.reportSyncError(e)
            }
            state.uiState.update { ui ->
                ui.copy(appointments = ui.appointments.filter { it.id != appointmentId })
            }
        }
    }
}
