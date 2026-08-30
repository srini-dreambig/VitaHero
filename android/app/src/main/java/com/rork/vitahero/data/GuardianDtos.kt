package com.rork.vitahero.data

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * The guardian half of the school screening pathway.
 *
 * These mirror the JSON the worker returns for a signed-in parent: what they
 * are being asked to consent to, what a physician released about their child,
 * the photographs taken of a finding, the questions they have asked the school,
 * the reading chosen from their own child's results, and their data rights.
 *
 * Unlike the older DTOs in Dtos.kt, which mirror database columns, these mirror
 * the API's camelCase responses, so almost none of them need @SerialName.
 */

// ─── Consent ────────────────────────────────────────────────

@Serializable
data class PendingConsentDto(
    val campId: String = "",
    val kidId: String = "",
    val kidName: String = "",
    val schoolName: String = "",
    val title: String = "",
    val date: String = "",
    val time: String = "",
    val venue: String = "",
    val deadline: String = "",
    val checks: List<String> = emptyList(),
    /**
     * True when this camp has photography switched on. The app must ask the
     * photography question as a separate yes or no when it is true, and must
     * not show it at all when it is false.
     */
    val photosAsked: Boolean = false,
)

@Serializable
data class PendingConsentsDto(val consents: List<PendingConsentDto> = emptyList())

@Serializable
data class ConsentResultDto(
    val kidId: String = "",
    val consentStatus: String = "",
    val consentPhotos: Boolean = false,
)

/**
 * Request bodies.
 *
 * These exist rather than a plain map because kotlinx.serialization has no
 * serializer for Map<String, Any>, and every one of these bodies mixes strings
 * with booleans or lists. A map would have compiled and then failed at runtime,
 * in the field, on the one screen where failure means a child is not screened.
 */

@Serializable
data class ConsentRequestBody(
    val campId: String,
    val kidId: String,
    val decision: String,
    val checks: List<String>,
    val consentPhotos: Boolean,
)

@Serializable
data class AskQuestionBody(
    val schoolId: String,
    val kidId: String? = null,
    val body: String,
    val notUrgentAcknowledged: Boolean,
)

@Serializable
data class CorrectionBody(
    val kidId: String,
    val field: String,
    val requestedValue: String,
    val note: String = "",
)

@Serializable
data class ReasonBody(val reason: String = "")

@Serializable
data class NoteBody(val note: String = "")

@Serializable
class EmptyBody

// ─── A released result ──────────────────────────────────────

@Serializable
data class ReleasedFindingDto(
    val checkType: String = "",
    val flag: String = "NOT_MEASURED",
    /** What was measured, in the guardian's words. */
    val summary: String = "",
    /** Why that flag, written for a parent rather than a clinician. */
    val note: String = "",
)

@Serializable
data class CampResultDto(
    /**
     * RELEASED once a physician has approved it. PENDING while the result
     * exists but is still under review — the app must show `message`, not an
     * empty screen, in that case.
     */
    val status: String = "PENDING",
    val message: String = "",
    val kidName: String = "",
    val schoolName: String = "",
    val campTitle: String = "",
    val date: String = "",
    val urgency: String = "NONE",
    val recommendation: String = "",
    val findings: List<ReleasedFindingDto> = emptyList(),
)

// ─── Photographs ────────────────────────────────────────────

@Serializable
data class FindingPhotoDto(
    val id: String = "",
    val checkType: String = "",
    val mime: String = "image/jpeg",
    val caption: String = "",
    val campTitle: String = "",
    val campDate: String = "",
    val at: String = "",
)

@Serializable
data class FindingPhotosDto(val photos: List<FindingPhotoDto> = emptyList())

/** One image, base64 encoded. Fetched only when the guardian opens it. */
@Serializable
data class PhotoImageDto(
    val id: String = "",
    val mime: String = "image/jpeg",
    val base64: String = "",
    val checkType: String = "",
    val caption: String = "",
)

// ─── Questions ──────────────────────────────────────────────

@Serializable
data class QuestionPolicyDto(
    val available: Boolean = false,
    val schools: List<QuestionSchoolDto> = emptyList(),
    val responseWindowDays: Int = 3,
    val notice: String = "",
)

@Serializable
data class QuestionSchoolDto(val id: String = "", val name: String = "")

@Serializable
data class QuestionThreadDto(
    val id: String = "",
    val schoolName: String = "",
    val kidName: String = "",
    val subject: String = "",
    val status: String = "OPEN",
    val awaiting: String = "SCHOOL",
    val messages: Int = 0,
    val lastAt: String = "",
)

@Serializable
data class QuestionThreadsDto(val threads: List<QuestionThreadDto> = emptyList())

@Serializable
data class QuestionMessageDto(
    val id: String = "",
    val side: String = "GUARDIAN",
    val name: String = "",
    val body: String = "",
    val at: String = "",
)

