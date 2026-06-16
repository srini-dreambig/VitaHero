package com.rork.vitahero.data

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.UUID

private val kidPalette = listOf(0xFF10B981, 0xFF2563EB, 0xFF8B5CF6, 0xFFFB7185, 0xFFF59E0B)

/**
 * Kids, meals, streaks, diet AI, growth, gamification, and wearables.
 */
class KidsViewModel(
    application: Application,
    private val container: AppContainer,
) : AndroidViewModel(application) {

    private val state get() = container.state
    private val auth get() = container.auth
    private val api get() = container.api

    val meals get() = state.meals
    val streaks get() = state.streaks
    val aiContent get() = state.aiContent
    val leaderboards get() = state.leaderboards

    private var healthConnectRequest: (() -> Unit)? = null
    private var pendingWearableKidId: String? = null

    fun setHealthConnectRequestHandler(handler: () -> Unit) {
        healthConnectRequest = handler
    }

    fun onHealthConnectPermissionsGranted() {
        pendingWearableKidId?.let { kidId ->
            pendingWearableKidId = null
            refreshWearableData(kidId)
        }
    }

    fun kidById(id: String?): Kid? = state.uiState.value.kids.firstOrNull { it.id == id }

    fun mealsForKid(kidId: String): List<MealItem> = state.meals.value[kidId].orEmpty()

    fun streakForKid(kidId: String): StreakInfo = state.streaks.value[kidId] ?: StreakInfo()

    fun growthAssessmentForKid(kidId: String): GrowthAssessment? =
        kidById(kidId)?.let { GrowthStandards.assess(it) }

    fun toggleMeal(kidId: String, mealId: String) {
        val today = LocalDate.now().format(DateTimeFormatter.ISO_LOCAL_DATE)
        state.meals.update { current ->
            val list = current[kidId].orEmpty().map { meal ->
                if (meal.id == mealId) meal.copy(eaten = !meal.eaten) else meal
            }
            current + (kidId to list)
        }
        state.streaks.update { s ->
            val prev = s[kidId] ?: StreakInfo()
            val currentStreak = when {
                prev.lastLogDate == today -> prev.currentStreak
                prev.lastLogDate == LocalDate.now().minusDays(1).format(DateTimeFormatter.ISO_LOCAL_DATE) ->
                    prev.currentStreak + 1
                else -> 1
            }
            s + (kidId to StreakInfo(
                currentStreak = currentStreak,
                bestStreak = maxOf(prev.bestStreak, currentStreak),
                lastLogDate = today,
            ))
        }
        container.persist(SyncEntity.MEALS, SyncEntity.STREAKS)
    }

    fun addMealItem(kidId: String, name: String, detail: String, kcal: Int, timeSlot: String = "Snack") {
        val newMeal = MealItem(
            id = "m${UUID.randomUUID().toString().take(8)}",
            time = timeSlot,
            name = name,
            detail = detail,
            kcal = kcal,
            eaten = true,
        )
        val today = LocalDate.now().format(DateTimeFormatter.ISO_LOCAL_DATE)
        state.meals.update { current ->
            val list = (current[kidId].orEmpty() + newMeal).sortedBy { m ->
                when (m.time) {
                    "Breakfast" -> 0; "Mid-morning" -> 1; "Lunch" -> 2
                    "Evening" -> 3; "Dinner" -> 4; else -> 5
                }
            }
            current + (kidId to list)
        }
        state.streaks.update { s ->
            val prev = s[kidId] ?: StreakInfo()
            val cs = when {
                prev.lastLogDate == today -> prev.currentStreak
                prev.lastLogDate == LocalDate.now().minusDays(1).format(DateTimeFormatter.ISO_LOCAL_DATE) ->
                    prev.currentStreak + 1
                else -> 1
            }
            s + (kidId to StreakInfo(currentStreak = cs, bestStreak = maxOf(prev.bestStreak, cs), lastLogDate = today))
        }
        container.persist(SyncEntity.MEALS, SyncEntity.STREAKS)
    }

    fun addKid(
        name: String, age: Int, gender: String, school: String, grade: String,
        heightCm: Float, weightKg: Float,
    ) {
        val assessment = KidHealthAssessment.fromMeasurements(age, gender, heightCm, weightKg)
        val newKid = Kid(
            id = "k${System.currentTimeMillis()}",
            name = name, age = age, gender = gender, school = school, grade = grade,
            heightCm = heightCm, weightKg = weightKg,
            avatarColor = kidPalette[state.uiState.value.kids.size % kidPalette.size],
            overallScore = assessment.overallScore,
            growth = listOf(
                GrowthPoint(
                    id = "gp_${UUID.randomUUID().toString().take(12)}",
                    label = "Now", height = heightCm, weight = weightKg,
                ),
            ),
            dental = assessment.dental,
            eyesight = assessment.eyesight,
            nutrition = assessment.nutrition,
            lastCheckup = "Not yet",
        )
        state.uiState.update { it.copy(kids = it.kids + newKid) }
        state.meals.update { it + (newKid.id to MealPlanGenerator.initialPlanFor(newKid)) }
        state.streaks.update { it + (newKid.id to StreakInfo()) }
        container.persistNow(SyncEntity.KIDS, SyncEntity.MEALS, SyncEntity.STREAKS, SyncEntity.GROWTH)
    }

    fun addGrowthPoint(kidId: String, heightCm: Float, weightKg: Float, label: String) {
        state.uiState.update { ui ->
            ui.copy(kids = ui.kids.map { kid ->
                if (kid.id != kidId) kid
                else {
                    val updatedGrowth = kid.growth + GrowthPoint(
                        id = "gp_${UUID.randomUUID().toString().take(12)}",
                        label = label, height = heightCm, weight = weightKg,
                    )
                    kid.copy(
                        growth = updatedGrowth,
                        heightCm = heightCm,
                        weightKg = weightKg,
                        overallScore = computeScore(updatedGrowth),
                        lastCheckup = label,
                    )
                }
            })
        }
        container.persist(SyncEntity.KIDS, SyncEntity.GROWTH)
    }

    fun deleteKid(kidId: String, onComplete: () -> Unit = {}) {
        viewModelScope.launch {
            try {
                if (auth.isLoggedIn.value) api.deleteKid(kidId)
            } catch (e: Exception) {
                container.reportSyncError(e)
            }
            state.uiState.update { ui ->
                ui.copy(
                    kids = ui.kids.filter { it.id != kidId },
                    wearableData = ui.wearableData - kidId,
                )
            }
            state.meals.update { it - kidId }
            state.streaks.update { it - kidId }
            state.aiContent.update { it - kidId }
            state.leaderboards.update { it - kidId }
            onComplete()
        }
    }

    fun refreshWearableData(kidId: String) {
        val kid = kidById(kidId) ?: return
        viewModelScope.launch {
            val app = getApplication<Application>()
            if (!HealthConnectService.isHealthConnectAvailable(app)) {
                container.reportSyncError(Exception(tr(S.healthConnectInstall, state.uiState.value.locale)))
                return@launch
            }
            if (!HealthConnectPermissions.hasAllPermissions(app)) {
                pendingWearableKidId = kidId
                healthConnectRequest?.invoke()
                return@launch
            }
            val d = HealthConnectService.fetchHealthData(app, kid.name)
            state.uiState.update { it.copy(wearableData = it.wearableData + (kidId to d)) }
        }
    }

    fun refreshLeaderboard(kidId: String) {
        val kid = kidById(kidId) ?: return
        viewModelScope.launch {
            val streak = streakForKid(kidId)
            val eatenCount = mealsForKid(kidId).count { it.eaten }
            val entries = LeaderboardService.fetchLeaderboard(
                accessToken = auth.sessionToken.value,
                currentKidId = kidId,
                currentKidName = kid.name,
                localEatenMeals = eatenCount,
                localStreak = streak.currentStreak,
            )
            state.leaderboards.update { it + (kidId to entries) }
        }
    }

    fun badgeProgressForKid(kidId: String): BadgeProgress {
        val kid = kidById(kidId) ?: return BadgeProgress()
        val mealList = mealsForKid(kidId)
        val eatenCount = mealList.count { it.eaten }
        val streak = streakForKid(kidId)
        val totalMeals = mealList.size.coerceAtLeast(1)

        val badges = listOf(
            Badge("b1", "Super Eater", "Log all meals for 7 days", eatenCount >= totalMeals && streak.currentStreak >= 7, 1f, 0xFF10B981, 7, streak.currentStreak),
            Badge("b2", "Growth Champion", "Height on track 3 camps in a row", kid.overallScore >= 85, if (kid.overallScore >= 85) 1f else kid.overallScore / 100f, 0xFF2563EB, 100, kid.overallScore),
            Badge("b3", "Hydration Hero", "Drank enough water all week", streak.currentStreak >= 5, (streak.currentStreak / 5f).coerceAtMost(1f), 0xFF06B6D4, 5, streak.currentStreak),
            Badge("b4", "Bright Smile", "No cavities at last dental check", kid.dental == HealthFlag.GOOD, if (kid.dental == HealthFlag.GOOD) 1f else 0.6f, 0xFF8B5CF6, 1, if (kid.dental == HealthFlag.GOOD) 1 else 0),
            Badge("b5", "Active Star", "Played 60 min daily for 5 days", eatenCount >= totalMeals, eatenCount / totalMeals.toFloat(), 0xFFF59E0B, totalMeals, eatenCount),
            Badge("b6", "Veggie Warrior", "Ate veggies in 10 meals", eatenCount >= 6, (eatenCount / 10f).coerceAtMost(1f), 0xFFFB7185, 10, eatenCount),
        )

        if (state.leaderboards.value[kidId] == null) {
            refreshLeaderboard(kidId)
        }
        return BadgeProgress(badges, state.leaderboards.value[kidId] ?: emptyList())
    }

    fun generateAIContent(kidId: String) {
        val kid = kidById(kidId) ?: return
        val mealList = mealsForKid(kidId)
        val streak = streakForKid(kidId)
        state.aiContent.update { it + (kidId to AIDietContent(isGenerating = true)) }
        viewModelScope.launch {
            val content = try {
                AIService.generateDietTip(kid, mealList, streak)
            } catch (e: Exception) {
                AIDietContent(
                    greeting = "", insight = "", suggestion = "", funFact = "",
                    generatedAt = e.message ?: tr(S.syncFailed, state.uiState.value.locale),
                    isGenerating = false,
                )
            }
            state.aiContent.update { it + (kidId to content) }
            if (content.greeting.isNotBlank() && auth.isLoggedIn.value) {
                try { api.saveAiDietTip(kidId, content) } catch (_: Exception) { }
            }
        }
    }

    fun mergeSharedKids(kids: List<Kid>) {
        val existingIds = state.uiState.value.kids.map { it.id }.toSet()
        val newKids = kids.filter { it.id !in existingIds }
        if (newKids.isNotEmpty()) {
            state.uiState.update { it.copy(kids = it.kids + newKids) }
            container.persist(SyncEntity.KIDS)
        }
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
}
