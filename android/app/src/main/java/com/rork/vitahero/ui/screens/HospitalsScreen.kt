package com.rork.vitahero.ui.screens

import android.Manifest
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.LocationOn
import androidx.compose.material.icons.outlined.MyLocation
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.rork.vitahero.data.BookingDirectory
import com.rork.vitahero.data.LocationHelper
import com.rork.vitahero.data.S
import com.rork.vitahero.ui.components.HospitalDirectoryCard
import com.rork.vitahero.ui.components.PrimaryGradientButton
import com.rork.vitahero.ui.components.StatusBarSpacer
import com.rork.vitahero.ui.components.t
import com.rork.vitahero.ui.theme.HeroBlue
import com.rork.vitahero.ui.theme.HeroGreen
import com.rork.vitahero.ui.theme.HeroPurple

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
    var filterSpecialty by remember { mutableStateOf<String?>(null) }
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

    LazyColumn(
        modifier = Modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.background),
        contentPadding = PaddingValues(start = 20.dp, end = 20.dp, bottom = 32.dp)
    ) {
        item {
            StatusBarSpacer()
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(vertical = 8.dp)) {
                Box(
                    Modifier
                        .size(44.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .clickable(onClick = onBack),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(Icons.AutoMirrored.Outlined.ArrowBack, contentDescription = null)
                }
                Spacer(Modifier.width(12.dp))
                Column {
                    Text(t(S.linkedHospitals), style = MaterialTheme.typography.headlineLarge, fontWeight = FontWeight.Bold)
                    Text(t(S.hospitalPartnersSub), style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            Spacer(Modifier.height(16.dp))
        }

        item {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Outlined.LocationOn, contentDescription = null, tint = HeroBlue, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(6.dp))
                Text(t(S.yourArea), style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Spacer(Modifier.height(8.dp))
            LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                items(listOf("Hyderabad")) { city ->
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
                            .background(if (locationEnabled) HeroGreen.copy(alpha = 0.14f) else HeroPurple.copy(alpha = 0.14f))
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
                                tint = if (locationEnabled) HeroGreen else HeroPurple,
                                modifier = Modifier.size(16.dp)
                            )
                            Spacer(Modifier.width(6.dp))
                            Text(
                                t(S.useMyLocation),
                                style = MaterialTheme.typography.labelMedium,
                                color = if (locationEnabled) HeroGreen else HeroPurple,
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
                    color = HeroGreen,
                    fontWeight = FontWeight.SemiBold
                )
            }
            Spacer(Modifier.height(16.dp))
            Text(t(S.hospitalsNearYou), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
            Spacer(Modifier.height(10.dp))
        }

        if (allSpecialties.isNotEmpty()) {
            item {
                LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(allSpecialties) { spec ->
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
        }

        if (filteredHospitals.isEmpty()) {
            item {
                Text(
                    t(S.noHospitalsFound),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(vertical = 24.dp)
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
                Spacer(Modifier.height(10.dp))
            }
        }

        item {
            Spacer(Modifier.height(8.dp))
            PrimaryGradientButton(
                text = t(S.bookAppt),
                onClick = onBookAppointment,
                modifier = Modifier.fillMaxWidth()
            )
        }
    }
}
