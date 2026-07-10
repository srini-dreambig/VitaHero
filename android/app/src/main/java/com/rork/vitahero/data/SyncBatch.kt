package com.rork.vitahero.data

import kotlinx.serialization.Serializable

/** Serializable payload for offline sync retry (WorkManager). */
@Serializable
data class SyncBatch(
    val entityNames: List<String>,
    val profile: ProfileDto? = null,
    val kids: List<KidDto> = emptyList(),
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
