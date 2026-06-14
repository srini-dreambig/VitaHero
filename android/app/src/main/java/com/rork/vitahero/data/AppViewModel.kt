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
import com.rork.vitahero.ui.screens.CoParent
import java.time.LocalDate
import java.time.format.DateTimeFormatter

data class AppUiState(
    val parentName: String = "Priya",
    val phone: String = "",
    val kids: List<Kid> = SampleData.kids,
    val camps: List<Camp> = SampleData.camps,
    val doctors: List<Doctor> = SampleData.doctors,
    val appointments: List<Appointment> = SampleData.appointments,
    val notifications: List<AppNotification> = SampleData.notifications,
    val consentAccepted: Boolean = false,
    val darkTheme: Boolean = false,
    val locale: AppLocale = AppLocale.ENGLISH,
    val familyCode: String = "",
    val coParents: List<CoParent> = emptyList(),
    val wearableData: Map<String, HealthConnectService.WearableData> = emptyMap(),
)

data class BadgeProgress(
    val badges: List<Badge> = emptyList(),
    val leaderboard: List<LeaderEntry> = emptyList(),
)

data class AIDietContent(
    val greeting: String = "",
    val insight: String = "",
    val suggestion: String = "",
    val funFact: String = "",
    val generatedAt: String = "",
    val isGenerating: Boolean = false,
)

private val palette = listOf(0xFF10B981, 0xFF2563EB, 0xFF8B5CF6, 0xFFFB7185, 0xFFF59E0B)

class AppViewModel(application: Application) : AndroidViewModel(application) {

    private val storage = StorageService(application)

    private val _uiState = MutableStateFlow(AppUiState())
    val uiState: StateFlow<AppUiState> = _uiState.asStateFlow()

    private val _meals = MutableStateFlow<Map<String, List<MealItem>>>(emptyMap())
    val meals: StateFlow<Map<String, List<MealItem>>> = _meals.asStateFlow()

    private val _streaks = MutableStateFlow<Map<String, StreakInfo>>(emptyMap())
    val streaks: StateFlow<Map<String, StreakInfo>> = _streaks.asStateFlow()

    private val _aiContent = MutableStateFlow<Map<String, AIDietContent>>(emptyMap())
    val aiContent: StateFlow<Map<String, AIDietContent>> = _aiContent.asStateFlow()

    // Auth state
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
                val savedStreaks = saved.streaks.mapValues { (_, v) -> v.toStreakInfo() }

