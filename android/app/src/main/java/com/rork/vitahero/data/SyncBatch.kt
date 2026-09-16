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
}
