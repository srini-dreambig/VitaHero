package kallam.healthcare.ui.screens

import android.Manifest
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
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
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.LocationOn
import androidx.compose.material3.Icon
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import kallam.healthcare.data.BookingDirectory
import kallam.healthcare.data.LocationHelper
import kallam.healthcare.data.S
import kallam.healthcare.ui.components.AppScreenHeader
import kallam.healthcare.ui.components.AppSectionTitle
import kallam.healthcare.ui.components.HospitalDirectoryCard
import kallam.healthcare.ui.components.PrimaryGradientButton
import kallam.healthcare.ui.components.SelectChip
import kallam.healthcare.ui.components.StatusBarSpacer
import kallam.healthcare.ui.components.t
import kallam.healthcare.ui.theme.AppSpacing

@Composable
fun HospitalsScreen(
    directory: BookingDirectory?,
    bookingCity: String,
    locationEnabled: Boolean,
    onBack: () -> Unit,
    onCityChange: (String) -> Unit,
    onUseMyLocation: () -> Unit,
    onBookAppointment: () -> Unit,
) {
    val context = LocalContext.current
    var filterSpecialty by rememberSaveable { mutableStateOf<String?>(null) }
    var expandedHospitalId by remember { mutableStateOf<String?>(null) }

    val hospitals = directory?.hospitals.orEmpty()
    val allSpecialties = directory?.specialties.orEmpty()
    val filteredHospitals = remember(hospitals, filterSpecialty) {
        if (filterSpecialty == null) hospitals
        else hospitals.filter { h ->
            h.specialties.contains(filterSpecialty) || h.doctors.any { it.specialty == filterSpecialty }
        }
    }

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

    Column(
        Modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.background)
    ) {
        StatusBarSpacer()
        AppScreenHeader(
            title = t(S.linkedHospitals),
            subtitle = t(S.hospitalPartnersSub),
            onBack = onBack,
        )
        LazyColumn(
            modifier = Modifier.fillMaxWidth(),
            contentPadding = PaddingValues(start = AppSpacing.xl, end = AppSpacing.xl, top = AppSpacing.sm, bottom = AppSpacing.xxxl)
        ) {
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
                AppSectionTitle(t(S.hospitalsNearYou))
                Spacer(Modifier.height(AppSpacing.md))
            }

            if (allSpecialties.isNotEmpty()) {
                item {
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
            }

            if (filteredHospitals.isEmpty()) {
                item {
                    Text(
                        t(S.noHospitalsFound),
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(vertical = AppSpacing.xxl)
                    )
                }
            } else {
                items(filteredHospitals, key = { it.id }) { hospital ->
                    HospitalDirectoryCard(
                        hospital = hospital,
                        expanded = expandedHospitalId == hospital.id,
                        selectedDoctorId = null,
                        onToggleExpand = {
                            expandedHospitalId = if (expandedHospitalId == hospital.id) null else hospital.id
                        },
                        onDoctorSelect = { },
                        showDoctors = expandedHospitalId == hospital.id,
                    )
                    Spacer(Modifier.height(AppSpacing.md))
                }
            }

            item {
                Spacer(Modifier.height(AppSpacing.sm))
                PrimaryGradientButton(
                    text = t(S.bookAppt),
                    onClick = onBookAppointment,
                    modifier = Modifier.fillMaxWidth()
                )
            }
        }
    }
}
