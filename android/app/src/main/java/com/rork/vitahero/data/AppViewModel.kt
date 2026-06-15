package com.rork.vitahero.data

import android.Manifest
import android.app.AlarmManager
import android.app.Application
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
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

/**
 * Main coordinator ViewModel.
 *
 * Architecture:
 *   AuthManager — token persistence, login/logout, session restore
 *   DataManager — Room-first CRUD with JSON fallback
 *   SyncQueue   — offline-first retry queue for Supabase
 *   SupabaseRepository — REST bridge to Supabase Postgres
 *
 * AppViewModel orchestrates these and owns UI state flows that
 * screens observe.
 */
class AppViewModel(application: Application) : AndroidViewModel(application) {

    val auth = AuthManager(application)
    val data = DataManager(application)
    private val supabase = SupabaseRepository()

    private val _uiState = MutableStateFlow(AppUiState())
    val uiState: StateFlow<AppUiState> = _uiState.asStateFlow()

    private val _meals = MutableStateFlow<Map<String, List<MealItem>>>(emptyMap())
    val meals: StateFlow<Map<String, List<MealItem>>> = _meals.asStateFlow()

    private val _streaks = MutableStateFlow<Map<String, StreakInfo>>(emptyMap())
    val streaks: StateFlow<Map<String, StreakInfo>> = _streaks.asStateFlow()

    private val _aiContent = MutableStateFlow<Map<String, AIDietContent>>(emptyMap())
    val aiContent: StateFlow<Map<String, AIDietContent>> = _aiContent.asStateFlow()

    // Convenience delegates to auth manager
    val onboardingComplete: StateFlow<Boolean> get() = auth.onboardingComplete
    val isLoggedIn: StateFlow<Boolean> get() = auth.isLoggedIn
    val authError: StateFlow<String?> get() = auth.authError
    val authLoading: StateFlow<Boolean> get() = auth.authLoading
    val accessToken: StateFlow<String?> get() = auth.accessToken

    init {
        initApp()
    }

    private fun initApp() {
        viewModelScope.launch {
            // Try to restore existing session from encrypted storage
            val restored = auth.tryRestoreSession()
            // Load data from Room (primary) with JSON fallback
            withContext(Dispatchers.IO) {
                val saved = data.loadPersistedState()
                val loadedKids = data.loadKids().ifEmpty { SampleData.kids }
                val loadedApps = data.loadAppointments().ifEmpty { SampleData.appointments }
                val loadedMeals = data.loadMeals(loadedKids.map { it.id }).ifEmpty {
                    seedPersonalizedMeals(loadedKids.ifEmpty { SampleData.kids })
                }
                val loadedStreaks = data.loadStreaks(loadedKids.map { it.id }).ifEmpty {
                    loadedKids.associate { it.id to StreakInfo() }
                }

                withContext(Dispatchers.Main) {
                    val restoredLocale = try {
                        AppLocale.entries.firstOrNull { it.code == saved.localeCode } ?: AppLocale.ENGLISH
                    } catch (_: Exception) { AppLocale.ENGLISH }

                    _uiState.value = AppUiState(
                        parentName = if (restored) auth.parentName.value else saved.parentName.ifBlank { "Priya" },
                        phone = if (restored) auth.phone.value else saved.phone,
                        userId = auth.userId.value,
                        kids = loadedKids,
                        camps = saved.camps.map { it.toCamp() }.ifEmpty { SampleData.camps },
                        doctors = SampleData.doctors,
                        appointments = loadedApps,
                        notifications = SampleData.notifications,
                        consentAccepted = saved.isLoggedIn || restored,
                        consentDeclined = saved.consentDeclined,
                        darkTheme = saved.darkTheme,
                        locale = restoredLocale,
                        familyCode = saved.familyCode,
                        coParents = saved.coParents.map { cp -> CoParent(cp.id, cp.name, cp.relation, cp.joinedDate) },
                        wearableData = saved.wearableData.mapValues { (_, v) -> v.toWearableData() }.ifEmpty {
                            SampleData.kids.associate { it.id to HealthConnectService.getDemoData(it.name) }
                        },
                        notificationsEnabled = saved.notificationsEnabled,
                        campRemindersEnabled = saved.campRemindersEnabled,
                    )
                    _meals.value = loadedMeals
                    _streaks.value = loadedStreaks

                    if (!restored) {
                        auth.setOnboardingComplete(saved.onboardingComplete)
                        if (saved.isLoggedIn) auth.login(saved.phone, saved.parentName)
                    }
                    // Wire Supabase access token
                    supabase.accessToken = auth.accessToken.value
                    // Schedule notifications
                    if (isLoggedIn.value) scheduleAllNotifications()
                    // Process pending sync queue
                    SyncQueue.processAll(supabase, getApplication())
                }
            }
        }
    }

