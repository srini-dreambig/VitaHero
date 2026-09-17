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

        // A refusal is not retried. The work used to come back `retry` for any
        // failure at all, so a record the server would never accept was resent
        // on WorkManager's backoff indefinitely — burning battery on a request
        // that could not succeed, and never clearing the queue that held it.
        //
        // What comes off the queue is only what the server settled. Clearing
        // the lot on a refusal took the parts that had merely failed to reach
        // it as well, and then reported success, so nothing ever went back for
        // them.
        val pushed = BackendSyncEngine.push(batch)
        SyncQueueStore.settle(applicationContext, pushed.settled)

        return when (pushed) {
            is BackendSyncEngine.PushResult.Ok -> Result.success()
            is BackendSyncEngine.PushResult.Rejected -> {
                // The app may not be running, so there is no screen to correct.
                // The next launch reads the server's own list and the refused
                // appointment simply will not be in it — but the reminder alarm
                // it set outlives the process, so that has to go now.
                pushed.rejections
                    .filter { it.entity == SyncEntity.APPOINTMENTS }
                    .forEach { rejection ->
                        batch.appointments.firstOrNull { it.id == rejection.id }?.let { appt ->
                            NotificationScheduler.cancelCheckupReminder(
                                applicationContext, appt.doctorName, appt.date,
                            )
                        }
                    }
                // Something may still be waiting: a refusal and a network
                // fault can arrive together.
                if (pushed.transient != null) Result.retry() else Result.success()
            }
            is BackendSyncEngine.PushResult.Retry -> Result.retry()
        }
    }
}
