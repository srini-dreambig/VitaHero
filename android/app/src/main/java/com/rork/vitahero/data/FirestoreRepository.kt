package com.rork.vitahero.data

import android.app.Application
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import com.google.firebase.firestore.SetOptions
import io.ktor.client.call.body
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.parameter
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.http.ContentType
import io.ktor.http.contentType
import io.ktor.http.isSuccess
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable

/**
 * Direct Firestore data layer — replaces the Cloudflare/Neon ApiRepository for all
 * user-scoped data (profiles, kids, meals, streaks, appointments, growth, notifications,
 * co-parents, camps, schools, health checkups, doctor assignments).
 *
 * Uses Firebase Auth UID as the root key for user data (subcollections under profiles/{uid}).
 * Public/shared data (camps, schools, health_checkups, doctor_assignments) lives in top-level
 * collections.
 *
 * Worker-only endpoints (booking directory, AI diet tips, food recognition, invite resolution)
 * still call the Cloudflare Worker via HTTP — the Worker now reads/writes Firestore via REST API.
 */
class FirestoreRepository(private val app: Application) {

    private val db: FirebaseFirestore get() = FirebaseFirestore.getInstance()
    private val auth: FirebaseAuth get() = FirebaseAuth.getInstance()
    private val http get() = ApiService.http
    private val base get() = ApiService.baseUrl

    private val currentUid: String get() = auth.currentUser?.uid ?: ""
    private val skipNetwork: Boolean get() = !ApiService.isConfigured

    private fun authHeaders(): Map<String, String> {
        val headers = mutableMapOf<String, String>()
        try {
            // We're already on Dispatchers.IO — blocking await is fine
            val token = com.google.android.gms.tasks.Tasks.await(
                auth.currentUser?.getIdToken(false) ?: return headers
            )?.token
            token?.let { headers["Authorization"] = "Bearer $it" }
        } catch (_: Exception) { }
        return headers
    }

    // ─── Profile ───────────────────────────────────────────────

    suspend fun fetchMyProfile(): ProfileDto? = withContext(Dispatchers.IO) {
        val uid = currentUid
        if (uid.isBlank()) return@withContext null
        try {
            val snap = db.collection("profiles").document(uid).get().await()
            if (!snap.exists()) return@withContext null
            snap.toDto<ProfileDto>()?.copy(id = uid)
        } catch (_: Exception) { null }
    }

    /**
     * Resolve provisioned parent data by phone number and link it to the Firebase UID.
     * Called after Firebase Auth succeeds — finds the admin-provisioned parent record
     * by phone number, copies kids/camp data into the user's profile, and marks the
     * provisioned record as linked.
     */
    suspend fun resolveProvisionedData(phone: String): Boolean = withContext(Dispatchers.IO) {
        val uid = currentUid
        if (uid.isBlank() || phone.isBlank()) return@withContext false
        try {
            // Extract last 10 digits from phone number
            val digits = phone.replace(Regex("\\D"), "")
            val last10 = if (digits.length >= 10) digits.takeLast(10) else ""
            if (last10.isBlank()) return@withContext false

            // Check if provisioned parent exists
            val provSnap = db.collection("provisioned_parents").document(last10).get().await()
            if (!provSnap.exists()) return@withContext false

            val provName = provSnap.getString("name") ?: "Parent"
            val provSchoolId = provSnap.getString("school_id") ?: ""
            val provSchoolName = provSnap.getString("school_name") ?: ""

            // Mark provisioned parent as linked to this UID
            db.collection("provisioned_parents").document(last10)
                .set(mapOf(
                    "uid" to uid,
                    "is_logged_in" to true,
                ), SetOptions.merge()).await()

            // Copy provisioned kids into the user's profile subcollection
            val kidsSnap = db.collection("provisioned_parents").document(last10)
                .collection("kids").get().await()
            for (kidDoc in kidsSnap.documents) {
                val kidData = kidDoc.data ?: continue
                val kidId = kidDoc.id
                // Write kid into user's profile subcollection
                db.collection("profiles").document(uid)
                    .collection("kids").document(kidId)
                    .set(kidData + mapOf(
                        "profile_id" to uid,
                        "user_id" to uid,
                    ), SetOptions.merge()).await()
            }

            // Update profile with school info if not already set
            val profileSnap = db.collection("profiles").document(uid).get().await()
            val existingName = profileSnap.getString("name") ?: ""
            if (existingName.isBlank() || existingName == "Parent") {
                db.collection("profiles").document(uid)
                    .set(mapOf(
                        "name" to provName,
                        "school_id" to provSchoolId,
                    ), SetOptions.merge()).await()
            }

            // Auto-enroll in school if provisioned with a school_id
            if (provSchoolId.isNotBlank()) {
                val enrollId = "${uid}_$provSchoolId"
                db.collection("school_enrollments").document(enrollId)
                    .set(mapOf(
                        "user_id" to uid,
                        "school_id" to provSchoolId,
                        "enrolled_at" to System.currentTimeMillis().toString(),
                    ), SetOptions.merge()).await()
            }

            true
        } catch (_: Exception) { false }
    }

