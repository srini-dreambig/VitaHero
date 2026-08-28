package com.rork.vitahero.data

import com.google.firebase.Timestamp
import com.google.firebase.firestore.DocumentSnapshot
import kotlinx.serialization.KSerializer
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.decodeFromJsonElement
import kotlinx.serialization.serializer

/**
 * Firestore document → @Serializable DTO decoding.
 *
 * Firestore's built-in toObject() cannot map our DTOs: it requires a public
 * no-argument constructor (most DTOs here have required constructor params,
 * so toObject threw for every document and every read silently returned an
 * empty list), and it ignores kotlinx @SerialName annotations, so snake_case
 * document keys like height_cm never populated heightCm.
 *
 * This decoder uses kotlinx serialization instead, which honors @SerialName
 * and per-property defaults, and injects the document id when missing.
 */
private val firestoreDtoJson = Json {
    ignoreUnknownKeys = true
    coerceInputValues = true
    isLenient = true
}

private fun firestoreValueToElement(value: Any?): JsonElement = when (value) {
    null -> JsonNull
    is String -> JsonPrimitive(value)
    is Boolean -> JsonPrimitive(value)
    is Number -> JsonPrimitive(value)
    is Map<*, *> -> JsonObject(value.entries.associate { (k, v) -> k.toString() to firestoreValueToElement(v) })
    is List<*> -> JsonArray(value.map { firestoreValueToElement(it) })
    is Timestamp -> JsonPrimitive(value.toDate().time)
    else -> JsonPrimitive(value.toString())
}

/** Decode a Firestore document into [T]. Returns null on any failure (doc dropped, not crash). */
fun <T> DocumentSnapshot.toDto(idKey: String = "id", serializer: KSerializer<T>): T? = try {
    val data = data ?: return null
    val fields = HashMap<String, JsonElement>(data.size + 1)
    for ((k, v) in data) fields[k] = firestoreValueToElement(v)
    if (!fields.containsKey(idKey)) fields[idKey] = JsonPrimitive(id)
    firestoreDtoJson.decodeFromJsonElement(serializer, JsonObject(fields))
} catch (_: Exception) {
    null
}

/** Decode a Firestore document into a @Serializable DTO [T]. Returns null on any failure. */
inline fun <reified T> DocumentSnapshot.toDto(idKey: String = "id"): T? =
    toDto(idKey, serializer())