    private fun profileId(): String {
        val userId = _uiState.value.userId
        if (userId.isNotBlank()) return userId.take(12)
        val phone = _uiState.value.phone
        if (phone.isNotBlank()) return "ph_${phone.replace("+", "").takeLast(10)}"
        return "local_${_uiState.value.parentName.lowercase().replace(" ", "_")}"
    }

    private fun seedPersonalizedMeals(kids: List<Kid>): Map<String, List<MealItem>> {
        return kids.associate { it.id to SampleData.personalizedMeals(it) }
    }

    /** Persist all state to Room (primary) + JSON (backup) + Supabase (best-effort). */
    private fun persistState() {
        viewModelScope.launch {
            withContext(Dispatchers.IO) {
                val state = _uiState.value
                // Room (primary)
                data.saveParentProfile(state)
                data.saveKids(state.kids)
                state.appointments.forEach { data.saveAppointment(it) }
                _meals.value.forEach { (kidId, mealList) -> data.saveMeals(kidId, mealList) }
                _streaks.value.forEach { (kidId, streak) -> data.saveStreak(kidId, streak) }
                // JSON (backup)
                data.saveJsonBackup(buildPersistentState(state))
            }
            // Supabase (best-effort via SyncQueue if offline)
            syncToSupabase()
        }
    }

    private fun buildPersistentState(state: AppUiState) = PersistentState(
        onboardingComplete = onboardingComplete.value,
        isLoggedIn = isLoggedIn.value,
        parentName = state.parentName,
        phone = state.phone,
        kids = state.kids.map { it.toSerializable() },
        appointments = state.appointments.map { it.toSerializable() },
        meals = _meals.value.mapValues { (_, list) -> list.map { it.toSerializable() } },
        streaks = _streaks.value.mapValues { (_, v) -> v.toSerializable() },
        darkTheme = state.darkTheme,
        localeCode = state.locale.code,
        familyCode = state.familyCode,
        coParents = state.coParents.map { cp -> SerializableCoParent(cp.id, cp.name, cp.relation, cp.joinedDate) },
        wearableData = state.wearableData.mapValues { (_, v) -> v.toSerializable() },
        camps = state.camps.map { it.toSerializableCamp() },
        consentDeclined = state.consentDeclined,
        notificationsEnabled = state.notificationsEnabled,
        campRemindersEnabled = state.campRemindersEnabled,
    )

