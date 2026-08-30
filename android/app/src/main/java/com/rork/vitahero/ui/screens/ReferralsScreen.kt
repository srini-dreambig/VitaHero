package com.rork.vitahero.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.rork.vitahero.data.GuardianViewModel
import com.rork.vitahero.data.ReferralDto
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
 * What to do next, when a camp found something.
 *
 * A screening is only worth running if somebody follows it up, so this screen
 * is about one thing: did the child actually get seen. A parent marks a
 * referral booked, then attended, or says why they will not act on it — and
 * declining is a first-class answer, not a failure state, because the school
 * needs the truth more than it needs a good number.
 */
@Composable
fun ReferralsScreen(
    guardianViewModel: GuardianViewModel,
    onBack: () -> Unit,
) {
    val referrals by guardianViewModel.referrals.collectAsState()

    LaunchedEffect(Unit) { guardianViewModel.loadReferrals() }

    LazyColumn(
        modifier = Modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.background),
        contentPadding = PaddingValues(start = 20.dp, end = 20.dp, bottom = 32.dp),
    ) {
        item {
            StatusBarSpacer()
            ScreenHeader(t(S.referralsTitle), t(S.referralsSub), onBack)
            Spacer(Modifier.height(12.dp))
        }

        if (referrals.isEmpty()) {
            item {
                HeroCard(Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(20.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                        IconBubble(Icons.Outlined.CheckCircle, HeroBlue)
                        Spacer(Modifier.height(12.dp))
                        Text(
                            t(S.noReferrals),
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.SemiBold,
                        )
                        Spacer(Modifier.height(6.dp))
                        Text(
                            t(S.noReferralsSub),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }
        }

        items(referrals, key = { it.id }) { r ->
            ReferralCard(
                r,
                onBooked = { guardianViewModel.markReferralBooked(r.id) },
                onAttended = { guardianViewModel.markReferralAttended(r.id, "") },
                onDecline = { guardianViewModel.declineReferral(r.id, "") },
            )
            Spacer(Modifier.height(12.dp))
        }
    }
}

@Composable
private fun ReferralCard(
    r: ReferralDto,
    onBooked: () -> Unit,
    onAttended: () -> Unit,
    onDecline: () -> Unit,
) {
    HeroCard(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(18.dp)) {
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(Modifier.weight(1f)) {
                    Text(r.kidName, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Text(
                        listOf(r.checkType, r.specialty).filter { it.isNotBlank() }.joinToString(" · "),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                UrgencyBadge(r.urgency)
            }

            if (r.reason.isNotBlank()) {
                Spacer(Modifier.height(10.dp))
                Text(r.reason, style = MaterialTheme.typography.bodyMedium)
            }
            if (r.dueBy.isNotBlank()) {
                Spacer(Modifier.height(6.dp))
                Text(
                    tf(S.referralDueBy, r.dueBy),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            Spacer(Modifier.height(14.dp))
            when (r.status) {
                "OPEN" -> {
                    PrimaryGradientButton(
                        text = t(S.referralBooked),
                        onClick = onBooked,
                        modifier = Modifier.fillMaxWidth(),
                    )
                    Spacer(Modifier.height(8.dp))
                    OutlinedButton(
                        onClick = onDecline,
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(14.dp),
                    ) {
                        Text(t(S.referralNotGoing))
                    }
                }
                "BOOKED" -> {
                    PrimaryGradientButton(
                        text = t(S.referralAttended),
                        onClick = onAttended,
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
                else -> {
                    Text(
                        r.outcome.ifBlank { t(S.referralClosed) },
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
    }
}

@Composable
private fun UrgencyBadge(urgency: String) {
    val (label, tint) = when (urgency.uppercase()) {
        "URGENT" -> t(S.urgencyUrgent) to HeroOrange
        "SOON" -> t(S.urgencySoon) to HeroBlue
        else -> t(S.urgencyRoutine) to MaterialTheme.colorScheme.onSurfaceVariant
    }
    Box(
        Modifier
            .clip(RoundedCornerShape(50))
            .background(tint.copy(alpha = 0.15f))
            .padding(horizontal = 12.dp, vertical = 6.dp),
    ) {
        Text(
            label,
            style = MaterialTheme.typography.labelMedium,
            fontWeight = FontWeight.SemiBold,
            color = tint,
        )
    }
}
