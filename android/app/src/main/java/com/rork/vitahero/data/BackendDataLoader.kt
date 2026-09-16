package com.rork.vitahero.data

import android.app.Application
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
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

        coroutineScope {
            val failuresBefore = SessionSignals.transportFailures

            // Opening the app used to be nineteen network round trips, each one
            // waiting for the last. On a 150ms connection that is nearly three
            // seconds before the home screen has anything in it; on a rural
            // connection, closer to six. It also runs after every write.
            //
            // There are only two real levels of dependency in all of it. Everything
            // below is independent — none of these reads needs another's answer.
            val profileD = async { api.fetchMyProfile() }
            val kidDtosD = async { api.fetchKids() }
            val appointmentsD = async { api.fetchAppointments() }
            val campsD = async { api.fetchCamps() }
            val mySchoolsD = async { api.fetchMySchools() }
            val browseSchoolsD = async { api.fetchSchools() }
            val mealsD = async { api.fetchAllMeals() }
            val coParentsD = async { api.fetchCoParents() }
            val notifsD = async { api.fetchNotifications() }

            val profile = profileD.await()
            val kidDtos = kidDtosD.await()
            val mySchools = mySchoolsD.await().map(BackendDataMapper::mapMySchool)
            val kidsFromBackend = kidDtos.map { BackendDataMapper.mapKid(it) }

            // The second level: what needs a child's id, or the school's city. The
            // per-child reads fan out across children and across kinds at once
            // rather than three loops end to end.
            val bookingCity = mySchools.firstOrNull()?.city?.ifBlank { null }
                ?: state.uiState.value.partnerSchools.firstOrNull()?.city?.ifBlank { null }
                ?: state.uiState.value.bookingCity.ifBlank { "Hyderabad" }
            val lat = state.uiState.value.userLat
            val lng = state.uiState.value.userLng

            val growthD = kidDtos.map { kid ->
                async { kid.id to runCatching { api.fetchGrowthPoints(kid.id) }.getOrDefault(emptyList()) }
            }
            val streakD = kidDtos.map { kid ->
                async { kid.id to runCatching { api.fetchStreak(kid.id) }.getOrNull() }
            }
            val aiD = kidDtos.map { kid ->
                async { kid.id to runCatching { api.fetchAiDietTip(kid.id) }.getOrNull() }
            }
            val bookingD = async { api.fetchBookingDirectory(bookingCity, lat = lat, lng = lng) }

            val allGrowthPoints = growthD.awaitAll().toMap()
                .mapValues { (_, gps) -> gps.map(BackendDataMapper::mapGrowthPoint) }
            val kidsWithGrowth = kidsFromBackend.map { kid ->
                val gps = allGrowthPoints[kid.id]
                if (!gps.isNullOrEmpty()) kid.copy(growth = gps) else kid
            }

            val appointmentsFromBackend = appointmentsD.await().map { dto ->
                Appointment(
                    dto.id, dto.doctorId.orEmpty(), dto.doctorName,
                    dto.specialty, dto.kidName, dto.date, dto.time,
                )
            }

            val campsFromBackend = campsD.await().map(BackendDataMapper::mapCamp)
            val browseSchools = browseSchoolsD.await().map(BackendDataMapper::mapPartnerSchool)

            val mealsFromBackend: Map<String, List<MealItem>> = mealsD.await()
                .groupBy { it.kidId }
                .mapValues { (_, list) -> list.map(BackendDataMapper::mapMeal) }

            val mealsWithBootstrap = mealsFromBackend.toMutableMap()
            // Only bootstrap a plan for a child the server genuinely has none for.
            // When the meals read failed, "none" is not something we know, and
            // generating one would write a fabricated day over a real one.
            val mealsAreTrustworthy = SessionSignals.transportFailures == failuresBefore
            val bootstrapped = mutableListOf<MealItemDto>()
            for (kid in if (mealsAreTrustworthy) kidsWithGrowth else emptyList()) {
                if (mealsWithBootstrap[kid.id].isNullOrEmpty()) {
                    val plan = MealPlanGenerator.initialPlanFor(kid)
                    mealsWithBootstrap[kid.id] = plan
                    bootstrapped += plan.map { meal ->
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
                    }
                }
            }
            // One write for every child that needed a plan, not one per child.
            if (bootstrapped.isNotEmpty() && auth.isLoggedIn.value) {
                runCatching { api.upsertMeals(bootstrapped) }
            }

            val streaksFromBackend = streakD.awaitAll().mapNotNull { (kidId, streak) ->
                streak?.let { kidId to StreakInfo(it.currentStreak, it.bestStreak, it.lastLogDate) }
            }.toMap()

            val aiFromBackend = aiD.awaitAll().mapNotNull { (kidId, tip) ->
                val content = tip?.content ?: return@mapNotNull null
                if (content.greeting.isBlank()) return@mapNotNull null
                kidId to AIDietContent(
                    greeting = content.greeting,
                    insight = content.insight,
                    suggestion = content.suggestion,
                    funFact = content.funFact,
                    generatedAt = content.generatedAt.ifBlank { "Saved tip" },
                )
            }.toMap()

            val coParentsFromBackend = coParentsD.await().map { dto ->
                CoParent(dto.id, dto.name, dto.relation, dto.joinedDate)
            }

            val bookingDirectory = bookingD.await()?.let { mapBookingDirectory(it) }
            val doctorsFromBackend = bookingDirectory?.hospitals?.flatMap { it.doctors }
                ?: api.fetchDoctors(bookingCity).map { mapDoctorDto(it) }

            val notificationsFromBackend = notifsD.await().map { dto ->
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
}
