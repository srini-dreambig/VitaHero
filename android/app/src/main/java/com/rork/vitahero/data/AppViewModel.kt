package com.rork.vitahero.data

import android.Manifest
import android.app.AlarmManager
import android.app.Application
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.provider.Settings
import androidx.core.content.ContextCompat
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import com.rork.vitahero.data.db.VitaHeroDatabase
import com.rork.vitahero.data.db.KidEntity
import com.rork.vitahero.data.db.MealItemEntity
import com.rork.vitahero.data.db.AppointmentEntity
import com.rork.vitahero.data.db.StreakEntity
import com.rork.vitahero.data.db.ParentProfileEntity
import com.rork.vitahero.ui.screens.CoParent
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.UUID

data class AppUiState(
    val parentName: String = "Priya",
    val phone: String = "",
    val email: String = "",
    val userId: String = "",
    val kids: List<Kid> = SampleData.kids,
    val camps: List<Camp> = SampleData.camps,
    val doctors: List<Doctor> = SampleData.doctors,
    val appointments: List<Appointment> = SampleData.appointments,
    val notifications: List<AppNotification> = SampleData.notifications,
    val consentAccepted: Boolean = false,
    val consentDeclined: Boolean = false,
    val darkTheme: Boolean = false,
    val locale: AppLocale = AppLocale.ENGLISH,
    val familyCode: String = "",
    val coParents: List<CoParent> = emptyList(),
    val wearableData: Map<String, HealthConnectService.WearableData> = emptyMap(),
    val notificationsEnabled: Boolean = true,
    val campRemindersEnabled: Boolean = true,
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
    private val db = VitaHeroDatabase.getInstance(application)
    private val supabase = SupabaseRepository()

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

    // Auth error state (shown on AuthScreen/OtpScreen)
    private val _authError = MutableStateFlow<String?>(null)
    val authError: StateFlow<String?> = _authError.asStateFlow()

    private val _authLoading = MutableStateFlow(false)
    val authLoading: StateFlow<Boolean> = _authLoading.asStateFlow()

    init {
        loadFromStorage()
    }

    private fun profileId(): String {
        val userId = _uiState.value.userId
        if (userId.isNotBlank()) return userId.take(12)
        val phone = _uiState.value.phone
        if (phone.isNotBlank()) return "ph_${phone.replace("+", "").takeLast(10)}"
        return "local_${_uiState.value.parentName.lowercase().replace(" ", "_")}"
    }

    private fun syncProfileToSupabase() {
        viewModelScope.launch {
            try {
                val state = _uiState.value
                supabase.upsertProfile(ProfileDto(
                    id = profileId(),
                    userId = state.userId.ifBlank { null },
                    phone = state.phone.ifBlank { null },
                    name = state.parentName,
                    onboardingComplete = _onboardingComplete.value,
                    isLoggedIn = _isLoggedIn.value,
                    darkTheme = state.darkTheme,
                    localeCode = state.locale.code,
                    familyCode = state.familyCode,
                    notificationsEnabled = state.notificationsEnabled,
                    campRemindersEnabled = state.campRemindersEnabled,
                    consentAccepted = state.consentAccepted,
                    consentDeclined = state.consentDeclined,
                ))
            } catch (_: Exception) { /* Supabase sync is best-effort */ }
        }
    }

    private fun syncKidsToSupabase() {
        viewModelScope.launch {
            try {
                val state = _uiState.value
                val pid = profileId()
                supabase.upsertKids(state.kids.map { kid ->
                    KidDto(
                        id = kid.id, profileId = pid,
                        userId = state.userId.ifBlank { null },
                        name = kid.name,
                        age = kid.age, gender = kid.gender, school = kid.school,
                        grade = kid.grade, heightCm = kid.heightCm.toDouble(),
                        weightKg = kid.weightKg.toDouble(), avatarColor = kid.avatarColor,
                        overallScore = kid.overallScore,
                        dental = kid.dental.name, eyesight = kid.eyesight.name,
                        nutrition = kid.nutrition.name, lastCheckup = kid.lastCheckup,
                    )
                })
                // Also sync growth points
                state.kids.forEach { kid ->
                    kid.growth.forEach { gp ->
                        supabase.upsertGrowthPoint(GrowthPointDto(
                            id = "${kid.id}_gp_${gp.label.replace(" ", "_")}",
                            kidId = kid.id,
                            userId = state.userId.ifBlank { null },
                            label = gp.label,
                            height = gp.height.toDouble(),
                            weight = gp.weight.toDouble(),
                        ))
                    }
                }
            } catch (_: Exception) { /* Supabase sync is best-effort */ }
        }
    }

    private fun syncAppointmentsToSupabase() {
        viewModelScope.launch {
            try {
                val state = _uiState.value
                val pid = profileId()
                state.appointments.forEach { appt ->
                    supabase.upsertAppointment(AppointmentDto(
                        id = appt.id, profileId = pid,
                        userId = state.userId.ifBlank { null },
                        doctorName = appt.doctorName,
                        specialty = appt.specialty, kidName = appt.kidName,
                        date = appt.date, time = appt.time,
                    ))
                }
            } catch (_: Exception) { /* Supabase sync is best-effort */ }
        }
    }

    private fun syncMealsToSupabase(kidId: String) {
        viewModelScope.launch {
            try {
                val pid = profileId()
                val mealList = _meals.value[kidId].orEmpty()
                supabase.upsertMeals(mealList.map { meal ->
                    MealItemDto(
                        id = meal.id, profileId = pid,
                        userId = _uiState.value.userId.ifBlank { null },
                        kidId = kidId,
                        timeSlot = meal.time, name = meal.name,
                        detail = meal.detail, kcal = meal.kcal, eaten = meal.eaten,
                    )
                })
            } catch (_: Exception) { /* Supabase sync is best-effort */ }
        }
    }

    private fun syncStreakToSupabase(kidId: String) {
        viewModelScope.launch {
            try {
                val streak = _streaks.value[kidId] ?: return@launch
                supabase.upsertStreak(StreakDto(
                    kidId = kidId,
                    userId = _uiState.value.userId.ifBlank { null },
                    currentStreak = streak.currentStreak,
                    bestStreak = streak.bestStreak,
                    lastLogDate = streak.lastLogDate,
                ))
            } catch (_: Exception) { /* Supabase sync is best-effort */ }
        }
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
                        camps = saved.camps.map { it.toCamp() }.ifEmpty { SampleData.camps },
                        doctors = SampleData.doctors,
                        appointments = savedAppointments.ifEmpty { SampleData.appointments },
                        notifications = SampleData.notifications,
                        consentAccepted = saved.isLoggedIn,
                        consentDeclined = saved.consentDeclined,
                        darkTheme = saved.darkTheme,
                        locale = restoredLocale,
                        familyCode = saved.familyCode,
                        coParents = saved.coParents.map { cp ->
                            CoParent(cp.id, cp.name, cp.relation, cp.joinedDate)
                        },
                        wearableData = saved.wearableData.mapValues { (_, v) -> v.toWearableData() }.ifEmpty {
                            SampleData.kids.associate { it.id to HealthConnectService.getDemoData(it.name) }
                        },
                        notificationsEnabled = saved.notificationsEnabled,
                        campRemindersEnabled = saved.campRemindersEnabled,
                    )
                    _meals.value = savedMeals.ifEmpty {
                        seedPersonalizedMeals(savedKids.ifEmpty { SampleData.kids })
                    }
                    _streaks.value = savedStreaks.ifEmpty {
                        savedKids.associate { it.id to StreakInfo() }
                    }
                    // Schedule all notifications after loading
                    if (saved.isLoggedIn) {
                        scheduleAllNotifications()
                    }
                }
            }
        }
    }

    // Room DB is used for write durability (via persistToRoom).
    // JSON file storage remains the primary load path for simplicity and speed.
    // To switch to Room as primary, implement loadFromRoom() using the DAO suspend methods.

    private data class Quadruple<A, B, C, D>(val first: A, val second: B, val third: C, val fourth: D)

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
                    wearableData = state.wearableData.mapValues { (_, v) -> v.toSerializable() },
                    camps = state.camps.map { it.toSerializableCamp() },
                    consentDeclined = state.consentDeclined,
                    notificationsEnabled = state.notificationsEnabled,
                    campRemindersEnabled = state.campRemindersEnabled,
                )
                storage.save(saved)
                // Also persist to Room DB
                persistToRoom(state)
            }
        }
    }

    private suspend fun persistToRoom(state: AppUiState) {
        try {
            // Parent profile
            db.parentDao().upsert(ParentProfileEntity(
                name = state.parentName,
                phone = state.phone,
                onboardingComplete = _onboardingComplete.value,
                isLoggedIn = _isLoggedIn.value,
                darkTheme = state.darkTheme,
                localeCode = state.locale.code,
                familyCode = state.familyCode,
            ))
            // Kids
            val json = kotlinx.serialization.json.Json { prettyPrint = false }
            db.kidDao().upsertAll(state.kids.map { kid ->
                KidEntity(
                    id = kid.id, name = kid.name, age = kid.age, gender = kid.gender,
                    school = kid.school, grade = kid.grade, heightCm = kid.heightCm,
                    weightKg = kid.weightKg, avatarColor = kid.avatarColor,
                    overallScore = kid.overallScore,
                    growthJson = json.encodeToString(
                        kotlinx.serialization.builtins.ListSerializer(SerializableGrowthPoint.serializer()),
                        kid.growth.map { SerializableGrowthPoint(it.label, it.height, it.weight) }
                    ),
                    dental = kid.dental.name, eyesight = kid.eyesight.name,
                    nutrition = kid.nutrition.name, lastCheckup = kid.lastCheckup,
                )
            })
            // Appointments
            db.appointmentDao().upsertAll(state.appointments.map { appt ->
                AppointmentEntity(
                    id = appt.id, doctorName = appt.doctorName, specialty = appt.specialty,
                    kidName = appt.kidName, date = appt.date, time = appt.time,
                )
            })
            // Meals
            val allMeals = _meals.value.flatMap { (kidId, meals) ->
                meals.map { meal ->
                    MealItemEntity(
                        id = meal.id, kidId = kidId, timeSlot = meal.time,
                        name = meal.name, detail = meal.detail, kcal = meal.kcal, eaten = meal.eaten,
                    )
                }
            }
            if (allMeals.isNotEmpty()) {
                db.mealDao().upsertAll(allMeals)
            }
            // Streaks
            _streaks.value.forEach { (kidId, streak) ->
                db.streakDao().upsert(StreakEntity(
                    kidId = kidId, currentStreak = streak.currentStreak,
                    bestStreak = streak.bestStreak, lastLogDate = streak.lastLogDate,
                ))
            }
        } catch (_: Exception) {
            // Room write fails silently — JSON storage is primary
        }
    }

    fun acceptConsent() {
        val code = generateFamilyCodeIfNeeded()
        _uiState.update { it.copy(consentAccepted = true, consentDeclined = false, familyCode = code) }
    }

    fun declineConsent() {
        _uiState.update { it.copy(consentDeclined = true, consentAccepted = false) }
        persistState()
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

    // ─── Supabase Auth methods (REST API) ─────────────────

    /** Access token from last successful auth. Used for authenticated Supabase calls. */
    private val _accessToken = MutableStateFlow<String?>(null)
    val accessToken: StateFlow<String?> = _accessToken.asStateFlow()

    /** Sign in with email + password via Supabase Auth REST API. */
    fun signInWithEmail(email: String, password: String) {
        _authLoading.value = true
        _authError.value = null
        viewModelScope.launch {
            val result = SupabaseAuth.signInWithEmail(email, password)
            result.fold(
                onSuccess = { resp ->
                    _accessToken.value = resp.access_token
                    val user = resp.user
                    if (user != null) {
                        onSupabaseLogin(
                            userId = user.id,
                            email = user.email,
                            phone = user.phone ?: "",
                            name = user.user_metadata?.get("name") ?: email.substringBefore('@')
                        )
                    }
                    _authLoading.value = false
                },
                onFailure = { e ->
                    _authError.value = e.message ?: "Sign in failed"
                    _authLoading.value = false
                }
            )
        }
    }

    /** Sign up with email + password + name via Supabase Auth REST API. */
    fun signUpWithEmail(email: String, password: String, name: String) {
        _authLoading.value = true
        _authError.value = null
        viewModelScope.launch {
            val result = SupabaseAuth.signUpWithEmail(email, password, name)
            result.fold(
                onSuccess = { resp ->
                    _accessToken.value = resp.access_token
                    val user = resp.user
                    if (user != null) {
                        onSupabaseLogin(
                            userId = user.id,
                            email = user.email,
                            phone = user.phone ?: "",
                            name = name
                        )
                    }
                    _authLoading.value = false
                },
                onFailure = { e ->
                    _authError.value = e.message ?: "Sign up failed"
                    _authLoading.value = false
                }
            )
        }
    }

    /** Send phone OTP via Supabase Auth REST API. */
    fun sendPhoneOtp(phone: String) {
        _authLoading.value = true
        _authError.value = null
        viewModelScope.launch {
            val result = SupabaseAuth.sendPhoneOtp("+91$phone")
            result.fold(
                onSuccess = { _authLoading.value = false },
                onFailure = { e ->
                    _authError.value = e.message ?: "Failed to send OTP"
                    _authLoading.value = false
                }
            )
        }
    }

    /** Verify phone OTP via Supabase Auth REST API. */
    fun verifyPhoneOtp(phone: String, token: String) {
        _authLoading.value = true
        _authError.value = null
        viewModelScope.launch {
            val result = SupabaseAuth.verifyPhoneOtp("+91$phone", token)
            result.fold(
                onSuccess = { resp ->
                    _accessToken.value = resp.access_token
                    val user = resp.user
                    if (user != null) {
                        onSupabaseLogin(
                            userId = user.id,
                            email = user.email,
                            phone = user.phone ?: phone,
                            name = user.user_metadata?.get("name") ?: "Parent"
                        )
                    }
                    _authLoading.value = false
                },
                onFailure = { e ->
                    _authError.value = e.message ?: "Invalid code"
                    _authLoading.value = false
                }
            )
        }
    }

    fun clearAuthError() {
        _authError.value = null
    }

    fun clearAuthLoading() {
        _authLoading.value = false
    }

    // ─── Legacy login (kept for offline/demo mode) ─────────

    /** Called after successful Supabase Auth (email or phone). */
    fun onSupabaseLogin(userId: String, email: String, phone: String, name: String) {
        _isLoggedIn.value = true
        // Wire the access token for authenticated API calls
        supabase.accessToken = _accessToken.value
        _uiState.update {
            it.copy(
                userId = userId,
                email = email,
                phone = phone,
                parentName = name.ifBlank { it.parentName },
                consentAccepted = true,
            )
        }
        persistState()
        // Sync profile to Supabase with user_id
        viewModelScope.launch {
            try {
                val state = _uiState.value
                supabase.upsertProfile(ProfileDto(
                    id = profileId(),
                    userId = userId.ifBlank { null },
                    phone = state.phone.ifBlank { null },
                    name = state.parentName,
                    onboardingComplete = _onboardingComplete.value,
                    isLoggedIn = true,
                    darkTheme = state.darkTheme,
                    localeCode = state.locale.code,
                    familyCode = state.familyCode,
                    notificationsEnabled = state.notificationsEnabled,
                    campRemindersEnabled = state.campRemindersEnabled,
                    consentAccepted = true,
                    consentDeclined = false,
                ))
                syncKidsToSupabase()
                syncAppointmentsToSupabase()
                _meals.value.keys.forEach { syncMealsToSupabase(it) }
                _streaks.value.keys.forEach { syncStreakToSupabase(it) }
            } catch (_: Exception) { }
        }
        scheduleAllNotifications()
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
        syncProfileToSupabase()
        syncKidsToSupabase()
        syncAppointmentsToSupabase()
        // Sync all meals
        _meals.value.keys.forEach { syncMealsToSupabase(it) }
        _streaks.value.keys.forEach { syncStreakToSupabase(it) }
    }

    fun scheduleAllNotifications() {
        val app = getApplication<Application>()
        if (!hasNotificationPermission(app)) return
        val state = _uiState.value
        if (state.notificationsEnabled) {
            if (state.campRemindersEnabled) {
                state.camps.filter { it.status == CampStatus.UPCOMING }.forEach { camp ->
                    NotificationScheduler.scheduleCampReminder(app, camp.title, camp.date, camp.time)
                }
            }
            state.appointments.forEach { appt ->
                NotificationScheduler.scheduleCheckupReminder(app, appt.doctorName, appt.kidName, appt.date, appt.time)
            }
        }
        state.kids.forEach { kid ->
            NotificationScheduler.scheduleDietReminder(app, kid.name, kid.id)
        }
    }

    private fun hasNotificationPermission(context: Context): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
        } else true
    }

    fun logout() {
        _isLoggedIn.value = false
        _onboardingComplete.value = false
        val currentFamilyCode = _uiState.value.familyCode
        storage.clear()
        // Sign out from Supabase and clear token
        viewModelScope.launch {
            val token = _accessToken.value
            _accessToken.value = null
            supabase.accessToken = null
            if (token != null) {
                try { SupabaseAuth.signOut(token) } catch (_: Exception) { }
            }
        }
        _uiState.value = _uiState.value.copy(
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
        syncProfileToSupabase()
    }

    // --- Notification toggles ---
    fun toggleNotificationsEnabled() {
        _uiState.update { it.copy(notificationsEnabled = !it.notificationsEnabled) }
        val app = getApplication<Application>()
        if (!_uiState.value.notificationsEnabled) {
            cancelAllNotifications(app)
        } else {
            scheduleAllNotifications()
        }
        persistState()
    }

    fun toggleCampReminders() {
        _uiState.update { it.copy(campRemindersEnabled = !it.campRemindersEnabled) }
        if (!_uiState.value.campRemindersEnabled) {
            cancelCampNotifications()
        } else {
            scheduleAllNotifications()
        }
        persistState()
    }

    private fun cancelAllNotifications(app: Application) {
        val alarmManager = app.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val state = _uiState.value
        // Cancel camp reminders
        state.camps.filter { it.status == CampStatus.UPCOMING }.forEach { camp ->
            val intent = Intent(app, NotificationReceiver::class.java)
            val pending = PendingIntent.getBroadcast(
                app, camp.title.hashCode(), intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            alarmManager.cancel(pending)
        }
        // Cancel appointment reminders
        state.appointments.forEach { appt ->
            val intent = Intent(app, NotificationReceiver::class.java)
            val pending = PendingIntent.getBroadcast(
                app, (appt.doctorName + appt.date).hashCode(), intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            alarmManager.cancel(pending)
        }
        // Cancel diet reminders
        state.kids.forEach { kid ->
            val intent = Intent(app, NotificationReceiver::class.java)
            val pending = PendingIntent.getBroadcast(
                app, kid.id.hashCode(), intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            alarmManager.cancel(pending)
        }
    }

    private fun cancelCampNotifications() {
        val app = getApplication<Application>()
        val alarmManager = app.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val state = _uiState.value
        state.camps.filter { it.status == CampStatus.UPCOMING }.forEach { camp ->
            val intent = Intent(app, NotificationReceiver::class.java)
            val pending = PendingIntent.getBroadcast(
                app, camp.title.hashCode(), intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            alarmManager.cancel(pending)
        }
    }

    // --- Locale ---
    fun setLocale(locale: AppLocale) {
        _uiState.update { it.copy(locale = locale) }
        persistState()
        syncProfileToSupabase()
    }

    // --- Family sharing ---
    fun generateFamilyCode() {
        val chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
        val code = (1..6).map { chars.random() }.joinToString("")
        _uiState.update { it.copy(familyCode = code) }
        persistState()
        syncProfileToSupabase()
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
        // Sync co-parent to Supabase
        viewModelScope.launch {
            try {
                val cp = _uiState.value.coParents.last()
                supabase.upsertCoParent(CoParentDto(
                    id = cp.id, profileId = profileId(),
                    userId = _uiState.value.userId.ifBlank { null },
                    name = cp.name, relation = cp.relation,
                    joinedDate = cp.joinedDate,
                ))
            } catch (_: Exception) { }
        }
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
        syncMealsToSupabase(kidId)
        syncStreakToSupabase(kidId)
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

    fun addMealItem(kidId: String, name: String, detail: String, kcal: Int, timeSlot: String = "Snack") {
        val newMeal = MealItem(
            id = "m${UUID.randomUUID().toString().take(8)}",
            time = timeSlot,
            name = name,
            detail = detail,
            kcal = kcal,
            eaten = true
        )
        _meals.update { current ->
            val list = (current[kidId].orEmpty() + newMeal).sortedBy { m ->
                when (m.time) {
                    "Breakfast" -> 0; "Mid-morning" -> 1; "Lunch" -> 2
                    "Evening" -> 3; "Dinner" -> 4; else -> 5
                }
            }
            current + (kidId to list)
        }
        // Auto-update streak for logging a meal
        val today = LocalDate.now().format(DateTimeFormatter.ISO_LOCAL_DATE)
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
        syncMealsToSupabase(kidId)
        syncStreakToSupabase(kidId)
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
        _meals.update { it + (newKid.id to SampleData.personalizedMeals(newKid)) }
        _streaks.update { it + (newKid.id to StreakInfo()) }
        persistState()
        // Sync to Supabase
        syncKidsToSupabase()
        syncMealsToSupabase(newKid.id)
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
        // Sync growth point to Supabase
        viewModelScope.launch {
            try {
                supabase.upsertGrowthPoint(GrowthPointDto(
                    id = "${kidId}_gp_${label.replace(" ", "_")}",
                    kidId = kidId,
                    userId = _uiState.value.userId.ifBlank { null },
                    label = label,
                    height = heightCm.toDouble(),
                    weight = weightKg.toDouble(),
                ))
                syncKidsToSupabase()
            } catch (_: Exception) { }
        }
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
        // Schedule notification for this appointment
        val app = getApplication<Application>()
        NotificationScheduler.scheduleCheckupReminder(app, doctor.name, kidName, date, time)
        persistState()
        // Sync to Supabase
        viewModelScope.launch {
            try {
                supabase.upsertAppointment(AppointmentDto(
                    id = appt.id, profileId = profileId(),
                    userId = _uiState.value.userId.ifBlank { null },
                    doctorName = appt.doctorName,
                    specialty = appt.specialty, kidName = appt.kidName,
                    date = appt.date, time = appt.time,
                ))
            } catch (_: Exception) { }
        }
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
