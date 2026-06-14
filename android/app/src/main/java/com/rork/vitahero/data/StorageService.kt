package com.rork.vitahero.data

import android.content.Context
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.io.File

class StorageService(private val context: Context) {

    private val json = Json { ignoreUnknownKeys = true; prettyPrint = false }
    private val file: File
        get() = File(context.filesDir, "vitahero_state.json")

    fun load(): PersistentState {
        return try {
            if (file.exists()) {
                val text = file.readText()
                json.decodeFromString<PersistentState>(text)
            } else {
                PersistentState()
            }
        } catch (_: Exception) {
            PersistentState()
        }
    }

    fun save(state: PersistentState) {
        try {
            val text = json.encodeToString(state)
            file.writeText(text)
        } catch (_: Exception) {
            // Silently fail — data will be fresh next launch
        }
    }

    fun clear() {
        try {
            file.delete()
        } catch (_: Exception) { }
    }
}
