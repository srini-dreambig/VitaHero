package kallam.healthcare.ui.screens

import android.Manifest
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.CalendarMonth
import androidx.compose.material.icons.outlined.Cancel
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.LocationOn
import androidx.compose.material.icons.outlined.MedicalServices
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import kallam.healthcare.data.Appointment
import kallam.healthcare.data.BookingDirectory
import kallam.healthcare.data.Doctor
import kallam.healthcare.data.ReferralSpecialtiesDto
import kallam.healthcare.data.Kid
import kallam.healthcare.data.LocationHelper
import kallam.healthcare.data.S
import kallam.healthcare.data.BookingTimeSlot
import kallam.healthcare.ui.components.AppCard
import kallam.healthcare.ui.components.AppListRow
import kallam.healthcare.ui.components.AppScreenHeader
import kallam.healthcare.ui.components.AppSectionTitle
import kallam.healthcare.ui.components.DoctorDirectoryCard
import kallam.healthcare.ui.components.SelectChip
import kallam.healthcare.ui.components.StatusBarSpacer
import kallam.healthcare.ui.components.StatusPill
import kallam.healthcare.ui.components.HospitalDirectoryCard
import kallam.healthcare.ui.components.IconBubble
import kallam.healthcare.ui.components.KidAvatar
import kallam.healthcare.ui.components.PrimaryGradientButton
import kallam.healthcare.ui.components.Tone
import kallam.healthcare.ui.components.color
import kallam.healthcare.ui.components.t
import kallam.healthcare.ui.components.tf2
import kallam.healthcare.ui.theme.AppCorners
import kallam.healthcare.ui.theme.AppSpacing

private data class BookingSlot(val label: String, val date: String, val time: String)

