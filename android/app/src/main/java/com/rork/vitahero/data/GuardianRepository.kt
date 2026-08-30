package com.rork.vitahero.data

import io.ktor.client.call.body
import io.ktor.client.request.delete
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.http.ContentType
import io.ktor.http.contentType
import io.ktor.http.isSuccess
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * The guardian's side of the school screening pathway.
 *
 * Everything here is read or written as the signed-in parent: the server
 * decides what belongs to them, and never trusts an id the app sends. That is
 * why none of these calls takes a profile id — the session is the identity.
 *
 * Kept apart from ApiRepository, which mirrors the older personal-tracking
 * tables. These endpoints all speak camelCase JSON and belong to one story.
 */
class GuardianRepository {

    private val http get() = ApiService.http
    private val base get() = ApiService.baseUrl
    private val configured: Boolean get() = ApiService.isConfigured

    private fun headers(): Map<String, String> {
        val h = mutableMapOf<String, String>()
        ApiService.sessionToken?.let { h["Authorization"] = "Bearer $it" }
        return h
    }

    private suspend fun <T> io(block: suspend () -> T): T = withContext(Dispatchers.IO) { block() }

    /** GET returning a decoded body, or the supplied fallback on any failure. */
    private suspend inline fun <reified T> getOr(
        path: String,
        fallback: T,
        params: Map<String, String> = emptyMap(),
    ): T = io {
        if (!configured) return@io fallback
        try {
            val resp = http.get("$base$path") {
                headers().forEach { (k, v) -> header(k, v) }
                url { params.forEach { (k, v) -> parameters.append(k, v) } }
            }
            if (resp.status.isSuccess()) resp.body<T>() else fallback
        } catch (_: Exception) {
            fallback
        }
    }

