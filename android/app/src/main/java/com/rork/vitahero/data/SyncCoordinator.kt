package com.rork.vitahero.data

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * Which entity groups should be pushed on the next debounced sync.
 * Keeps meal toggles from overwriting server-authoritative kid health flags.
 */
enum class SyncEntity {
    PROFILE,
    GROWTH,
    CAMPS,
    MEALS,
    STREAKS,
    APPOINTMENTS,
}

/**
 * Debounces backend writes and supports partial sync by entity type.
 */
class SyncCoordinator(
    private val scope: CoroutineScope,
    private val debounceMs: Long = 750L,
    private val onSync: suspend (Set<SyncEntity>) -> Unit,
) {
    private val pending = linkedSetOf<SyncEntity>()
    private var debounceJob: Job? = null

    fun enqueue(vararg entities: SyncEntity) {
        if (entities.isEmpty()) return
        pending.addAll(entities)
        debounceJob?.cancel()
        debounceJob = scope.launch {
            delay(debounceMs)
            val batch = pending.toSet()
            pending.clear()
            if (batch.isNotEmpty()) push(batch)
        }
    }

    /** Flush immediately — use after auth or explicit user save actions. */
    fun flushNow(vararg entities: SyncEntity) {
        debounceJob?.cancel()
        val batch = (pending + entities).toSet()
        pending.clear()
        if (batch.isEmpty()) return
        scope.launch { push(batch) }
    }

    /**
     * The entities are taken out of [pending] before the push, so if the push
     * throws on its way out they are gone — nothing would carry them, and the
     * next sync would not know they were owed. Putting them back means the
     * following change sweeps them up with it.
     */
    private suspend fun push(batch: Set<SyncEntity>) {
        try {
            onSync(batch)
        } catch (e: Throwable) {
            pending.addAll(batch)
            throw e
        }
    }
}