private enum class BookingViewMode { BY_HOSPITAL, BY_SPECIALTY }

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun BookingScreen(
    /**
     * The specialty a referral asked for, or "".
     *
     * A parent arriving from "take Aarav to an ophthalmologist" used to land
     * on every hospital in the city and have to remember which specialty the
     * referral named. The screen could always filter by one — it draws chips
     * from the open referrals — but nothing carried the answer across, so the
     * parent did the machine's job.
     */
    initialSpecialty: String = "",
    /** The child that referral was about, so the booking opens on them. */
    initialKidName: String = "",
    directory: BookingDirectory?,
    doctors: List<Doctor>,
    kids: List<Kid>,
    appointments: List<Appointment>,
    bookingCity: String,
    locationEnabled: Boolean,
    onBack: () -> Unit,
    onCityChange: (String) -> Unit,
    onUseMyLocation: () -> Unit,
    bookingSlotsByDoctor: Map<String, List<BookingTimeSlot>>,
    onLoadSlots: (String) -> Unit,
    onConfirm: (Doctor, kidName: String, date: String, time: String) -> Unit,
    onCancel: (String) -> Unit,
    /**
     * What this family's children were actually referred for, after a school
     * check-up. Empty for a family booking on their own initiative.
     */
    referrals: ReferralSpecialtiesDto = ReferralSpecialtiesDto(),
    /** True while the booking is with the server and no answer has come back. */
    booking: Boolean = false,
    /** Set once the server has accepted or refused. Null before either. */
    confirmed: Boolean = false,
    refusedMessage: String? = null,
) {
    val context = LocalContext.current
    // An earlier pass left the doctor and the slot transient, on the grounds
    // that they are "a selection two taps away". They are not. Getting to a
    // slot means filtering by specialty, expanding a hospital, choosing a
    // doctor and then waiting for that doctor's slots to come back over the
    // network — and a rotation at the confirm step threw all of it away and
    // did not ask for the slots again. What is saved is the id and the label,
    // which restore without needing either type to be Parcelable.
    var selectedDoctorId by rememberSaveable { mutableStateOf<String?>(null) }
    var selectedKid by rememberSaveable {
        mutableStateOf(initialKidName.ifBlank { kids.firstOrNull()?.name ?: "" })
    }
    var selectedSlotLabel by rememberSaveable { mutableStateOf<String?>(null) }
    // rememberSaveable so the filter survives a rotation, seeded from the
    // referral that sent the parent here.
    var filterSpecialty by rememberSaveable {
        mutableStateOf<String?>(initialSpecialty.ifBlank { null })
    }
    var showExisting by rememberSaveable { mutableStateOf(true) }
    var viewMode by rememberSaveable { mutableStateOf(BookingViewMode.BY_HOSPITAL) }
    var expandedHospitalId by remember { mutableStateOf<String?>(null) }

    val hospitals = directory?.hospitals.orEmpty()
    val allDoctors = remember(hospitals, doctors) { hospitals.flatMap { it.doctors } + doctors }
    val selectedDoctor = selectedDoctorId?.let { id -> allDoctors.firstOrNull { it.id == id } }
    val allSpecialties = directory?.specialties?.ifEmpty {
        doctors.map { it.specialty }.distinct()
    } ?: doctors.map { it.specialty }.distinct()

    val filteredHospitals = remember(hospitals, filterSpecialty) {
        if (filterSpecialty == null) hospitals
        else hospitals.filter { h -> h.specialties.contains(filterSpecialty) || h.doctors.any { it.specialty == filterSpecialty } }
    }

    val fallbackDoctors = if (filterSpecialty != null) doctors.filter { it.specialty == filterSpecialty } else doctors

    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted) onUseMyLocation()
    }

    LaunchedEffect(Unit) {
        if (LocationHelper.hasLocationPermission(context) && !locationEnabled) {
            onUseMyLocation()
        }
    }

    // Asks again after a rotation, which is the point: the slots are a network
    // read and the restored doctor needs them back. It no longer clears the
    // chosen slot — a fresh composition re-runs this effect with the same
    // doctor, and clearing here would undo the very thing being restored.
    LaunchedEffect(selectedDoctorId) {
        selectedDoctorId?.let { onLoadSlots(it) }
    }

    val slots = remember(selectedDoctorId, bookingSlotsByDoctor) {
        selectedDoctorId?.let { doctorId ->
            bookingSlotsByDoctor[doctorId].orEmpty().map { BookingSlot(it.label, it.date, it.time) }
        }.orEmpty()
    }

    // Derived, not stored, so it cannot outlive its meaning: a slot counts only
    // while the doctor on screen still offers it. Switching doctors used to
    // leave the previous doctor's time selected on one of the three paths into
    // the list, which is how a booking gets confirmed at an hour nobody offered.
    val selectedSlot = selectedSlotLabel?.let { label -> slots.firstOrNull { it.label == label } }

    Column(
        Modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.background)
    ) {
        StatusBarSpacer()
        AppScreenHeader(t(S.bookAppt), onBack = onBack)

        if (confirmed) {
            Column(
                Modifier
                    .fillMaxWidth()
                    .padding(AppSpacing.xxl),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Spacer(Modifier.height(AppSpacing.sm))
                Box(
                    Modifier
                        .size(96.dp)
                        .clip(CircleShape)
                        .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.14f)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(Icons.Outlined.CheckCircle, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(54.dp))
                }
                Spacer(Modifier.height(AppSpacing.xxl))
                Text(t(S.apptConfirmed), style = MaterialTheme.typography.headlineMedium)
                Spacer(Modifier.height(AppSpacing.sm))
                // The doctor and slot are a transient selection, so after a
                // rotation on this screen they are gone while the confirmation
                // itself — which lives in the view model — is not. Read the
                // booking back from the appointment list rather than printing
                // "null · null" at a parent who has just booked something.
                val justBooked = appointments.lastOrNull { it.kidName == selectedKid }
                val line = selectedDoctor?.let { doc ->
                    "${doc.name} · ${selectedSlot?.label.orEmpty()}\nfor $selectedKid"
                } ?: justBooked?.let { "${it.doctorName} · ${it.date} ${it.time}\nfor ${it.kidName}" }
                if (line != null) {
                    Text(
                        line,
                        style = MaterialTheme.typography.bodyLarge,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                Spacer(Modifier.height(AppSpacing.xxxl))
                PrimaryGradientButton(text = t(S.done), onClick = onBack, modifier = Modifier.fillMaxWidth())
            }
        } else LazyColumn(
            Modifier.fillMaxWidth(),
            contentPadding = PaddingValues(start = AppSpacing.xl, end = AppSpacing.xl, top = AppSpacing.sm, bottom = AppSpacing.xxl)
        ) {
            if (appointments.isNotEmpty()) {
                item {
                    AppSectionTitle(
                        t(S.upcomingAppts),
                        actionLabel = if (showExisting) "Hide" else "Show",
                        onAction = { showExisting = !showExisting },
                    )
                    Spacer(Modifier.height(AppSpacing.sm))
                }
                if (showExisting) {
                    items(appointments, key = { it.id }) { appt ->
                        ExistingAppointmentCard(appt, onCancel = { onCancel(appt.id) })
                        Spacer(Modifier.height(AppSpacing.md))
                    }
                }
                item { Spacer(Modifier.height(AppSpacing.md)) }
            }

            item {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Outlined.LocationOn, contentDescription = null, tint = MaterialTheme.colorScheme.secondary, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(AppSpacing.xs))
                    Text(t(S.yourArea), style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                Spacer(Modifier.height(AppSpacing.sm))
                LazyRow(horizontalArrangement = Arrangement.spacedBy(AppSpacing.sm)) {
                    items(listOf("Hyderabad"), key = { it }) { city ->
                        val selected = bookingCity.equals(city, ignoreCase = true)
                        SelectChip(
                            text = city,
                            selected = selected,
                            onClick = { if (!selected) onCityChange(city) },
                        )
                    }
                    item {
                        SelectChip(
                            text = t(S.useMyLocation),
                            selected = locationEnabled,
                            onClick = {
                                if (LocationHelper.hasLocationPermission(context)) {
                                    onUseMyLocation()
                                } else {
                                    permissionLauncher.launch(Manifest.permission.ACCESS_COARSE_LOCATION)
                                }
                            },
                        )
                    }
                }
                if (locationEnabled) {
                    Spacer(Modifier.height(AppSpacing.sm))
                    Text(
                        t(S.locationSorted),
                        style = MaterialTheme.typography.labelMedium,
                        color = MaterialTheme.colorScheme.primary,
                    )
                }
                Spacer(Modifier.height(AppSpacing.xxl))

                AppSectionTitle(t(S.selectKid))
                Spacer(Modifier.height(AppSpacing.md))
                LazyRow(horizontalArrangement = Arrangement.spacedBy(AppSpacing.sm)) {
                    items(kids, key = { it.id }) { kid ->
                        val selected = selectedKid == kid.name
                        // An avatar chip: SelectChip carries text only, and the
                        // face is how a parent tells two children apart at a glance.
                        Row(
                            Modifier
                                .clip(RoundedCornerShape(50))
                                .background(if (selected) MaterialTheme.colorScheme.primary.copy(alpha = 0.14f) else MaterialTheme.colorScheme.surface)
                                .clickable { selectedKid = kid.name }
                                .padding(end = AppSpacing.lg, top = AppSpacing.xs, bottom = AppSpacing.xs, start = AppSpacing.xs),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            KidAvatar(kid.name, kid.avatarColor, size = 32.dp)
                            Spacer(Modifier.width(AppSpacing.sm))
                            Text(kid.name, style = MaterialTheme.typography.labelLarge, color = if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                            )
                        }
                    }
                }
                Spacer(Modifier.height(AppSpacing.xxl))

                // What the school check-up actually asked for.
                //
                // /api/referral-specialties has existed since referrals did and
                // nothing called it, so this screen offered the whole
                // directory's specialty list and left the parent to remember
                // which one the doctor had written down. That is the last step
                // of a screening programme — a child is found to need glasses
                // and the app's job is to get them in front of an
                // ophthalmologist, not to present a menu.
                if (referrals.forChildren.isNotEmpty()) {
                    AppSectionTitle(t(S.referredTitle))
                    Spacer(Modifier.height(AppSpacing.md))
                    Column(verticalArrangement = Arrangement.spacedBy(AppSpacing.sm)) {
                        referrals.forChildren.forEach { r ->
                            val active = filterSpecialty == r.specialty
                            AppCard(
                                onClick = {
                                    // Tapping it does the filtering the parent
                                    // would otherwise have to do from memory.
                                    filterSpecialty = if (active) null else r.specialty
                                    viewMode = BookingViewMode.BY_SPECIALTY
                                    selectedDoctorId = null
                                    expandedHospitalId = null
                                },
                                contentPadding = PaddingValues(AppSpacing.md),
                            ) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    IconBubble(
                                        Icons.Outlined.MedicalServices,
                                        if (r.urgency == "URGENT") Tone.Alert.color() else MaterialTheme.colorScheme.secondary,
                                    )
                                    Spacer(Modifier.width(AppSpacing.md))
                                    Text(
                                        tf2(S.referredChip, r.kidName, r.specialty),
                                        style = MaterialTheme.typography.bodyMedium,
                                        // Bold marks the referral currently filtering the list.
                                        fontWeight = if (active) FontWeight.Bold else FontWeight.Medium,
                                        modifier = Modifier.weight(1f),
                                        maxLines = 2,
                                        overflow = TextOverflow.Ellipsis,
                                    )
                                    if (r.urgency != "ROUTINE") {
                                        Spacer(Modifier.width(AppSpacing.sm))
                                        StatusPill(
                                            t(S.referredUrgent),
                                            if (r.urgency == "URGENT") Tone.Alert else Tone.Watch,
                                        )
                                    }
                                }
                            }
                        }
                    }
                    Spacer(Modifier.height(AppSpacing.xxl))
                }

                Row(horizontalArrangement = Arrangement.spacedBy(AppSpacing.sm)) {
                    SelectChip(
                        text = t(S.viewByHospital),
                        selected = viewMode == BookingViewMode.BY_HOSPITAL,
                        onClick = {
                            viewMode = BookingViewMode.BY_HOSPITAL
                            selectedDoctorId = null
                        },
                    )
                    SelectChip(
                        text = t(S.viewBySpecialty),
                        selected = viewMode == BookingViewMode.BY_SPECIALTY,
                        onClick = {
                            viewMode = BookingViewMode.BY_SPECIALTY
                            selectedDoctorId = null
                            expandedHospitalId = null
                        },
                    )
                }
                Spacer(Modifier.height(AppSpacing.lg))

                AppSectionTitle(
                    if (viewMode == BookingViewMode.BY_HOSPITAL) t(S.hospitalsNearYou) else t(S.selectDoctor),
                    actionLabel = if (filterSpecialty != null) t(S.clearLabel) else null,
                    onAction = { filterSpecialty = null },
                )
                Spacer(Modifier.height(AppSpacing.sm))
                LazyRow(horizontalArrangement = Arrangement.spacedBy(AppSpacing.sm)) {
                    items(allSpecialties, key = { it }) { spec ->
                        val active = filterSpecialty == spec
                        SelectChip(
                            text = spec,
                            selected = active,
                            onClick = { filterSpecialty = if (active) null else spec },
                        )
                    }
                }
                Spacer(Modifier.height(AppSpacing.md))
            }

            if (viewMode == BookingViewMode.BY_HOSPITAL && filteredHospitals.isNotEmpty()) {
                items(filteredHospitals, key = { it.id }) { hospital ->
                    HospitalDirectoryCard(
                        hospital = hospital,
                        expanded = expandedHospitalId == hospital.id,
                        selectedDoctorId = selectedDoctor?.id,
                        onToggleExpand = {
                            expandedHospitalId = if (expandedHospitalId == hospital.id) null else hospital.id
                        },
                        onDoctorSelect = { doc ->
                            selectedDoctorId = doc.id
                            selectedSlotLabel = null
                        }
                    )
                    Spacer(Modifier.height(AppSpacing.md))
                }
            } else if (viewMode == BookingViewMode.BY_SPECIALTY && filteredHospitals.isNotEmpty()) {
                items(filteredHospitals, key = { "spec-${it.id}" }) { hospital ->
                    val docs = if (filterSpecialty != null) {
                        hospital.doctors.filter { it.specialty == filterSpecialty }
                    } else hospital.doctors

                    if (docs.isNotEmpty()) {
                        AppSectionTitle(
                            hospital.name,
                            subtitle = if (hospital.userCampLinked || hospital.isCampPartner) t(S.campPartnerHospital) else null,
                        )
                        Spacer(Modifier.height(AppSpacing.sm))
                        docs.forEach { doctor ->
                            DoctorDirectoryCard(doctor, selectedDoctor?.id == doctor.id) {
                                selectedDoctorId = doctor.id
                                selectedSlotLabel = null
                            }
                            Spacer(Modifier.height(AppSpacing.md))
                        }
                    }
                }
            } else {
                items(fallbackDoctors, key = { it.id }) { doctor ->
                    DoctorDirectoryCard(doctor, selectedDoctor?.id == doctor.id) { selectedDoctorId = doctor.id; selectedSlotLabel = null }
                    Spacer(Modifier.height(AppSpacing.md))
                }
            }

            if (filteredHospitals.isEmpty() && hospitals.isNotEmpty() && filterSpecialty != null) {
                item {
                    Box(
                        Modifier
                            .fillMaxWidth()
                            .padding(vertical = AppSpacing.xl),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            t(S.noDoctorsFound) + " for $filterSpecialty",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            } else if (hospitals.isEmpty() && fallbackDoctors.isEmpty()) {
                item {
                    Box(
                        Modifier
                            .fillMaxWidth()
                            .padding(vertical = AppSpacing.xl),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(t(S.noHospitalsFound), style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }

            if (selectedDoctor != null) {
                item {
                    Spacer(Modifier.height(AppSpacing.md))
                    AppSectionTitle(t(S.selectTime))
                    Spacer(Modifier.height(AppSpacing.md))
                    if (slots.isEmpty()) {
                        Text(
                            t(S.noSlotsAvailable),
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(vertical = AppSpacing.md)
                        )
                    } else {
                        Column(verticalArrangement = Arrangement.spacedBy(AppSpacing.sm)) {
                            slots.chunked(2).forEach { row ->
                                Row(horizontalArrangement = Arrangement.spacedBy(AppSpacing.sm)) {
                                    row.forEach { slot ->
                                        val selected = selectedSlot == slot
                                        // Equal-width tiles in a grid; SelectChip sizes to
                                        // its text, so the slot keeps its own box.
                                        Box(
                                            Modifier
                                                .weight(1f)
                                                .clip(RoundedCornerShape(AppCorners.medium))
                                                .background(if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surface)
                                                .clickable { selectedSlotLabel = slot.label }
                                                .padding(vertical = AppSpacing.md),
                                            contentAlignment = Alignment.Center
                                        ) {
                                            Text(
                                                slot.label,
                                                style = MaterialTheme.typography.labelLarge,
                                                color = if (selected) Color.White else MaterialTheme.colorScheme.onSurface,
                                            )
                                        }
                                    }
                                    if (row.size == 1) Spacer(Modifier.weight(1f))
                                }
                            }
                        }
                    }
                    Spacer(Modifier.height(AppSpacing.xxl))
                    if (refusedMessage != null) {
                        // The server's own wording — "This slot is no longer
                        // available" — rather than a generic failure. Nothing
                        // was booked, and the screen says so before the button.
                        Text(
                            refusedMessage,
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.error,
                            modifier = Modifier.fillMaxWidth(),
                        )
                        Spacer(Modifier.height(AppSpacing.md))
                    }
                    PrimaryGradientButton(
                        text = if (booking) t(S.bookingInProgress) else t(S.confirmBooking),
                        enabled = selectedSlot != null && !booking,
                        onClick = {
                            val doc = selectedDoctor ?: return@PrimaryGradientButton
                            val slot = selectedSlot ?: return@PrimaryGradientButton
                            onConfirm(doc, selectedKid, slot.date, slot.time)
                        },
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            }
        }
    }
}

@Composable
private fun ExistingAppointmentCard(appt: Appointment, onCancel: () -> Unit) {
    AppListRow(
        title = appt.doctorName,
        subtitle = "${appt.specialty} · for ${appt.kidName}",
        supporting = "${appt.date} · ${appt.time}",
        supportingTone = Tone.Info,
        leading = { IconBubble(Icons.Outlined.CalendarMonth, MaterialTheme.colorScheme.secondary) },
        trailing = {
            IconButton(onClick = onCancel) {
                Icon(Icons.Outlined.Cancel, contentDescription = "Cancel appointment", tint = MaterialTheme.colorScheme.error)
            }
        },
    )
}
