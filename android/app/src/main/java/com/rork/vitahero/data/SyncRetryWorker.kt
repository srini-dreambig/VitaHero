package com.rork.vitahero.data

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.google.firebase.auth.FirebaseAuth
import kotlinx.coroutines.tasks.await

/**
 * Retries a persisted SyncBatch when network connectivity returns.
 * With Firestore offline persistence, most data is auto-synced.
 * This worker handles the legacy SyncQueueStore batches as a backup.
 */
class SyncRetryWorker(
    context: Context,
    params: WorkerParameters,
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        // With Firebase Auth + Firestore offline persistence, sync is automatic.
        val user = FirebaseAuth.getInstance().currentUser ?: return Result.success()

        // Refresh the ID token
        try {
            val tokenResult = user.getIdToken(false).await()
            ApiService.sessionToken = tokenResult.token
        } catch (_: Exception) {
            return Result.retry()
        }

        // Try to push any pending batch from the old queue
        val batch = SyncQueueStore.loadBatch(applicationContext) ?: return Result.success()
        val repo = ApiRepositoryProvider.firestoreRepo ?: return Result.success()

        return BackendSyncEngine.push(batch, repo).fold(
            onSuccess = {
                SyncQueueStore.clear(applicationContext)
                Result.success()
            },
            onFailure = { Result.retry() },
        )
    }
}
