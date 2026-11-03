package kallam.healthcare.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import kallam.healthcare.data.GuardianViewModel
import kallam.healthcare.data.ReferralDto
import kallam.healthcare.data.S
import kallam.healthcare.ui.components.AppCard
import kallam.healthcare.ui.components.AppScreenHeader
import kallam.healthcare.ui.components.IconBubble
import kallam.healthcare.ui.components.PrimaryGradientButton
import kallam.healthcare.ui.components.SecondaryButton
import kallam.healthcare.ui.components.StatusBarSpacer
import kallam.healthcare.ui.components.StatusPill
import kallam.healthcare.ui.components.Tone
import kallam.healthcare.ui.components.t
import kallam.healthcare.ui.components.tf
import kallam.healthcare.ui.theme.AppSpacing

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
    onFindDoctor: (specialty: String, kidName: String) -> Unit,
    onBack: () -> Unit,
) {
    val referrals by guardianViewModel.referrals.collectAsState()
    val busy by guardianViewModel.busy.collectAsState()

    LaunchedEffect(Unit) { guardianViewModel.loadReferrals() }

    Column(
        Modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.background)
    ) {
        StatusBarSpacer()
        AppScreenHeader(t(S.referralsTitle), subtitle = t(S.referralsSub), onBack = onBack)
        LazyColumn(
            modifier = Modifier.fillMaxWidth(),
            contentPadding = PaddingValues(start = AppSpacing.xl, end = AppSpacing.xl, top = AppSpacing.sm, bottom = AppSpacing.xxxl),
            verticalArrangement = Arrangement.spacedBy(AppSpacing.md),
        ) {
            if (referrals.isEmpty()) {
                item {
                    AppCard {
                        Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
                            IconBubble(Icons.Outlined.CheckCircle, MaterialTheme.colorScheme.secondary)
                            Spacer(Modifier.height(AppSpacing.md))
                            Text(
                                t(S.noReferrals),
                                style = MaterialTheme.typography.titleMedium,
                            )
                            Spacer(Modifier.height(AppSpacing.sm))
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
                    onFindDoctor = { onFindDoctor(r.specialty, r.kidName) },
                    onBooked = { guardianViewModel.markReferralBooked(r.id) },
                    onAttended = { guardianViewModel.markReferralAttended(r.id, "") },
                    onDecline = { guardianViewModel.declineReferral(r.id, "") },
                    busy = busy,
                )
            }
        }
    }
}

@Composable
private fun ReferralCard(
    r: ReferralDto,
    onFindDoctor: () -> Unit,
    onBooked: () -> Unit,
    onAttended: () -> Unit,
    onDecline: () -> Unit,
    busy: Boolean,
) {
    AppCard {
        Row(
            Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(Modifier.weight(1f)) {
                Text(r.kidName, style = MaterialTheme.typography.titleMedium,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    listOf(r.checkType, r.specialty).filter { it.isNotBlank() }.joinToString(" · "),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Spacer(Modifier.width(AppSpacing.sm))
            val (label, tone) = when (r.urgency.uppercase()) {
                "URGENT" -> t(S.urgencyUrgent) to Tone.Alert
                "SOON" -> t(S.urgencySoon) to Tone.Info
                else -> t(S.urgencyRoutine) to Tone.Neutral
            }
            StatusPill(label, tone)
        }

        if (r.reason.isNotBlank()) {
            Spacer(Modifier.height(AppSpacing.md))
            Text(r.reason, style = MaterialTheme.typography.bodyMedium)
        }
        if (r.dueBy.isNotBlank()) {
            Spacer(Modifier.height(AppSpacing.sm))
            Text(
                tf(S.referralDueBy, r.dueBy),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }

        Spacer(Modifier.height(AppSpacing.lg))
        when (r.status) {
            "OPEN" -> {
                // The first thing a parent needs is a doctor, not a
                // checkbox. This used to lead with "I have booked it",
                // which marks the referral handled without an appointment
                // existing anywhere — so the console showed a child as
                // dealt with while nothing had happened. Booking leads;
                // the self-report stays, because a parent may well have
                // arranged something on their own.
                PrimaryGradientButton(
                    text = t(S.referralFindDoctor),
                    enabled = !busy,
                    onClick = onFindDoctor,
                    modifier = Modifier.fillMaxWidth(),
                )
                Spacer(Modifier.height(AppSpacing.sm))
                SecondaryButton(
                    text = if (busy) t(S.pleaseWait) else t(S.referralBooked),
                    onClick = onBooked,
                    enabled = !busy,
                    modifier = Modifier.fillMaxWidth(),
                )
                Spacer(Modifier.height(AppSpacing.sm))
                SecondaryButton(
                    text = t(S.referralNotGoing),
                    onClick = onDecline,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
            "BOOKED" -> {
                PrimaryGradientButton(
                    text = if (busy) t(S.pleaseWait) else t(S.referralAttended),
                    enabled = !busy,
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
