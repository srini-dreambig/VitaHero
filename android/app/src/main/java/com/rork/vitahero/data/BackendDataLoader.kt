package com.rork.vitahero.data

import android.app.Application
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * Pulls authenticated user data from Firestore and applies it to [AppStateHolder].
 * Uses FirestoreRepository for direct Firestore reads (no Cloudflare Worker in the path).
 */
class BackendDataLoader(
    private val app: Application,
    private val auth: AuthManager,
    private val repo: FirestoreRepository,
    private val state: AppStateHolder,
) {
    suspend fun fetchAndApply(onKidIdsLoaded: suspend (List<String>) -> Unit = {}) {
        if (!auth.isLoggedIn.value) return
        if (auth.profileId.value.isBlank()) return

        // Self-heal admin-provisioned data (imported kids, parent name): runs on
        // every data load — not only fresh logins — so imports added after the
        // parent signed in, or app updates with a restored session, still show up.
        // provisioned_parents is admin-only in Firestore rules, so this must go
        // through the backend Worker (service account), never a direct client read.
        if (ApiService.isConfigured) {
            try { ApiRepositoryProvider.repository.resolveProvisionedData() } catch (_: Exception) { }
        }

        val profile = repo.fetchMyProfile()
        val kidDtos = repo.fetchKids()
        val kidsFromBackend = kidDtos.map { BackendDataMapper.mapKid(it) }

        var allGrowthPoints = emptyMap<String, List<GrowthPoint>>()
        for (kidDto in kidDtos) {
            try {
                val gps = repo.fetchGrowthPoints(kidDto.id)
                allGrowthPoints = allGrowthPoints + (kidDto.id to gps.map(BackendDataMapper::mapGrowthPoint))
            } catch (_: Exception) { }
        }
        val kidsWithGrowth = kidsFromBackend.map { kid ->
            val gps = allGrowthPoints[kid.id]
            if (gps != null && gps.isNotEmpty()) kid.copy(growth = gps) else kid
        }

        val appointmentsFromBackend = repo.fetchAppointments().map { dto ->
            Appointment(
                dto.id, dto.doctorId.orEmpty(), dto.doctorName,
                dto.specialty, dto.kidName, dto.date, dto.time,
            )
        }

        val personalCamps = repo.fetchCamps().map(BackendDataMapper::mapCamp)
        val mySchools = repo.fetchMySchools().map(BackendDataMapper::mapMySchool)
        val browseSchools = repo.fetchSchools().map(BackendDataMapper::mapPartnerSchool)

        // Fetch partner (school) camps for enrolled schools
        val schoolIds = mySchools.map { it.id }.ifEmpty {
            // Also check if profile has a school_id from provisioning
            listOfNotNull(profile?.schoolId?.takeIf { it.isNotBlank() })
        }
        val partnerCamps = if (schoolIds.isNotEmpty()) {
            try { repo.fetchSchoolCamps(schoolIds) } catch (_: Exception) { emptyList() }
        } else emptyList()
        val campsFromBackend = personalCamps + partnerCamps.map(BackendDataMapper::mapCamp)

        val mealsFromBackend: Map<String, List<MealItem>> = repo.fetchAllMeals()
            .groupBy { it.kidId }
            .mapValues { (_, list) -> list.map(BackendDataMapper::mapMeal) }

        val mealsWithBootstrap = mealsFromBackend.toMutableMap()
        for (kid in kidsWithGrowth) {
            if (mealsWithBootstrap[kid.id].isNullOrEmpty()) {
                val plan = MealPlanGenerator.initialPlanFor(kid)
                mealsWithBootstrap[kid.id] = plan
                if (auth.isLoggedIn.value) {
                    try {
                        repo.upsertMeals(plan.map { meal ->
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
            repo.fetchStreak(kidDto.id)?.let { streak ->
                streaksFromBackend[kidDto.id] = StreakInfo(
                    streak.currentStreak, streak.bestStreak, streak.lastLogDate,
                )
            }
        }

        val aiFromBackend = mutableMapOf<String, AIDietContent>()
        for (kidDto in kidDtos) {
            try {
                repo.fetchAiDietTip(kidDto.id)?.content?.let { tip ->
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

        val coParentsFromBackend = repo.fetchCoParents().map { dto ->
            CoParent(dto.id, dto.name, dto.relation, dto.joinedDate)
        }

        val bookingCity = state.uiState.value.partnerSchools.firstOrNull()?.city?.ifBlank { null }
            ?: state.uiState.value.bookingCity.ifBlank { "Hyderabad" }
        val lat = state.uiState.value.userLat
        val lng = state.uiState.value.userLng

        val bookingDto = repo.fetchBookingDirectory(bookingCity, lat = lat, lng = lng)
        val bookingDirectory = bookingDto?.let { mapBookingDirectory(it) }
        val doctorsFromBackend = bookingDirectory?.hospitals?.flatMap { it.doctors }
            ?: repo.fetchDoctors(bookingCity).map { mapDoctorDto(it) }

        val notifDtos = repo.fetchNotifications()
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