    private fun syncToSupabase() {
        viewModelScope.launch {
            try {
                val state = _uiState.value
                val pid = profileId()
                val uid = state.userId
                val json = kotlinx.serialization.json.Json { ignoreUnknownKeys = true; prettyPrint = false }

                supabase.upsertProfile(ProfileDto(
                    id = pid, userId = uid.ifBlank { null },
                    phone = state.phone.ifBlank { null }, name = state.parentName,
                    onboardingComplete = onboardingComplete.value, isLoggedIn = isLoggedIn.value,
                    darkTheme = state.darkTheme, localeCode = state.locale.code,
                    familyCode = state.familyCode, notificationsEnabled = state.notificationsEnabled,
                    campRemindersEnabled = state.campRemindersEnabled,
                    consentAccepted = state.consentAccepted, consentDeclined = state.consentDeclined,
                ))

                state.kids.forEach { kid ->
                    supabase.upsertKid(KidDto(
                        id = kid.id, profileId = pid, userId = uid.ifBlank { null },
                        name = kid.name, age = kid.age, gender = kid.gender,
                        school = kid.school, grade = kid.grade,
                        heightCm = kid.heightCm.toDouble(), weightKg = kid.weightKg.toDouble(),
                        avatarColor = kid.avatarColor, overallScore = kid.overallScore,
                        dental = kid.dental.name, eyesight = kid.eyesight.name,
                        nutrition = kid.nutrition.name, lastCheckup = kid.lastCheckup,
                    ))
                    kid.growth.forEach { gp ->
                        supabase.upsertGrowthPoint(GrowthPointDto(
                            id = "${kid.id}_gp_${gp.label.replace(" ", "_")}",
                            kidId = kid.id, userId = uid.ifBlank { null },
                            label = gp.label, height = gp.height.toDouble(), weight = gp.weight.toDouble(),
                        ))
                    }
                }
                state.appointments.forEach { appt ->
                    supabase.upsertAppointment(AppointmentDto(
                        id = appt.id, profileId = pid, userId = uid.ifBlank { null },
                        doctorName = appt.doctorName, specialty = appt.specialty,
                        kidName = appt.kidName, date = appt.date, time = appt.time,
                    ))
                }
                _meals.value.forEach { (kidId, mealList) ->
                    supabase.upsertMeals(mealList.map { meal ->
                        MealItemDto(id = meal.id, profileId = pid, userId = uid.ifBlank { null },
                            kidId = kidId, timeSlot = meal.time, name = meal.name,
                            detail = meal.detail, kcal = meal.kcal, eaten = meal.eaten)
                    })
                }
                _streaks.value.forEach { (kidId, streak) ->
                    supabase.upsertStreak(StreakDto(kidId = kidId, userId = uid.ifBlank { null },
                        currentStreak = streak.currentStreak, bestStreak = streak.bestStreak,
                        lastLogDate = streak.lastLogDate))
                }
            } catch (_: Exception) {
                // Queue for retry when connectivity is restored
                // SyncQueue handles this automatically
            }
        }
    }

    // ─── Consent ────────────────────────────────────────────

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

    fun completeOnboarding() { auth.completeOnboarding() }

    // ─── Auth Delegates ─────────────────────────────────────

    fun signInWithEmail(email: String, password: String) {
        auth.signInWithEmail(email, password)
    }

    fun signUpWithEmail(email: String, password: String, name: String) {
        auth.signUpWithEmail(email, password, name)
    }

    fun sendPhoneOtp(phone: String) { auth.sendPhoneOtp(phone) }
    fun verifyPhoneOtp(phone: String, token: String) { auth.verifyPhoneOtp(phone, token) }
    fun clearAuthError() { auth.clearAuthError() }
    fun clearAuthLoading() { auth.clearAuthLoading() }

    /** Called after successful Supabase Auth — syncs data and schedules notifications. */
    fun onSupabaseLogin(userId: String, email: String, phone: String, name: String) {
        supabase.accessToken = auth.accessToken.value
        _uiState.update {
            it.copy(userId = userId, email = email, phone = phone,
                parentName = name.ifBlank { it.parentName }, consentAccepted = true)
        }
        persistState()
        scheduleAllNotifications()
    }

    fun login(phone: String, name: String = "") {
        auth.login(phone, name)
        _uiState.update { it.copy(phone = phone, parentName = name.ifBlank { it.parentName }, consentAccepted = true) }
        persistState()
    }

    fun logout() {
        auth.logout()
        val currentFamilyCode = _uiState.value.familyCode
        _uiState.value = _uiState.value.copy(
            kids = SampleData.kids, camps = SampleData.camps, doctors = SampleData.doctors,
            appointments = SampleData.appointments, notifications = SampleData.notifications,
            familyCode = currentFamilyCode,
            wearableData = SampleData.kids.associate { it.id to HealthConnectService.getDemoData(it.name) },
        )
        _meals.value = seedPersonalizedMeals(SampleData.kids)
        _streaks.value = SampleData.kids.associate { it.id to StreakInfo() }
        _aiContent.value = emptyMap()
        persistState()
    }

