package com.rork.vitahero.data

import kotlinx.serialization.Serializable

/**
 * Serializable payload for offline sync retry (WorkManager).
 *
 * No children here: the school's roster owns those, and the app never writes
 * one. A batch persisted by an older build may still carry a `kids` field —
 * the decoder ignores unknown keys, so it is read as if it never had one.
 */
@Serializable
data class SyncBatch(
    val entityNames: List<String>,
    val profile: ProfileDto? = null,
    val growthPoints: List<GrowthPointDto> = emptyList(),
    val appointments: List<AppointmentDto> = emptyList(),
    val meals: List<MealItemDto> = emptyList(),
    val streaks: List<StreakDto> = emptyList(),
    val camps: List<CampDto> = emptyList(),
) {
    fun entities(): Set<SyncEntity> = entityNames.mapNotNull { name ->
        runCatching { SyncEntity.valueOf(name) }.getOrNull()
    }.toSet()

    /**
     * Fold a newer batch into this one.
     *
     * The store used to hold exactly one batch and a save replaced it. A meal
     * that failed to send was therefore dropped the moment anything else
     * changed — the next batch carried only the profile, the meals were no
     * longer in the store to retry, and the next fetch replaced them with the
     * server's copy, which never had them. The parent's logging was gone with
     * nothing on screen to say so.
     *
     * Each entity is a whole snapshot, so the newer one wins where it has
     * something to say and the older one is kept where it does not.
     */
    fun mergedWith(newer: SyncBatch): SyncBatch {
        val incoming = newer.entities()
        fun <T> pick(entity: SyncEntity, mine: T, theirs: T): T =
            if (entity in incoming) theirs else mine
        return SyncBatch(
            entityNames = (entities() + incoming).map { it.name },
            profile = pick(SyncEntity.PROFILE, profile, newer.profile),
            growthPoints = pick(SyncEntity.GROWTH, growthPoints, newer.growthPoints),
            appointments = pick(SyncEntity.APPOINTMENTS, appointments, newer.appointments),
            meals = pick(SyncEntity.MEALS, meals, newer.meals),
            streaks = pick(SyncEntity.STREAKS, streaks, newer.streaks),
            camps = pick(SyncEntity.CAMPS, camps, newer.camps),
        )
    }

    /** The same batch with everything outside [keep] dropped. */
    fun only(keep: Set<SyncEntity>): SyncBatch = SyncBatch(
        entityNames = keep.map { it.name },
        profile = profile.takeIf { SyncEntity.PROFILE in keep },
        growthPoints = if (SyncEntity.GROWTH in keep) growthPoints else emptyList(),
        appointments = if (SyncEntity.APPOINTMENTS in keep) appointments else emptyList(),
        meals = if (SyncEntity.MEALS in keep) meals else emptyList(),
        streaks = if (SyncEntity.STREAKS in keep) streaks else emptyList(),
        camps = if (SyncEntity.CAMPS in keep) camps else emptyList(),
    )
}
