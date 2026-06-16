package com.rork.vitahero.data

private val doctorPalette = listOf(0xFF10B981, 0xFF2563EB, 0xFF8B5CF6, 0xFFFB7185, 0xFFF59E0B)

fun mapDoctorDto(dto: DoctorDto): Doctor = Doctor(
    id = dto.id,
    name = dto.name,
    specialty = dto.specialty,
    hospital = dto.hospital,
    rating = dto.rating.toFloat(),
    nextSlot = "",
    avatarColor = doctorPalette[kotlin.math.abs(dto.id.hashCode()) % doctorPalette.size],
    hospitalId = dto.hospitalId.orEmpty(),
    city = dto.city,
    isCampPartner = dto.isCampPartner,
)

fun mapBookingDirectory(dto: BookingDirectoryDto): BookingDirectory = BookingDirectory(
    city = dto.city,
    specialties = dto.specialties,
    hospitals = dto.hospitals.map { h ->
        Hospital(
            id = h.id,
            name = h.name,
            city = h.city,
            district = h.district,
            address = h.address,
            rating = h.rating.toFloat(),
            isCampPartner = h.isCampPartner,
            conductedCamps = h.conductedCamps,
            userCampLinked = h.userCampLinked,
            distanceKm = h.distanceKm?.toFloat(),
            specialties = h.specialties,
            doctors = h.doctors.map { d ->
                Doctor(
                    id = d.id,
                    name = d.name,
                    specialty = d.specialty,
                    hospital = d.hospital,
                    rating = d.rating.toFloat(),
                    nextSlot = "",
                    avatarColor = doctorPalette[kotlin.math.abs(d.id.hashCode()) % doctorPalette.size],
                    hospitalId = d.hospitalId.orEmpty(),
                    city = d.city,
                    isCampPartner = d.isCampPartner || h.isCampPartner,
                )
            },
        )
    },
)
