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

    /**
     * A growth assessment, or null when nobody has measured this child.
     *
     * Height and weight default to zero, and a zero fed to the WHO tables comes
     * back below the third percentile — so an unscreened child was being shown
     * a severe stunting result, on a chart, as though it had been measured.
     */
    fun growthAssessmentForKid(kidId: String): GrowthAssessment? =
        kidById(kidId)?.takeIf { it.heightCm > 0f && it.weightKg > 0f }
            ?.let { GrowthStandards.assess(it) }

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

    /**
     * Add a child who is not on a school's roster.
     *
     * No measurements, and no flags. Every check starts NOT_MEASURED, because
     * nobody has looked at this child yet — and a health app that answers
     * "how are their teeth?" before anyone has looked in their mouth is worse
     * than one that says it does not know. A camp fills these in; the app does
     * not guess them, and neither does the parent.
     */
    fun addKid(name: String, age: Int, gender: String, school: String, grade: String) {
        val newKid = Kid(
            id = "k${System.currentTimeMillis()}",
            name = name, age = age, gender = gender, school = school, grade = grade,
            heightCm = 0f, weightKg = 0f,
            avatarColor = kidPalette[state.uiState.value.kids.size % kidPalette.size],
            overallScore = 0,
            growth = emptyList(),
            dental = HealthFlag.NOT_MEASURED,
            eyesight = HealthFlag.NOT_MEASURED,
            nutrition = HealthFlag.NOT_MEASURED,
            lastCheckup = "",
        )
        state.uiState.update { it.copy(kids = it.kids + newKid) }
        state.meals.update { it + (newKid.id to MealPlanGenerator.initialPlanFor(newKid)) }
        state.streaks.update { it + (newKid.id to StreakInfo()) }
        container.persistNow(SyncEntity.KIDS, SyncEntity.MEALS, SyncEntity.STREAKS)
    }

    /**
     * Drop a child from local state after the server erased them.
     *
     * The erasure itself belongs to the record screen and is logged as a data
     * right; this only clears what this device is still holding.
     */
    fun forgetKidLocally(kidId: String) {
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

        // Every badge here describes something this app actually measures:
        // meals logged, and the streak of days they were logged. The old set
        // claimed water drunk, minutes played and "height on track 3 camps in
        // a row" — none of which was ever recorded, all of them derived from
        // the meal counter. A badge a child cannot have earned is a lie told
        // to a child.
        val dentalKnown = kid.dental != HealthFlag.NOT_MEASURED
        val badges = listOf(
            Badge("b1", S.badgeSuperEater, S.badgeSuperEaterSub,
                eatenCount >= totalMeals && streak.currentStreak >= 7,
                (streak.currentStreak / 7f).coerceAtMost(1f),
                0xFF10B981, 7, streak.currentStreak),
            Badge("b2", S.badgeEveryMeal, S.badgeEveryMealSub,
                eatenCount >= totalMeals,
                eatenCount / totalMeals.toFloat(),
                0xFF2563EB, totalMeals, eatenCount),
            Badge("b3", S.badgeThreeDay, S.badgeThreeDaySub,
                streak.currentStreak >= 3,
                (streak.currentStreak / 3f).coerceAtMost(1f),
                0xFF06B6D4, 3, streak.currentStreak),
            Badge("b4", S.badgeTwoWeek, S.badgeTwoWeekSub,
                streak.bestStreak >= 14,
                (streak.bestStreak / 14f).coerceAtMost(1f),
                0xFFF59E0B, 14, streak.bestStreak),
            // The one clinical badge. Only meaningful once a dentist has
            // actually looked; before that it shows as not yet checked rather
            // than as partial progress toward something nobody did.
            Badge("b5", S.badgeBrightSmile,
                if (dentalKnown) S.badgeBrightSmileSub else S.badgeBrightSmileUnknown,
                dentalKnown && kid.dental == HealthFlag.GOOD,
                if (dentalKnown && kid.dental == HealthFlag.GOOD) 1f else 0f,
                0xFF8B5CF6, 1, if (dentalKnown && kid.dental == HealthFlag.GOOD) 1 else 0),
            Badge("b6", S.badgeHalfWay, S.badgeHalfWaySub,
                eatenCount >= totalMeals / 2,
                (eatenCount / (totalMeals / 2f).coerceAtLeast(1f)).coerceAtMost(1f),
                0xFFFB7185, (totalMeals / 2).coerceAtLeast(1), eatenCount),
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
}
