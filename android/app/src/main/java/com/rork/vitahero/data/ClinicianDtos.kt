package com.rork.vitahero.data

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
)

@Serializable
data class CampRosterDto(
    val participants: List<CampChildDto> = emptyList(),
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
 * No flag is sent. The server decides what a measurement means, so a device
 * and the record cannot disagree about a child's result.
 */
@Serializable
data class ScreeningSubmissionDto(
    val checkType: String = "",
    val detail: kotlinx.serialization.json.JsonObject =
        kotlinx.serialization.json.JsonObject(emptyMap()),
    val note: String = "",
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