@Serializable
data class ThreadHeaderDto(
    val id: String = "",
    val schoolName: String = "",
    val kidName: String = "",
    val subject: String = "",
    val status: String = "OPEN",
    val awaiting: String = "SCHOOL",
    val openedAt: String = "",
)

@Serializable
data class ThreadDetailDto(
    val thread: ThreadHeaderDto = ThreadHeaderDto(),
    val messages: List<QuestionMessageDto> = emptyList(),
)

@Serializable
data class AskedQuestionDto(
    val threadId: String = "",
    val status: String = "OPEN",
    val expectedReplyWithinDays: Int = 3,
)

// ─── Reading ────────────────────────────────────────────────

@Serializable
data class ArticleBecauseDto(val kidName: String = "", val checkType: String = "")

@Serializable
data class ArticleDto(
    val slug: String = "",
    val locale: String = "en",
    val title: String = "",
    val summary: String = "",
    val body: String = "",
    val checkTypes: List<String> = emptyList(),
    val flags: List<String> = emptyList(),
    val minAge: Int = 0,
    val maxAge: Int = 99,
    val published: Boolean = true,
    /** Present only on the "for you" shelf: which child, and which finding. */
    val because: ArticleBecauseDto? = null,
)

@Serializable
data class LibraryDto(
    val locale: String = "en",
    val forYou: List<ArticleDto> = emptyList(),
    val general: List<ArticleDto> = emptyList(),
)

@Serializable
data class ArticleResponseDto(val article: ArticleDto = ArticleDto())

// ─── Referrals ──────────────────────────────────────────────

@Serializable
data class ReferralDto(
    val id: String = "",
    val campId: String = "",
    val kidId: String = "",
    val kidName: String = "",
    val checkType: String = "",
    val specialty: String = "",
    val flag: String = "WATCH",
    val urgency: String = "ROUTINE",
    val reason: String = "",
    val status: String = "OPEN",
    val dueBy: String = "",
    val createdAt: String = "",
    val attendedAt: String = "",
    val outcome: String = "",
    val diagnosis: String = "",
    val treatment: String = "",
    val clinicianNote: String = "",
    val clinicianName: String = "",
    val declinedReason: String = "",
    val schoolName: String = "",
    val campTitle: String = "",
)

@Serializable
data class ReferralsDto(val referrals: List<ReferralDto> = emptyList())

// ─── Entitlements ───────────────────────────────────────────

@Serializable
data class CareEntitlementsDto(
    val campResults: Boolean = true,
    val referrals: Boolean = true,
    val consent: Boolean = true,
    val dataRights: Boolean = true,
    val askTheSchool: Boolean = true,
    val growthCharts: Boolean = true,
)

@Serializable
data class EntitlementsDto(
    val plan: String = "FREE",
    val planUntil: String = "",
    val features: Map<String, Boolean> = emptyMap(),
    /**
     * Always true on every plan. The app reads this rather than the plan when
     * deciding whether to show anything clinical, so that a future paid tier
     * cannot accidentally hide a child's health result.
     */
    val care: CareEntitlementsDto = CareEntitlementsDto(),
    val notice: String = "",
)

// ─── Data rights ────────────────────────────────────────────

@Serializable
data class DataRightDto(
    val action: String = "",
    val at: String = "",
    val detail: String = "",
)

@Serializable
data class DataRightsDto(val history: List<DataRightDto> = emptyList())

@Serializable
data class SimpleOkDto(val ok: Boolean = true, val message: String = "")

// ─── Everyday illness ───────────────────────────────────────

@Serializable
data class SymptomEventDto(
    val id: String = "",
    val kidId: String = "",
    val symptom: String = "",
    val severity: String = "MILD",
    val startedOn: String = "",
    val endedOn: String = "",
    val note: String = "",
    val sawDoctor: Boolean = false,
    val missedSchool: Boolean = false,
)

@Serializable
data class SymptomLogDto(
    val symptoms: List<String> = emptyList(),
    val severities: List<String> = emptyList(),
    /** Written by the server so this wording cannot drift from the API's. */
    val notice: String = "",
    val events: List<SymptomEventDto> = emptyList(),
)

@Serializable
data class SymptomBody(
    val kidId: String,
    val symptom: String,
    val severity: String,
    val startedOn: String,
    val endedOn: String? = null,
    val note: String = "",
    val sawDoctor: Boolean = false,
    val missedSchool: Boolean = false,
)

@Serializable
data class SymptomSavedDto(
    val id: String = "",
    val symptom: String = "",
    val startedOn: String = "",
    /**
     * Present when this complaint has a version that needs care today. Shown
     * after saving — the record is kept either way, because a worried parent
     * should not lose what they typed.
     */
    val advice: String = "",
)
