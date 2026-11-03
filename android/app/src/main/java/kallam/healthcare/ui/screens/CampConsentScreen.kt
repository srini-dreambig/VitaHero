package kallam.healthcare.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.PhotoCamera
import androidx.compose.material3.Checkbox
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
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
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import kallam.healthcare.data.GuardianViewModel
import kallam.healthcare.data.PendingConsentDto
import kallam.healthcare.data.S
import kallam.healthcare.ui.components.AppCard
import kallam.healthcare.ui.components.AppScreenHeader
import kallam.healthcare.ui.components.IconBubble
import kallam.healthcare.ui.components.PrimaryGradientButton
import kallam.healthcare.ui.components.SecondaryButton
import kallam.healthcare.ui.components.StatusBarSpacer
import kallam.healthcare.ui.components.t
import kallam.healthcare.ui.components.tf
import kallam.healthcare.ui.theme.AppCorners
import kallam.healthcare.ui.theme.AppSpacing

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
    // The header pads itself, so the list has no horizontal contentPadding;
    // every other item carries the screen margin instead.
    val margin = Modifier.padding(horizontal = AppSpacing.xl)

    LaunchedEffect(Unit) { guardianViewModel.loadPendingConsents() }

    LazyColumn(
        modifier = Modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.background),
        contentPadding = PaddingValues(bottom = AppSpacing.xxxl),
    ) {
        item {
            StatusBarSpacer()
            ScreenHeader(t(S.campConsentTitle), t(S.campConsentSub), onBack)
            Spacer(Modifier.height(AppSpacing.sm))
        }

        if (pending.isEmpty()) {
            item {
                AppCard(margin, contentPadding = PaddingValues(AppSpacing.xxl)) {
                    Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
                        IconBubble(Icons.Outlined.CheckCircle, MaterialTheme.colorScheme.secondary)
                        Spacer(Modifier.height(AppSpacing.md))
                        Text(
                            t(S.noConsentPending),
                            style = MaterialTheme.typography.titleMedium,
                            textAlign = TextAlign.Center,
                        )
                        Spacer(Modifier.height(AppSpacing.xs))
                        Text(
                            t(S.noConsentPendingSub),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            textAlign = TextAlign.Center,
                        )
                    }
                }
            }
        }

        items(pending, key = { it.campId + "/" + it.kidId }) { c ->
            ConsentRequestCard(c, busy, margin) { granted, checks, photos ->
                guardianViewModel.answerConsent(c.campId, c.kidId, granted, checks, photos)
            }
            Spacer(Modifier.height(AppSpacing.md))
        }
    }
}

@Composable
private fun ConsentRequestCard(
    c: PendingConsentDto,
    busy: Boolean,
    modifier: Modifier = Modifier,
    onAnswer: (granted: Boolean, checks: List<String>, photos: Boolean) -> Unit,
) {
    // Every check starts ticked, because that is what the school asked for and
    // what most guardians will agree to. Unticking is the deliberate act.
    val ticked = remember(c.campId, c.kidId) {
        mutableStateMapOf<String, Boolean>().apply { c.checks.forEach { put(it, true) } }
    }
    // Photography starts unticked. Silence is not consent.
    var photos by remember(c.campId, c.kidId) { mutableStateOf(false) }

    AppCard(modifier) {
        Text(c.kidName, style = MaterialTheme.typography.titleMedium,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
        Spacer(Modifier.height(AppSpacing.xxs))
        Text(
            listOf(c.schoolName, c.title).filter { it.isNotBlank() }.joinToString(" · "),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        if (c.date.isNotBlank()) {
            Spacer(Modifier.height(AppSpacing.xxs))
            Text(
                listOf(c.date, c.time, c.venue).filter { it.isNotBlank() }.joinToString(" · "),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }

        Spacer(Modifier.height(AppSpacing.md))
        Text(
            t(S.consentChecksTitle),
            style = MaterialTheme.typography.titleMedium,
        )
        Spacer(Modifier.height(AppSpacing.xs))
        Text(
            t(S.consentChecksHint),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(Modifier.height(AppSpacing.xs))
        c.checks.forEach { check ->
            Row(
                Modifier
                    .fillMaxWidth()
                    .clickable { ticked[check] = !(ticked[check] ?: true) }
                    .padding(vertical = AppSpacing.xxs),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Checkbox(
                    checked = ticked[check] ?: true,
                    onCheckedChange = { ticked[check] = it },
                )
                Spacer(Modifier.width(AppSpacing.xs))
                Text(check, style = MaterialTheme.typography.bodyMedium)
            }
        }

        // Only where the camp actually asked. When photosAsked is false the
        // question is not shown at all, rather than shown and defaulted.
        if (c.photosAsked) {
            val brand = MaterialTheme.colorScheme.primary
            Spacer(Modifier.height(AppSpacing.md))
            Column(
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(AppCorners.medium))
                    .background(brand.copy(alpha = 0.10f))
                    .padding(AppSpacing.md),
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        Icons.Outlined.PhotoCamera,
                        contentDescription = null,
                        tint = brand,
                        modifier = Modifier.size(20.dp),
                    )
                    Spacer(Modifier.width(AppSpacing.sm))
                    Text(
                        t(S.photoConsentTitle),
                        style = MaterialTheme.typography.titleMedium,
                    )
                }
                Spacer(Modifier.height(AppSpacing.xs))
                Text(
                    t(S.photoConsentBody),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(Modifier.height(AppSpacing.xs))
                Row(
                    Modifier
                        .fillMaxWidth()
                        .clickable { photos = !photos },
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Checkbox(checked = photos, onCheckedChange = { photos = it })
                    Spacer(Modifier.width(AppSpacing.xs))
                    Text(t(S.photoConsentAgree), style = MaterialTheme.typography.bodyMedium)
                }
            }
        }

        if (c.deadline.isNotBlank()) {
            Spacer(Modifier.height(AppSpacing.md))
            Text(
                tf(S.consentDeadlineMsg, c.deadline),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }

        Spacer(Modifier.height(AppSpacing.md))
        PrimaryGradientButton(
            text = t(S.consentGrant),
            onClick = {
                onAnswer(true, c.checks.filter { ticked[it] ?: true }, photos)
            },
            modifier = Modifier.fillMaxWidth(),
            enabled = !busy && c.checks.any { ticked[it] ?: true },
        )
        Spacer(Modifier.height(AppSpacing.sm))
        SecondaryButton(
            text = t(S.campConsentDecline),
            onClick = { onAnswer(false, emptyList(), false) },
            modifier = Modifier.fillMaxWidth(),
            enabled = !busy,
        )
        Spacer(Modifier.height(AppSpacing.sm))
        Text(
            t(S.consentChangeMind),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

/** Back arrow, title and subtitle: the kit's [AppScreenHeader], kept under its old name. */
@Composable
fun ScreenHeader(title: String, subtitle: String, onBack: () -> Unit) =
    AppScreenHeader(title, subtitle = subtitle, onBack = onBack)