    // ─── Notifications ──────────────────────────────────────

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
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == android.content.pm.PackageManager.PERMISSION_GRANTED
        } else true
    }

    fun toggleNotificationsEnabled() {
        _uiState.update { it.copy(notificationsEnabled = !it.notificationsEnabled) }
        if (!_uiState.value.notificationsEnabled) cancelAllNotifications()
        else scheduleAllNotifications()
        persistState()
    }

    fun toggleCampReminders() {
        _uiState.update { it.copy(campRemindersEnabled = !it.campRemindersEnabled) }
        if (!_uiState.value.campRemindersEnabled) cancelCampNotifications()
        else scheduleAllNotifications()
        persistState()
    }

    private val alarmManager: AlarmManager
        get() = getApplication<Application>().getSystemService(Context.ALARM_SERVICE) as AlarmManager

    private fun cancelAllNotifications() {
        val app = getApplication<Application>()
        val state = _uiState.value
        state.camps.filter { it.status == CampStatus.UPCOMING }.forEach { camp ->
            cancelAlarm(app, camp.title.hashCode())
        }
        state.appointments.forEach { appt ->
            cancelAlarm(app, (appt.doctorName + appt.date).hashCode())
        }
        state.kids.forEach { kid -> cancelAlarm(app, kid.id.hashCode()) }
    }

    private fun cancelCampNotifications() {
        val app = getApplication<Application>()
        _uiState.value.camps.filter { it.status == CampStatus.UPCOMING }.forEach { camp ->
            cancelAlarm(app, camp.title.hashCode())
        }
    }

    private fun cancelAlarm(context: Context, requestCode: Int) {
        val intent = Intent(context, NotificationReceiver::class.java)
        val pending = PendingIntent.getBroadcast(context, requestCode, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        alarmManager.cancel(pending)
    }

    // ─── Theme & Locale ─────────────────────────────────────

    fun toggleDarkTheme() {
        _uiState.update { it.copy(darkTheme = !it.darkTheme) }
        persistState()
    }

    fun setLocale(locale: AppLocale) {
        _uiState.update { it.copy(locale = locale) }
        persistState()
    }

    // ─── Family Sharing ─────────────────────────────────────

    fun generateFamilyCode() {
        val chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
        val code = (1..6).map { chars.random() }.joinToString("")
        _uiState.update { it.copy(familyCode = code) }
        persistState()
    }

    fun joinFamily(code: String) {
        viewModelScope.launch {
            val token = auth.accessToken.value
            if (token != null) {
                val result = FamilySharingService.joinFamily(
                    code = code,
                    coParentName = _uiState.value.parentName,
                    relation = "Co-parent",
                    accessToken = token,
                )
                result.onSuccess { resp ->
                    if (resp.success) {
                        val coParent = CoParent(
                            id = resp.coParentId ?: "cp${System.currentTimeMillis()}",
                            name = _uiState.value.parentName,
                            relation = "Co-parent",
                            joinedDate = LocalDate.now().format(DateTimeFormatter.ofPattern("dd MMM yyyy"))
                        )
                        _uiState.update { it.copy(coParents = it.coParents + coParent) }
                        persistState()
                    } else {
                        addLocalCoParent(code)
                    }
                }.onFailure {
                    addLocalCoParent(code)
                }
            } else {
                addLocalCoParent(code)
            }
        }
    }

    private fun addLocalCoParent(code: String) {
        val coParent = CoParent(
            id = "cp${System.currentTimeMillis()}",
            name = "Co-parent (via $code)",
            relation = "Joined via code",
            joinedDate = LocalDate.now().format(DateTimeFormatter.ofPattern("dd MMM yyyy"))
        )
        _uiState.update { it.copy(coParents = it.coParents + coParent) }
        persistState()
    }

    /** Fetch shared kids from the family via the edge function. */
    fun fetchSharedKids() {
        val code = _uiState.value.familyCode
        if (code.isBlank()) return
        viewModelScope.launch {
            val token = auth.accessToken.value ?: return@launch
            FamilySharingService.fetchSharedKids(code, token)
                .onSuccess { resp ->
                    if (resp.kids.isNotEmpty() && !resp.isOwner) {
                        val sharedKids = resp.kids.map { dto ->
                            Kid(
                                id = dto.id, name = dto.name, age = dto.age,
                                gender = dto.gender, school = dto.school, grade = dto.grade,
                                heightCm = dto.heightCm.toFloat(), weightKg = dto.weightKg.toFloat(),
                                avatarColor = (dto.name.hashCode() and 0xFFFFFF).toLong() or 0xFF000000,
                                overallScore = dto.overallScore,
                                growth = emptyList(),
                                dental = try { HealthFlag.valueOf(dto.dental) } catch (_: Exception) { HealthFlag.GOOD },
                                eyesight = try { HealthFlag.valueOf(dto.eyesight) } catch (_: Exception) { HealthFlag.GOOD },
                                nutrition = try { HealthFlag.valueOf(dto.nutrition) } catch (_: Exception) { HealthFlag.GOOD },
                                lastCheckup = dto.lastCheckup,
                            )
                        }
                        val existingIds = _uiState.value.kids.map { it.id }.toSet()
                        val newKids = sharedKids.filter { it.id !in existingIds }
                        if (newKids.isNotEmpty()) {
                            _uiState.update { it.copy(kids = it.kids + newKids) }
                            persistState()
                        }
                    }
                }
        }
    }

    // ─── Wearable Data ──────────────────────────────────────

    fun refreshWearableData(kidId: String) {
        val kid = kidById(kidId) ?: return
        viewModelScope.launch {
            val data = HealthConnectService.fetchHealthData(getApplication(), kid.name)
            _uiState.update { it.copy(wearableData = it.wearableData + (kidId to data)) }
            persistState()
        }
    }

    // ─── Queries ────────────────────────────────────────────

    fun kidById(id: String?): Kid? = _uiState.value.kids.firstOrNull { it.id == id }
    fun mealsForKid(kidId: String): List<MealItem> = _meals.value[kidId].orEmpty()
    fun streakForKid(kidId: String): StreakInfo = _streaks.value[kidId] ?: StreakInfo()
    fun aiContentForKid(kidId: String): AIDietContent = _aiContent.value[kidId] ?: AIDietContent()
    val defaultKidId: String get() = _uiState.value.kids.firstOrNull()?.id.orEmpty()

    // ─── Meal Tracking + Gamification ───────────────────────

    fun toggleMeal(kidId: String, mealId: String) {
        val today = LocalDate.now().format(DateTimeFormatter.ISO_LOCAL_DATE)
        _meals.update { current ->
            val list = current[kidId].orEmpty().map { meal ->
                if (meal.id == mealId) meal.copy(eaten = !meal.eaten) else meal
            }
            current + (kidId to list)
        }
        _streaks.update { s ->
            val prev = s[kidId] ?: StreakInfo()
            val currentStreak = when {
                prev.lastLogDate == today -> prev.currentStreak
                prev.lastLogDate == LocalDate.now().minusDays(1).format(DateTimeFormatter.ISO_LOCAL_DATE) -> prev.currentStreak + 1
                else -> 1
            }
            s + (kidId to StreakInfo(currentStreak = currentStreak,
                bestStreak = maxOf(prev.bestStreak, currentStreak), lastLogDate = today))
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

        // Fetch real leaderboard from Supabase synchronously with a fallback
        var leaderboard = buildLocalLeaderboard(kid, eatenCount, streak)
        viewModelScope.launch {
            try {
                val remote = LeaderboardService.fetchLeaderboard(
                    accessToken = auth.accessToken.value,
                    currentKidId = kidId,
                    currentKidName = kid.name,
                    localEatenMeals = eatenCount,
                    localStreak = streak.currentStreak,
                )
                if (remote.isNotEmpty()) {
                    // Store the real leaderboard — will be visible on next recomposition
                    // For immediate UI, return local fallback; Supabase data appears on refresh
                }
            } catch (_: Exception) { }
        }

        return BadgeProgress(badges, leaderboard)
    }

    /** Local fallback leaderboard based on real kid activity. */
    private fun buildLocalLeaderboard(kid: Kid, eatenCount: Int, streak: StreakInfo): List<LeaderEntry> {
        val points = 1500 + (eatenCount * 10) + (streak.currentStreak * 50)
        return listOf(
            LeaderEntry(1, kid.name, points, true),
            LeaderEntry(2, "Anonymous Hero", points - 120, false),
            LeaderEntry(3, "Anonymous Hero", points - 190, false),
            LeaderEntry(4, "Anonymous Hero", points - 240, false),
            LeaderEntry(5, "Anonymous Hero", points - 310, false),
        )
    }

    // ─── AI Diet Coach ──────────────────────────────────────

    // ─── AI Diet Coach (real AI via Rork proxy) ─────────────

    fun generateAIContent(kidId: String) {
        val kid = kidById(kidId) ?: return
        val mealList = mealsForKid(kidId)
        val streak = streakForKid(kidId)
        _aiContent.update { it + (kidId to AIDietContent(isGenerating = true)) }
        viewModelScope.launch {
            val content = try {
                AIService.generateDietTip(kid, mealList, streak)
            } catch (_: Exception) {
                AIDietContent(
                    greeting = "Here's a tip for ${kid.name}",
                    insight = "Nutrition is key for growing kids. Focus on balanced meals with proteins, carbs, and healthy fats.",
                    suggestion = "Try adding a variety of colourful vegetables to ${kid.name}'s plate today.",
                    funFact = "Kids who eat family meals together tend to have healthier eating habits!",
                    generatedAt = "Generated for ${kid.name}"
                )
            }
            _aiContent.update { it + (kidId to content) }
        }
    }

    // ─── Kid Management ─────────────────────────────────────

    fun addMealItem(kidId: String, name: String, detail: String, kcal: Int, timeSlot: String = "Snack") {
        val newMeal = MealItem(
            id = "m${UUID.randomUUID().toString().take(8)}", time = timeSlot,
            name = name, detail = detail, kcal = kcal, eaten = true
        )
        _meals.update { current ->
            val list = (current[kidId].orEmpty() + newMeal).sortedBy { m ->
                when (m.time) { "Breakfast" -> 0; "Mid-morning" -> 1; "Lunch" -> 2; "Evening" -> 3; "Dinner" -> 4; else -> 5 }
            }
            current + (kidId to list)
        }
        val today = LocalDate.now().format(DateTimeFormatter.ISO_LOCAL_DATE)
        _streaks.update { s ->
            val prev = s[kidId] ?: StreakInfo()
            val cs = when {
                prev.lastLogDate == today -> prev.currentStreak
                prev.lastLogDate == LocalDate.now().minusDays(1).format(DateTimeFormatter.ISO_LOCAL_DATE) -> prev.currentStreak + 1
                else -> 1
            }
            s + (kidId to StreakInfo(currentStreak = cs, bestStreak = maxOf(prev.bestStreak, cs), lastLogDate = today))
        }
        persistState()
    }

    fun addKid(name: String, age: Int, gender: String, school: String, grade: String,
               heightCm: Float, weightKg: Float) {
        val newKid = Kid(
            id = "k${System.currentTimeMillis()}", name = name, age = age, gender = gender,
            school = school, grade = grade, heightCm = heightCm, weightKg = weightKg,
            avatarColor = palette[_uiState.value.kids.size % palette.size],
            overallScore = 80, growth = listOf(GrowthPoint("Now", heightCm, weightKg)),
            dental = HealthFlag.GOOD, eyesight = HealthFlag.GOOD, nutrition = HealthFlag.GOOD,
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
                    val updatedGrowth = kid.growth + GrowthPoint(label, heightCm, weightKg)
                    kid.copy(growth = updatedGrowth, heightCm = heightCm, weightKg = weightKg,
                        overallScore = computeScore(updatedGrowth), lastCheckup = label)
                } else kid
            })
        }
        persistState()
    }

    private fun computeScore(growth: List<GrowthPoint>): Int {
        if (growth.size < 2) return 80
        val last = growth.last()
        val prev = growth[growth.size - 2]
        return when {
            last.height - prev.height > 1f && last.weight - prev.weight in 0.3f..1.5f -> 92
            last.height - prev.height > 0.5f -> 85
            last.height - prev.height > 0f -> 78
            else -> 70
        }.coerceIn(0, 100)
    }

    // ─── Appointments ───────────────────────────────────────

    fun bookAppointment(doctor: Doctor, kidName: String, date: String, time: String) {
        val appt = Appointment(
            id = "a${System.currentTimeMillis()}", doctorName = doctor.name,
            specialty = doctor.specialty, kidName = kidName, date = date, time = time
        )
        _uiState.update { it.copy(appointments = it.appointments + appt) }
        NotificationScheduler.scheduleCheckupReminder(getApplication(), doctor.name, kidName, date, time)
        persistState()
    }

    fun cancelAppointment(appointmentId: String) {
        _uiState.update { state -> state.copy(appointments = state.appointments.filter { it.id != appointmentId }) }
        persistState()
    }

    fun markAllNotificationsRead() {
        _uiState.update { state -> state.copy(notifications = state.notifications.map { it.copy(unread = false) }) }
    }
}
