package kallam.healthcare.data

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

    /** What the server says this clinician may do on the camp now open. */
    private val _can = MutableStateFlow(CampCanDto())
    val can: StateFlow<CampCanDto> = _can.asStateFlow()

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

    // ─── Review and release ─────────────────────────────────

    private val _queue = MutableStateFlow<List<ReviewQueueItemDto>>(emptyList())
    val queue: StateFlow<List<ReviewQueueItemDto>> = _queue.asStateFlow()

    private val _review = MutableStateFlow<ReviewDetailDto?>(null)
    val review: StateFlow<ReviewDetailDto?> = _review.asStateFlow()

    /** What a completed release did, for saying so rather than just closing. */
    private val _released = MutableStateFlow<ReleaseResultDto?>(null)
    val released: StateFlow<ReleaseResultDto?> = _released.asStateFlow()

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
            val answer = repo.roster(campId)
            _roster.value = answer.participants
            _can.value = answer.can
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

    fun loadQueue(campId: String) {
        viewModelScope.launch {
            _busy.value = true
            _message.value = ""
            _queue.value = repo.reviewQueue(campId)
            _busy.value = false
        }
    }

    fun openReview(campId: String, kidId: String) {
        viewModelScope.launch {
            _busy.value = true
            _review.value = null
            _saved.value = false
            _message.value = ""
            val d = repo.reviewDetail(campId, kidId)
            if (d == null) _message.value = "Could not open this record. Check your connection."
            _review.value = d
            _busy.value = false
        }
    }

    fun closeReview() {
        _review.value = null
        _saved.value = false
        _message.value = ""
    }

    /**
     * Approve one child.
     *
     * [flags] holds only the checks a physician moved off what the rules
     * decided; an untouched finding is not sent, so an approval cannot quietly
     * restate a flag nobody looked at.
     */
    fun approve(
        campId: String,
        kidId: String,
        flags: Map<String, String>,
        urgency: String,
        recommendation: String,
    ) {
        if (recommendation.isBlank()) {
            _message.value = "Write what the guardian should do before approving."
            return
        }
        viewModelScope.launch {
            _busy.value = true
            val body = ReviewSubmissionBody(
                findings = flags.map { (check, flag) ->
                    FindingAdjustmentDto(checkType = check, flag = flag)
                },
                urgency = urgency,
                recommendation = recommendation.trim(),
            )
            repo.approve(campId, kidId, body).fold(
                onSuccess = {
                    _saved.value = true
                    _message.value = ""
                    // The queue is what tells a physician how much is left, so
                    // it cannot wait for a manual refresh.
                    _queue.value = _queue.value.map {
                        if (it.kidId == kidId) {
                            it.copy(status = "APPROVED", reviewed = true, urgency = urgency)
                        } else it
                    }
                },
                onFailure = { e -> _message.value = e.message ?: "Could not approve" },
            )
            _busy.value = false
        }
    }

    /** Send every approved child on this camp to their guardians. */
    fun release(campId: String) {
        viewModelScope.launch {
            _busy.value = true
            repo.release(campId).fold(
                onSuccess = { r ->
                    _released.value = r
                    _message.value = ""
                    _queue.value = repo.reviewQueue(campId)
                },
                onFailure = { e -> _message.value = e.message ?: "Could not release" },
            )
            _busy.value = false
        }
    }

    fun clearReleased() { _released.value = null }
}

