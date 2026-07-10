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
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.School
import androidx.compose.material.icons.outlined.VpnKey
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.rork.vitahero.data.Kid
import com.rork.vitahero.data.PartnerSchool
import com.rork.vitahero.data.S
import com.rork.vitahero.ui.components.HeroCard
import com.rork.vitahero.ui.components.IconBubble
import com.rork.vitahero.ui.components.PrimaryGradientButton
import com.rork.vitahero.ui.components.StatusBarSpacer
import com.rork.vitahero.ui.components.t
import com.rork.vitahero.ui.theme.HeroBlue
import com.rork.vitahero.ui.theme.HeroOrange

@Composable
fun SchoolsScreen(
    partnerSchools: List<PartnerSchool>,
    availableSchools: List<PartnerSchool>,
    kids: List<Kid>,
    onBack: () -> Unit,
    onEnroll: (partnerCode: String, kidId: String?) -> Unit,
) {
    var code by remember { mutableStateOf("") }
    var selectedKidId by remember { mutableStateOf(kids.firstOrNull()?.id) }

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
                    Text(t(S.schoolPartners), style = MaterialTheme.typography.headlineLarge, fontWeight = FontWeight.Bold)
                    Text(t(S.schoolPartnersSub), style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            Spacer(Modifier.height(16.dp))
        }

        if (partnerSchools.isNotEmpty()) {
            item {
                Text(t(S.linkedSchools), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                Spacer(Modifier.height(10.dp))
            }
            items(partnerSchools, key = { it.id }) { school ->
                LinkedSchoolCard(school)
                Spacer(Modifier.height(10.dp))
            }
            item { Spacer(Modifier.height(8.dp)) }
        }

        item {
            HeroCard(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(18.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        IconBubble(Icons.Outlined.VpnKey, HeroOrange)
                        Spacer(Modifier.width(12.dp))
                        Text(t(S.enterPartnerCode), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                    }
                    Spacer(Modifier.height(12.dp))
                    Text(t(S.partnerCodeHint), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Spacer(Modifier.height(12.dp))
                    OutlinedTextField(
                        value = code,
                        onValueChange = { code = it.uppercase().take(12) },
                        modifier = Modifier.fillMaxWidth(),
                        placeholder = { Text("OAK2026") },
                        singleLine = true,
                        shape = RoundedCornerShape(14.dp),
                        colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = HeroOrange),
                    )
                    if (kids.isNotEmpty()) {
                        Spacer(Modifier.height(10.dp))
                        Text(t(S.linkChildOptional), style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Spacer(Modifier.height(8.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            kids.forEach { kid ->
                                val selected = selectedKidId == kid.id
                                Text(
                                    kid.name,
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(50))
                                        .clickable { selectedKidId = kid.id }
                                        .background(if (selected) HeroOrange.copy(alpha = 0.15f) else MaterialTheme.colorScheme.surfaceVariant)
                                        .padding(horizontal = 14.dp, vertical = 8.dp),
                                    style = MaterialTheme.typography.labelLarge,
                                    fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium,
                                    color = if (selected) HeroOrange else MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                            }
                        }
                    }
                    Spacer(Modifier.height(16.dp))
                    PrimaryGradientButton(
                        text = t(S.linkSchool),
                        enabled = code.length >= 4,
                        onClick = { onEnroll(code.trim(), selectedKidId) },
                    )
                }
            }
            Spacer(Modifier.height(20.dp))
        }

        item {
            Text(t(S.partnerSchoolsList), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
            Spacer(Modifier.height(10.dp))
        }
        items(availableSchools, key = { it.id }) { school ->
            PartnerSchoolCard(school, isLinked = partnerSchools.any { it.id == school.id })
            Spacer(Modifier.height(10.dp))
        }
    }
}

@Composable
private fun LinkedSchoolCard(school: PartnerSchool) {
    HeroCard(Modifier.fillMaxWidth(), background = HeroOrange.copy(alpha = 0.06f)) {
        Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
            IconBubble(Icons.Outlined.CheckCircle, HeroOrange)
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(school.name, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                Text("${school.city} · ${school.district}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Text(t(S.linked), style = MaterialTheme.typography.labelSmall, color = HeroOrange, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
private fun PartnerSchoolCard(school: PartnerSchool, isLinked: Boolean) {
    HeroCard(Modifier.fillMaxWidth()) {
        Row(Modifier.padding(16.dp), verticalAlignment = Alignment.Top) {
            Icon(Icons.Outlined.School, contentDescription = null, tint = HeroBlue, modifier = Modifier.size(28.dp))
            Spacer(Modifier.width(14.dp))
            Column {
                Text(school.name, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                Text("${school.city}, ${school.district}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                if (school.description.isNotBlank()) {
                    Spacer(Modifier.height(6.dp))
                    Text(school.description, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                if (isLinked) {
                    Spacer(Modifier.height(6.dp))
                    Text(t(S.linked), style = MaterialTheme.typography.labelSmall, color = HeroOrange, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}
