package com.rork.vitahero.data

import android.app.Application
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/**
 * Shared dependency root for all feature ViewModels.
 */
class AppContainer(application: Application) {

    val auth = AuthManager(application)
    val api = ApiRepositoryProvider.repository
    val state = AppStateHolder()

    private val app = application
    private val dataLoader = BackendDataLoader(app, auth, api, state)

    private var syncCoordinator: SyncCoordinator? = null

    fun attachSync(scope: CoroutineScope) {
        if (syncCoordinator != null) return
        syncCoordinator = SyncCoordinator(scope) { entities -> pushToBackend(entities) }
    }

    fun persist(vararg entities: SyncEntity) {
        syncCoordinator?.enqueue(*entities)
    }

    fun persistNow(vararg entities: SyncEntity) {
        syncCoordinator?.flushNow(*entities)
    }

    fun reportSyncError(e: Exception) {
        state.syncMessage.value = e.message ?: tr(S.syncFailed, state.uiState.value.locale)
    }

    fun clearSyncMessage() {
        state.syncMessage.value = null
    }

    suspend fun retryPendingSync() {
        if (!SyncQueueStore.hasPending(app)) return
        val batch = SyncQueueStore.loadBatch(app) ?: return
        when (val result = BackendSyncEngine.push(batch)) {
            is BackendSyncEngine.PushResult.Ok -> SyncQueueStore.clear(app)
            is BackendSyncEngine.PushResult.Retry -> SyncRetryScheduler.schedule(app)
            is BackendSyncEngine.PushResult.Rejected -> {
                // Whatever was waiting from a previous session has been refused.
                // Drop it rather than carry it forward, undo what it left on
                // screen, and say what the server said.
                SyncQueueStore.clear(app)
                result.rejections.forEach { rollBack(it) }
                state.syncMessage.value = result.rejections.first().message
                if (result.transient != null) SyncRetryScheduler.schedule(app)
            }
        }
    }

    suspend fun pushToBackend(entities: Set<SyncEntity>) {
        if (!ApiService.isConfigured || !auth.isLoggedIn.value) return
        val pid = auth.profileId.value
        if (pid.isBlank()) return
        val uid = auth.userId.value.ifBlank { pid }

        val batch = BackendSyncEngine.buildBatch(
            entities = entities,
            profileId = pid,
            userId = uid,
            state = state.uiState.value,
            meals = state.meals.value,
            streaks = state.streaks.value,
            onboardingComplete = auth.onboardingComplete.value,
            isLoggedIn = auth.isLoggedIn.value,
        )

        SyncQueueStore.saveBatch(app, batch)

        when (val result = BackendSyncEngine.push(batch)) {
            is BackendSyncEngine.PushResult.Ok -> SyncQueueStore.clear(app)

            is BackendSyncEngine.PushResult.Retry -> {
                reportSyncError(result.cause as? Exception ?: Exception(result.cause.message))
                SyncRetryScheduler.schedule(app)
            }

            is BackendSyncEngine.PushResult.Rejected -> {
                // The server will not accept these however often they are sent,
                // so the queue is cleared rather than replayed forever. It is
                // also the moment to take the record back off screen: the app
                // showed it the instant the parent tapped, and nothing else
                // will ever correct that.
                SyncQueueStore.clear(app)
                result.rejections.forEach { rollBack(it) }
                state.syncMessage.value = result.rejections.first().message
                // A refusal and a network fault can arrive together. The parts
                // that merely failed to send are still worth another try.
                if (result.transient != null) SyncRetryScheduler.schedule(app)
            }
        }
    }

    /**
     * Undo what the app showed optimistically, for a record the server refused.
     *
     * Appointments are the one that reaches beyond the screen: booking one
     * schedules a reminder notification, so a parent whose booking was refused
     * would otherwise be reminded, on the day, of an appointment that never
     * existed and turn up at the hospital for it.
     */
    private fun rollBack(rejection: BackendSyncEngine.Rejection) {
        when (rejection.entity) {
            SyncEntity.APPOINTMENTS -> {
                val appt = state.uiState.value.appointments.firstOrNull { it.id == rejection.id }
                state.uiState.update { ui ->
                    ui.copy(appointments = ui.appointments.filterNot { it.id == rejection.id })
                }
                appt?.let { NotificationScheduler.cancelCheckupReminder(app, it.doctorName, it.date) }
            }
            // Everything else is a record the parent can see and correct from
            // the screen it belongs to; the message tells them what happened.
            else -> Unit
        }
    }

    fun fetchAndApplyBackendData(scope: CoroutineScope, onKidsLoaded: suspend (List<String>) -> Unit = {}) {
        scope.launch {
            try {
                dataLoader.fetchAndApply(onKidsLoaded)
            } catch (e: Exception) {
                reportSyncError(e)
            }
        }
    }
}
