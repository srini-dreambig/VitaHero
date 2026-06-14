package com.rork.vitahero.ui.screens

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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.Star
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.rork.vitahero.data.Doctor
import com.rork.vitahero.data.Kid
import com.rork.vitahero.ui.components.HeroCard
import com.rork.vitahero.ui.components.KidAvatar
import com.rork.vitahero.ui.components.PrimaryGradientButton
import com.rork.vitahero.ui.theme.HeroGreen
import com.rork.vitahero.ui.theme.HeroYellow

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BookingScreen(
    doctors: List<Doctor>,
    kids: List<Kid>,
    onBack: () -> Unit,
    onConfirm: (Doctor, kidName: String, date: String, time: String) -> Unit
) {
    var selectedDoctor by remember { mutableStateOf<Doctor?>(null) }
    var selectedKid by remember { mutableStateOf(kids.firstOrNull()?.name ?: "") }
    var selectedSlot by remember { mutableStateOf<String?>(null) }
    var booked by remember { mutableStateOf(false) }

    val slots = listOf("Today, 4:30 PM", "Tomorrow, 11:00 AM", "Wed, 5:15 PM", "Thu, 10:00 AM")

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            TopAppBar(
                title = { Text(if (booked) "Booked" else "Book Appointment", style = MaterialTheme.typography.titleLarge) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Outlined.ArrowBack, contentDescription = "Back")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background)
            )
        }
    ) { pad ->
        if (booked) {
            Column(
                Modifier
                    .fillMaxWidth()
                    .padding(pad)
                    .padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Spacer(Modifier.height(40.dp))
                Box(
                    Modifier
                        .size(96.dp)
                        .clip(CircleShape)
                        .background(HeroGreen.copy(alpha = 0.14f)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(Icons.Outlined.CheckCircle, contentDescription = null, tint = HeroGreen, modifier = Modifier.size(54.dp))
                }
                Spacer(Modifier.height(24.dp))
                Text("Appointment confirmed!", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(8.dp))
                Text(
                    "${selectedDoctor?.name} · $selectedSlot\nfor $selectedKid",
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(Modifier.height(32.dp))
                PrimaryGradientButton(text = "Done", onClick = onBack, modifier = Modifier.fillMaxWidth())
            }
            return@Scaffold
        }

        LazyColumn(
            Modifier
                .fillMaxWidth()
                .padding(pad),
            contentPadding = PaddingValues(start = 20.dp, end = 20.dp, bottom = 24.dp)
        ) {
            item {
                Spacer(Modifier.height(4.dp))
                Text("Select a child", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                Spacer(Modifier.height(12.dp))
                LazyRow(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    items(kids, key = { it.id }) { kid ->
                        val selected = selectedKid == kid.name
                        Row(
                            Modifier
                                .clip(RoundedCornerShape(50))
                                .background(if (selected) HeroGreen.copy(alpha = 0.14f) else MaterialTheme.colorScheme.surface)
                                .clickable { selectedKid = kid.name }
                                .padding(end = 16.dp, top = 6.dp, bottom = 6.dp, start = 6.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            KidAvatar(kid.name, kid.avatarColor, size = 32.dp)
                            Spacer(Modifier.width(8.dp))
                            Text(kid.name, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold, color = if (selected) HeroGreen else MaterialTheme.colorScheme.onSurface)
                        }
                    }
                }
                Spacer(Modifier.height(24.dp))
                Text("Choose a doctor", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                Spacer(Modifier.height(12.dp))
            }

            items(doctors, key = { it.id }) { doctor ->
                DoctorCard(doctor, selectedDoctor?.id == doctor.id) { selectedDoctor = doctor }
                Spacer(Modifier.height(10.dp))
            }

            if (selectedDoctor != null) {
                item {
                    Spacer(Modifier.height(14.dp))
                    Text("Pick a slot", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                    Spacer(Modifier.height(12.dp))
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
                                            .clickable { selectedSlot = slot }
                                            .padding(vertical = 14.dp),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Text(
                                            slot,
                                            style = MaterialTheme.typography.labelLarge,
                                            color = if (selected) Color.White else MaterialTheme.colorScheme.onSurface,
                                            fontWeight = FontWeight.SemiBold
                                        )
                                    }
                                }
                            }
                        }
                    }
                    Spacer(Modifier.height(24.dp))
                    PrimaryGradientButton(
                        text = "Confirm Booking",
                        enabled = selectedSlot != null,
                        onClick = {
                            val doc = selectedDoctor ?: return@PrimaryGradientButton
                            val slot = selectedSlot ?: return@PrimaryGradientButton
                            val parts = slot.split(", ")
                            onConfirm(doc, selectedKid, parts.getOrElse(0) { slot }, parts.getOrElse(1) { "" })
                            booked = true
                        },
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            }
        }
    }
}

@Composable
private fun DoctorCard(doctor: Doctor, selected: Boolean, onClick: () -> Unit) {
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
                Text(doctor.name, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                Text(doctor.specialty, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text(doctor.hospital, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Column(horizontalAlignment = Alignment.End) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Outlined.Star, contentDescription = null, tint = HeroYellow, modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(2.dp))
                    Text("${doctor.rating}", style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.SemiBold)
                }
                Spacer(Modifier.height(4.dp))
                Text(doctor.nextSlot, style = MaterialTheme.typography.labelSmall, color = HeroGreen, fontWeight = FontWeight.SemiBold)
            }
        }
    }
}
