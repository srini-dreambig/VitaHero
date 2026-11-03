package kallam.healthcare.data

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject

/**
 * The dietician's side of the wire.
 *
 * Every field here has to match what functions/dietician.ts sends, key for
 * key. kotlinx fills a missing key with the declared default and says nothing,
 * so a rename shows a dietician a child with no readings and no plan rather
 * than an error — dietician.test.ts holds the two sides together.
 */

@Serializable
data class DieticianMeDto(
    val id: String = "",
    val name: String = "",
    val qualification: String = "",
)

@Serializable
data class DieticianSchoolDto(
    val id: String = "",
    val name: String = "",
    val city: String = "",
    val children: Int = 0,
    /** Plans running at this school right now. */
    val plans: Int = 0,
)

@Serializable
data class DieticianSchoolsDto(
    val me: DieticianMeDto = DieticianMeDto(),
    val schools: List<DieticianSchoolDto> = emptyList(),
)

@Serializable
data class DieticianChildDto(
    val kidId: String = "",
    val name: String = "",
    val grade: String = "",
    val section: String = "",
    val age: Int? = null,
    val gender: String = "",
    val hasPlan: Boolean = false,
    /**
     * Growth or haemoglobin flagged at a released camp. Not every flag the
     * child has — the dental and eye findings are not this person's business
     * and never leave the server.
     */
    val concerns: Int = 0,
)

@Serializable
data class DieticianChildrenDto(
    val schoolId: String = "",
    val children: List<DieticianChildDto> = emptyList(),
)

@Serializable
data class DieticianFindingDto(
    val checkType: String = "",
    val flag: String = "",
    val detail: JsonObject? = null,
    val valueText: String = "",
    val rationale: String = "",
    val date: String = "",
    val campTitle: String = "",
)

@Serializable
data class DietTargetDto(
    val label: String = "",
    val value: String = "",
)

@Serializable
data class DietPlanDto(
    val id: String = "",
    val kidId: String = "",
    val title: String = "",
    val focus: String = "GENERAL",
    val startsOn: String = "",
    val endsOn: String = "",
    val guidance: String = "",
    val targets: List<DietTargetDto> = emptyList(),
    val status: String = "ACTIVE",
    val authorName: String = "",
    val createdAt: String = "",
    /** Parent's view only: who to phone about an allergy. Not on the wire: the repository fills it in. */
    @kotlinx.serialization.Transient val dieticianName: String = "",
    @kotlinx.serialization.Transient val dieticianPhone: String = "",
)

/** The server's first draft of a plan, from what was actually found. */
@Serializable
data class DietDraftDto(
    val title: String = "",
    val focus: String = "GENERAL",
    val guidance: String = "",
)

@Serializable
data class DieticianChildRecordDto(
    val child: DieticianChildProfileDto = DieticianChildProfileDto(),
    val findings: List<DieticianFindingDto> = emptyList(),
    val plans: List<DietPlanDto> = emptyList(),
    val draft: DietDraftDto = DietDraftDto(),
)

@Serializable
data class DieticianChildProfileDto(
    val kidId: String = "",
    val name: String = "",
    val grade: String = "",
    val section: String = "",
    val age: Int? = null,
    val gender: String = "",
    val schoolName: String = "",
    val heightCm: Float = 0f,
    val weightKg: Float = 0f,
)

@Serializable
data class DietPlanBody(
    val kidId: String,
    val title: String = "",
    val focus: String = "GENERAL",
    val startsOn: String = "",
    val endsOn: String = "",
    val guidance: String = "",
    val targets: List<DietTargetDto> = emptyList(),
)

@Serializable
data class DietPlanSavedDto(val plan: DietPlanDto? = null)

/** What a guardian is shown: the one plan that is running, or none, and who to phone about it. */
@Serializable
data class GuardianDietPlanDto(
    val plan: DietPlanDto? = null,
    val dietician: DieticianContactDto? = null,
    val allergyNote: String = "",
)

@Serializable
data class DieticianContactDto(val name: String = "", val phone: String = "")

