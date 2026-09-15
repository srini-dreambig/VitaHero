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
    /**
     * The refreshed list, or what is already on screen.
     *
     * Every read here falls back to an empty list when it fails, and this
     * method then wrote all of them into app state unconditionally. So a
     * refresh on a bad connection — and this runs after adding a child, after
     * booking, after a profile change — replaced a family's children, camps and
     * appointments with nothing. The screen went blank and the app looked
     * broken, when in truth it had simply failed to ask.
     *
     * An empty list is only believed when the server actually answered. A
     * parent who removes their last child still sees it go.
     */
    private fun <T> List<T>.orKeep(current: List<T>, reached: Boolean): List<T> =
        if (reached || isNotEmpty()) this else current

    suspend fun fetchAndApply(onKidIdsLoaded: suspend (List<String>) -> Unit = {}) {
        if (!ApiService.isConfigured || !auth.isLoggedIn.value) return
        if (auth.profileId.value.isBlank()) return

        val failuresBefore = SessionSignals.transportFailures
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
        // Only bootstrap a plan for a child the server genuinely has none for.
        // When the meals read failed, "none" is not something we know, and
        // generating one would write a fabricated day over a real one.
        val mealsAreTrustworthy = SessionSignals.transportFailures == failuresBefore
        for (kid in if (mealsAreTrustworthy) kidsWithGrowth else emptyList()) {
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

        // Anything that failed on the way here means the empty lists below are
        // "we could not ask", not "there is nothing".
        val reached = SessionSignals.transportFailures == failuresBefore

        withContext(Dispatchers.Main) {
            val now = state.uiState.value
            state.uiState.value = now.copy(
                userId = auth.profileId.value,
                parentName = profile?.name?.ifBlank { now.parentName }
                    ?: now.parentName,
                phone = profile?.phone?.ifBlank { now.phone }
                    ?: now.phone,
                email = profile?.email?.ifBlank { now.email }
                    ?: now.email,
                kids = kidsWithGrowth.orKeep(now.kids, reached),
                camps = campsFromBackend.orKeep(now.camps, reached),
                partnerSchools = mySchools.orKeep(now.partnerSchools, reached),
                availableSchools = browseSchools.orKeep(now.availableSchools, reached),
                appointments = appointmentsFromBackend.orKeep(now.appointments, reached),
                doctors = doctorsFromBackend.orKeep(now.doctors, reached),
                bookingDirectory = bookingDirectory ?: now.bookingDirectory,
                bookingCity = bookingCity,
                notifications = notificationsFromBackend.orKeep(now.notifications, reached),
                familyCode = profile?.familyCode?.ifBlank { now.familyCode }
                    ?: now.familyCode,
                coParents = coParentsFromBackend.orKeep(now.coParents, reached),
                darkTheme = profile?.darkTheme ?: now.darkTheme,
                locale = restoredLocale,
                notificationsEnabled = profile?.notificationsEnabled
                    ?: now.notificationsEnabled,
                campRemindersEnabled = profile?.campRemindersEnabled
                    ?: now.campRemindersEnabled,
                consentAccepted = profile?.consentAccepted ?: now.consentAccepted,
                consentDeclined = profile?.consentDeclined ?: now.consentDeclined,
            )
            if (reached || mealsWithBootstrap.isNotEmpty()) state.meals.value = mealsWithBootstrap
            if (reached || streaksFromBackend.isNotEmpty()) state.streaks.value = streaksFromBackend
            if (aiFromBackend.isNotEmpty()) {
                state.aiContent.value = state.aiContent.value + aiFromBackend
            }
            profile?.onboardingComplete?.let { if (it) auth.setOnboardingComplete(true) }
        }

        onKidIdsLoaded(state.uiState.value.kids.map { it.id })
    }
}
