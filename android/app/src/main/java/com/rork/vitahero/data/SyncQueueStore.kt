package com.rork.vitahero.data

import android.content.Context
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

/**
 * Persists the last failed sync batch so WorkManager can retry when connectivity returns.
 */
object SyncQueueStore {

    private const val PREFS = "vitahero_sync_queue"
    private const val KEY_BATCH = "pending_batch"

    private val json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = true
    }

    fun saveBatch(context: Context, batch: SyncBatch) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_BATCH, json.encodeToString(batch))
            .apply()
    }

    fun loadBatch(context: Context): SyncBatch? {
        val raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(KEY_BATCH, null)
            ?: return null
        return runCatching { json.decodeFromString<SyncBatch>(raw) }.getOrNull()
    }

    fun clear(context: Context) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .remove(KEY_BATCH)
            .apply()
    }

    fun hasPending(context: Context): Boolean = loadBatch(context) != null
}
