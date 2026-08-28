package com.rork.vitahero.data

/**
 * Maps Neon API DTOs to domain models for the UI layer.
 */
object BackendDataMapper {

    fun mapKid(dto: KidDto, growth: List<GrowthPoint> = emptyList()): Kid = Kid(
        id = dto.id,
        name = dto.name,
        age = dto.age,
        gender = dto.gender,
        school = dto.school,
        grade = dto.grade,
        heightCm = dto.heightCm.toFloat(),
        weightKg = dto.weightKg.toFloat(),
        avatarColor = dto.avatarColor.takeIf { it != 0L } ?: stableAvatarColor(dto.name),
        overallScore = dto.overallScore,
        growth = growth,
        dental = parseFlag(dto.dental),
        eyesight = parseFlag(dto.eyesight),
        nutrition = parseFlag(dto.nutrition),
        lastCheckup = dto.lastCheckup,
        source = dto.source,
    )

    fun mapGrowthPoint(dto: GrowthPointDto): GrowthPoint = GrowthPoint(
        id = dto.id,
        label = dto.label,
        height = dto.height.toFloat(),
        weight = dto.weight.toFloat(),
    )

    fun mapCamp(dto: CampDto): Camp = Camp(
        id = dto.id,
        title = dto.title,
        school = dto.school,
        date = dto.date,
        time = dto.time,
        status = runCatching { CampStatus.valueOf(dto.status) }.getOrDefault(CampStatus.UPCOMING),
        checks = dto.checks,
        resultSummary = dto.resultSummary,
        isPartnerCamp = dto.isPartner,
        schoolId = dto.schoolId.orEmpty(),
        schoolCampId = dto.schoolCampId ?: dto.id,
        description = dto.description,
        grades = dto.grades,
        capacity = dto.capacity,
        registeredKidIds = dto.registeredKidIds,
    )

    fun mapPartnerSchool(dto: SchoolDto): PartnerSchool = PartnerSchool(
        id = dto.id,
        name = dto.name,
        city = dto.city,
        district = dto.district,
        description = dto.description,
    )

    fun mapMySchool(dto: MySchoolDto): PartnerSchool = PartnerSchool(
        id = dto.id,
        name = dto.name,
        city = dto.city,
        district = dto.district,
        description = dto.description,
        enrolledAt = dto.enrolledAt.orEmpty(),
        kidId = dto.kidId,
    )

    fun mapMeal(dto: MealItemDto): MealItem = MealItem(
        id = dto.id,
        time = dto.timeSlot,
        name = dto.name,
        detail = dto.detail,
        kcal = dto.kcal,
        eaten = dto.eaten,
    )

    private fun parseFlag(value: String): HealthFlag =
        runCatching { HealthFlag.valueOf(value) }.getOrDefault(HealthFlag.GOOD)

    private val avatarPalette = longArrayOf(
        0xFFEF6C00, 0xFF2E7D32, 0xFF1565C0, 0xFF6A1B9A, 0xFFC62828, 0xFF00838F, 0xFF5D4037,
    )

    /** Imported kids have no avatar_color (0 renders black) — derive a stable color from the name. */
    private fun stableAvatarColor(name: String): Long =
        avatarPalette[Math.abs(name.hashCode()) % avatarPalette.size]
}
