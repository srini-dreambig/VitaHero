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

/** One day of the food log, rolled up. Not every meal the child has eaten. */
@Serializable
data class FoodLogDayDto(
    val day: String = "",
    val items: Int = 0,
    val eaten: Int = 0,
    val kcal: Int = 0,
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
    val foodLog: List<FoodLogDayDto> = emptyList(),
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

/** What a guardian is shown: the one plan that is running, or none. */
@Serializable
data class GuardianDietPlanDto(val plan: DietPlanDto? = null)

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
