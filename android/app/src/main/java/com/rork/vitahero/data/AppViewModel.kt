package com.rork.vitahero.data

import androidx.lifecycle.ViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update

data class AppUiState(
    val parentName: String = "Priya",
    val kids: List<Kid> = SampleData.kids,
    val camps: List<Camp> = SampleData.camps,
    val doctors: List<Doctor> = SampleData.doctors,
    val appointments: List<Appointment> = SampleData.appointments,
    val notifications: List<AppNotification> = SampleData.notifications,
)

class AppViewModel : ViewModel() {

    private val _uiState = MutableStateFlow(AppUiState())
    val uiState: StateFlow<AppUiState> = _uiState.asStateFlow()

    // Per-kid meal logs, keyed by kid id
    private val _meals = MutableStateFlow(
        SampleData.kids.associate { it.id to SampleData.mealsFor(it.name) }
    )
    val meals: StateFlow<Map<String, List<MealItem>>> = _meals.asStateFlow()

    fun kidById(id: String?): Kid? = _uiState.value.kids.firstOrNull { it.id == id }

    fun mealsForKid(kidId: String): List<MealItem> = _meals.value[kidId].orEmpty()

    fun toggleMeal(kidId: String, mealId: String) {
        _meals.update { current ->
            val list = current[kidId].orEmpty().map { meal ->
                if (meal.id == mealId) meal.copy(eaten = !meal.eaten) else meal
            }
            current + (kidId to list)
        }
    }

    fun addKid(
        name: String,
        age: Int,
        gender: String,
        school: String,
        grade: String,
        heightCm: Float,
        weightKg: Float
    ) {
        val palette = listOf(0xFF10B981, 0xFF2563EB, 0xFF8B5CF6, 0xFFFB7185, 0xFFF59E0B)
        val newKid = Kid(
            id = "k${System.currentTimeMillis()}",
            name = name,
            age = age,
            gender = gender,
            school = school,
            grade = grade,
            heightCm = heightCm,
            weightKg = weightKg,
            avatarColor = palette[_uiState.value.kids.size % palette.size],
            overallScore = 80,
            growth = listOf(GrowthPoint("Now", heightCm, weightKg)),
            dental = HealthFlag.GOOD,
            eyesight = HealthFlag.GOOD,
            nutrition = HealthFlag.GOOD,
            lastCheckup = "Not yet"
        )
        _uiState.update { it.copy(kids = it.kids + newKid) }
        _meals.update { it + (newKid.id to SampleData.mealsFor(name)) }
    }

    fun bookAppointment(doctor: Doctor, kidName: String, date: String, time: String) {
        val appt = Appointment(
            id = "a${System.currentTimeMillis()}",
            doctorName = doctor.name,
            specialty = doctor.specialty,
            kidName = kidName,
            date = date,
            time = time
        )
        _uiState.update { it.copy(appointments = it.appointments + appt) }
    }

    fun markAllNotificationsRead() {
        _uiState.update { state ->
            state.copy(notifications = state.notifications.map { it.copy(unread = false) })
        }
    }
}
