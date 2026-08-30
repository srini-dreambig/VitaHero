package com.rork.vitahero.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.LocationOn
import androidx.compose.material.icons.outlined.Schedule
import androidx.compose.material.icons.outlined.Verified
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
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
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.rork.vitahero.data.Camp
import com.rork.vitahero.data.CampStatus
import com.rork.vitahero.data.Kid
import com.rork.vitahero.data.S
import com.rork.vitahero.ui.components.HeroCard
import com.rork.vitahero.ui.components.PrimaryGradientButton
import com.rork.vitahero.ui.components.StatusBarSpacer
import com.rork.vitahero.ui.components.t
import com.rork.vitahero.ui.theme.HeroBlue
import com.rork.vitahero.ui.theme.HeroOrange

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun CampDetailScreen(
    camp: Camp,
    kids: List<Kid>,
    onBack: () -> Unit,
    onRegister: (kidId: String) -> Unit,
    onBookFollowUp: () -> Unit,
    /** Open what a doctor released for one child at this camp. */
    onOpenResult: (campId: String, kidId: String) -> Unit = { _, _ -> },
) {
    var selectedKidId by remember { mutableStateOf(kids.firstOrNull()?.id.orEmpty()) }
    val upcoming = camp.status.isUpcoming
    val accent = if (upcoming) HeroBlue else HeroOrange
    val registered = camp.registeredKidIds

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
                    Modifier.size(44.dp).clip(RoundedCornerShape(12.dp)).clickable(onClick = onBack),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(Icons.AutoMirrored.Outlined.ArrowBack, contentDescription = null)
                }
                Spacer(Modifier.width(12.dp))
                Text(t(S.campDetails), style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
            }
            Spacer(Modifier.height(12.dp))
        }

        item {
            HeroCard(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(20.dp)) {
                    if (camp.isPartnerCamp) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Outlined.Verified, contentDescription = null, tint = HeroOrange, modifier = Modifier.size(18.dp))
                            Spacer(Modifier.width(6.dp))
                            Text(t(S.partnerCamp), style = MaterialTheme.typography.labelMedium, color = HeroOrange, fontWeight = FontWeight.Bold)
                        }
                        Spacer(Modifier.height(10.dp))
                    }
                    Text(camp.title, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Spacer(Modifier.height(8.dp))
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Outlined.LocationOn, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(16.dp))
                        Spacer(Modifier.width(4.dp))
                        Text(camp.school, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }
                    Spacer(Modifier.height(10.dp))
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Outlined.Schedule, contentDescription = null, tint = accent, modifier = Modifier.size(16.dp))
                        Spacer(Modifier.width(6.dp))
                        Text("${camp.date} · ${camp.time}", style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium)
                    }
                    if (camp.description.isNotBlank()) {
                        Spacer(Modifier.height(14.dp))
                        Text(camp.description, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    if (camp.grades.isNotEmpty()) {
                        Spacer(Modifier.height(14.dp))
                        Text(t(S.eligibleGrades), style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.SemiBold)
                        Spacer(Modifier.height(8.dp))
                        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            camp.grades.forEach { grade ->
                                Box(
                                    Modifier
                                        .padding(bottom = 6.dp)
                                        .clip(RoundedCornerShape(50))
                                        .background(MaterialTheme.colorScheme.surfaceVariant)
                                        .padding(horizontal = 12.dp, vertical = 6.dp)
                                ) {
                                    Text(grade, style = MaterialTheme.typography.labelMedium)
                                }
                            }
                        }
                    }
                    Spacer(Modifier.height(14.dp))
                    Text(t(S.screeningsIncluded), style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.SemiBold)
                    Spacer(Modifier.height(8.dp))
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        camp.checks.forEach { check ->
                            Box(
                                Modifier
                                    .padding(bottom = 6.dp)
                                    .clip(RoundedCornerShape(50))
                                    .background(accent.copy(alpha = 0.12f))
                                    .padding(horizontal = 12.dp, vertical = 6.dp)
                            ) {
                                Text(check, style = MaterialTheme.typography.labelMedium, color = accent)
                            }
                        }
                    }
                    if (camp.capacity > 0) {
                        Spacer(Modifier.height(10.dp))
                        Text("${t(S.capacity)}: ${camp.capacity}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    camp.resultSummary?.let {
                        Spacer(Modifier.height(12.dp))
                        Box(
                            Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(12.dp))
                                .background(HeroOrange.copy(alpha = 0.1f))
                                .padding(12.dp)
                        ) {
                            Text(it, style = MaterialTheme.typography.bodySmall, color = HeroOrange, fontWeight = FontWeight.Medium)
                        }
                    }
                }
            }
            Spacer(Modifier.height(20.dp))
        }

        if (upcoming && camp.isPartnerCamp && kids.isNotEmpty()) {
            item {
                Text(t(S.registerChild), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                Spacer(Modifier.height(10.dp))
                kids.forEach { kid ->
                    val isRegistered = kid.id in registered
                    HeroCard(
                        Modifier
                            .fillMaxWidth()
                            .padding(bottom = 10.dp)
                            .clickable(enabled = !isRegistered) { selectedKidId = kid.id }
                    ) {
                        Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                            Column(Modifier.weight(1f)) {
                                Text(kid.name, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis,
                                )
                                Text("${kid.grade} · ${kid.school}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis,
                                )
                            }
                            if (isRegistered) {
                                Text(t(S.registered), style = MaterialTheme.typography.labelSmall, color = HeroOrange, fontWeight = FontWeight.Bold)
                            } else if (selectedKidId == kid.id) {
                                Text(t(S.selected), style = MaterialTheme.typography.labelSmall, color = HeroBlue, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
                val kid = kids.firstOrNull { it.id == selectedKidId }
                if (kid != null && kid.id !in registered) {
                    Spacer(Modifier.height(8.dp))
                    PrimaryGradientButton(
                        text = t(S.confirmRegistration),
                        onClick = { onRegister(kid.id) },
                    )
                }
                Spacer(Modifier.height(16.dp))
            }
        }

        // After a school camp, each child's own result is a separate screen —
        // the flags on the Kids tab are the summary, this is what the doctor
        // actually wrote.
        if (!upcoming && camp.isPartnerCamp && kids.isNotEmpty()) {
            item {
                Text(t(S.campResultTitle), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                Spacer(Modifier.height(10.dp))
                kids.forEach { kid ->
                    HeroCard(
                        Modifier
                            .fillMaxWidth()
                            .padding(bottom = 10.dp)
                            .clickable {
                                onOpenResult(camp.schoolCampId.ifBlank { camp.id }, kid.id)
                            }
                    ) {
                        Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                            Column(Modifier.weight(1f)) {
                                Text(kid.name, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis,
                                )
                                Text(
                                    t(S.campResultTitle),
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                            }
                            Text(
                                t(S.viewLabel),
                                style = MaterialTheme.typography.labelMedium,
                                color = HeroBlue,
                                fontWeight = FontWeight.Bold,
                            )
                        }
                    }
                }
                Spacer(Modifier.height(8.dp))
            }
        }

        item {
            PrimaryGradientButton(
                text = if (upcoming) t(S.addToReminders) else t(S.bookFollowUp),
                onClick = onBookFollowUp,
            )
        }
    }
}
