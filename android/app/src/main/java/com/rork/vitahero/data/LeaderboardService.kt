package com.rork.vitahero.data

import com.google.firebase.auth.FirebaseAuth

/**
 * Leaderboard service — now uses Firestore directly via FirestoreRepository
 * for real multi-user leaderboard data.
 *
 * Falls back to local-only ranking when the backend is unavailable
 * or the user is offline.
 */
object LeaderboardService {

    /**
     * Fetch the global leaderboard from Firestore.
     */
    suspend fun fetchLeaderboard(
        accessToken: String?,
        currentKidId: String,
        currentKidName: String,
        localEatenMeals: Int,
        localStreak: Int,
    ): List<LeaderEntry> {
        val repo = ApiRepositoryProvider.firestoreRepo
            ?: return localFallback(currentKidName, localEatenMeals, localStreak)
        return repo.fetchLeaderboard(currentKidId, currentKidName, localEatenMeals, localStreak)
    }

    private fun localFallback(
        currentKidName: String,
        localEatenMeals: Int,
        localStreak: Int,
    ): List<LeaderEntry> = listOf(
        LeaderEntry(1, currentKidName, (localEatenMeals * 10) + (localStreak * 50) + 1500, true)
    )
}
