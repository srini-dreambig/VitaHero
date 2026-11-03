package kallam.healthcare.ui.screens

import android.graphics.BitmapFactory
import android.util.Base64
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.HealthAndSafety
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import kallam.healthcare.data.FindingPhotoDto
import kallam.healthcare.data.GuardianViewModel
import kallam.healthcare.data.HealthFlag
import kallam.healthcare.data.ReleasedFindingDto
import kallam.healthcare.data.ResultChildDto
import kallam.healthcare.data.S
import kallam.healthcare.ui.components.PrescriptionTables
import kallam.healthcare.data.WhoBmi
import kallam.healthcare.ui.components.AppCard
import kallam.healthcare.ui.components.AppListRow
import kallam.healthcare.ui.components.AppScreenHeader
import kallam.healthcare.ui.components.AppSectionTitle
import kallam.healthcare.ui.components.GrowthChartsPanel
import kallam.healthcare.ui.components.FlagChip
import kallam.healthcare.ui.components.IconBubble
import kallam.healthcare.ui.components.InfoNote
import kallam.healthcare.ui.components.SecondaryButton
import kallam.healthcare.ui.components.StatusBarSpacer
import kallam.healthcare.ui.components.StatusPill
import kallam.healthcare.ui.components.Tone
import kallam.healthcare.ui.components.color
import kallam.healthcare.ui.components.t
import kallam.healthcare.ui.theme.AppCorners
import kallam.healthcare.ui.theme.AppSpacing

/**
 * What the camp found, once a doctor has approved it.
 *
 * Nothing here is derived on the device. Every flag, and the recommendation
 * under it, is what a physician approved for this child — the app renders it
 * and does not second-guess it. While a result is still under review the screen
 * says so rather than showing an empty page or a stale value.
 */
