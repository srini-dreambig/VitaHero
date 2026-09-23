package kallam.healthcare.data

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

    /**
     * Add a batch to what is waiting, rather than replacing it.
     *
     * This was a plain save, so a batch that had failed to send was thrown away
     * by the next unrelated change. See [SyncBatch.mergedWith] for what that
     * cost a parent.
     */
    fun enqueue(context: Context, batch: SyncBatch) {
        val merged = loadBatch(context)?.mergedWith(batch) ?: batch
        write(context, merged)
    }

    /**
     * Take the entities that are finished with off the queue and leave the rest.
     *
     * "Finished" means the server either accepted them or refused them for
     * good. It used to be all or nothing: a batch where one record was refused
     * and another merely failed to reach the server cleared the whole queue and
     * then scheduled a retry with nothing left in it to retry, so the part that
     * was only unlucky was dropped as surely as the part that was refused.
     */
    fun settle(context: Context, done: Set<SyncEntity>) {
        val batch = loadBatch(context) ?: return
        val left = batch.entities() - done
        if (left.isEmpty()) clear(context) else write(context, batch.only(left))
    }

    private fun write(context: Context, batch: SyncBatch) {
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
