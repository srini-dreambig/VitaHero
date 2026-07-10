package com.rork.vitahero.data

import java.util.UUID

/**
 * Pushes local state to the Neon backend. Used by AppViewModel and SyncRetryWorker.
 */
object BackendSyncEngine {

    fun buildBatch(
        entities: Set<SyncEntity>,
        profileId: String,
        userId: String,
        state: AppUiState,
        meals: Map<String, List<MealItem>>,
        streaks: Map<String, StreakInfo>,
        onboardingComplete: Boolean,
        isLoggedIn: Boolean,
    ): SyncBatch {
        val profile = if (SyncEntity.PROFILE in entities) {
            ProfileDto(
                id = profileId,
                userId = userId,
                phone = state.phone.ifBlank { null },
                name = state.parentName,
                email = state.email.ifBlank { null },
                onboardingComplete = onboardingComplete,
                isLoggedIn = isLoggedIn,
                darkTheme = state.darkTheme,
                localeCode = state.locale.code,
                familyCode = state.familyCode,
                notificationsEnabled = state.notificationsEnabled,
                campRemindersEnabled = state.campRemindersEnabled,
                consentAccepted = state.consentAccepted,
                consentDeclined = state.consentDeclined,
            )
        } else {
            null
        }

        val kidDtos = if (SyncEntity.KIDS in entities) {
            state.kids.map { kid ->
                KidDto(
                    id = kid.id,
                    profileId = profileId,
                    userId = userId,
                    name = kid.name,
                    age = kid.age,
                    gender = kid.gender,
                    school = kid.school,
                    grade = kid.grade,
                    heightCm = kid.heightCm.toDouble(),
                    weightKg = kid.weightKg.toDouble(),
                    avatarColor = kid.avatarColor,
                    overallScore = kid.overallScore,
                    dental = kid.dental.name,
                    eyesight = kid.eyesight.name,
                    nutrition = kid.nutrition.name,
                    lastCheckup = kid.lastCheckup,
                )
            }
        } else {
            emptyList()
        }

        val growthDtos = if (SyncEntity.GROWTH in entities) {
            state.kids.flatMap { kid ->
                kid.growth.map { gp ->
                    GrowthPointDto(
                        id = gp.id.ifBlank { "${kid.id}_gp_${UUID.randomUUID().toString().take(8)}" },
                        kidId = kid.id,
                        userId = userId,
                        label = gp.label,
                        height = gp.height.toDouble(),
                        weight = gp.weight.toDouble(),
                    )
                }
            }
        } else {
            emptyList()
        }

        val appointmentDtos = if (SyncEntity.APPOINTMENTS in entities) {
            state.appointments.map { appt ->
                AppointmentDto(
                    id = appt.id,
                    profileId = profileId,
                    userId = userId,
                    doctorId = appt.doctorId.ifBlank { null },
                    doctorName = appt.doctorName,
                    specialty = appt.specialty,
                    kidName = appt.kidName,
                    date = appt.date,
                    time = appt.time,
                )
            }
        } else {
            emptyList()
        }

        val mealDtos = if (SyncEntity.MEALS in entities) {
            meals.flatMap { (kidId, mealList) ->
                mealList.map { meal ->
                    MealItemDto(
                        id = meal.id,
                        profileId = profileId,
                        userId = userId,
                        kidId = kidId,
                        timeSlot = meal.time,
                        name = meal.name,
                        detail = meal.detail,
                        kcal = meal.kcal,
                        eaten = meal.eaten,
                    )
                }
            }
        } else {
            emptyList()
        }

        val streakDtos = if (SyncEntity.STREAKS in entities) {
            streaks.map { (kidId, streak) ->
                StreakDto(
                    kidId = kidId,
                    userId = userId,
                    currentStreak = streak.currentStreak,
                    bestStreak = streak.bestStreak,
                    lastLogDate = streak.lastLogDate,
                )
            }
        } else {
            emptyList()
        }

        val campDtos = if (SyncEntity.CAMPS in entities) {
            state.camps
                .filter { !it.isPartnerCamp }
                .map { camp ->
                    CampDto(
                        id = camp.id,
                        profileId = profileId,
                        userId = userId,
                        title = camp.title,
                        school = camp.school,
                        date = camp.date,
                        time = camp.time,
                        status = camp.status.name,
                        checks = camp.checks,
                        resultSummary = camp.resultSummary,
                    )
                }
        } else {
            emptyList()
        }

        return SyncBatch(
            entityNames = entities.map { it.name },
            profile = profile,
            kids = kidDtos,
            growthPoints = growthDtos,
            appointments = appointmentDtos,
            meals = mealDtos,
            streaks = streakDtos,
            camps = campDtos,
        )
    }

    suspend fun push(
        batch: SyncBatch,
        api: ApiRepository = ApiRepositoryProvider.repository,
    ): Result<Unit> {
        if (!ApiService.isConfigured) {
            return Result.failure(IllegalStateException("Backend not configured"))
        }
        val entities = batch.entities()
        if (entities.isEmpty()) return Result.success(Unit)

        return try {
            if (SyncEntity.PROFILE in entities && batch.profile != null) {
                api.upsertProfile(batch.profile).getOrThrow()
            }
            if (SyncEntity.KIDS in entities) {
                batch.kids.forEach { api.upsertKid(it).getOrThrow() }
            }
            if (SyncEntity.GROWTH in entities) {
                batch.growthPoints.forEach { api.upsertGrowthPoint(it).getOrThrow() }
            }
            if (SyncEntity.APPOINTMENTS in entities) {
                batch.appointments.forEach { api.upsertAppointment(it).getOrThrow() }
            }
            if (SyncEntity.MEALS in entities && batch.meals.isNotEmpty()) {
                api.upsertMeals(batch.meals).getOrThrow()
            }
            if (SyncEntity.STREAKS in entities) {
                batch.streaks.forEach { api.upsertStreak(it).getOrThrow() }
            }
            if (SyncEntity.CAMPS in entities) {
                batch.camps.forEach { api.upsertCamp(it).getOrThrow() }
            }
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
