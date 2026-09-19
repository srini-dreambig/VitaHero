package com.rork.vitahero.ui.screens

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
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.CalendarMonth
import androidx.compose.material.icons.outlined.Cancel
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.LocalHospital
import androidx.compose.material.icons.outlined.MedicalServices
import androidx.compose.material.icons.outlined.LocationOn
import androidx.compose.material.icons.outlined.MyLocation
import androidx.compose.material.icons.outlined.Verified
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
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
import com.rork.vitahero.data.Appointment
import com.rork.vitahero.data.BookingDirectory
import com.rork.vitahero.data.Doctor
import com.rork.vitahero.data.Hospital
import com.rork.vitahero.data.ReferralSpecialtiesDto
import com.rork.vitahero.data.Kid
import com.rork.vitahero.data.LocationHelper
import com.rork.vitahero.data.S
import com.rork.vitahero.data.BookingTimeSlot
import com.rork.vitahero.ui.components.DoctorDirectoryCard
import com.rork.vitahero.ui.components.HeroCard
import com.rork.vitahero.ui.components.StatusBarSpacer
import com.rork.vitahero.ui.components.HospitalDirectoryCard
import com.rork.vitahero.ui.components.IconBubble
import com.rork.vitahero.ui.components.KidAvatar
import com.rork.vitahero.ui.components.PrimaryGradientButton
import com.rork.vitahero.ui.components.t
import com.rork.vitahero.ui.components.tf2
import com.rork.vitahero.ui.theme.HeroBlue
import com.rork.vitahero.ui.theme.HeroOrange
import com.rork.vitahero.ui.theme.HeroPurple

private data class BookingSlot(val label: String, val date: String, val time: String)

