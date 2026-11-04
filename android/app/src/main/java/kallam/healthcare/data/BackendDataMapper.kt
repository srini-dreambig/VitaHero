package kallam.healthcare.data

/**
 * Maps Neon API DTOs to domain models for the UI layer.
 */
object BackendDataMapper {

    private val kidPalette = listOf(0xFF10B981L, 0xFF2563EB, 0xFF8B5CF6, 0xFFFB7185, 0xFFF59E0B)

    /**
     * The server keeps avatar_color but nothing writes it, so every child
     * arrives as 0: a transparent circle behind a white initial. A colour
     * from the child's id stays the same on every launch.
     */
    private fun kidColor(dto: KidDto): Long =
        if (dto.avatarColor != 0L) dto.avatarColor
        else kidPalette[Math.floorMod(dto.id.hashCode(), kidPalette.size)]

    fun mapKid(dto: KidDto, growth: List<GrowthPoint> = emptyList()): Kid = Kid(
        id = dto.id,
        name = dto.name,
        age = dto.age,
        gender = dto.gender,
        school = dto.school,
        grade = dto.grade,
        heightCm = dto.heightCm.toFloat(),
        weightKg = dto.weightKg.toFloat(),
        avatarColor = kidColor(dto),
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
        status = runCatching { CampStatus.valueOf(dto.status) }.getOrDefault(CampStatus.SCHEDULED),
        venue = dto.venue,
        consentDeadline = dto.consentDeadline,
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
        runCatching { HealthFlag.valueOf(value) }.getOrDefault(HealthFlag.NOT_MEASURED)
}
