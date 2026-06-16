package com.rork.vitahero.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.LocalHospital
import androidx.compose.material.icons.outlined.Star
import androidx.compose.material.icons.outlined.Verified
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.rork.vitahero.data.Doctor
import com.rork.vitahero.data.Hospital
import com.rork.vitahero.data.S
import com.rork.vitahero.ui.theme.HeroBlue
import com.rork.vitahero.ui.theme.HeroGreen
import com.rork.vitahero.ui.theme.HeroYellow

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun HospitalDirectoryCard(
    hospital: Hospital,
    expanded: Boolean,
    selectedDoctorId: String?,
    onToggleExpand: () -> Unit,
    onDoctorSelect: (Doctor) -> Unit,
    showDoctors: Boolean = true,
) {
    HeroCard(
        Modifier
            .fillMaxWidth()
            .clickable(onClick = onToggleExpand),
        background = if (hospital.userCampLinked) HeroGreen.copy(alpha = 0.06f) else MaterialTheme.colorScheme.surface,
        border = !hospital.userCampLinked
    ) {
        Column(Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.Top) {
                IconBubble(Icons.Outlined.LocalHospital, if (hospital.userCampLinked) HeroGreen else HeroBlue)
                Spacer(Modifier.width(14.dp))
                Column(Modifier.weight(1f)) {
                    Text(hospital.name, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                    Text(
                        "${hospital.district}, ${hospital.city}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    if (hospital.address.isNotBlank()) {
                        Text(
                            hospital.address,
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                    hospital.distanceKm?.let { km ->
                        Text(
                            String.format(t(S.kmAway), "%.1f".format(km)),
                            style = MaterialTheme.typography.labelSmall,
                            color = HeroBlue,
                            fontWeight = FontWeight.SemiBold
                        )
                    }
                }
                Column(horizontalAlignment = Alignment.End) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Outlined.Star, contentDescription = null, tint = HeroYellow, modifier = Modifier.size(16.dp))
                        Spacer(Modifier.width(2.dp))
                        Text("${hospital.rating}", style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.SemiBold)
                    }
                }
            }

            Spacer(Modifier.height(10.dp))
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                if (hospital.userCampLinked || hospital.isCampPartner) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Outlined.Verified, contentDescription = null, tint = HeroGreen, modifier = Modifier.size(14.dp))
                        Spacer(Modifier.width(4.dp))
                        Text(t(S.campPartnerHospital), style = MaterialTheme.typography.labelSmall, color = HeroGreen, fontWeight = FontWeight.SemiBold)
                    }
                }
                if (hospital.conductedCamps > 0) {
                    Text(
                        String.format(t(S.conductedCampsCount), hospital.conductedCamps),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            if (hospital.specialties.isNotEmpty()) {
                Spacer(Modifier.height(8.dp))
                FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    hospital.specialties.forEach { spec ->
                        Box(
                            Modifier
                                .clip(RoundedCornerShape(50))
                                .background(HeroBlue.copy(alpha = 0.1f))
                                .padding(horizontal = 10.dp, vertical = 4.dp)
                        ) {
                            Text(spec, style = MaterialTheme.typography.labelSmall, color = HeroBlue)
                        }
                    }
                }
            }

            if (showDoctors && expanded) {
                Spacer(Modifier.height(12.dp))
                Text(t(S.selectDoctor), style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.SemiBold)
                Spacer(Modifier.height(8.dp))
                hospital.doctors.forEach { doctor ->
                    DoctorDirectoryCard(doctor, selectedDoctorId == doctor.id) { onDoctorSelect(doctor) }
                    Spacer(Modifier.height(8.dp))
                }
            }
        }
    }
}

@Composable
fun DoctorDirectoryCard(doctor: Doctor, selected: Boolean, onClick: () -> Unit) {
    HeroCard(
        Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        background = if (selected) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surface,
        border = !selected
    ) {
        Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
            KidAvatar(doctor.name.removePrefix("Dr. "), doctor.avatarColor, size = 50.dp)
            Spacer(Modifier.width(14.dp))
            Column(Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(doctor.name, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                    if (doctor.isCampPartner) {
                        Spacer(Modifier.width(6.dp))
                        Icon(Icons.Outlined.Verified, contentDescription = null, tint = HeroGreen, modifier = Modifier.size(14.dp))
                    }
                }
                Text(doctor.specialty, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text(doctor.hospital, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Outlined.Star, contentDescription = null, tint = HeroYellow, modifier = Modifier.size(16.dp))
                Spacer(Modifier.width(2.dp))
                Text("${doctor.rating}", style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.SemiBold)
            }
        }
    }
}
