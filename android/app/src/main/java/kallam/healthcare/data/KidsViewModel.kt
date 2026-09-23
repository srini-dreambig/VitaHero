package kallam.healthcare.data

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
    private val guardian = GuardianRepository()

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
        invalidateBadges(kidId)
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
        invalidateBadges(kidId)
    }

    /**
     * This child's badges are out of date; ask again next time they are read.
     *
     * Not a refetch: the meal that changed them is queued for sync, not sent,
     * so asking the server now would get yesterday's answer and cache it.
     * Forgetting is enough — the rewards screen re-asks on the way in, by
     * which time the queue has usually flushed.
     */
    private fun invalidateBadges(kidId: String) {
        state.badges.update { it - kidId }
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
        state.badges.update { it - kidId }
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

    /**
     * How a badge is dressed, once the server has said whether it is earned.
     *
     * The rule moved to functions/badges.ts; what stays here is everything a
     * child actually reads — a title, a line of explanation, a colour — in the
     * three languages the app speaks. The server sends ids.
     *
     * Bright Smile is the one badge with two descriptions, because "no
     * cavities" and "nobody has looked yet" are different things to say to a
     * family, and only the second one is true before a camp.
     */
    private fun dress(dto: BadgeDto): Badge? = when (dto.id) {
        "b1" -> Badge(dto.id, S.badgeSuperEater, S.badgeSuperEaterSub,
            dto.earned, dto.progress, 0xFF10B981, dto.target, dto.current)
        "b2" -> Badge(dto.id, S.badgeEveryMeal, S.badgeEveryMealSub,
            dto.earned, dto.progress, 0xFF2563EB, dto.target, dto.current)
        "b3" -> Badge(dto.id, S.badgeThreeDay, S.badgeThreeDaySub,
            dto.earned, dto.progress, 0xFF06B6D4, dto.target, dto.current)
        "b4" -> Badge(dto.id, S.badgeTwoWeek, S.badgeTwoWeekSub,
            dto.earned, dto.progress, 0xFFF59E0B, dto.target, dto.current)
        "b5" -> Badge(dto.id, S.badgeBrightSmile,
            if (dto.current > 0 || dto.earned) S.badgeBrightSmileSub else S.badgeBrightSmileUnknown,
            dto.earned, dto.progress, 0xFF8B5CF6, dto.target, dto.current)
        "b6" -> Badge(dto.id, S.badgeHalfWay, S.badgeHalfWaySub,
            dto.earned, dto.progress, 0xFFFB7185, dto.target, dto.current)
        // A badge this build has no words for. Dropped rather than shown as a
        // blank tile, so the server can add one ahead of an app release.
        else -> null
    }

    fun refreshBadges(kidId: String) {
        if (kidById(kidId) == null) return
        viewModelScope.launch {
            // Empty means the call did not land: the server always answers
            // with the whole set, earned or not. Caching an empty answer would
            // wipe a child's week off the screen because a train went into a
            // tunnel, so nothing is stored and the next read asks again.
            val dtos = guardian.badges(kidId)
            if (dtos.isEmpty()) return@launch
            state.badges.update { it + (kidId to dtos.mapNotNull(::dress)) }
        }
    }

    /**
     * What the rewards screen draws.
     *
     * Reads what the server last said and asks again if it has not been asked.
     * Nothing is computed here any more: a badge worked out on this handset
     * could not survive a reinstall, could not be compared with another
     * child's, and could be earned by editing local state.
     */
    fun badgeProgressForKid(kidId: String): BadgeProgress {
        if (kidById(kidId) == null) return BadgeProgress()
        if (state.badges.value[kidId] == null) refreshBadges(kidId)
        if (state.leaderboards.value[kidId] == null) refreshLeaderboard(kidId)
        return BadgeProgress(
            state.badges.value[kidId] ?: emptyList(),
            state.leaderboards.value[kidId] ?: emptyList(),
        )
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

    /**
     * Show a co-parent the children they now share.
     *
     * Local only. This used to push them back as this account's own children,
     * which was never right — the roster says whose child is whose, and the
     * other guardian is already on it. The server refuses that write now, so
     * the push could only ever have produced an error message.
     */
    fun mergeSharedKids(kids: List<Kid>) {
        val existingIds = state.uiState.value.kids.map { it.id }.toSet()
        val newKids = kids.filter { it.id !in existingIds }
        if (newKids.isNotEmpty()) {
            state.uiState.update { it.copy(kids = it.kids + newKids) }
        }
    }
}
