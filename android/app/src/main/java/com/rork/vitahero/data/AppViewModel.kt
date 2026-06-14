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

data class AppUiState(
    val parentName: String = "Priya",
    val phone: String = "",
    val kids: List<Kid> = SampleData.kids,
    val camps: List<Camp> = SampleData.camps,
    val doctors: List<Doctor> = SampleData.doctors,
    val appointments: List<Appointment> = SampleData.appointments,
    val notifications: List<AppNotification> = SampleData.notifications,
)

private val palette = listOf(0xFF10B981, 0xFF2563EB, 0xFF8B5CF6, 0xFFFB7185, 0xFFF59E0B)

class AppViewModel(application: Application) : AndroidViewModel(application) {

    private val storage = StorageService(application)

    private val _uiState = MutableStateFlow(AppUiState())
    val uiState: StateFlow<AppUiState> = _uiState.asStateFlow()

    private val _meals = MutableStateFlow<Map<String, List<MealItem>>>(emptyMap())
    val meals: StateFlow<Map<String, List<MealItem>>> = _meals.asStateFlow()

    // Auth state for navigation — persisted
    private val _onboardingComplete = MutableStateFlow(false)
    val onboardingComplete: StateFlow<Boolean> = _onboardingComplete.asStateFlow()

    private val _isLoggedIn = MutableStateFlow(false)
    val isLoggedIn: StateFlow<Boolean> = _isLoggedIn.asStateFlow()

    init {
        loadFromStorage()
    }

    private fun loadFromStorage() {
        viewModelScope.launch {
            withContext(Dispatchers.IO) {
                val saved = storage.load()
                val savedKids = saved.kids.map { it.toKid() }
                val savedAppointments = saved.appointments.map { it.toAppointment() }
                val savedMeals = saved.meals.mapValues { (_, list) -> list.map { it.toMealItem() } }

                withContext(Dispatchers.Main) {
                    _onboardingComplete.value = saved.onboardingComplete
                    _isLoggedIn.value = saved.isLoggedIn
                    _uiState.value = AppUiState(
                        parentName = saved.parentName.ifBlank { "Priya" },
                        phone = saved.phone,
                        kids = savedKids.ifEmpty { SampleData.kids },
                        camps = SampleData.camps,
                        doctors = SampleData.doctors,
                        appointments = savedAppointments.ifEmpty { SampleData.appointments },
                        notifications = SampleData.notifications,
                    )
                    _meals.value = savedMeals.ifEmpty {
                        SampleData.kids.associate { it.id to SampleData.mealsFor(it.name) }
                    }
                }
            }
        }
    }

    private fun persistState() {
        viewModelScope.launch {
            withContext(Dispatchers.IO) {
                val state = _uiState.value
                val saved = PersistentState(
                    onboardingComplete = _onboardingComplete.value,
                    isLoggedIn = _isLoggedIn.value,
                    parentName = state.parentName,
                    phone = state.phone,
                    kids = state.kids.map { it.toSerializable() },
                    appointments = state.appointments.map { it.toSerializable() },
                    meals = _meals.value.mapValues { (_, list) -> list.map { it.toSerializable() } },
                )
                storage.save(saved)
            }
        }
    }

    fun completeOnboarding() {
        _onboardingComplete.value = true
        persistState()
    }

    fun login(phone: String, name: String = "") {
        _isLoggedIn.value = true
        _uiState.update {
            it.copy(
                phone = phone,
                parentName = name.ifBlank { it.parentName }
            )
        }
        persistState()
    }

    fun logout() {
        _isLoggedIn.value = false
        _onboardingComplete.value = false
        storage.clear()
        _uiState.value = AppUiState(
            kids = SampleData.kids,
            camps = SampleData.camps,
            doctors = SampleData.doctors,
            appointments = SampleData.appointments,
            notifications = SampleData.notifications,
        )
        _meals.value = SampleData.kids.associate { it.id to SampleData.mealsFor(it.name) }
        persistState()
    }

    fun kidById(id: String?): Kid? = _uiState.value.kids.firstOrNull { it.id == id }

    fun mealsForKid(kidId: String): List<MealItem> = _meals.value[kidId].orEmpty()

    fun toggleMeal(kidId: String, mealId: String) {
        _meals.update { current ->
            val list = current[kidId].orEmpty().map { meal ->
                if (meal.id == mealId) meal.copy(eaten = !meal.eaten) else meal
            }
            current + (kidId to list)
        }
        persistState()
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
        persistState()
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
        persistState()
    }

    fun markAllNotificationsRead() {
        _uiState.update { state ->
            state.copy(notifications = state.notifications.map { it.copy(unread = false) })
        }
    }

    val defaultKidId: String
        get() = _uiState.value.kids.firstOrNull()?.id.orEmpty()
}
