package com.rork.vitahero.data

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

/**
 * A camp day, held for the person working it.
 *
 * Three screens lean on this: the clinician's own camps, one camp's list of
 * children, and one child's form. Nothing here decides what may be recorded —
 * the server narrows the form to this clinician's specialty and the guardian's
 * consent, and refuses anything else on the way back in.
 */
class ClinicianViewModel(
    application: Application,
    private val container: AppContainer,
) : AndroidViewModel(application) {

    private val repo = ClinicianRepository()

    private val _camps = MutableStateFlow<List<ClinicianCampDto>>(emptyList())
    val camps: StateFlow<List<ClinicianCampDto>> = _camps.asStateFlow()

    private val _roster = MutableStateFlow<List<CampChildDto>>(emptyList())
    val roster: StateFlow<List<CampChildDto>> = _roster.asStateFlow()

    private val _form = MutableStateFlow<ScreeningFormDto?>(null)
    val form: StateFlow<ScreeningFormDto?> = _form.asStateFlow()

    private val _busy = MutableStateFlow(false)
    val busy: StateFlow<Boolean> = _busy.asStateFlow()

    /**
     * Why the last thing failed, or "".
     *
     * A refusal from the server is shown as written rather than replaced with
     * "something went wrong": it is the server that knows a guardian declined
     * this check, or that the child is on another clinician's round, and a
     * clinician standing in a hall can act on that.
     */
    private val _message = MutableStateFlow("")
    val message: StateFlow<String> = _message.asStateFlow()

    /** Set once a save has gone through, so the screen can say so and move on. */
    private val _saved = MutableStateFlow(false)
    val saved: StateFlow<Boolean> = _saved.asStateFlow()

    fun clearMessage() { _message.value = "" }

    /**
     * A field value in the type the clinical rules expect.
     *
     * Numbers may travel as text — clinical.ts parses them with parseFloat —
     * but booleans may not: it tests `d.squint === true`, and the string
     * "true" is not that. Sent as text, a noted squint would have been read as
     * no squint, with nothing anywhere saying so.
     */
    private fun asJson(v: String): JsonPrimitive = when (v) {
        "true" -> JsonPrimitive(true)
        "false" -> JsonPrimitive(false)
        else -> JsonPrimitive(v)
    }

    fun loadCamps() {
        viewModelScope.launch {
            _busy.value = true
            _camps.value = repo.myCamps()
            _busy.value = false
        }
    }

    fun loadRoster(campId: String) {
        viewModelScope.launch {
            _busy.value = true
            // Cleared first: a roster left on screen while the next camp loads
            // is one camp's children under another camp's heading.
            _roster.value = emptyList()
            _roster.value = repo.roster(campId)
            _busy.value = false
        }
    }

    fun openChild(campId: String, kidId: String) {
        viewModelScope.launch {
            _busy.value = true
            _form.value = null
            _saved.value = false
            _message.value = ""
            val f = repo.screeningForm(campId, kidId)
            if (f == null) _message.value = "Could not open this child's form. Check your connection."
            _form.value = f
            _busy.value = false
        }
    }

    fun closeChild() {
        _form.value = null
        _saved.value = false
        _message.value = ""
    }

    fun markAttendance(campId: String, kidId: String, value: String) {
        viewModelScope.launch {
            _busy.value = true
            repo.setAttendance(campId, kidId, value).fold(
                onSuccess = {
                    _form.value = _form.value?.copy(attendance = value)
                    _roster.value = _roster.value.map {
                        if (it.kidId == kidId) it.copy(attendance = value) else it
                    }
                },
                onFailure = { e -> _message.value = e.message ?: "Could not record attendance" },
            )
            _busy.value = false
        }
    }

    /**
     * Send what was measured.
     *
     * [values] is keyed by check type, then by the field names clinical.ts
     * reads. A check with nothing filled in is not sent at all: an empty form
     * saved by accident would otherwise write "not measured" over a reading
     * somebody else took.
     */
    fun save(campId: String, kidId: String, values: Map<String, Map<String, String>>, note: String) {
        val findings = values.mapNotNull { (checkType, fields) ->
            val filled = fields.filterValues { it.isNotBlank() }
            // An unticked checkbox is not a measurement. Without this, opening
            // a vision form and saving without touching it would send
            // squint=false on its own and write "Vision not tested" over
            // whatever somebody else had recorded.
            if (filled.none { (_, v) -> v != "false" }) return@mapNotNull null
            ScreeningSubmissionDto(
                checkType = checkType,
                detail = JsonObject(filled.mapValues { (_, v) -> asJson(v) }),
                note = note,
            )
        }
        if (findings.isEmpty()) {
            _message.value = "Record at least one measurement before saving."
            return
        }
        viewModelScope.launch {
            _busy.value = true
            repo.saveScreening(campId, kidId, findings).fold(
                onSuccess = {
                    _saved.value = true
                    _message.value = ""
                    // The roster's status pill is why a clinician knows who is
                    // still to be seen, so it cannot wait for a manual refresh.
                    _roster.value = _roster.value.map {
                        if (it.kidId == kidId) it.copy(status = "SCREENED") else it
                    }
                },
                onFailure = { e -> _message.value = e.message ?: "Could not save" },
            )
            _busy.value = false
        }
    }
}
