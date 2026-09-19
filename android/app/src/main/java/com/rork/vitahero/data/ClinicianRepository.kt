package com.rork.vitahero.data

import io.ktor.client.call.body
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.http.ContentType
import io.ktor.http.contentType
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * A clinician's camp day, from the app.
 *
 * Every call here goes to an endpoint that already existed and already knew
 * the rules: listMyCamps returns only the camps this person was assigned to,
 * getScreeningForm narrows its checks to their specialty and the guardian's
 * consent, and saveScreening refuses a check outside either. None of that is
 * re-implemented on the phone. The app asks and renders the answer, so a stale
 * build cannot widen what a doctor may record.
 *
 * The paths say "admin" because that is where the programme's API lives, not
 * because the caller is an administrator: the worker resolves the session and
 * scopes the answer to whoever holds it.
 */
class ClinicianRepository {

    private val http get() = ApiService.http
    private val base get() = ApiService.baseUrl
    private val configured: Boolean get() = ApiService.isConfigured

    private fun headers(): Map<String, String> {
        val h = mutableMapOf<String, String>()
        ApiService.sessionToken?.let { h["Authorization"] = "Bearer $it" }
        return h
    }

    private suspend fun <T> io(block: suspend () -> T): T = withContext(Dispatchers.IO) { block() }

    /** The camps this clinician has been put on, and nothing else. */
    suspend fun myCamps(): List<ClinicianCampDto> = io {
        if (!configured) return@io emptyList()
        try {
            val resp = http.get("$base/api/admin/my-camps") {
                headers().forEach { (k, v) -> header(k, v) }
            }
            if (resp.observed()) resp.body<ClinicianCampsDto>().camps else emptyList()
        } catch (e: Exception) {
            noteTransportFailure(e)
            emptyList()
        }
    }

    /** Every child on one camp's list. */
    suspend fun roster(campId: String): List<CampChildDto> = io {
        if (!configured) return@io emptyList()
        try {
            val resp = http.get("$base/api/admin/camps/$campId/participants") {
                headers().forEach { (k, v) -> header(k, v) }
            }
            if (resp.observed()) resp.body<CampRosterDto>().participants else emptyList()
        } catch (e: Exception) {
            noteTransportFailure(e)
            emptyList()
        }
    }

    /**
     * The form for one child: which checks this clinician may record, what was
     * already recorded, and whose round the rest is.
     *
     * Null means the request did not come back. The screen says so rather than
     * drawing an empty form a doctor might start filling in.
     */
    suspend fun screeningForm(campId: String, kidId: String): ScreeningFormDto? = io {
        if (!configured) return@io null
        try {
            val resp = http.get("$base/api/admin/camps/$campId/screening/$kidId") {
                headers().forEach { (k, v) -> header(k, v) }
            }
            if (resp.observed()) resp.body<ScreeningFormDto>() else null
        } catch (e: Exception) {
            noteTransportFailure(e)
            null
        }
    }

    /**
     * Record what was measured.
     *
     * The findings go up exactly as the form collected them; the server runs
     * the clinical rules, decides the flag, and refuses anything outside this
     * clinician's specialty or the guardian's consent. The app never proposes
     * a flag of its own — the device and the record must not be able to
     * disagree about what a measurement meant.
     */
    suspend fun saveScreening(
        campId: String,
        kidId: String,
        findings: List<ScreeningSubmissionDto>,
    ): Result<ScreeningSavedDto> = io {
        if (!configured) return@io Result.failure(Exception("Backend not configured"))
        try {
            val resp = http.post("$base/api/admin/camps/$campId/screening/$kidId") {
                contentType(ContentType.Application.Json)
                headers().forEach { (k, v) -> header(k, v) }
                setBody(ScreeningSubmissionBody(findings))
            }
            if (resp.observed()) {
                Result.success(resp.body<ScreeningSavedDto>())
            } else {
                val err = try { resp.body<ErrorBody>() } catch (_: Exception) { null }
                Result.failure(Exception(err?.error ?: "Could not save"))
            }
        } catch (e: Exception) {
            noteTransportFailure(e)
            Result.failure(e)
        }
    }

    /** Mark a child present or absent, which is what opens their form. */
    suspend fun setAttendance(campId: String, kidId: String, value: String): Result<Unit> = io {
        if (!configured) return@io Result.failure(Exception("Backend not configured"))
        try {
            val resp = http.post("$base/api/admin/camps/$campId/attendance") {
                contentType(ContentType.Application.Json)
                headers().forEach { (k, v) -> header(k, v) }
                setBody(AttendanceBody(kidId, value))
            }
            if (resp.observed()) Result.success(Unit)
            else Result.failure(Exception("Could not record attendance"))
        } catch (e: Exception) {
            noteTransportFailure(e)
            Result.failure(e)
        }
    }
}
