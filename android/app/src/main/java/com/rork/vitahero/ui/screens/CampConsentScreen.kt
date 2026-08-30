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
import androidx.compose.material.icons.outlined.PhotoCamera
import androidx.compose.material3.Checkbox
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.rork.vitahero.data.GuardianViewModel
import com.rork.vitahero.data.PendingConsentDto
import com.rork.vitahero.data.S
import com.rork.vitahero.ui.components.HeroCard
import com.rork.vitahero.ui.components.IconBubble
import com.rork.vitahero.ui.components.PrimaryGradientButton
import com.rork.vitahero.ui.components.StatusBarSpacer
import com.rork.vitahero.ui.components.t
import com.rork.vitahero.ui.components.tf
import com.rork.vitahero.ui.theme.HeroBlue
import com.rork.vitahero.ui.theme.HeroOrange

/**
 * The school is asking permission to check your child.
 *
 * Two decisions live on this screen and they are deliberately not the same one.
 * The first is the check-up: a guardian may agree to some checks and refuse
 * others, so every check is its own tick. The second is photography, shown only
 * where the camp asked for it, because agreeing to have your child measured is
 * not agreeing to have them photographed. The server enforces both again.
 */
@Composable
fun CampConsentScreen(
    guardianViewModel: GuardianViewModel,
    onBack: () -> Unit,
) {
    val pending by guardianViewModel.pendingConsents.collectAsState()
    val busy by guardianViewModel.busy.collectAsState()

    LaunchedEffect(Unit) { guardianViewModel.loadPendingConsents() }

    LazyColumn(
        modifier = Modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.background),
        contentPadding = PaddingValues(start = 20.dp, end = 20.dp, bottom = 32.dp),
    ) {
        item {
            StatusBarSpacer()
            ScreenHeader(t(S.campConsentTitle), t(S.campConsentSub), onBack)
            Spacer(Modifier.height(16.dp))
        }

        if (pending.isEmpty()) {
            item {
                HeroCard(Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                        IconBubble(Icons.Outlined.CheckCircle, HeroBlue)
                        Spacer(Modifier.height(12.dp))
                        Text(
                            t(S.noConsentPending),
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.SemiBold,
                        )
                        Spacer(Modifier.height(6.dp))
                        Text(
                            t(S.noConsentPendingSub),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }
        }

        items(pending, key = { it.campId + "/" + it.kidId }) { c ->
            ConsentRequestCard(c, busy) { granted, checks, photos ->
                guardianViewModel.answerConsent(c.campId, c.kidId, granted, checks, photos)
            }
            Spacer(Modifier.height(14.dp))
        }
    }
}

@Composable
private fun ConsentRequestCard(
    c: PendingConsentDto,
    busy: Boolean,
    onAnswer: (granted: Boolean, checks: List<String>, photos: Boolean) -> Unit,
) {
    // Every check starts ticked, because that is what the school asked for and
    // what most guardians will agree to. Unticking is the deliberate act.
    val ticked = remember(c.campId, c.kidId) {
        mutableStateMapOf<String, Boolean>().apply { c.checks.forEach { put(it, true) } }
    }
    // Photography starts unticked. Silence is not consent.
    var photos by remember(c.campId, c.kidId) { mutableStateOf(false) }

    HeroCard(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(18.dp)) {
            Text(c.kidName, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(2.dp))
            Text(
                listOf(c.schoolName, c.title).filter { it.isNotBlank() }.joinToString(" · "),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            if (c.date.isNotBlank()) {
                Spacer(Modifier.height(2.dp))
                Text(
                    listOf(c.date, c.time, c.venue).filter { it.isNotBlank() }.joinToString(" · "),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            Spacer(Modifier.height(14.dp))
            Text(
                t(S.consentChecksTitle),
                style = MaterialTheme.typography.labelLarge,
                fontWeight = FontWeight.SemiBold,
            )
            Spacer(Modifier.height(4.dp))
            Text(
                t(S.consentChecksHint),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(Modifier.height(6.dp))
            c.checks.forEach { check ->
                Row(
                    Modifier
                        .fillMaxWidth()
                        .clickable { ticked[check] = !(ticked[check] ?: true) }
                        .padding(vertical = 2.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Checkbox(
                        checked = ticked[check] ?: true,
                        onCheckedChange = { ticked[check] = it },
                    )
                    Spacer(Modifier.width(4.dp))
                    Text(check, style = MaterialTheme.typography.bodyMedium)
                }
            }

            // Only where the camp actually asked. When photosAsked is false the
            // question is not shown at all, rather than shown and defaulted.
            if (c.photosAsked) {
                Spacer(Modifier.height(12.dp))
                Box(
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(14.dp))
                        .background(HeroOrange.copy(alpha = 0.10f))
                        .padding(14.dp),
                ) {
                    Column {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                Icons.Outlined.PhotoCamera,
                                contentDescription = null,
                                tint = HeroOrange,
                                modifier = Modifier.size(20.dp),
                            )
                            Spacer(Modifier.width(8.dp))
                            Text(
                                t(S.photoConsentTitle),
                                style = MaterialTheme.typography.labelLarge,
                                fontWeight = FontWeight.SemiBold,
                            )
                        }
                        Spacer(Modifier.height(6.dp))
                        Text(
                            t(S.photoConsentBody),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Spacer(Modifier.height(4.dp))
                        Row(
                            Modifier
                                .fillMaxWidth()
                                .clickable { photos = !photos },
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Checkbox(checked = photos, onCheckedChange = { photos = it })
                            Spacer(Modifier.width(4.dp))
                            Text(t(S.photoConsentAgree), style = MaterialTheme.typography.bodyMedium)
                        }
                    }
                }
            }

            if (c.deadline.isNotBlank()) {
                Spacer(Modifier.height(10.dp))
                Text(
                    tf(S.consentDeadlineMsg, c.deadline),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            Spacer(Modifier.height(14.dp))
            PrimaryGradientButton(
                text = t(S.consentGrant),
                onClick = {
                    onAnswer(true, c.checks.filter { ticked[it] ?: true }, photos)
                },
                modifier = Modifier.fillMaxWidth(),
                enabled = !busy && c.checks.any { ticked[it] ?: true },
            )
            Spacer(Modifier.height(8.dp))
            OutlinedButton(
                onClick = { onAnswer(false, emptyList(), false) },
                modifier = Modifier.fillMaxWidth(),
                enabled = !busy,
                shape = RoundedCornerShape(14.dp),
            ) {
                Text(t(S.campConsentDecline))
            }
            Spacer(Modifier.height(8.dp))
            Text(
                t(S.consentChangeMind),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

/** Back arrow, title and subtitle — the header every pathway screen shares. */
@Composable
fun ScreenHeader(title: String, subtitle: String, onBack: () -> Unit) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier.padding(vertical = 8.dp),
    ) {
        Box(
            Modifier
                .size(44.dp)
                .clip(RoundedCornerShape(12.dp))
                .clickable(onClick = onBack),
            contentAlignment = Alignment.Center,
        ) {
            Icon(Icons.AutoMirrored.Outlined.ArrowBack, contentDescription = null)
        }
        Spacer(Modifier.width(12.dp))
        Column {
            Text(title, style = MaterialTheme.typography.headlineLarge, fontWeight = FontWeight.Bold)
            if (subtitle.isNotBlank()) {
                Text(
                    subtitle,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}
