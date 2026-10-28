package kallam.healthcare.data

import kotlinx.serialization.Serializable

// What a clinician sees at a camp.
//
// A doctor arrives at a school hall with a phone. They need the camps they
// were put on, the children on the one they are working, and the screening
// forms their own specialty covers — an ophthalmologist records vision, a
// dentist records the dental check, and neither is handed the other's form.
//
// The server already decides all of this: listMyCamps returns only assigned
// camps, and getScreeningForm narrows its `checks` to the specialty behind the
// assignment. These types are the shape those answers already have, so the app
// asks rather than reasons.

@Serializable
data class ClinicianCampDto(
    val id: String = "",
    val title: String = "",
    val schoolName: String = "",
    val date: String = "",
    val staffRole: String = "",
    val participants: Int = 0,
    val screened: Int = 0,
    /**
     * Children screened and waiting on a physician.
     *
     * The server sends this as `approved`, which is what the column is called
     * in the shared camp mapper — but for a clinician's own camps the query
     * behind it counts status = 'SCREENED', which is the queue, not the done
     * pile. Named here for what it holds.
     */
    @kotlinx.serialization.SerialName("approved")
    val awaitingReview: Int = 0,
    val status: String = "",
)

@Serializable
data class ClinicianCampsDto(
    val camps: List<ClinicianCampDto> = emptyList(),
)

@Serializable
data class CampChildDto(
    val kidId: String = "",
    val name: String = "",
    val grade: String = "",
    val section: String = "",
    val gender: String = "",
    val age: Int? = null,
    val studentRef: String = "",
    val consentStatus: String = "PENDING",
    val attendance: String = "UNKNOWN",
    /** NOT_SCREENED, SCREENED, REVIEWED or RELEASED. */
    val status: String = "NOT_SCREENED",
    /**
     * Where this child stands for the person signed in: TODO, DONE, ABSENT,
     * NOT_MINE or NO_CONSENT. [status] flips to SCREENED on anybody's save, so
     * the eye doctor would see Done once the dentist had been. Blank from a
     * server older than this field; [state] falls back to [status] then.
     */
    val screeningState: String = "",
    /** The checks that are this clinician's to record for this child. */
    val myChecks: List<String> = emptyList(),
    /** Of [myChecks], the ones not yet on record. */
    val myOutstanding: List<String> = emptyList(),
    val checksDone: Int = 0,
    val checksTotal: Int = 0,
) {
    val state: String
        get() = screeningState.ifBlank {
            when {
                consentStatus != "GRANTED" && consentStatus != "PAPER" -> "NO_CONSENT"
                status != "NOT_SCREENED" && status != "ABSENT" -> "DONE"
                attendance == "ABSENT" -> "ABSENT"
                else -> "TODO"
            }
        }

    /** "5 B", the class a teacher would say. */
    val classLabel: String
        get() = listOf(grade, section).filter { it.isNotBlank() }.joinToString(" ")
}

/**
 * What this person may do on this camp, decided by the server.
 *
 * A screener screens; a physician screens and signs off. The app could infer
 * it from staffRole on the camps list, but inferring a permission the server
 * already states is how the two come to disagree — and the one that matters
 * is the server's.
 */
@Serializable
data class CampCanDto(
    val schedule: Boolean = false,
    val screen: Boolean = false,
    val review: Boolean = false,
)

@Serializable
data class CampRosterDto(
    val participants: List<CampChildDto> = emptyList(),
    val can: CampCanDto = CampCanDto(),
)

@Serializable
data class ScreeningChildDto(
    val kidId: String = "",
    val name: String = "",
    val grade: String = "",
    val section: String = "",
    val gender: String = "",
    val age: Int? = null,
    val studentRef: String = "",
    val previousHeightCm: Double? = null,
    val previousWeightKg: Double? = null,
)

@Serializable
data class ExistingFindingDto(
    val checkType: String = "",
    val flag: String = "NOT_MEASURED",
    val rationale: String = "",
    val note: String = "",
)