                withContext(Dispatchers.Main) {
                    _onboardingComplete.value = saved.onboardingComplete
                    _isLoggedIn.value = saved.isLoggedIn
                    val restoredLocale = try { AppLocale.entries.firstOrNull { it.code == saved.localeCode } ?: AppLocale.ENGLISH } catch (_: Exception) { AppLocale.ENGLISH }
                    _uiState.value = AppUiState(
                        parentName = saved.parentName.ifBlank { "Priya" },
                        phone = saved.phone,
                        kids = savedKids.ifEmpty { SampleData.kids },
                        camps = SampleData.camps,
                        doctors = SampleData.doctors,
                        appointments = savedAppointments.ifEmpty { SampleData.appointments },
                        notifications = SampleData.notifications,
                        consentAccepted = saved.isLoggedIn,
                        darkTheme = saved.darkTheme,
                        locale = restoredLocale,
                        familyCode = saved.familyCode,
                        coParents = saved.coParents.map { cp ->
                            CoParent(cp.id, cp.name, cp.relation, cp.joinedDate)
                        },
                        wearableData = SampleData.kids.associate { it.id to HealthConnectService.getDemoData(it.name) },
                    )
                    _meals.value = savedMeals.ifEmpty {
                        seedPersonalizedMeals(savedKids.ifEmpty { SampleData.kids })
                    }
                    _streaks.value = savedStreaks.ifEmpty {
                        savedKids.associate { it.id to StreakInfo() }
                    }
                }
            }
        }
    }

    private fun seedPersonalizedMeals(kids: List<Kid>): Map<String, List<MealItem>> {
        return kids.associate { it.id to SampleData.personalizedMeals(it) }
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
                    streaks = _streaks.value.mapValues { (_, v) -> v.toSerializable() },
                    darkTheme = state.darkTheme,
                    localeCode = state.locale.code,
                    familyCode = state.familyCode,
                    coParents = state.coParents.map { cp ->
                        SerializableCoParent(cp.id, cp.name, cp.relation, cp.joinedDate)
                    },
                )
                storage.save(saved)
            }
        }
    }

    fun acceptConsent() {
        val code = generateFamilyCodeIfNeeded()
        _uiState.update { it.copy(consentAccepted = true, familyCode = code) }
    }

    private fun generateFamilyCodeIfNeeded(): String {
        val current = _uiState.value.familyCode
        if (current.isNotBlank()) return current
        val chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
        return (1..6).map { chars.random() }.joinToString("")
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
                parentName = name.ifBlank { it.parentName },
                consentAccepted = true,
            )
        }
        persistState()
    }

    fun logout() {
        _isLoggedIn.value = false
        _onboardingComplete.value = false
        val currentFamilyCode = _uiState.value.familyCode
        storage.clear()
        _uiState.value = AppUiState(
            kids = SampleData.kids,
            camps = SampleData.camps,
            doctors = SampleData.doctors,
            appointments = SampleData.appointments,
            notifications = SampleData.notifications,
            familyCode = currentFamilyCode,
            wearableData = SampleData.kids.associate { it.id to HealthConnectService.getDemoData(it.name) },
        )
        _meals.value = seedPersonalizedMeals(SampleData.kids)
        _streaks.value = SampleData.kids.associate { it.id to StreakInfo() }
        _aiContent.value = emptyMap()
        persistState()
    }

    fun kidById(id: String?): Kid? = _uiState.value.kids.firstOrNull { it.id == id }

    // --- Theme ---
    fun toggleDarkTheme() {
        _uiState.update { it.copy(darkTheme = !it.darkTheme) }
        persistState()
    }

    // --- Locale ---
    fun setLocale(locale: AppLocale) {
        _uiState.update { it.copy(locale = locale) }
        persistState()
    }

    // --- Family sharing ---
    fun generateFamilyCode() {
        val chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
        val code = (1..6).map { chars.random() }.joinToString("")
        _uiState.update { it.copy(familyCode = code) }
        persistState()
    }

    fun joinFamily(code: String) {
        _uiState.update {
            it.copy(
                coParents = it.coParents + CoParent(
                    id = "cp${System.currentTimeMillis()}",
                    name = "Co-parent (via $code)",
                    relation = "Joined via code",
                    joinedDate = LocalDate.now().format(DateTimeFormatter.ofPattern("dd MMM yyyy"))
                )
            )
        }
        persistState()
    }

    // --- Wearable data ---
    fun refreshWearableData(kidId: String) {
        val kid = kidById(kidId) ?: return
        val data = HealthConnectService.getDemoData(kid.name)
        _uiState.update {
            it.copy(wearableData = it.wearableData + (kidId to data))
        }
        persistState()
    }

    fun mealsForKid(kidId: String): List<MealItem> = _meals.value[kidId].orEmpty()

    fun streakForKid(kidId: String): StreakInfo = _streaks.value[kidId] ?: StreakInfo()

    fun aiContentForKid(kidId: String): AIDietContent = _aiContent.value[kidId] ?: AIDietContent()

    // --- Meal tracking + gamification ---

    fun toggleMeal(kidId: String, mealId: String) {
        val today = LocalDate.now().format(DateTimeFormatter.ISO_LOCAL_DATE)
        _meals.update { current ->
            val list = current[kidId].orEmpty().map { meal ->
                if (meal.id == mealId) meal.copy(eaten = !meal.eaten) else meal
            }
            current + (kidId to list)
        }
        // Update streak
        _streaks.update { s ->
            val prev = s[kidId] ?: StreakInfo()
            val currentStreak = if (prev.lastLogDate == today) prev.currentStreak
            else if (prev.lastLogDate == LocalDate.now().minusDays(1).format(DateTimeFormatter.ISO_LOCAL_DATE))
                prev.currentStreak + 1
            else 1
            s + (kidId to StreakInfo(
                currentStreak = currentStreak,
                bestStreak = maxOf(prev.bestStreak, currentStreak),
                lastLogDate = today,
            ))
        }
        persistState()
    }

    fun badgeProgressForKid(kidId: String): BadgeProgress {
        val kid = kidById(kidId) ?: return BadgeProgress()
        val mealList = mealsForKid(kidId)
        val eatenCount = mealList.count { it.eaten }
        val streak = streakForKid(kidId)
        val totalMeals = mealList.size

        val badges = listOf(
            Badge("b1", "Super Eater", "Log all meals for 7 days", eatenCount >= totalMeals && streak.currentStreak >= 7, 1f, 0xFF10B981, 7, streak.currentStreak),
            Badge("b2", "Growth Champion", "Height on track 3 camps in a row", kid.overallScore >= 85, if (kid.overallScore >= 85) 1f else kid.overallScore / 100f, 0xFF2563EB, 100, kid.overallScore),
            Badge("b3", "Hydration Hero", "Drank enough water all week", streak.currentStreak >= 5, (streak.currentStreak / 5f).coerceAtMost(1f), 0xFF06B6D4, 5, streak.currentStreak),
            Badge("b4", "Bright Smile", "No cavities at last dental check", kid.dental == HealthFlag.GOOD, if (kid.dental == HealthFlag.GOOD) 1f else 0.6f, 0xFF8B5CF6, 1, if (kid.dental == HealthFlag.GOOD) 1 else 0),
            Badge("b5", "Active Star", "Played 60 min daily for 5 days", eatenCount >= totalMeals, eatenCount / totalMeals.toFloat(), 0xFFF59E0B, totalMeals, eatenCount),
            Badge("b6", "Veggie Warrior", "Ate veggies in 10 meals", eatenCount >= 6, (eatenCount / 10f).coerceAtMost(1f), 0xFFFB7185, 10, eatenCount),
        )

        val points = (eatenCount * 10) + (streak.currentStreak * 50)
        val leaderboard = listOf(
            LeaderEntry(1, "Hero #214", 1840, false),
            LeaderEntry(2, "${kid.name} (You)", 1720 + points, true),
            LeaderEntry(3, "Hero #087", 1610, false),
            LeaderEntry(4, "Hero #156", 1540, false),
            LeaderEntry(5, "Hero #033", 1490, false),
        )

        return BadgeProgress(badges, leaderboard)
    }

    // --- AI diet content ---

    fun generateAIContent(kidId: String) {
        val kid = kidById(kidId) ?: return
        _aiContent.update { it + (kidId to AIDietContent(isGenerating = true)) }
        viewModelScope.launch {
            // Simulate AI generation with personalized content
            kotlinx.coroutines.delay(1800)
            val content = buildPersonalizedTip(kid)
            _aiContent.update { it + (kidId to content) }
        }
    }

    private fun buildPersonalizedTip(kid: Kid): AIDietContent {
        val age = kid.age
        val name = kid.name
        val greeting = when {
            kid.nutrition == HealthFlag.GOOD -> "Great job, $name's eating well! 🥗"
            kid.nutrition == HealthFlag.WATCH -> "Let's boost $name's nutrition! 💪"
            else -> "$name needs some extra care with meals ❤️"
        }
        val insight = when {
            age <= 6 -> "Kids $age and under need calcium-rich foods for strong bones. Milk, curd, and ragi are excellent choices."
            age <= 10 -> "At age $age, $name needs plenty of protein for growth spurts. Eggs, dal, paneer, and sprouts build muscle."
            else -> "Growing teens like $name need iron-rich foods. Include green leafy veggies, dates, and jaggery daily."
        }
        val suggestion = when {
            kid.nutrition == HealthFlag.WATCH -> "Try adding a boiled egg or a bowl of sprout chaat to $name's evening snack. Iron and protein boost in one!"
            kid.bmi < 14f -> "Add a handful of nuts (almonds, walnuts) and a banana to $name's day. Healthy fats help catch up on the growth curve."
            kid.bmi > 19.5f -> "Swap packaged snacks with cucumber/carrot sticks and homemade roasted chana. More activity, same nutrition!"
            else -> "Keep up the great balance! Rotate between dal-rice, khichdi, idli-sambar, and roti-sabzi for variety."
        }
        val funFact = listOf(
            "Did you know? Soaking almonds overnight removes tannins and makes nutrients easier to absorb!",
            "Fun fact: Vitamin C from lemon on dal helps absorb iron 3x better. Squeeze away!",
            "Tip: Ragi (finger millet) has 10x more calcium than rice. Perfect for growing kids.",
            "Did you know? Curd has probiotics that keep the gut healthy and boost immunity naturally.",
            "Fun fact: Jaggery has iron and minerals that refined sugar doesn't. Sweet and smart!"
        ).random()

        return AIDietContent(
            greeting = greeting,
            insight = insight,
            suggestion = suggestion,
            funFact = funFact,
            generatedAt = "Generated just now for $name",
        )
    }

    // --- Kid management ---

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
        _meals.update { it + (newKid.id to SampleData.personalizedMeals(newKid)) }
        _streaks.update { it + (newKid.id to StreakInfo()) }
        persistState()
    }

    fun addGrowthPoint(kidId: String, heightCm: Float, weightKg: Float, label: String) {
        _uiState.update { state ->
            state.copy(kids = state.kids.map { kid ->
                if (kid.id == kidId) {
                    val newPoint = GrowthPoint(label, heightCm, weightKg)
                    val updatedGrowth = kid.growth + newPoint
                    val newScore = computeScore(updatedGrowth)
                    kid.copy(
                        growth = updatedGrowth,
                        heightCm = heightCm,
                        weightKg = weightKg,
                        overallScore = newScore,
                        lastCheckup = label,
                    )
                } else kid
            })
        }
        persistState()
    }

    private fun computeScore(growth: List<GrowthPoint>): Int {
        if (growth.size < 2) return 80
        val last = growth.last()
        val prev = growth[growth.size - 2]
        val heightGain = last.height - prev.height
        val weightGain = last.weight - prev.weight
        val score = when {
            heightGain > 1f && weightGain in 0.3f..1.5f -> 92
            heightGain > 0.5f -> 85
            heightGain > 0f -> 78
            else -> 70
        }
        return score.coerceIn(0, 100)
    }

    // --- Appointment management ---

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

    fun cancelAppointment(appointmentId: String) {
        _uiState.update { state ->
            state.copy(appointments = state.appointments.filter { it.id != appointmentId })
        }
        persistState()
    }

    // --- Notifications ---

    fun markAllNotificationsRead() {
        _uiState.update { state ->
            state.copy(notifications = state.notifications.map { it.copy(unread = false) })
        }
    }

    val defaultKidId: String
        get() = _uiState.value.kids.firstOrNull()?.id.orEmpty()
}