@Composable
fun CampResultScreen(
    campId: String,
    kidId: String,
    guardianViewModel: GuardianViewModel,
    onBack: () -> Unit,
) {
    val result by guardianViewModel.result.collectAsState()
    val photos by guardianViewModel.photos.collectAsState()
    val openPhoto by guardianViewModel.openPhoto.collectAsState()

    LaunchedEffect(campId, kidId) { guardianViewModel.loadResult(campId, kidId) }

    val r = result
    // The header pads itself, so the list has no horizontal contentPadding;
    // every other item carries the screen margin instead.
    val margin = Modifier.padding(horizontal = AppSpacing.xl)

    LazyColumn(
        modifier = Modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.background),
        contentPadding = PaddingValues(bottom = AppSpacing.xxxl),
    ) {
        item {
            StatusBarSpacer()
            AppScreenHeader(
                title = r?.kidName?.takeIf { it.isNotBlank() } ?: t(S.campResultTitle),
                subtitle = listOf(r?.campTitle.orEmpty(), r?.date.orEmpty()).filter { it.isNotBlank() }.joinToString(" · "),
                onBack = onBack,
            )
            Spacer(Modifier.height(AppSpacing.sm))
        }

        if (r == null) {
            item { Text(t(S.loadingLabel), color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = margin) }
            return@LazyColumn
        }

        if (r.status != "RELEASED") {
            item {
                AppCard(margin, contentPadding = PaddingValues(AppSpacing.xl)) {
                    Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
                        IconBubble(Icons.Outlined.HealthAndSafety, MaterialTheme.colorScheme.secondary)
                        Spacer(Modifier.height(AppSpacing.md))
                        // The stage, when the server says it: "a doctor is still
                        // checking this" was wrong for a child still in the queue.
                        Text(
                            when {
                                r.status == "NOT_SCREENED" -> t(S.resultNotScreened)
                                r.progress?.stage == "SCREENING" -> t(S.progressScreening)
                                r.progress?.stage == "WAITING" -> t(S.progressWaiting)
                                r.progress?.stage == "CONSENT_NEEDED" -> t(S.progressConsentNeeded)
                                r.progress?.stage == "DECLINED" -> t(S.progressDeclined)
                                else -> t(S.resultUnderReview)
                            },
                            style = MaterialTheme.typography.titleMedium,
                            textAlign = TextAlign.Center,
                        )
                        Spacer(Modifier.height(AppSpacing.xs))
                        Text(
                            r.message.ifBlank { t(S.resultUnderReviewSub) },
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            textAlign = TextAlign.Center,
                        )
                    }
                }
            }
            // Which checks are done so far. Never what they found.
            val checks = r.progress?.checks.orEmpty()
            if (checks.isNotEmpty()) {
                item {
                    Spacer(Modifier.height(AppSpacing.md))
                    AppCard(margin) {
                        Text(t(S.campProgressTitle), style = MaterialTheme.typography.titleMedium)
                        checks.forEach { c ->
                            Spacer(Modifier.height(AppSpacing.sm))
                            CheckStateRow(
                                c.checkType,
                                when (c.state) {
                                    "DONE" -> "✓ " + t(S.checkStateDone)
                                    "NOT_DONE" -> t(S.checkStateNotDone)
                                    "NOT_CONSENTED" -> t(S.checkStateNotIncluded)
                                    else -> t(S.checkStatePending)
                                },
                                when (c.state) {
                                    "DONE" -> Tone.Good
                                    "PENDING" -> Tone.Watch
                                    else -> Tone.Neutral
                                },
                            )
                        }
                    }
                }
            }
            return@LazyColumn
        }

        // Some checks are in, others still to come: say which, above the ones
        // that are, so a parent does not read the list as the whole check-up.
        if (r.partial) {
            item {
                AppCard(margin) {
                    Text(r.message, style = MaterialTheme.typography.titleMedium)
                    r.pendingChecks.forEach { c ->
                        Spacer(Modifier.height(AppSpacing.sm))
                        CheckStateRow(c, t(S.checkStatePending), Tone.Watch)
                    }
                }
                Spacer(Modifier.height(AppSpacing.md))
            }
        }

        // The doctor's own words come first. A parent who reads nothing else on
        // this screen should still read this.
        if (r.recommendation.isNotBlank()) {
            item {
                AppCard(margin) {
                    Text(
                        t(S.doctorSays),
                        style = MaterialTheme.typography.titleMedium,
                        color = if (r.urgency == "URGENT") Tone.Watch.color() else MaterialTheme.colorScheme.primary,
                    )
                    Spacer(Modifier.height(AppSpacing.xs))
                    Text(r.recommendation, style = MaterialTheme.typography.bodyMedium)
                }
                Spacer(Modifier.height(AppSpacing.md))
            }
        }

        // A camp screens; it does not diagnose. Whenever something was flagged
        // the family is told who confirms it, whatever the doctor wrote above.
        if (r.findings.any { it.flag == "WATCH" || it.flag == "ALERT" }) {
            item {
                InfoNote(t(S.consultPaediatrician), margin, tone = Tone.Watch, icon = Icons.Outlined.HealthAndSafety)
                Spacer(Modifier.height(AppSpacing.md))
            }
        }

        items(r.findings, key = { it.checkType }) { f ->
            FindingCard(f, r.child, margin)
            Spacer(Modifier.height(AppSpacing.md))
        }

        if (photos.isNotEmpty()) {
            item {
                Spacer(Modifier.height(AppSpacing.md))
                AppSectionTitle(t(S.photosTitle), margin, subtitle = t(S.photosSub))
                Spacer(Modifier.height(AppSpacing.md))
            }
            items(photos, key = { it.id }) { p ->
                PhotoRow(p, margin) { guardianViewModel.openPhoto(p.id) }
                Spacer(Modifier.height(AppSpacing.sm))
            }
        }

        val image = openPhoto
        if (image != null) {
            item {
                Spacer(Modifier.height(AppSpacing.md))
                AppCard(margin) {
                    // Decoded here rather than fetched as a URL, because the
                    // image is only ever served to this guardian behind their
                    // session and every fetch of it is recorded.
                    val bitmap = remember(image.id, image.base64) {
                        runCatching {
                            val bytes = Base64.decode(image.base64, Base64.DEFAULT)
                            BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
                        }.getOrNull()
                    }
                    if (bitmap != null) {
                        Image(
                            bitmap = bitmap.asImageBitmap(),
                            contentDescription = image.caption.ifBlank { image.checkType },
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(AppCorners.medium)),
                            contentScale = ContentScale.FillWidth,
                        )
                    } else {
                        Text(
                            t(S.photoUnavailable),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                    if (image.caption.isNotBlank()) {
                        Spacer(Modifier.height(AppSpacing.sm))
                        Text(image.caption, style = MaterialTheme.typography.bodySmall)
                    }
                    Spacer(Modifier.height(AppSpacing.md))
                    SecondaryButton(t(S.closeLabel), { guardianViewModel.closePhoto() })
                }
            }
        }
    }
}

