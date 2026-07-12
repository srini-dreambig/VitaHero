package com.rork.vitahero.ui.screens

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
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
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.Group
import androidx.compose.material.icons.outlined.LocalHospital
import androidx.compose.material.icons.outlined.Pending
import androidx.compose.material.icons.outlined.Schedule
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.rork.vitahero.data.DoctorCampDto
import com.rork.vitahero.data.DoctorCampKidDto
import com.rork.vitahero.data.DoctorViewModel
import com.rork.vitahero.ui.components.HeroCard
import com.rork.vitahero.ui.components.IconBubble
import com.rork.vitahero.ui.components.PrimaryGradientButton
import com.rork.vitahero.ui.components.StatusBarSpacer
import com.rork.vitahero.ui.theme.HeroBlue
import com.rork.vitahero.ui.theme.HeroOrange
import com.rork.vitahero.ui.theme.FlagGood
import com.rork.vitahero.ui.theme.FlagWatch
import com.rork.vitahero.ui.theme.FlagAlert

/**
 * Doctor Dashboard — shows assigned camps, lets doctor select a camp,
 * then shows the list of registered kids with their checkup status.
 */
@Composable
fun DoctorDashboardScreen(
    doctorViewModel: DoctorViewModel,
    doctorName: String,
    allowedScreens: List<String> = emptyList(),
    onBack: () -> Unit,
    onOpenCheckup: (DoctorCampKidDto, DoctorCampDto) -> Unit,
    onLogout: () -> Unit,
) {
    val state by doctorViewModel.uiState.collectAsState()

    // Determine screen access
    val hasCheckupAccess = allowedScreens.isEmpty() || allowedScreens.contains("CHECKUP")

    LaunchedEffect(Unit) { doctorViewModel.loadCamps() }

    LazyColumn(
        modifier = Modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.background),
        contentPadding = PaddingValues(start = 20.dp, end = 20.dp, bottom = 32.dp)
    ) {
        item {
            StatusBarSpacer()
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.padding(vertical = 8.dp)
            ) {
                Box(
                    Modifier.size(44.dp).clip(RoundedCornerShape(12.dp)).clickable(onClick = onBack),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(Icons.AutoMirrored.Outlined.ArrowBack, contentDescription = "Back")
                }
                Spacer(Modifier.weight(1f))
                Text(
                    "Logout",
                    style = MaterialTheme.typography.labelLarge,
                    color = HeroOrange,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.clickable(onClick = onLogout).padding(8.dp)
                )
            }
        }

        // ── Doctor header ──
        item {
            Column(modifier = Modifier.padding(bottom = 24.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    IconBubble(
                        icon = Icons.Outlined.LocalHospital,
                        tint = HeroOrange,
                        size = 52.dp
                    )
                    Column {
                        Text(
                            "Welcome, $doctorName",
                            style = MaterialTheme.typography.headlineSmall,
                            fontWeight = FontWeight.Bold,
                        )
                        Text(
                            "Doctor Portal",
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }
        }

        // ── Camp selection view ──
        if (state.selectedCamp == null) {
            item {
                Text(
                    "Your Assigned Camps",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(bottom = 16.dp)
                )
            }

            if (state.isLoading && state.camps.isEmpty()) {
                item {
                    Box(
                        Modifier.fillMaxWidth().padding(48.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        CircularProgressIndicator(color = HeroOrange)
                    }
                }
            } else if (state.camps.isEmpty()) {
                item {
                    HeroCard {
                        Column(
                            Modifier.padding(28.dp),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Icon(
                                Icons.Outlined.LocalHospital,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.size(48.dp)
                            )
                            Spacer(Modifier.height(12.dp))
                            Text(
                                "No camps assigned yet",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.SemiBold,
                            )
                            Spacer(Modifier.height(4.dp))
                            Text(
                                "Your admin will assign you to a camp. Check back later.",
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                }
            } else {
                items(state.camps, key = { it.campId }) { camp ->
                    DoctorCampCard(camp = camp, onClick = { doctorViewModel.selectCamp(camp) })
                    Spacer(Modifier.height(14.dp))
                }
            }
        } else {
            // ── Camp kids view ──
            val camp = state.selectedCamp!!
            item {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.padding(bottom = 16.dp)
                ) {
                    Box(
                        Modifier.size(40.dp).clip(RoundedCornerShape(10.dp))
                            .clickable { doctorViewModel.loadCamps() },
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(Icons.AutoMirrored.Outlined.ArrowBack, contentDescription = "Back to camps")
                    }
                    Spacer(Modifier.width(12.dp))
                    Column {
                        Text(
                            camp.campTitle,
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.Bold,
                        )
                        Text(
                            "${camp.schoolName} • ${camp.campDate}",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }

                // Progress summary
                HeroCard {
                    Row(
                        Modifier.padding(16.dp),
                        horizontalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        StatPill(
                            modifier = Modifier.weight(1f),
                            icon = Icons.Outlined.Group,
                            label = "Registered",
                            value = state.campKids.size.toString(),
                            color = HeroBlue,
                        )
                        StatPill(
                            modifier = Modifier.weight(1f),
                            icon = Icons.Outlined.CheckCircle,
                            label = "Checked",
                            value = state.campKids.count { it.checkupId != null }.toString(),
                            color = FlagGood,
                        )
                        StatPill(
                            modifier = Modifier.weight(1f),
                            icon = Icons.Outlined.Pending,
                            label = "Pending",
                            value = state.campKids.count { it.checkupId == null }.toString(),
                            color = FlagWatch,
                        )
                    }
                }
                Spacer(Modifier.height(16.dp))
            }

            if (state.isLoading && state.campKids.isEmpty()) {
                item {
                    Box(
                        Modifier.fillMaxWidth().padding(48.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        CircularProgressIndicator(color = HeroOrange)
                    }
                }
            } else if (state.campKids.isEmpty()) {
                item {
                    HeroCard {
                        Text(
                            "No kids registered for this camp yet.",
                            style = MaterialTheme.typography.bodyLarge,
                            modifier = Modifier.padding(28.dp),
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            } else {
                items(state.campKids, key = { it.kidId }) { kid ->
                    DoctorKidCard(
                        kid = kid,
                        canStartCheckup = hasCheckupAccess,
                        onClick = { onOpenCheckup(kid, camp) },
                    )
                    Spacer(Modifier.height(12.dp))
                }
            }
        }
    }
}

@Composable
private fun DoctorCampCard(camp: DoctorCampDto, onClick: () -> Unit) {
    HeroCard(modifier = Modifier.clickable(onClick = onClick)) {
        Column(Modifier.padding(20.dp)) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                IconBubble(
                    icon = Icons.Outlined.LocalHospital,
                    tint = HeroBlue,
                    size = 44.dp
                )
                Column(Modifier.weight(1f)) {
                    Text(
                        camp.campTitle,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                    )
                    Text(
                        camp.schoolName,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
            Spacer(Modifier.height(14.dp))
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Icon(Icons.Outlined.Schedule, contentDescription = null, modifier = Modifier.size(16.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text(camp.campDate, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Icon(Icons.Outlined.Group, contentDescription = null, modifier = Modifier.size(16.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text("${camp.registeredCount} kids", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Icon(Icons.Outlined.CheckCircle, contentDescription = null, modifier = Modifier.size(16.dp), tint = FlagGood)
                    Text("${camp.checkedCount} done", style = MaterialTheme.typography.labelMedium, color = FlagGood)
                }
            }
        }
    }
}

@Composable
private fun DoctorKidCard(kid: DoctorCampKidDto, canStartCheckup: Boolean = true, onClick: () -> Unit) {
    val isChecked = kid.checkupId != null
    val statusColor = when {
        kid.referralNeeded == true -> FlagAlert
        isChecked -> FlagGood
        else -> FlagWatch
    }
    val isClickable = canStartCheckup || isChecked
    HeroCard(modifier = Modifier.clickable(enabled = isClickable, onClick = onClick)) {
        Row(
            Modifier.padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            Box(
                Modifier.size(48.dp).clip(RoundedCornerShape(12.dp))
                    .background(statusColor.copy(alpha = 0.12f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    if (isChecked) Icons.Outlined.CheckCircle else Icons.Outlined.Pending,
                    contentDescription = null,
                    tint = statusColor,
                    modifier = Modifier.size(26.dp)
                )
            }
            Column(Modifier.weight(1f)) {
                Text(
                    kid.name,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                )
                Text(
                    buildString {
                        append(kid.age)
                        if (kid.gender.isNotBlank()) append("y · ").append(kid.gender)
                        if (kid.grade.isNotBlank()) append(" · ").append(kid.grade)
                    },
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                if (isChecked) {
                    Text(
                        "Checkup completed${if (kid.checkupAt != null) " · ${kid.checkupAt.take(10)}" else ""}",
                        style = MaterialTheme.typography.labelSmall,
                        color = FlagGood,
                        fontWeight = FontWeight.Medium,
                    )
                } else if (canStartCheckup) {
                    Text(
                        "Pending checkup",
                        style = MaterialTheme.typography.labelSmall,
                        color = FlagWatch,
                        fontWeight = FontWeight.Medium,
                    )
                } else {
                    Text(
                        "View only — no checkup access",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        fontWeight = FontWeight.Medium,
                    )
                }
            }
            if (canStartCheckup || isChecked) {
                Text(
                    if (isChecked) "View" else "Start",
                    style = MaterialTheme.typography.labelLarge,
                    color = HeroOrange,
                    fontWeight = FontWeight.Bold,
                )
            }
        }
    }
}

@Composable
private fun StatPill(modifier: Modifier = Modifier, icon: ImageVector, label: String, value: String, color: androidx.compose.ui.graphics.Color) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        modifier = modifier
    ) {
        Icon(icon, contentDescription = null, tint = color, modifier = Modifier.size(20.dp))
        Column {
            Text(value, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, color = color)
            Text(label, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}
