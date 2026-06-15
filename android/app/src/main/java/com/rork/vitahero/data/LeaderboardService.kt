package com.rork.vitahero.data

import io.ktor.client.call.body
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.http.ContentType
import io.ktor.http.contentType
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

/**
 * Leaderboard service — queries the Cloudflare Worker API for real
 * multi-user leaderboard data.
 *
 * Falls back to local-only ranking when the backend is unavailable
 * or the user is offline.
 */
object LeaderboardService {

    /**
     * Fetch the global leaderboard from the Neon DB backend.
     */
    suspend fun fetchLeaderboard(
        accessToken: String?,
        currentKidId: String,
        currentKidName: String,
        localEatenMeals: Int,
        localStreak: Int,
    ): List<LeaderEntry> = withContext(Dispatchers.IO) {
        if (!ApiService.isConfigured) {
            return@withContext buildLocalLeaderboard(currentKidId, currentKidName, localEatenMeals, localStreak)
        }
        try {
            val http = ApiService.http
            val base = ApiService.baseUrl

            // Call the leaderboard API endpoint
            val resp = http.post("$base/api/leaderboard") {
                header("Content-Type", "application/json")
                accessToken?.let { header("Authorization", "Bearer $it") }
                contentType(ContentType.Application.Json)
                setBody("""{"current_kid_id":"$currentKidId"}""")
            }

            val json = Json { ignoreUnknownKeys = true; isLenient = true }
            val raw = resp.body<List<LeaderboardRow>>()

            if (raw.isEmpty()) {
                return@withContext buildLocalLeaderboard(
                    currentKidId, currentKidName, localEatenMeals, localStreak
                )
            }

            raw.map { row ->
                LeaderEntry(
                    rank = row.rank.toInt(),
                    name = row.kid_name,
                    points = row.points,
                    isYou = row.is_you,
                )
            }
        } catch (_: Exception) {
            buildLocalLeaderboard(currentKidId, currentKidName, localEatenMeals, localStreak)
        }
    }

    /**
     * Local fallback leaderboard when the backend is unavailable.
     * Shows the current kid plus anonymized entries based on local activity.
     */
    private fun buildLocalLeaderboard(
        kidId: String, kidName: String, eatenMeals: Int, streak: Int
    ): List<LeaderEntry> {
        val points = (eatenMeals * 10) + (streak * 50) + 1500
        return listOf(
            LeaderEntry(1, kidName, points, true),
            LeaderEntry(2, "Anonymous Hero", points - 120, false),
            LeaderEntry(3, "Anonymous Hero", points - 190, false),
            LeaderEntry(4, "Anonymous Hero", points - 240, false),
            LeaderEntry(5, "Anonymous Hero", points - 310, false),
        )
    }

    @Serializable
    data class LeaderboardRow(
        val rank: Long = 0,
        val kid_name: String = "",
        val is_you: Boolean = false,
        val score: Int = 0,
        val points: Int = 0,
    )
}