/** One check's name and its state as a pill, as on the camp's progress card. */
@Composable
private fun CheckStateRow(name: String, state: String, tone: Tone) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Text(name, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.weight(1f))
        Spacer(Modifier.width(AppSpacing.sm))
        StatusPill(state, tone)
    }
}

@Composable
private fun FindingCard(f: ReleasedFindingDto, child: ResultChildDto?, modifier: Modifier = Modifier) {
    val sheet = f.sheet
    AppCard(modifier) {
        Row(
            Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                sheet?.title?.ifBlank { null } ?: f.checkType,
                style = MaterialTheme.typography.titleMedium,
                modifier = Modifier.weight(1f),
            )
            Spacer(Modifier.width(AppSpacing.sm))
            FlagChip(flagOf(f.flag))
        }
        if (sheet != null && sheet.rows.isNotEmpty()) {
            // The assessment sheet, a row per column, as the doctor filled it.
            Spacer(Modifier.height(AppSpacing.sm))
            sheet.listedRows.forEach { row ->
                Row(Modifier.fillMaxWidth().padding(vertical = AppSpacing.xxs)) {
                    Text(
                        row.label,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.weight(0.42f),
                    )
                    // A value inside the sheet, set apart from its label.
                    Text(
                        row.value,
                        style = MaterialTheme.typography.bodySmall,
                        fontWeight = FontWeight.Medium,
                        modifier = Modifier.weight(0.58f),
                    )
                }
            }
            if (sheet.rx.isNotEmpty()) PrescriptionTables(sheet.rx, Modifier.fillMaxWidth())
            // The growth charts, IAP and WHO, with the child on them.
            val g = sheet.growth
            val who = if (g != null && child != null) {
                WhoBmi.forChild(g.heightCm, g.weightKg, child.gender, child.dob, child.age)
            } else null
            if (who != null) {
                Spacer(Modifier.height(AppSpacing.md))
                GrowthChartsPanel(who, g?.muacCm, Modifier.fillMaxWidth())
            }
        }
        if (f.summary.isNotBlank()) {
            Spacer(Modifier.height(AppSpacing.sm))
            Text(f.summary, style = MaterialTheme.typography.bodyMedium)
        }
        if (f.note.isNotBlank()) {
            Spacer(Modifier.height(AppSpacing.xs))
            Text(
                f.note,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

@Composable
private fun PhotoRow(p: FindingPhotoDto, modifier: Modifier = Modifier, onOpen: () -> Unit) {
    AppListRow(
        title = p.checkType,
        modifier = modifier,
        supporting = p.caption.ifBlank { null },
        trailing = { StatusPill(t(S.viewLabel), Tone.Info) },
        onClick = onOpen,
    )
}

/**
 * A flag from the server, or NOT_MEASURED when it is anything we do not
 * recognise. Never GOOD by default: an unknown value must not be shown to a
 * parent as a clean result.
 */
private fun flagOf(raw: String): HealthFlag = when (raw.uppercase()) {
    "GOOD" -> HealthFlag.GOOD
    "WATCH" -> HealthFlag.WATCH
    "ALERT" -> HealthFlag.ALERT
    else -> HealthFlag.NOT_MEASURED
}