    /**
     * POST that surfaces the server's own message on failure.
     *
     * These messages are written for guardians — "This guardian consented to
     * the check-up but not to photographs", "Please confirm this is not an
     * emergency" — so showing them verbatim is better than inventing one.
     */
    private suspend inline fun <reified B, reified T> postFor(path: String, body: B): Result<T> = io {
        if (!configured) return@io Result.failure(Exception("Backend not configured"))
        try {
            val resp = http.post("$base$path") {
                headers().forEach { (k, v) -> header(k, v) }
                contentType(ContentType.Application.Json)
                setBody(body)
            }
            if (resp.status.isSuccess()) {
                Result.success(resp.body<T>())
            } else {
                val err = try { resp.body<ErrorBody>() } catch (_: Exception) { null }
                Result.failure(Exception(err?.error ?: "Request failed"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    // ─── Consent ────────────────────────────────────────────

    suspend fun pendingConsents(): List<PendingConsentDto> =
        getOr("/api/camps/consents", PendingConsentsDto()).consents

    /**
     * Answer a consent request.
     *
     * `checks` narrows what may be recorded — a guardian can agree to height
     * and vision and refuse a blood test. `photos` is a separate answer, only
     * ever sent when the camp asked the photography question.
     */
    suspend fun recordConsent(
        campId: String,
        kidId: String,
        granted: Boolean,
        checks: List<String>,
        photos: Boolean,
    ): Result<ConsentResultDto> = postFor(
        "/api/camps/consent",
        ConsentRequestBody(
            campId = campId,
            kidId = kidId,
            decision = if (granted) "GRANTED" else "DECLINED",
            checks = checks,
            consentPhotos = photos,
        ),
    )

    // ─── Results ────────────────────────────────────────────

    suspend fun campResult(campId: String, kidId: String): CampResultDto =
        getOr("/api/camps/result", CampResultDto(), mapOf("camp_id" to campId, "kid_id" to kidId))

    // ─── Photographs ────────────────────────────────────────

    suspend fun photos(kidId: String): List<FindingPhotoDto> =
        getOr("/api/me/photos", FindingPhotosDto(), mapOf("kid_id" to kidId)).photos

    /** The image itself. Fetched on open, never in a list. */
    suspend fun photo(photoId: String): PhotoImageDto? {
        val r = getOr("/api/me/photo/$photoId", PhotoImageDto())
        return if (r.base64.isBlank()) null else r
    }

    // ─── Questions ──────────────────────────────────────────

    suspend fun questionPolicy(): QuestionPolicyDto =
        getOr("/api/me/question-policy", QuestionPolicyDto())

    suspend fun threads(): List<QuestionThreadDto> =
        getOr("/api/me/questions", QuestionThreadsDto()).threads

    suspend fun thread(threadId: String): ThreadDetailDto =
        getOr("/api/me/questions/$threadId", ThreadDetailDto())

    /**
     * Ask a question.
     *
     * The acknowledgement is required by the server, not merely by this screen:
     * a build of the app that forgot to ask gets a 400 rather than quietly
     * opening a channel a family might mistake for urgent care.
     */
    suspend fun ask(
        schoolId: String,
        kidId: String?,
        body: String,
        notUrgentAcknowledged: Boolean,
    ): Result<AskedQuestionDto> = postFor(
        "/api/me/questions",
        AskQuestionBody(
            schoolId = schoolId,
            kidId = kidId?.takeIf { it.isNotBlank() },
            body = body,
            notUrgentAcknowledged = notUrgentAcknowledged,
        ),
    )

    // ─── Reading ────────────────────────────────────────────

    suspend fun library(locale: String): LibraryDto =
        getOr("/api/library", LibraryDto(), mapOf("locale" to locale))

    suspend fun article(slug: String, locale: String): ArticleDto? {
        val r = getOr("/api/library/$slug", ArticleResponseDto(), mapOf("locale" to locale))
        return if (r.article.title.isBlank()) null else r.article
    }

    // ─── Referrals ──────────────────────────────────────────

    suspend fun referrals(includeClosed: Boolean = false): List<ReferralDto> =
        getOr(
            "/api/referrals",
            ReferralsDto(),
            if (includeClosed) mapOf("all" to "1") else emptyMap(),
        ).referrals

    suspend fun markReferralBooked(referralId: String): Result<SimpleOkDto> =
        postFor("/api/referrals/$referralId/booked", EmptyBody())

    suspend fun markReferralAttended(referralId: String, note: String): Result<SimpleOkDto> =
        postFor("/api/referrals/$referralId/attended", NoteBody(note))

    suspend fun declineReferral(referralId: String, reason: String): Result<SimpleOkDto> =
        postFor("/api/referrals/$referralId/decline", ReasonBody(reason))

    // ─── Everyday illness ───────────────────────────────────

    /**
     * The complaint list, the wording, and this child's history.
     *
     * The list comes from the server rather than the app so that a build
     * running an old version cannot offer a complaint the server rejects.
     */
    suspend fun symptomLog(kidId: String): SymptomLogDto =
        getOr("/api/me/symptoms", SymptomLogDto(), mapOf("kid_id" to kidId))

    suspend fun recordSymptom(body: SymptomBody): Result<SymptomSavedDto> =
        postFor("/api/me/symptoms", body)

    suspend fun deleteSymptom(eventId: String): Result<SimpleOkDto> = io {
        if (!configured) return@io Result.failure(Exception("Backend not configured"))
        try {
            val resp = http.delete("$base/api/me/symptoms/$eventId") {
                headers().forEach { (k, v) -> header(k, v) }
            }
            if (resp.status.isSuccess()) Result.success(SimpleOkDto())
            else Result.failure(Exception("Could not delete that"))
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    // ─── Plan ───────────────────────────────────────────────

    /**
     * What this account can use.
     *
     * The app reads `care` and never `plan` when deciding whether to show
     * something clinical. On failure the default is the free plan with all care
     * allowed, so a network problem can never hide a child's results.
     */
    suspend fun entitlements(): EntitlementsDto =
        getOr("/api/me/entitlements", EntitlementsDto())

    // ─── Data rights ────────────────────────────────────────

    suspend fun dataRights(): List<DataRightDto> =
        getOr("/api/me/rights", DataRightsDto()).history

    suspend fun requestCorrection(
        kidId: String,
        field: String,
        requestedValue: String,
        note: String,
    ): Result<SimpleOkDto> = postFor(
        "/api/me/correction",
        CorrectionBody(kidId = kidId, field = field, requestedValue = requestedValue, note = note),
    )

    suspend fun withdrawConsent(reason: String): Result<SimpleOkDto> =
        postFor("/api/me/consent/withdraw", ReasonBody(reason))

    /**
     * Erase one child's record completely.
     *
     * This is the DPDP erasure right, not a tidy-up: findings, referrals and
     * camp participation go with it, and the deletion itself is logged. It is
     * reachable only from the record screen, never from a button sitting next
     * to the child's health data, because the two are not the same act.
     */
    suspend fun eraseChild(kidId: String): Result<SimpleOkDto> = io {
        if (!configured) return@io Result.failure(Exception("Backend not configured"))
        try {
            val resp = http.delete("$base/api/kids/$kidId") {
                headers().forEach { (k, v) -> header(k, v) }
            }
            if (resp.status.isSuccess()) {
                Result.success(SimpleOkDto())
            } else {
                val err = try { resp.body<ErrorBody>() } catch (_: Exception) { null }
                Result.failure(Exception(err?.error ?: "Request failed"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