    suspend fun upsertProfile(dto: ProfileDto) = withContext(Dispatchers.IO) {
        val uid = currentUid
        if (uid.isBlank()) return@withContext
        try {
            val data = dto.toMap()
            db.collection("profiles").document(uid).set(data, SetOptions.merge()).await()
        } catch (_: Exception) { }
    }

    // ─── Kids ──────────────────────────────────────────────────

    suspend fun fetchKids(): List<KidDto> = withContext(Dispatchers.IO) {
        val uid = currentUid
        if (uid.isBlank()) return@withContext emptyList()
        try {
            db.collection("profiles").document(uid)
                .collection("kids").get().await()
                .documents.mapNotNull { it.toDto<KidDto>()?.copy(id = it.id) }
        } catch (_: Exception) { emptyList() }
    }

    suspend fun upsertKid(dto: KidDto) = withContext(Dispatchers.IO) {
        val uid = currentUid
        if (uid.isBlank()) return@withContext
        try {
            val data = dto.toMap()
            db.collection("profiles").document(uid)
                .collection("kids").document(dto.id).set(data, SetOptions.merge()).await()
        } catch (_: Exception) { }
    }

    suspend fun deleteKid(kidId: String) = withContext(Dispatchers.IO) {
        val uid = currentUid
        if (uid.isBlank()) return@withContext
        try {
            db.collection("profiles").document(uid)
                .collection("kids").document(kidId).delete().await()
            // Also delete subcollections
            deleteSubcollection("profiles/$uid/kids/$kidId/growth_points")
            deleteSubcollection("profiles/$uid/kids/$kidId/ai_diet_tips")
        } catch (_: Exception) { }
    }

    // ─── Meals ─────────────────────────────────────────────────

    suspend fun fetchAllMeals(): List<MealItemDto> = withContext(Dispatchers.IO) {
        val uid = currentUid
        if (uid.isBlank()) return@withContext emptyList()
        try {
            db.collection("profiles").document(uid)
                .collection("meals").get().await()
                .documents.mapNotNull { it.toDto<MealItemDto>()?.copy(id = it.id) }
        } catch (_: Exception) { emptyList() }
    }

    suspend fun upsertMeals(dtos: List<MealItemDto>) = withContext(Dispatchers.IO) {
        val uid = currentUid
        if (uid.isBlank()) return@withContext
        try {
            val batch = db.batch()
            for (dto in dtos) {
                val ref = db.collection("profiles").document(uid)
                    .collection("meals").document(dto.id)
                batch.set(ref, dto.toMap(), SetOptions.merge())
            }
            batch.commit().await()
        } catch (_: Exception) { }
    }

    // ─── Growth Points ─────────────────────────────────────────

    suspend fun fetchGrowthPoints(kidId: String): List<GrowthPointDto> = withContext(Dispatchers.IO) {
        val uid = currentUid
        if (uid.isBlank()) return@withContext emptyList()
        try {
            db.collection("profiles").document(uid)
                .collection("kids").document(kidId)
                .collection("growth_points").get().await()
                .documents.mapNotNull { it.toDto<GrowthPointDto>()?.copy(id = it.id) }
        } catch (_: Exception) { emptyList() }
    }

    suspend fun upsertGrowthPoint(dto: GrowthPointDto) = withContext(Dispatchers.IO) {
        val uid = currentUid
        if (uid.isBlank()) return@withContext
        try {
            val data = dto.toMap()
            db.collection("profiles").document(uid)
                .collection("kids").document(dto.kidId)
                .collection("growth_points").document(dto.id).set(data, SetOptions.merge()).await()
        } catch (_: Exception) { }
    }

    // ─── Streaks ───────────────────────────────────────────────

    suspend fun fetchStreak(kidId: String): StreakDto? = withContext(Dispatchers.IO) {
        val uid = currentUid
        if (uid.isBlank()) return@withContext null
        try {
            val snap = db.collection("profiles").document(uid)
                .collection("streaks").document(kidId).get().await()
            if (!snap.exists()) return@withContext null
            snap.toDto<StreakDto>()
        } catch (_: Exception) { null }
    }

    suspend fun upsertStreak(dto: StreakDto) = withContext(Dispatchers.IO) {
        val uid = currentUid
        if (uid.isBlank()) return@withContext
        try {
            val data = dto.toMap()
            db.collection("profiles").document(uid)
                .collection("streaks").document(dto.kidId).set(data, SetOptions.merge()).await()
        } catch (_: Exception) { }
    }

    // ─── Appointments ──────────────────────────────────────────

    suspend fun fetchAppointments(): List<AppointmentDto> = withContext(Dispatchers.IO) {
        val uid = currentUid
        if (uid.isBlank()) return@withContext emptyList()
        try {
            db.collection("profiles").document(uid)
                .collection("appointments").get().await()
                .documents.mapNotNull { it.toDto<AppointmentDto>()?.copy(id = it.id) }
        } catch (_: Exception) { emptyList() }
    }

    suspend fun upsertAppointment(dto: AppointmentDto) = withContext(Dispatchers.IO) {
        val uid = currentUid
        if (uid.isBlank()) return@withContext
        try {
            val data = dto.toMap()
            db.collection("profiles").document(uid)
                .collection("appointments").document(dto.id).set(data, SetOptions.merge()).await()
        } catch (_: Exception) { }
    }