@Serializable
data class ScreeningFormDto(
    val child: ScreeningChildDto = ScreeningChildDto(),
    val consentStatus: String = "PENDING",
    val attendance: String = "UNKNOWN",
    val status: String = "NOT_SCREENED",
    /**
     * The checks this clinician may record for this child: the camp's checks,
     * narrowed by the guardian's consent and then by the clinician's own
     * specialty. The app renders what is in this list and nothing else.
     */
    val checks: List<String> = emptyList(),
    /** Checks the guardian declined. Named so the absence is explained. */
    val excludedByConsent: List<String> = emptyList(),
    /** Checks this camp covers that belong to another clinician's round. */
    val otherSpecialties: List<String> = emptyList(),
    /** The specialty this scoping came from, for saying whose round it is. */
    val specialty: String = "",
    val findings: List<ExistingFindingDto> = emptyList(),
    /**
     * What the family logged in the app since the last camp. Null when the
     * server does not show it to this reader.
     */
    val illnessHistory: IllnessHistoryDto? = null,
)

/** The guardian's own account, labelled as such by the server. */
@Serializable
data class IllnessHistoryDto(
    val caution: String = "",
    val events: List<SymptomEventDto> = emptyList(),
)

@Serializable
data class SavedFindingDto(
    val checkType: String = "",
    val flag: String = "",
    val rationale: String = "",
)

@Serializable
data class ScreeningSavedDto(
    val saved: List<SavedFindingDto> = emptyList(),
)

// ─── What goes back up ──────────────────────────────────────

/**
 * One measurement, on its way to the server.
 *
 * `detail` is a JsonObject rather than a typed class because each check has
 * its own fields — heightCm and weightKg for growth, leftAcuity and
 * rightAcuity and squint for vision, cariesCount and gums and pain for
 * dental — and the names must match exactly what clinical.ts reads. Rename one
 * and the finding silently becomes "not recorded": captured at the camp,
 * stored, released, and shown to the parent as NOT MEASURED, with no error
 * anywhere. app-surface.test.ts holds those names to the rules.
 *
 * No flag is sent for a measurement. The server decides what a reading
 * means, so a device and the record cannot disagree about a child's result.
 * The one flag a device sends is NOT_MEASURED, for a check the clinician
 * could not do, and the server refuses it without the reason in [note].
 */
@Serializable
data class ScreeningSubmissionDto(
    val checkType: String = "",
    val detail: kotlinx.serialization.json.JsonObject =
        kotlinx.serialization.json.JsonObject(emptyMap()),
    val note: String = "",
    val flag: String = "",
)

@Serializable
data class ScreeningSubmissionBody(
    val findings: List<ScreeningSubmissionDto> = emptyList(),
)

@Serializable
data class AttendanceBody(
    val kidId: String = "",
    val attendance: String = "",
)

// ─── Review: turning findings into something a parent may see ──
//
// A camp does not end when the last child is screened. Every finding sits at
// SCREENED until a physician approves it, and nothing reaches a guardian until
// the camp is released. Both steps existed only in the web console, which
// meant the physician who took the readings — standing in the hall, holding
// the phone they took them on — had to find a laptop to let the work out.
//
// The worker already served all of it: the queue, the per-child detail, the
// approval and the release. These are the shapes those answers already have.

@Serializable
data class ReviewQueueItemDto(
    val kidId: String = "",
    val name: String = "",
    val grade: String = "",
    val age: Int? = null,
    /** Findings the rules flagged. Sorted worst-first by the server. */
    val alerts: Int = 0,
    val watches: Int = 0,
    /** SCREENED (waiting on this physician) or APPROVED (done, awaiting release). */
    val status: String = "SCREENED",
    val urgency: String = "NONE",
    val recommendation: String = "",
    val reviewed: Boolean = false,
    /** Other specialties' checks not yet signed off; the child is approved once none are left. */
    val waitingFor: List<String> = emptyList(),
    /**
     * Where this child stands for the physician reading the queue. TO_SIGN:
     * their checks are recorded and theirs to sign. NOT_READY: one of their
     * checks is not recorded yet. SIGNED: they have signed, others have not.
     * APPROVED: every check is signed.
     */
    val reviewState: String = "",
    /** The checks this physician signs off. All of them for a general physician. */
    val myChecks: List<String> = emptyList(),
    val signedChecks: List<String> = emptyList(),
    /** Checks no physician assigned to this camp can sign; the school has to add one. */
    val noSigner: List<String> = emptyList(),
) {
    /** The state, worked out from status for a server that does not send one. */
    val state: String
        get() = reviewState.ifBlank { if (status == "APPROVED") "APPROVED" else "TO_SIGN" }
}

