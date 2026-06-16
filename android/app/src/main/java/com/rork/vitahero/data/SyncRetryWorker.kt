package com.rork.vitahero.data

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters

/**
 * Retries a persisted [SyncBatch] when network connectivity returns.
 */
class SyncRetryWorker(
    context: Context,
    params: WorkerParameters,
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        if (!ApiService.isConfigured) return Result.failure()

        val batch = SyncQueueStore.loadBatch(applicationContext) ?: return Result.success()

        SessionStore.getToken(applicationContext)?.let { ApiService.sessionToken = it }
            ?: return Result.retry()

        return BackendSyncEngine.push(batch).fold(
            onSuccess = {
                SyncQueueStore.clear(applicationContext)
                Result.success()
            },
            onFailure = { Result.retry() },
        )
    }
}
