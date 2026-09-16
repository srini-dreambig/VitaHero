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

    /**
     * The outcome of pushing one batch.
     *
     * Three states, because the app has three different things to do about
     * them: carry on, try again later, or stop trying and tell the parent.
     */
    sealed interface PushResult {
        data object Ok : PushResult

        /** The network or the server faltered. Worth retrying unchanged. */
        data class Retry(val cause: Throwable) : PushResult

        /**
         * The server refused something and will refuse it again. `rejected`
         * names which records, so the caller can take them back off screen.
         */
        data class Rejected(
            val rejections: List<Rejection>,
            val transient: Throwable? = null,
        ) : PushResult
    }

    /** One record the server refused outright, and what it said about it. */
    data class Rejection(
        val entity: SyncEntity,
        val id: String,
        val message: String,
    )

    /**
     * Send a batch, one entity at a time.
     *
     * This used to be a chain of `getOrThrow()`, so the first failure abandoned
     * everything after it. A single appointment the server would never accept
     * therefore stopped that batch's children, meals and growth points from
     * ever being written — and the next local change overwrote the batch, so
     * they were not retried either. They were simply lost, quietly.
     *
     * Now every entity is attempted whichever way the others go, and the two
     * kinds of failure are reported separately: a refusal is final and names
     * its record, a network fault is worth retrying as-is.
     */
    suspend fun push(
        batch: SyncBatch,
        api: ApiRepository = ApiRepositoryProvider.repository,
    ): PushResult {
        if (!ApiService.isConfigured) {
            return PushResult.Retry(IllegalStateException("Backend not configured"))
        }
        val entities = batch.entities()
        if (entities.isEmpty()) return PushResult.Ok

        val rejections = mutableListOf<Rejection>()
        var transient: Throwable? = null

        suspend fun attempt(entity: SyncEntity, id: String, write: suspend () -> Result<Unit>) {
            write().onFailure { e ->
                if (e is PermanentRejection) rejections += Rejection(entity, id, e.message)
                else if (transient == null) transient = e
            }
        }

        if (SyncEntity.PROFILE in entities && batch.profile != null) {
            attempt(SyncEntity.PROFILE, batch.profile.id) { api.upsertProfile(batch.profile) }
        }
        if (SyncEntity.KIDS in entities) {
            for (k in batch.kids) attempt(SyncEntity.KIDS, k.id) { api.upsertKid(k) }
        }
        if (SyncEntity.GROWTH in entities) {
            for (g in batch.growthPoints) attempt(SyncEntity.GROWTH, g.id) { api.upsertGrowthPoint(g) }
        }
        if (SyncEntity.APPOINTMENTS in entities) {
            for (a in batch.appointments) attempt(SyncEntity.APPOINTMENTS, a.id) { api.upsertAppointment(a) }
        }
        if (SyncEntity.MEALS in entities && batch.meals.isNotEmpty()) {
            attempt(SyncEntity.MEALS, "") { api.upsertMeals(batch.meals) }
        }
        if (SyncEntity.STREAKS in entities) {
            for (st in batch.streaks) attempt(SyncEntity.STREAKS, st.kidId) { api.upsertStreak(st) }
        }
        if (SyncEntity.CAMPS in entities) {
            for (c in batch.camps) attempt(SyncEntity.CAMPS, c.id) { api.upsertCamp(c) }
        }

        return when {
            rejections.isNotEmpty() -> PushResult.Rejected(rejections, transient)
            transient != null -> PushResult.Retry(transient!!)
            else -> PushResult.Ok
        }
    }
}