// ─── The reading library ────────────────────────────────────

/**
 * One article on the shelf a family reads.
 *
 * A dietician writes for it too — C4, which is a permission change on a route
 * that already existed rather than a new system. They see and edit their own
 * articles; taking a page off the shelf stays with operations, because a page
 * a family has been sent to is a decision about the programme.
 */
@Serializable
data class LibraryArticleDto(
    val id: String = "",
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
    val updatedAt: String = "",
)

@Serializable
data class MyArticlesDto(
    val articles: List<LibraryArticleDto> = emptyList(),
    val checkTypes: List<String> = emptyList(),
    val locales: List<String> = emptyList(),
)

@Serializable
data class ArticleBody(
    val slug: String,
    val locale: String = "en",
    val title: String = "",
    val summary: String = "",
    val body: String = "",
    val checkTypes: List<String> = emptyList(),
    val flags: List<String> = emptyList(),
    val published: Boolean = true,
)

// ─── Groups: one plan for many children ─────────────────────

/**
 * Children grouped by what their checks found, so one plan can go to every
 * child who needs the same thing. Bands and flags only: the readings stay
 * behind the per-child record, whose every opening is logged.
 */
@Serializable
data class DieticianCohortsDto(
    val schoolId: String = "",
    val grade: String = "",
    val grades: List<String> = emptyList(),
    val total: Int = 0,
    val cohorts: List<DieticianCohortDto> = emptyList(),
)

@Serializable
data class DieticianCohortDto(
    val key: String = "",
    val label: String = "",
    val focus: String = "GENERAL",
    val priority: Int = 0,
    val summary: CohortSummaryDto = CohortSummaryDto(),
    val children: List<CohortChildDto> = emptyList(),
    val draft: CohortDraftDto = CohortDraftDto(),
)

@Serializable
data class CohortSummaryDto(
    val count: Int = 0,
    val withPlan: Int = 0,
    val ageMin: Int? = null,
    val ageMax: Int? = null,
    val girls: Int = 0,
    val boys: Int = 0,
    val severeAnaemia: Int = 0,
    val toothDecay: Int = 0,
)

@Serializable
data class CohortChildDto(
    val kidId: String = "",
    val name: String = "",
    val grade: String = "",
    val section: String = "",
    val age: Int? = null,
    val gender: String = "",
    val band: String = "",
    /** "", NONE, MILD or SEVERE. */
    val anaemia: String = "",
    val toothDecay: Boolean = false,
    val hasPlan: Boolean = false,
)

/** A starting point for the group's plan: RULES, or AI when the model wrote it. */
@Serializable
data class CohortDraftDto(
    val title: String = "",
    val focus: String = "GENERAL",
    val guidance: String = "",
    val targets: List<DietTargetDto> = emptyList(),
    val source: String = "RULES",
)

/** One of the twelve plans written before a camp, one per group. */
@Serializable
data class DietTemplateDto(
    val key: String = "",
    val label: String = "",
    val focus: String = "GENERAL",
    /** False while it is still the starter draft. */
    val saved: Boolean = false,
    val title: String = "",
    val guidance: String = "",
    val targets: List<DietTargetDto> = emptyList(),
    val updatedAt: String = "",
)

@Serializable
data class DietTemplatesDto(
    val templates: List<DietTemplateDto> = emptyList(),
    val ready: Int = 0,
)

@Serializable
data class DietTemplateBody(
    val key: String,
    val title: String = "",
    val guidance: String = "",
    val targets: List<DietTargetDto> = emptyList(),
)

@Serializable
data class CohortDraftResponseDto(val draft: CohortDraftDto = CohortDraftDto())

@Serializable
data class CohortDraftBody(val schoolId: String, val key: String, val grade: String = "")

@Serializable
data class CohortPlanBody(
    val kidIds: List<String>,
    val title: String = "",
    val focus: String = "GENERAL",
    val guidance: String = "",
    val targets: List<DietTargetDto> = emptyList(),
)

@Serializable
data class CohortPlanSavedDto(val saved: Int = 0)