    suspend fun deleteAppointment(appointmentId: String) = withContext(Dispatchers.IO) {
        val uid = currentUid
        if (uid.isBlank()) return@withContext
        try {
            db.collection("profiles").document(uid)
                .collection("appointments").document(appointmentId).delete().await()
        } catch (_: Exception) { }
    }

    // ─── Co-Parents ────────────────────────────────────────────

    suspend fun fetchCoParents(): List<CoParentDto> = withContext(Dispatchers.IO) {
        val uid = currentUid
        if (uid.isBlank()) return@withContext emptyList()
        try {
            db.collection("profiles").document(uid)
                .collection("co_parents").get().await()
                .documents.mapNotNull { it.toDto<CoParentDto>()?.copy(id = it.id) }
        } catch (_: Exception) { emptyList() }
    }

    suspend fun upsertCoParent(dto: CoParentDto) = withContext(Dispatchers.IO) {
        val uid = currentUid
        if (uid.isBlank()) return@withContext
        try {
            val data = dto.toMap()
            db.collection("profiles").document(uid)
                .collection("co_parents").document(dto.id).set(data, SetOptions.merge()).await()
        } catch (_: Exception) { }
    }

    // ─── Notifications ─────────────────────────────────────────

    suspend fun fetchNotifications(): List<NotificationDto> = withContext(Dispatchers.IO) {
        val uid = currentUid
        if (uid.isBlank()) return@withContext emptyList()
        try {
            db.collection("profiles").document(uid)
                .collection("notifications")
                .orderBy("time", Query.Direction.DESCENDING).get().await()
                .documents.mapNotNull { it.toDto<NotificationDto>()?.copy(id = it.id) }
        } catch (_: Exception) { emptyList() }
    }

    suspend fun markNotificationsRead(ids: List<String>) = withContext(Dispatchers.IO) {
        val uid = currentUid
        if (uid.isBlank()) return@withContext
        try {
            val batch = db.batch()
            for (id in ids) {
                batch.update(
                    db.collection("profiles").document(uid)
                        .collection("notifications").document(id),
                    "unread", false
                )
            }
            batch.commit().await()
        } catch (_: Exception) { }
    }

    // ─── Camps (parent-created, not school camps) ──────────────

    suspend fun fetchCamps(): List<CampDto> = withContext(Dispatchers.IO) {
        val uid = currentUid
        if (uid.isBlank()) return@withContext emptyList()
        try {
            db.collection("profiles").document(uid)
                .collection("camps").get().await()
                .documents.mapNotNull { it.toDto<CampDto>()?.copy(id = it.id) }
        } catch (_: Exception) { emptyList() }
    }

    suspend fun upsertCamp(dto: CampDto) = withContext(Dispatchers.IO) {
        val uid = currentUid
        if (uid.isBlank()) return@withContext
        try {
            val data = dto.toMap()
            db.collection("profiles").document(uid)
                .collection("camps").document(dto.id).set(data, SetOptions.merge()).await()
        } catch (_: Exception) { }
    }

    // ─── Schools (public directory) ────────────────────────────

    suspend fun fetchSchools(): List<SchoolDto> = withContext(Dispatchers.IO) {
        try {
            db.collection("schools").whereEqualTo("active", true).get().await()
                .documents.mapNotNull { it.toDto<SchoolDto>()?.copy(id = it.id) }
        } catch (_: Exception) { emptyList() }
    }

    // ─── School Camps (partner camps) ───────────────────────────

    suspend fun fetchSchoolCamps(schoolIds: List<String>): List<CampDto> = withContext(Dispatchers.IO) {
        if (schoolIds.isEmpty()) return@withContext emptyList()
        try {
            val result = mutableListOf<CampDto>()
            for (schoolId in schoolIds) {
                val snaps = db.collection("school_camps")
                    .whereEqualTo("school_id", schoolId)
                    .whereEqualTo("active", true).get().await()
                for (doc in snaps.documents) {
                    val title = doc.getString("title") ?: continue
                    val schoolName = try {
                        db.collection("schools").document(schoolId).get().await().getString("name") ?: ""
                    } catch (_: Exception) { "" }
                    val regKidIds = try {
                        db.collection("camp_registrations")
                            .whereEqualTo("school_camp_id", doc.id)
                            .whereEqualTo("user_id", currentUid)
                            .get().await().documents.mapNotNull { it.getString("kid_id") }
                    } catch (_: Exception) { emptyList() }
                    result.add(CampDto(
                        id = doc.id,
                        profileId = currentUid,
                        userId = currentUid,
                        title = title,
                        school = schoolName,
                        date = doc.getString("date") ?: "",
                        time = doc.getString("time") ?: "",
                        status = doc.getString("status") ?: "UPCOMING",
                        checks = (doc.get("checks") as? List<*>)?.filterIsInstance<String>() ?: emptyList(),
                        resultSummary = doc.getString("result_summary"),
                        isPartner = true,
                        schoolId = schoolId,
                        schoolCampId = doc.id,
                        description = doc.getString("description") ?: "",
                        grades = (doc.get("grades") as? List<*>)?.filterIsInstance<String>() ?: emptyList(),
                        capacity = (doc.getLong("capacity")?.toInt() ?: 200),
                        registeredKidIds = regKidIds,
                    ))
                }
            }
            result.sortedBy { it.date }
        } catch (_: Exception) { emptyList() }
    }