private enum class BookingViewMode { BY_HOSPITAL, BY_SPECIALTY }

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun BookingScreen(
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
    var selectedKid by rememberSaveable { mutableStateOf(kids.firstOrNull()?.name ?: "") }
    var selectedSlotLabel by rememberSaveable { mutableStateOf<String?>(null) }
    var filterSpecialty by rememberSaveable { mutableStateOf<String?>(null) }
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

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = { Text(t(S.bookAppt), style = MaterialTheme.typography.titleLarge) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Outlined.ArrowBack, contentDescription = t(S.goBack))
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background)
            )
        }
    ) { pad ->
        if (confirmed) {
            Column(
                Modifier
                    .fillMaxWidth()
                    .padding(pad)
                    .padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                StatusBarSpacer()
                Spacer(Modifier.height(8.dp))
                Box(
                    Modifier
                        .size(96.dp)
                        .clip(CircleShape)
                        .background(HeroOrange.copy(alpha = 0.14f)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(Icons.Outlined.CheckCircle, contentDescription = null, tint = HeroOrange, modifier = Modifier.size(54.dp))
                }
                Spacer(Modifier.height(24.dp))
                Text(t(S.apptConfirmed), style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(8.dp))
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
                Spacer(Modifier.height(32.dp))
                PrimaryGradientButton(text = t(S.done), onClick = onBack, modifier = Modifier.fillMaxWidth())
            }
            return@Scaffold
        }

        LazyColumn(
            Modifier
                .fillMaxWidth()
                .padding(pad),
            contentPadding = PaddingValues(start = 20.dp, end = 20.dp, bottom = 24.dp)
        ) {
            if (appointments.isNotEmpty()) {
                item {
                    Spacer(Modifier.height(4.dp))
                    Row(
                        Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(t(S.upcomingAppts), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
                        Text(
                            if (showExisting) "Hide" else "Show",
                            style = MaterialTheme.typography.labelLarge,
                            color = MaterialTheme.colorScheme.primary,
                            modifier = Modifier
                                .clip(RoundedCornerShape(8.dp))
                                .clickable { showExisting = !showExisting }
                                .padding(horizontal = 8.dp, vertical = 4.dp)
                        )
                    }
                    Spacer(Modifier.height(8.dp))
                }
                if (showExisting) {
                    items(appointments, key = { it.id }) { appt ->
                        ExistingAppointmentCard(appt, onCancel = { onCancel(appt.id) })
                        Spacer(Modifier.height(8.dp))
                    }
                }
                item { Spacer(Modifier.height(8.dp)) }
            }

            item {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Outlined.LocationOn, contentDescription = null, tint = HeroBlue, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(6.dp))
                    Text(t(S.yourArea), style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Spacer(Modifier.width(8.dp))
                }
                Spacer(Modifier.height(8.dp))
                LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(listOf("Hyderabad"), key = { it }) { city ->
                        val selected = bookingCity.equals(city, ignoreCase = true)
                        Box(
                            Modifier
                                .clip(RoundedCornerShape(50))
                                .background(if (selected) HeroBlue.copy(alpha = 0.14f) else MaterialTheme.colorScheme.surfaceVariant)
                                .clickable { if (!selected) onCityChange(city) }
                                .padding(horizontal = 14.dp, vertical = 8.dp)
                        ) {
                            Text(
                                city,
                                style = MaterialTheme.typography.labelMedium,
                                color = if (selected) HeroBlue else MaterialTheme.colorScheme.onSurfaceVariant,
                                fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Medium
                            )
                        }
                    }
                    item {
                        Box(
                            Modifier
                                .clip(RoundedCornerShape(50))
                                .background(if (locationEnabled) HeroOrange.copy(alpha = 0.14f) else HeroPurple.copy(alpha = 0.14f))
                                .clickable {
                                    if (LocationHelper.hasLocationPermission(context)) {
                                        onUseMyLocation()
                                    } else {
                                        permissionLauncher.launch(Manifest.permission.ACCESS_COARSE_LOCATION)
                                    }
                                }
                                .padding(horizontal = 14.dp, vertical = 8.dp)
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(
                                    Icons.Outlined.MyLocation,
                                    contentDescription = null,
                                    tint = if (locationEnabled) HeroOrange else HeroPurple,
                                    modifier = Modifier.size(16.dp)
                                )
                                Spacer(Modifier.width(6.dp))
                                Text(
                                    t(S.useMyLocation),
                                    style = MaterialTheme.typography.labelMedium,
                                    color = if (locationEnabled) HeroOrange else HeroPurple,
                                    fontWeight = FontWeight.SemiBold
                                )
                            }
                        }
                    }
                }
                if (locationEnabled) {
                    Spacer(Modifier.height(8.dp))
                    Text(
                        t(S.locationSorted),
                        style = MaterialTheme.typography.labelSmall,
                        color = HeroOrange,
                        fontWeight = FontWeight.SemiBold
                    )
                }
                Spacer(Modifier.height(16.dp))

                Text(t(S.selectKid), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                Spacer(Modifier.height(12.dp))
                LazyRow(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    items(kids, key = { it.id }) { kid ->
                        val selected = selectedKid == kid.name
                        Row(
                            Modifier
                                .clip(RoundedCornerShape(50))
                                .background(if (selected) HeroOrange.copy(alpha = 0.14f) else MaterialTheme.colorScheme.surface)
                                .clickable { selectedKid = kid.name }
                                .padding(end = 16.dp, top = 6.dp, bottom = 6.dp, start = 6.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            KidAvatar(kid.name, kid.avatarColor, size = 32.dp)
                            Spacer(Modifier.width(8.dp))
                            Text(kid.name, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold, color = if (selected) HeroOrange else MaterialTheme.colorScheme.onSurface,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                            )
                        }
                    }
                }
                Spacer(Modifier.height(20.dp))

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
                    Text(
                        t(S.referredTitle),
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold,
                    )
                    Spacer(Modifier.height(10.dp))
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        referrals.forChildren.forEach { r ->
                            val active = filterSpecialty == r.specialty
                            HeroCard(
                                Modifier.fillMaxWidth().clickable {
                                    // Tapping it does the filtering the parent
                                    // would otherwise have to do from memory.
                                    filterSpecialty = if (active) null else r.specialty
                                    viewMode = BookingViewMode.BY_SPECIALTY
                                    selectedDoctorId = null
                                    expandedHospitalId = null
                                }
                            ) {
                                Row(
                                    Modifier.padding(14.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                ) {
                                    IconBubble(
                                        Icons.Outlined.MedicalServices,
                                        if (r.urgency == "URGENT") HeroOrange else HeroBlue,
                                    )
                                    Spacer(Modifier.width(12.dp))
                                    Text(
                                        tf2(S.referredChip, r.kidName, r.specialty),
                                        style = MaterialTheme.typography.bodyMedium,
                                        fontWeight = if (active) FontWeight.Bold else FontWeight.Medium,
                                        modifier = Modifier.weight(1f),
                                        maxLines = 2,
                                        overflow = TextOverflow.Ellipsis,
                                    )
                                    if (r.urgency != "ROUTINE") {
                                        Text(
                                            t(S.referredUrgent),
                                            style = MaterialTheme.typography.labelSmall,
                                            color = HeroOrange,
                                            fontWeight = FontWeight.Bold,
                                        )
                                    }
                                }
                            }
                        }
                    }
                    Spacer(Modifier.height(20.dp))
                }

                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    ViewModeChip(t(S.viewByHospital), viewMode == BookingViewMode.BY_HOSPITAL) {
                        viewMode = BookingViewMode.BY_HOSPITAL
                        selectedDoctorId = null
                    }
                    ViewModeChip(t(S.viewBySpecialty), viewMode == BookingViewMode.BY_SPECIALTY) {
                        viewMode = BookingViewMode.BY_SPECIALTY
                        selectedDoctorId = null
                        expandedHospitalId = null
                    }
                }
                Spacer(Modifier.height(16.dp))

                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        if (viewMode == BookingViewMode.BY_HOSPITAL) t(S.hospitalsNearYou) else t(S.selectDoctor),
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.weight(1f)
                    )
                    if (filterSpecialty != null) {
                        Box(
                            Modifier
                                .clip(RoundedCornerShape(50))
                                .background(MaterialTheme.colorScheme.error.copy(alpha = 0.1f))
                                .clickable { filterSpecialty = null }
                                .padding(horizontal = 10.dp, vertical = 4.dp)
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(t(S.clearLabel), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.error, fontWeight = FontWeight.SemiBold)
                                Spacer(Modifier.width(4.dp))
                                Icon(Icons.Outlined.Close, contentDescription = null, tint = MaterialTheme.colorScheme.error, modifier = Modifier.size(14.dp))
                            }
                        }
                    }
                }
                Spacer(Modifier.height(10.dp))
                LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(allSpecialties, key = { it }) { spec ->
                        val active = filterSpecialty == spec
                        Box(
                            Modifier
                                .clip(RoundedCornerShape(50))
                                .background(if (active) HeroBlue.copy(alpha = 0.14f) else MaterialTheme.colorScheme.surfaceVariant)
                                .clickable { filterSpecialty = if (active) null else spec }
                                .padding(horizontal = 14.dp, vertical = 8.dp)
                        ) {
                            Text(
                                spec,
                                style = MaterialTheme.typography.labelMedium,
                                color = if (active) HeroBlue else MaterialTheme.colorScheme.onSurfaceVariant,
                                fontWeight = if (active) FontWeight.SemiBold else FontWeight.Medium
                            )
                        }
                    }
                }
                Spacer(Modifier.height(12.dp))
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
                    Spacer(Modifier.height(10.dp))
                }
            } else if (viewMode == BookingViewMode.BY_SPECIALTY && filteredHospitals.isNotEmpty()) {
                items(filteredHospitals, key = { "spec-${it.id}" }) { hospital ->
                    val docs = if (filterSpecialty != null) {
                        hospital.doctors.filter { it.specialty == filterSpecialty }
                    } else hospital.doctors

                    if (docs.isNotEmpty()) {
                        HospitalSectionHeader(hospital)
                        Spacer(Modifier.height(8.dp))
                        docs.forEach { doctor ->
                            DoctorDirectoryCard(doctor, selectedDoctor?.id == doctor.id) {
                                selectedDoctorId = doctor.id
                                selectedSlotLabel = null
                            }
                            Spacer(Modifier.height(10.dp))
                        }
                    }
                }
            } else {
                items(fallbackDoctors, key = { it.id }) { doctor ->
                    DoctorDirectoryCard(doctor, selectedDoctor?.id == doctor.id) { selectedDoctorId = doctor.id; selectedSlotLabel = null }
                    Spacer(Modifier.height(10.dp))
                }
            }

            if (filteredHospitals.isEmpty() && hospitals.isNotEmpty() && filterSpecialty != null) {
                item {
                    Box(
                        Modifier
                            .fillMaxWidth()
                            .padding(vertical = 20.dp),
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
                            .padding(vertical = 20.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(t(S.noHospitalsFound), style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }

            if (selectedDoctor != null) {
                item {
                    Spacer(Modifier.height(14.dp))
                    Text(t(S.selectTime), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                    Spacer(Modifier.height(12.dp))
                    if (slots.isEmpty()) {
                        Text(
                            t(S.noSlotsAvailable),
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(vertical = 12.dp)
                        )
                    } else {
                        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            slots.chunked(2).forEach { row ->
                                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                    row.forEach { slot ->
                                        val selected = selectedSlot == slot
                                        Box(
                                            Modifier
                                                .weight(1f)
                                                .clip(RoundedCornerShape(14.dp))
                                                .background(if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surface)
                                                .clickable { selectedSlotLabel = slot.label }
                                                .padding(vertical = 14.dp),
                                            contentAlignment = Alignment.Center
                                        ) {
                                            Text(
                                                slot.label,
                                                style = MaterialTheme.typography.labelLarge,
                                                color = if (selected) Color.White else MaterialTheme.colorScheme.onSurface,
                                                fontWeight = FontWeight.SemiBold
                                            )
                                        }
                                    }
                                    if (row.size == 1) Spacer(Modifier.weight(1f))
                                }
                            }
                        }
                    }
                    Spacer(Modifier.height(24.dp))
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
                        Spacer(Modifier.height(12.dp))
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
private fun ViewModeChip(label: String, active: Boolean, onClick: () -> Unit) {
    Box(
        Modifier
            .clip(RoundedCornerShape(50))
            .background(if (active) HeroPurple.copy(alpha = 0.14f) else MaterialTheme.colorScheme.surfaceVariant)
            .clickable(onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 8.dp)
    ) {
        Text(
            label,
            style = MaterialTheme.typography.labelMedium,
            color = if (active) HeroPurple else MaterialTheme.colorScheme.onSurfaceVariant,
            fontWeight = if (active) FontWeight.SemiBold else FontWeight.Medium
        )
    }
}

@Composable
private fun HospitalSectionHeader(hospital: Hospital) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Icon(Icons.Outlined.LocalHospital, contentDescription = null, tint = HeroBlue, modifier = Modifier.size(18.dp))
        Spacer(Modifier.width(8.dp))
        Column {
            Text(hospital.name, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
            if (hospital.userCampLinked || hospital.isCampPartner) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Outlined.Verified, contentDescription = null, tint = HeroOrange, modifier = Modifier.size(12.dp))
                    Spacer(Modifier.width(4.dp))
                    Text(t(S.campPartnerHospital), style = MaterialTheme.typography.labelSmall, color = HeroOrange)
                }
            }
        }
    }
}

@Composable
private fun ExistingAppointmentCard(appt: Appointment, onCancel: () -> Unit) {
    HeroCard(Modifier.fillMaxWidth(), background = HeroBlue.copy(alpha = 0.04f)) {
        Row(
            Modifier.padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconBubble(Icons.Outlined.CalendarMonth, HeroBlue)
            Spacer(Modifier.width(14.dp))
            Column(Modifier.weight(1f)) {
                Text(appt.doctorName, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    "${appt.specialty} · for ${appt.kidName}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Text("${appt.date} · ${appt.time}", style = MaterialTheme.typography.labelSmall, color = HeroBlue, fontWeight = FontWeight.SemiBold)
            }
            IconButton(onClick = onCancel) {
                Icon(Icons.Outlined.Cancel, contentDescription = "Cancel appointment", tint = MaterialTheme.colorScheme.error)
            }
        }
    }
}
