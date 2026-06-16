package com.rork.vitahero.data

import android.app.Application
import kotlinx.coroutines.CoroutineScope
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
        BackendSyncEngine.push(batch).fold(
            onSuccess = { SyncQueueStore.clear(app) },
            onFailure = { SyncRetryScheduler.schedule(app) },
        )
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

        BackendSyncEngine.push(batch).fold(
            onSuccess = { SyncQueueStore.clear(app) },
            onFailure = { error ->
                reportSyncError(error as? Exception ?: Exception(error.message))
                SyncRetryScheduler.schedule(app)
            },
        )
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
