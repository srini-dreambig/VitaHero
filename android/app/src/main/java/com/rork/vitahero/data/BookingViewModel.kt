package com.rork.vitahero.data

import android.app.Application
import android.content.Context
import android.widget.Toast
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
 * Hospital directory, doctor booking, appointments, and location.
 */
class BookingViewModel(
    application: Application,
    private val container: AppContainer,
) : AndroidViewModel(application) {

    private val state get() = container.state
    private val auth get() = container.auth
    private val api get() = container.api

    /**
     * Whether a booking is on its way to the server.
     *
     * The confirm button had no in-flight state at all: on a slow connection
     * the screen did not change, so a parent tapped again. It also flipped
     * straight to "booked" whatever the server said.
     */
    private val _booking = MutableStateFlow(false)
    val booking: StateFlow<Boolean> = _booking.asStateFlow()

    /** The outcome of the last booking attempt, for the screen to react to. */
    sealed interface BookingOutcome {
        data object Confirmed : BookingOutcome
        data class Refused(val message: String) : BookingOutcome
    }

    private val _lastBooking = MutableStateFlow<BookingOutcome?>(null)
    val lastBooking: StateFlow<BookingOutcome?> = _lastBooking.asStateFlow()

    fun clearBookingOutcome() { _lastBooking.value = null }

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
            if (!LocationHelper.hasLocationPermission(context)) {
                toast("Location permission is needed to find hospitals near you")
                return@launch
            }
            if (!LocationHelper.isLocationEnabled(context)) {
                toast("Turn on location/GPS to sort hospitals by distance")
                return@launch
            }
            val loc = LocationHelper.getCurrentLocation(context)
            if (loc == null) {
                toast("Couldn't get your location. Please try again in a moment")
                return@launch
            }
            applyUserLocation(loc.first, loc.second)
        }
    }

    private suspend fun toast(message: String) {
        withContext(Dispatchers.Main) {
            Toast.makeText(getApplication(), message, Toast.LENGTH_SHORT).show()
        }
    }

    /**
     * Book a slot, and wait to be told it is really booked.
     *
     * This used to add the appointment to the screen, schedule the reminder
     * notification and fire the write off unwatched. The server refuses a slot
     * somebody else has already taken — and that refusal went nowhere. The
     * parent kept an appointment that did not exist, was reminded of it three
     * hours beforehand, and turned up at the hospital for it.
     *
     * The write goes first now. Nothing is shown, and no alarm is set, until
     * the server has accepted it.
     */
    fun bookAppointment(doctor: Doctor, kidName: String, date: String, time: String) {
        if (_booking.value) return
        _booking.value = true
        viewModelScope.launch {
            // Released in a finally. It used to be cleared on the last line
            // of the block, which never ran if anything in it threw — and
            // scheduling the reminder can, on a phone that has refused the
            // exact-alarm permission. A parent who hit that could not book
            // again for the rest of the session, and was told nothing about
            // why the button had stopped working.
            try {
                val appt = Appointment(
                    id = "a${System.currentTimeMillis()}",
                    doctorId = doctor.id,
                    doctorName = doctor.name,
                    specialty = doctor.specialty,
                    kidName = kidName,
                    date = date,
                    time = time,
                )
                val result = api.upsertAppointment(
                    AppointmentDto(
                        id = appt.id,
                        profileId = auth.profileId.value,
                        userId = auth.userId.value.ifBlank { auth.profileId.value },
                        doctorName = appt.doctorName,
                        doctorId = appt.doctorId.ifBlank { null },
                        specialty = appt.specialty,
                        kidName = appt.kidName,
                        date = appt.date,
                        time = appt.time,
                    )
                )

                result.fold(
                    onSuccess = {
                        state.uiState.update { it.copy(appointments = it.appointments + appt) }
                        NotificationScheduler.scheduleCheckupReminder(
                            getApplication(), doctor.name, kidName, date, time, state.uiState.value.locale,
                        )
                        _lastBooking.value = BookingOutcome.Confirmed
                        container.fetchAndApplyBackendData(viewModelScope)
                    },
                    onFailure = { e ->
                        // A refusal is the server's own wording — "This slot is no
                        // longer available" — and is worth showing verbatim. A
                        // network fault is not the parent's fault and says so.
                        val message = if (e is PermanentRejection) e.message
                        else tr(S.bookingCouldNotReach, state.uiState.value.locale)
                        _lastBooking.value = BookingOutcome.Refused(message)
                    },
                )
            } finally {
                _booking.value = false
            }
        }
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