    // ─── School Enrollments ────────────────────────────────────

    suspend fun fetchMySchools(): List<MySchoolDto> = withContext(Dispatchers.IO) {
        val uid = currentUid
        if (uid.isBlank()) return@withContext emptyList()
        try {
            val enrollments = db.collection("school_enrollments")
                .whereEqualTo("user_id", uid).get().await().documents

            val result = mutableListOf<MySchoolDto>()
            for (enrollment in enrollments) {
                val schoolId = enrollment.getString("school_id") ?: continue
                val kidId = enrollment.getString("kid_id")
                val enrolledAt = enrollment.getString("enrolled_at") ?: ""
                val schoolDoc = db.collection("schools").document(schoolId).get().await()
                if (!schoolDoc.exists()) continue
                val school = schoolDoc.toDto<SchoolDto>() ?: continue
                result.add(
                    MySchoolDto(
                        id = school.id,
                        name = school.name,
                        city = school.city,
                        district = school.district,
                        description = school.description,
                        enrolledAt = enrolledAt,
                        kidId = kidId,
                    )
                )
            }
            result
        } catch (_: Exception) { emptyList() }
    }

    suspend fun enrollSchool(partnerCode: String, kidId: String?): Result<SchoolEnrollResponse> = withContext(Dispatchers.IO) {
        val uid = currentUid
        if (uid.isBlank()) return@withContext Result.failure(Exception("Not authenticated"))
        try {
            val schools = db.collection("schools")
                .whereEqualTo("partner_code", partnerCode.uppercase().trim()).get().await()
            if (schools.documents.isEmpty()) {
                return@withContext Result.failure(Exception("Invalid partner code"))
            }
            val school = schools.documents[0].toDto<SchoolDto>()!!
            val enrollmentId = "${uid}_${school.id}"
            val enrollmentData = mutableMapOf(
                "user_id" to uid,
                "school_id" to school.id,
                "enrolled_at" to System.currentTimeMillis().toString(),
            )
            kidId?.let { enrollmentData["kid_id"] = it }
            db.collection("school_enrollments").document(enrollmentId)
                .set(enrollmentData, SetOptions.merge()).await()
            Result.success(SchoolEnrollResponse(success = true, schoolId = school.id, schoolName = school.name))
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    // ─── Camp Registration ─────────────────────────────────────

    suspend fun registerForCamp(schoolCampId: String, kidId: String): Result<CampRegisterResponse> = withContext(Dispatchers.IO) {
        val uid = currentUid
        if (uid.isBlank()) return@withContext Result.failure(Exception("Not authenticated"))
        try {
            val regId = "${schoolCampId}_${kidId}"
            val data = mapOf(
                "school_camp_id" to schoolCampId,
                "kid_id" to kidId,
                "user_id" to uid,
                "registered_at" to System.currentTimeMillis().toString(),
            )
            db.collection("camp_registrations").document(regId).set(data, SetOptions.merge()).await()
            Result.success(CampRegisterResponse(success = true, registrationId = regId))
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    // ─── Health Checkups ───────────────────────────────────────

    /**
     * Fetch health checkups. Parents see only their own kids' checkups
     * (scoped by user_id). Doctors see checkups for camps they're assigned to
     * (caller passes doctorCampIds; query is scoped to those camps).
     */
    suspend fun fetchHealthCheckups(
        kidId: String? = null,
        doctorCampIds: List<String> = emptyList(),
    ): List<HealthCheckupResultDto> = withContext(Dispatchers.IO) {
        try {
            val uid = currentUid
            if (uid.isBlank()) return@withContext emptyList()

            // Parents: scope by user_id. Doctors: scope by school_camp_id (in doctorCampIds).
            val isDoctorScope = doctorCampIds.isNotEmpty()
            var query: Query = db.collection("health_checkups")

            if (isDoctorScope) {
                // Firestore "in" query supports up to 10 values; chunk if needed
                val chunked = doctorCampIds.chunked(10)
                val allSnaps = mutableListOf<HealthCheckupResultDto>()
                for (campIds in chunked) {
                    var q: Query = query.whereIn("school_camp_id", campIds)
                    if (kidId != null) q = q.whereEqualTo("kid_id", kidId)
                    val snaps = q.get().await()
                    for (snap in snaps.documents) {
                        val checkup = snap.toDto<HealthCheckupResultDto>()?.copy(id = snap.id)
                        if (checkup != null) {
                            allSnaps.add(enrichCheckup(checkup, uid))
                        }
                    }
                }
                return@withContext allSnaps
            } else {
                // Parent scope: only this user's kids' checkups
                query = query.whereEqualTo("user_id", uid)
                if (kidId != null) query = query.whereEqualTo("kid_id", kidId)
                val snaps = query.get().await()
                val results = mutableListOf<HealthCheckupResultDto>()
                for (snap in snaps.documents) {
                    val checkup = snap.toDto<HealthCheckupResultDto>()?.copy(id = snap.id)
                    if (checkup != null) {
                        val enriched = enrichCheckup(checkup, uid)
                        results.add(enriched)
                    }
                }
                results
            }
        } catch (_: Exception) { emptyList() }
    }

    suspend fun fetchHealthCheckup(checkupId: String): HealthCheckupResultDto? = withContext(Dispatchers.IO) {
        try {
            val uid = currentUid
            val snap = db.collection("health_checkups").document(checkupId).get().await()
            if (!snap.exists()) return@withContext null
            val checkup = snap.toDto<HealthCheckupResultDto>()?.copy(id = snap.id)
            if (checkup != null) enrichCheckup(checkup, uid) else null
        } catch (_: Exception) { null }
    }

    private suspend fun enrichCheckup(dto: HealthCheckupResultDto, uid: String): HealthCheckupResultDto {
        var result = dto
        try {
            // Find kid name from this user's kids subcollection (scoped by parent UID)
            if (result.kidName.isBlank() && uid.isNotBlank()) {
                val kidSnap = db.collection("profiles").document(uid)
                    .collection("kids").document(dto.kidId).get().await()
                if (kidSnap.exists()) {
                    result = result.copy(kidName = kidSnap.getString("name") ?: "")
                }
            }
            // Find camp title
            if (result.campTitle.isBlank() && dto.schoolCampId.isNotBlank()) {
                val campSnap = db.collection("school_camps").document(dto.schoolCampId).get().await()
                if (campSnap.exists()) {
                    result = result.copy(
                        campTitle = campSnap.getString("title") ?: "",
                        campDate = campSnap.getString("date") ?: "",
                    )
                }
            }
        } catch (_: Exception) { }
        return result
    }

    // ─── Doctor: Camps & Kids ──────────────────────────────────

    suspend fun fetchDoctorCamps(): List<DoctorCampDto> = withContext(Dispatchers.IO) {
        val phone = auth.currentUser?.phoneNumber ?: ""
        if (phone.isBlank()) return@withContext emptyList()
        try {
            val assignments = db.collection("doctor_assignments")
                .whereEqualTo("phone", phone)
                .whereEqualTo("assignment_status", "ACTIVE").get().await()

            val result = mutableListOf<DoctorCampDto>()
            for (assignment in assignments.documents) {
                val campId = assignment.getString("camp_id") ?: continue
                val campDoc = db.collection("school_camps").document(campId).get().await()
                if (!campDoc.exists()) continue

                val regCount = db.collection("camp_registrations")
                    .whereEqualTo("school_camp_id", campId).get().await().size()

                val checkupCount = db.collection("health_checkups")
                    .whereEqualTo("school_camp_id", campId).get().await().size()

                val checks = campDoc.get("checks") as? List<*> ?: emptyList<String>()
                result.add(
                    DoctorCampDto(
                        assignmentId = assignment.id,
                        assignmentStatus = assignment.getString("assignment_status") ?: "ACTIVE",
                        campId = campId,
                        campTitle = campDoc.getString("title") ?: "",
                        campDate = campDoc.getString("date") ?: "",
                        campTime = campDoc.getString("time") ?: "",
                        campStatus = campDoc.getString("status") ?: "UPCOMING",
                        checks = checks.filterIsInstance<String>(),
                        schoolId = campDoc.getString("school_id"),
                        schoolName = campDoc.getString("school_name") ?: "",
                        schoolCity = campDoc.getString("school_city") ?: "",
                        registeredCount = regCount,
                        checkedCount = checkupCount,
                    )
                )
            }
            result
        } catch (_: Exception) { emptyList() }
    }

    suspend fun fetchDoctorCampKids(campId: String): List<DoctorCampKidDto> = withContext(Dispatchers.IO) {
        try {
            val registrations = db.collection("camp_registrations")
                .whereEqualTo("school_camp_id", campId).get().await()

            val result = mutableListOf<DoctorCampKidDto>()
            for (reg in registrations.documents) {
                val kidId = reg.getString("kid_id") ?: continue
                val parentUid = reg.getString("user_id") ?: continue

                val kidDoc = db.collection("profiles").document(parentUid)
                    .collection("kids").document(kidId).get().await()
                if (!kidDoc.exists()) continue

                val kid = kidDoc.toDto<KidDto>() ?: continue

                val checkupSnap = db.collection("health_checkups")
                    .whereEqualTo("kid_id", kidId)
                    .whereEqualTo("school_camp_id", campId).limit(1).get().await()
                val checkupDoc = checkupSnap.documents.firstOrNull()

                val parentDoc = db.collection("profiles").document(parentUid).get().await()
                val parentName = parentDoc.getString("name") ?: ""
                val parentPhone = parentDoc.getString("phone") ?: ""

                result.add(
                    DoctorCampKidDto(
                        kidId = kid.id,
                        name = kid.name,
                        age = kid.age,
                        gender = kid.gender,
                        grade = kid.grade,
                        school = kid.school,
                        heightCm = kid.heightCm,
                        weightKg = kid.weightKg,
                        dental = kid.dental,
                        eyesight = kid.eyesight,
                        nutrition = kid.nutrition,
                        lastCheckup = kid.lastCheckup,
                        parentName = parentName,
                        parentPhone = parentPhone,
                        checkupId = checkupDoc?.id,
                        checkupStatus = checkupDoc?.getString("overall_status"),
                        checkupAt = checkupDoc?.getString("updated_at"),
                        referralNeeded = checkupDoc?.getBoolean("referral_needed"),
                    )
                )
            }
            result
        } catch (_: Exception) { emptyList() }
    }

    suspend fun fetchDoctorCheckup(kidId: String, campId: String): HealthCheckupDto? = withContext(Dispatchers.IO) {
        try {
            val snap = db.collection("health_checkups")
                .whereEqualTo("kid_id", kidId)
                .whereEqualTo("school_camp_id", campId).limit(1).get().await()
            val doc = snap.documents.firstOrNull() ?: return@withContext null
            doc.toDto<HealthCheckupDto>()?.copy(id = doc.id)
        } catch (_: Exception) { null }
    }

    suspend fun submitDoctorCheckup(
        kidId: String,
        campId: String,
        formData: Map<String, Any>,
        summary: String,
        referralNeeded: Boolean,
        referralNotes: String,
        overallStatus: String,
    ): Result<Unit> = withContext(Dispatchers.IO) {
        try {
            val doctorName = auth.currentUser?.displayName ?: "Doctor"
            val doctorUid = currentUid
            // Look up the parent UID for this kid via camp_registrations
            val regSnap = db.collection("camp_registrations")
                .whereEqualTo("school_camp_id", campId)
                .whereEqualTo("kid_id", kidId).limit(1).get().await()
            val parentUid = regSnap.documents.firstOrNull()?.getString("user_id") ?: ""
            val data = mapOf(
                "kid_id" to kidId,
                "school_camp_id" to campId,
                "user_id" to parentUid,
                "doctor_uid" to doctorUid,
                "doctor_name" to doctorName,
                "form_data" to formData,
                "summary" to summary,
                "referral_needed" to referralNeeded,
                "referral_notes" to referralNotes,
                "overall_status" to overallStatus,
                "updated_at" to System.currentTimeMillis().toString(),
            )
            // Check if checkup already exists
            val existing = db.collection("health_checkups")
                .whereEqualTo("kid_id", kidId)
                .whereEqualTo("school_camp_id", campId).limit(1).get().await()
            val docId = if (existing.documents.isNotEmpty()) existing.documents[0].id else db.collection("health_checkups").document().id
            db.collection("health_checkups").document(docId).set(data, SetOptions.merge()).await()
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    // ─── Phone Pre-Verification (Worker) ─────────────────────

    /**
     * Pre-check a phone number before sending Firebase OTP.
     * Verifies the phone is registered as an active doctor or provisioned parent.
     * Returns null if valid (proceed with OTP), or an error message string if denied.
     */
    suspend fun verifyPhoneForLogin(phone: String): PhoneVerifyResult = withContext(Dispatchers.IO) {
        if (skipNetwork) return@withContext PhoneVerifyResult(valid = true, isDoctor = false)
        try {
            val resp = http.post("$base/api/doctor/verify-phone") {
                contentType(ContentType.Application.Json)
                setBody(mapOf("phone" to phone))
            }
            if (resp.status.isSuccess()) {
                val dto = resp.body<PhoneVerifyDto>()
                if (dto.valid) {
                    PhoneVerifyResult(
                        valid = true,
                        isDoctor = dto.is_doctor,
                        doctorName = dto.doctor_name ?: "",
                        specialty = dto.specialty ?: "",
                        allowedScreens = dto.allowed_screens ?: emptyList(),
                    )
                } else {
                    PhoneVerifyResult(
                        valid = false,
                        error = dto.error ?: "This phone number is not registered.",
                    )
                }
            } else {
                try {
                    val errBody = resp.body<PhoneVerifyDto>()
                    PhoneVerifyResult(valid = false, error = errBody.error ?: "Verification failed. Please try again.")
                } catch (_: Exception) {
                    PhoneVerifyResult(valid = false, error = "Could not verify phone number. Check your connection.")
                }
            }
        } catch (e: Exception) {
            PhoneVerifyResult(valid = false, error = "Network error. Check your connection and try again.")
        }
    }

    // ─── Worker-backed endpoints (still via HTTP) ──────────────

    suspend fun fetchBookingDirectory(
        city: String,
        specialty: String = "",
        lat: Double? = null,
        lng: Double? = null,
    ): BookingDirectoryDto? = withContext(Dispatchers.IO) {
        if (skipNetwork) return@withContext null
        try {
            val resp = http.get("$base/api/booking/directory") {
                authHeaders().forEach { (k, v) -> header(k, v) }
                url {
                    parameters.append("city", city)
                    if (specialty.isNotBlank()) parameters.append("specialty", specialty)
                    lat?.let { parameters.append("lat", it.toString()) }
                    lng?.let { parameters.append("lng", it.toString()) }
                }
            }
            if (resp.status.isSuccess()) resp.body<BookingDirectoryDto>() else null
        } catch (_: Exception) { null }
    }

    suspend fun fetchDoctors(
        city: String = "",
        hospitalId: String = "",
        specialty: String = "",
    ): List<DoctorDto> = withContext(Dispatchers.IO) {
        if (skipNetwork) return@withContext emptyList()
        try {
            val resp = http.get("$base/api/doctors") {
                authHeaders().forEach { (k, v) -> header(k, v) }
                url {
                    if (city.isNotBlank()) parameters.append("city", city)
                    if (hospitalId.isNotBlank()) parameters.append("hospital_id", hospitalId)
                    if (specialty.isNotBlank()) parameters.append("specialty", specialty)
                }
            }
            if (resp.status.isSuccess()) resp.body<List<DoctorDto>>() else emptyList()
        } catch (_: Exception) { emptyList() }
    }

    suspend fun fetchBookingSlots(doctorId: String): List<BookingSlotDto> = withContext(Dispatchers.IO) {
        if (skipNetwork || doctorId.isBlank()) return@withContext emptyList()
        try {
            val resp = http.get("$base/api/booking/slots") {
                authHeaders().forEach { (k, v) -> header(k, v) }
                url { parameters.append("doctor_id", doctorId) }
            }
            if (resp.status.isSuccess()) resp.body<BookingSlotsResponse>().slots else emptyList()
        } catch (_: Exception) { emptyList() }
    }

    // ─── AI Diet Tips (Worker) ─────────────────────────────────

    suspend fun fetchAiDietTip(kidId: String): AiDietTipDto? = withContext(Dispatchers.IO) {
        if (skipNetwork) return@withContext null
        try {
            val resp = http.get("$base/api/ai-diet-tips") {
                authHeaders().forEach { (k, v) -> header(k, v) }
                url { parameters.append("kid_id", kidId) }
            }
            if (resp.status.isSuccess()) {
                try { resp.body<AiDietTipDto?>() } catch (_: Exception) { null }
            } else null
        } catch (_: Exception) { null }
    }

    suspend fun generateAiDietTip(kidId: String): AiDietTipDto? = withContext(Dispatchers.IO) {
        if (skipNetwork) return@withContext null
        try {
            val resp = http.post("$base/api/ai-diet-tips/generate") {
                authHeaders().forEach { (k, v) -> header(k, v) }
                contentType(ContentType.Application.Json)
                setBody(mapOf("kid_id" to kidId))
            }
            if (resp.status.isSuccess()) {
                try { resp.body<AiDietTipDto>() } catch (_: Exception) { null }
            } else null
        } catch (_: Exception) { null }
    }

    suspend fun saveAiDietTip(kidId: String, content: AIDietContent) = withContext(Dispatchers.IO) {
        if (skipNetwork) return@withContext
        try {
            http.post("$base/api/ai-diet-tips") {
                authHeaders().forEach { (k, v) -> header(k, v) }
                contentType(ContentType.Application.Json)
                setBody(mapOf(
                    "kid_id" to kidId,
                    "content" to mapOf(
                        "greeting" to content.greeting,
                        "insight" to content.insight,
                        "suggestion" to content.suggestion,
                        "funFact" to content.funFact,
                        "generatedAt" to content.generatedAt,
                    )
                ))
            }
        } catch (_: Exception) { }
    }

    // ─── Food Recognition (Worker) ─────────────────────────────

    suspend fun recognizeFood(imageBase64: String, mime: String = "image/jpeg"): FoodRecognitionResponseDto? = withContext(Dispatchers.IO) {
        if (skipNetwork) return@withContext null
        try {
            val resp = http.post("$base/api/food-recognition") {
                authHeaders().forEach { (k, v) -> header(k, v) }
                contentType(ContentType.Application.Json)
                setBody(mapOf("image_base64" to imageBase64, "mime" to mime))
            }
            if (resp.status.isSuccess()) {
                try { resp.body<FoodRecognitionResponseDto>() } catch (_: Exception) { null }
            } else null
        } catch (_: Exception) { null }
    }

    // ─── Invite Resolution (Worker) ────────────────────────────

    suspend fun resolveInvite(token: String): String? = withContext(Dispatchers.IO) {
        if (skipNetwork) return@withContext null
        try {
            val resp = http.get("$base/api/invite/resolve") {
                parameter("token", token)
            }
            if (!resp.status.isSuccess()) return@withContext null
            val dto = resp.body<InviteResolveDto>()
            if (dto.valid && !dto.last10.isNullOrBlank()) dto.last10 else null
        } catch (_: Exception) { null }
    }

    // ─── Leaderboard ───────────────────────────────────────────

    suspend fun fetchLeaderboard(
        currentKidId: String,
        currentKidName: String,
        localEatenMeals: Int,
        localStreak: Int,
    ): List<LeaderEntry> = withContext(Dispatchers.IO) {
        try {
            val snaps = db.collectionGroup("streaks")
                .orderBy("best_streak", Query.Direction.DESCENDING).limit(20).get().await()
            val rows = snaps.documents.mapNotNull { doc ->
                val bestStreak = doc.getLong("best_streak")?.toInt() ?: 0
                val currentStreak = doc.getLong("current_streak")?.toInt() ?: 0
                val kidId = doc.id
                val parentUid = doc.reference.parent.parent?.id ?: ""
                val kidDoc = db.collection("profiles").document(parentUid)
                    .collection("kids").document(kidId).get().await()
                val kidName = kidDoc.getString("name") ?: "Unknown"
                val points = currentStreak * 50 + bestStreak * 100
                LeaderEntry(
                    rank = 0,
                    name = kidName,
                    points = points,
                    isYou = kidId == currentKidId,
                )
            }.sortedByDescending { it.points }

            if (rows.isEmpty()) {
                listOf(LeaderEntry(1, currentKidName, (localEatenMeals * 10) + (localStreak * 50) + 1500, true))
            } else {
                rows.mapIndexed { i, r -> r.copy(rank = i + 1) }
            }
        } catch (_: Exception) {
            listOf(LeaderEntry(1, currentKidName, (localEatenMeals * 10) + (localStreak * 50) + 1500, true))
        }
    }

    // ─── Family Sharing (Firestore) ────────────────────────────

    suspend fun validateFamilyCode(code: String): FamilyValidationResult = withContext(Dispatchers.IO) {
        try {
            val snaps = db.collection("profiles")
                .whereEqualTo("family_code", code).limit(1).get().await()
            if (snaps.documents.isEmpty()) {
                return@withContext FamilyValidationResult(valid = false, error = "Invalid family code")
            }
            val ownerDoc = snaps.documents[0]
            val ownerName = ownerDoc.getString("name") ?: "Parent"
            FamilyValidationResult(valid = true, familyOwner = ownerName, ownerId = ownerDoc.id)
        } catch (e: Exception) {
            FamilyValidationResult(valid = false, error = e.message ?: "Failed to validate code")
        }
    }

    suspend fun joinFamily(
        code: String,
        coParentName: String,
        relation: String,
    ): FamilyJoinResult = withContext(Dispatchers.IO) {
        val uid = currentUid
        if (uid.isBlank()) return@withContext FamilyJoinResult(error = "Not authenticated")
        try {
            // Find the family owner
            val snaps = db.collection("profiles")
                .whereEqualTo("family_code", code).limit(1).get().await()
            if (snaps.documents.isEmpty()) {
                return@withContext FamilyJoinResult(error = "Invalid family code")
            }
            val ownerId = snaps.documents[0].id
            // Add co-parent to owner's co_parents subcollection
            val coParentId = "cp_${System.currentTimeMillis()}"
            db.collection("profiles").document(ownerId)
                .collection("co_parents").document(coParentId)
                .set(mapOf(
                    "id" to coParentId,
                    "profile_id" to uid,
                    "name" to coParentName,
                    "relation" to relation,
                    "joined_date" to System.currentTimeMillis().toString(),
                )).await()
            // Set the joiner's family code
            db.collection("profiles").document(uid)
                .set(mapOf("family_code" to code), SetOptions.merge()).await()
            FamilyJoinResult(success = true, coParentId = coParentId, familyCode = code)
        } catch (e: Exception) {
            FamilyJoinResult(error = e.message ?: "Failed to join family")
        }
    }

    suspend fun fetchSharedKids(familyCode: String): SharedKidsResult = withContext(Dispatchers.IO) {
        try {
            val snaps = db.collection("profiles")
                .whereEqualTo("family_code", familyCode).get().await()
            val allKids = mutableListOf<SharedKidInfo>()
            var isOwner = false
            val uid = currentUid

            for (doc in snaps.documents) {
                if (doc.id == uid) isOwner = true
                val kids = doc.reference.collection("kids").get().await()
                for (kidDoc in kids.documents) {
                    val kid = kidDoc.toDto<KidDto>() ?: continue
                    allKids.add(
                        SharedKidInfo(
                            id = kid.id,
                            name = kid.name,
                            age = kid.age,
                            gender = kid.gender,
                            school = kid.school,
                            grade = kid.grade,
                            heightCm = kid.heightCm,
                            weightKg = kid.weightKg,
                            overallScore = kid.overallScore,
                            dental = kid.dental,
                            eyesight = kid.eyesight,
                            nutrition = kid.nutrition,
                            lastCheckup = kid.lastCheckup,
                            isOwnerKid = doc.id == uid,
                        )
                    )
                }
            }
            SharedKidsResult(kids = allKids, isOwner = isOwner)
        } catch (e: Exception) {
            SharedKidsResult(error = e.message ?: "Failed to fetch shared kids")
        }
    }

    // ─── Helpers ───────────────────────────────────────────────

    private suspend fun deleteSubcollection(path: String) {
        try {
            val docs = db.collection(path).get().await()
            val batch = db.batch()
            for (doc in docs.documents) batch.delete(doc.reference)
            if (docs.documents.isNotEmpty()) batch.commit().await()
        } catch (_: Exception) { }
    }
}

// ─── Family Sharing Result Types ──────────────────────────────

@Serializable
data class FamilyValidationResult(
    val valid: Boolean = false,
    val familyOwner: String? = null,
    val ownerId: String? = null,
    val error: String? = null,
)

@Serializable
data class FamilyJoinResult(
    val success: Boolean = false,
    val coParentId: String? = null,
    val familyCode: String? = null,
    val error: String? = null,
)

@Serializable
data class SharedKidsResult(
    val kids: List<SharedKidInfo> = emptyList(),
    val isOwner: Boolean = false,
    val error: String? = null,
)

@Serializable
data class SharedKidInfo(
    val id: String = "",
    val name: String = "",
    val age: Int = 0,
    val gender: String = "",
    val school: String = "",
    val grade: String = "",
    val heightCm: Double = 0.0,
    val weightKg: Double = 0.0,
    val overallScore: Int = 80,
    val dental: String = "GOOD",
    val eyesight: String = "GOOD",
    val nutrition: String = "GOOD",
    val lastCheckup: String = "",
    val isOwnerKid: Boolean = false,
)