@Serializable
data class ReviewQueueDto(
    val queue: List<ReviewQueueItemDto> = emptyList(),
)

@Serializable
data class ReviewChildDto(
    val kidId: String = "",
    val name: String = "",
    val grade: String = "",
    val age: Int? = null,
    val gender: String = "",
    val guardianName: String = "",
)

/** One prior camp where this same check was flagged. */
@Serializable
data class PriorFindingDto(
    val flag: String = "",
    val date: String = "",
    val title: String = "",
)

@Serializable
data class ReviewFindingDto(
    val checkType: String = "",
    /** What was measured. Keys vary by check — see ScreeningSubmissionDto. */
    val detail: kotlinx.serialization.json.JsonObject =
        kotlinx.serialization.json.JsonObject(emptyMap()),
    val flag: String = "NOT_MEASURED",
    /** What the rules said before anyone overrode it. */
    val autoFlag: String = "NOT_MEASURED",
    val rationale: String = "",
    val urgency: String = "NONE",
    val screenerNote: String = "",
    val reviewNote: String = "",
    /** True when a human has already moved this flag off the rules' answer. */
    val overridden: Boolean = false,
    /** The same check flagged at earlier camps. Empty is the common case. */
    val previous: List<PriorFindingDto> = emptyList(),
    /** Who signed this check off, when someone has. */
    val signedBy: String = "",
)

/** Another specialist's check on this child: only whether it is done, never the result. */
@Serializable
data class OtherCheckDto(
    val checkType: String = "",
    val recorded: Boolean = false,
    val signedBy: String = "",
)

@Serializable
data class RecurringDto(
    val checkType: String = "",
    val timesBefore: Int = 0,
)

@Serializable
data class ReviewDetailDto(
    val child: ReviewChildDto = ReviewChildDto(),
    val status: String = "SCREENED",
    val findings: List<ReviewFindingDto> = emptyList(),
    /** Checks flagged at a previous camp too — the server raises urgency for these. */
    val recurring: List<RecurringDto> = emptyList(),
    /** NONE, ROUTINE, SOON or URGENT, worked out from the findings. */
    val suggestedUrgency: String = "NONE",
    /**
     * What the guardian will read.
     *
     * The server drafts one from the findings when nobody has written one yet,
     * so the physician edits a sentence rather than facing a blank box at the
     * end of a long day. recommendationIsDraft says which it is.
     */
    val recommendation: String = "",
    val recommendationIsDraft: Boolean = false,
    /** The checks this physician signs off; the findings above are only these. */
    val myChecks: List<String> = emptyList(),
    /** When this physician last signed this child, or blank. */
    val mySignedAt: String = "",
    val otherChecks: List<OtherCheckDto> = emptyList(),
    val waitingFor: List<String> = emptyList(),
)

/** What a sign-off left behind: APPROVED once every check is signed. */
@Serializable
data class ReviewResultDto(
    val kidId: String = "",
    val status: String = "",
    val urgency: String = "NONE",
    val escalated: Boolean = false,
    val signedChecks: List<String> = emptyList(),
    val waitingFor: List<String> = emptyList(),
)

/** A flag a physician moved off what the rules decided. */
@Serializable
data class FindingAdjustmentDto(
    val checkType: String = "",
    val flag: String = "",
    val reviewNote: String = "",
)

@Serializable
data class ReviewSubmissionBody(
    val findings: List<FindingAdjustmentDto> = emptyList(),
    val urgency: String = "",
    /** Required by the server: there is no approving without telling the parent something. */
    val recommendation: String = "",
)

@Serializable
data class ReleaseResultDto(
    val released: Int = 0,
    val referralsOpened: Int = 0,
    val urgentNotified: Int = 0,
)
