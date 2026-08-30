package com.rork.vitahero.data

import android.app.Application
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * Pulls authenticated user data from Neon and applies it to [AppStateHolder].
 */
class BackendDataLoader(
    private val app: Application,
    private val auth: AuthManager,
    private val api: ApiRepository,
    private val state: AppStateHolder,
) {
    suspend fun fetchAndApply(onKidIdsLoaded: suspend (List<String>) -> Unit = {}) {
        if (!ApiService.isConfigured || !auth.isLoggedIn.value) return
        if (auth.profileId.value.isBlank()) return

        val profile = api.fetchMyProfile()
        val kidDtos = api.fetchKids()
        val kidsFromBackend = kidDtos.map { BackendDataMapper.mapKid(it) }

        var allGrowthPoints = emptyMap<String, List<GrowthPoint>>()
        for (kidDto in kidDtos) {
            try {
                val gps = api.fetchGrowthPoints(kidDto.id)
                allGrowthPoints = allGrowthPoints + (kidDto.id to gps.map(BackendDataMapper::mapGrowthPoint))
            } catch (_: Exception) { }
        }
        val kidsWithGrowth = kidsFromBackend.map { kid ->
            val gps = allGrowthPoints[kid.id]
            if (gps != null && gps.isNotEmpty()) kid.copy(growth = gps) else kid
        }

        val appointmentsFromBackend = api.fetchAppointments().map { dto ->
            Appointment(
                dto.id, dto.doctorId.orEmpty(), dto.doctorName,
                dto.specialty, dto.kidName, dto.date, dto.time,
            )
        }

        val campsFromBackend = api.fetchCamps().map(BackendDataMapper::mapCamp)
        val mySchools = api.fetchMySchools().map(BackendDataMapper::mapMySchool)
        val browseSchools = api.fetchSchools().map(BackendDataMapper::mapPartnerSchool)

        val mealsFromBackend: Map<String, List<MealItem>> = api.fetchAllMeals()
            .groupBy { it.kidId }
            .mapValues { (_, list) -> list.map(BackendDataMapper::mapMeal) }

        val mealsWithBootstrap = mealsFromBackend.toMutableMap()
        for (kid in kidsWithGrowth) {
            if (mealsWithBootstrap[kid.id].isNullOrEmpty()) {
                val plan = MealPlanGenerator.initialPlanFor(kid)
                mealsWithBootstrap[kid.id] = plan
                if (auth.isLoggedIn.value) {
                    try {
                        api.upsertMeals(plan.map { meal ->
                            MealItemDto(
                                id = meal.id,
                                profileId = auth.profileId.value,
                                userId = auth.userId.value.ifBlank { auth.profileId.value },
                                kidId = kid.id,
                                timeSlot = meal.time,
                                name = meal.name,
                                detail = meal.detail,
                                kcal = meal.kcal,
                                eaten = meal.eaten,
                            )
                        })
                    } catch (_: Exception) { }
                }
            }
        }

        val streaksFromBackend = mutableMapOf<String, StreakInfo>()
        for (kidDto in kidDtos) {
            api.fetchStreak(kidDto.id)?.let { streak ->
                streaksFromBackend[kidDto.id] = StreakInfo(
                    streak.currentStreak, streak.bestStreak, streak.lastLogDate,
                )
            }
        }

        val aiFromBackend = mutableMapOf<String, AIDietContent>()
        for (kidDto in kidDtos) {
            try {
                api.fetchAiDietTip(kidDto.id)?.content?.let { tip ->
                    if (tip.greeting.isNotBlank()) {
                        aiFromBackend[kidDto.id] = AIDietContent(
                            greeting = tip.greeting,
                            insight = tip.insight,
                            suggestion = tip.suggestion,
                            funFact = tip.funFact,
                            generatedAt = tip.generatedAt.ifBlank { "Saved tip" },
                        )
                    }
                }
            } catch (_: Exception) { }
        }

        val coParentsFromBackend = api.fetchCoParents().map { dto ->
            CoParent(dto.id, dto.name, dto.relation, dto.joinedDate)
        }

        val bookingCity = state.uiState.value.partnerSchools.firstOrNull()?.city?.ifBlank { null }
            ?: state.uiState.value.bookingCity.ifBlank { "Hyderabad" }
        val lat = state.uiState.value.userLat
        val lng = state.uiState.value.userLng

        val bookingDto = api.fetchBookingDirectory(bookingCity, lat = lat, lng = lng)
        val bookingDirectory = bookingDto?.let { mapBookingDirectory(it) }
        val doctorsFromBackend = bookingDirectory?.hospitals?.flatMap { it.doctors }
            ?: api.fetchDoctors(bookingCity).map { mapDoctorDto(it) }

        val notifDtos = api.fetchNotifications()
        val notificationsFromBackend = notifDtos.map { dto ->
            AppNotification(
                id = dto.id, title = dto.title, body = dto.body, time = dto.time,
                type = runCatching { NotificationType.valueOf(dto.type) }
                    .getOrDefault(NotificationType.CAMP),
                unread = dto.unread,
            )
        }

        val restoredLocale = profile?.localeCode?.let { code ->
            AppLocale.entries.firstOrNull { it.code == code }
        } ?: state.uiState.value.locale

        withContext(Dispatchers.Main) {
            state.uiState.value = state.uiState.value.copy(
                userId = auth.profileId.value,
                parentName = profile?.name?.ifBlank { state.uiState.value.parentName }
                    ?: state.uiState.value.parentName,
                phone = profile?.phone?.ifBlank { state.uiState.value.phone }
                    ?: state.uiState.value.phone,
                email = profile?.email?.ifBlank { state.uiState.value.email }
                    ?: state.uiState.value.email,
                kids = kidsWithGrowth,
                camps = campsFromBackend,
                partnerSchools = mySchools,
                availableSchools = browseSchools,
                appointments = appointmentsFromBackend,
                doctors = doctorsFromBackend,
                bookingDirectory = bookingDirectory,
                bookingCity = bookingCity,
                notifications = notificationsFromBackend,
                familyCode = profile?.familyCode?.ifBlank { state.uiState.value.familyCode }
                    ?: state.uiState.value.familyCode,
                coParents = coParentsFromBackend,
                darkTheme = profile?.darkTheme ?: state.uiState.value.darkTheme,
                locale = restoredLocale,
                notificationsEnabled = profile?.notificationsEnabled
                    ?: state.uiState.value.notificationsEnabled,
                campRemindersEnabled = profile?.campRemindersEnabled
                    ?: state.uiState.value.campRemindersEnabled,
                consentAccepted = profile?.consentAccepted ?: state.uiState.value.consentAccepted,
                consentDeclined = profile?.consentDeclined ?: state.uiState.value.consentDeclined,
            )
            state.meals.value = mealsWithBootstrap
            state.streaks.value = streaksFromBackend
            if (aiFromBackend.isNotEmpty()) {
                state.aiContent.value = state.aiContent.value + aiFromBackend
            }
            profile?.onboardingComplete?.let { if (it) auth.setOnboardingComplete(true) }
        }

        onKidIdsLoaded(kidsWithGrowth.map { it.id })
    }
}
