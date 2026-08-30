package com.rork.vitahero.ui.screens

import android.graphics.BitmapFactory
import android.util.Base64
import androidx.compose.foundation.Image
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
import androidx.compose.material.icons.outlined.HealthAndSafety
import androidx.compose.material.icons.outlined.PhotoCamera
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
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
import androidx.compose.ui.unit.dp
import com.rork.vitahero.data.FindingPhotoDto
import com.rork.vitahero.data.GuardianViewModel
import com.rork.vitahero.data.HealthFlag
import com.rork.vitahero.data.ReleasedFindingDto
import com.rork.vitahero.data.S
import com.rork.vitahero.ui.components.FlagChip
import com.rork.vitahero.ui.components.HeroCard
import com.rork.vitahero.ui.components.IconBubble
import com.rork.vitahero.ui.components.StatusBarSpacer
import com.rork.vitahero.ui.components.t
import com.rork.vitahero.ui.theme.HeroBlue
import com.rork.vitahero.ui.theme.HeroOrange

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

    LazyColumn(
        modifier = Modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.background),
        contentPadding = PaddingValues(start = 20.dp, end = 20.dp, bottom = 32.dp),
    ) {
        item {
            StatusBarSpacer()
            ScreenHeader(
                r?.kidName?.takeIf { it.isNotBlank() } ?: t(S.campResultTitle),
                listOf(r?.campTitle.orEmpty(), r?.date.orEmpty()).filter { it.isNotBlank() }.joinToString(" · "),
                onBack,
            )
            Spacer(Modifier.height(12.dp))
        }

        if (r == null) {
            item { Text(t(S.loadingLabel), color = MaterialTheme.colorScheme.onSurfaceVariant) }
            return@LazyColumn
        }

        if (r.status != "RELEASED") {
            item {
                HeroCard(Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(20.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                        IconBubble(Icons.Outlined.HealthAndSafety, HeroBlue)
                        Spacer(Modifier.height(12.dp))
                        Text(
                            t(S.resultUnderReview),
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.SemiBold,
                        )
                        Spacer(Modifier.height(6.dp))
                        Text(
                            r.message.ifBlank { t(S.resultUnderReviewSub) },
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }
            return@LazyColumn
        }

        // The doctor's own words come first. A parent who reads nothing else on
        // this screen should still read this.
        if (r.recommendation.isNotBlank()) {
            item {
                HeroCard(Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(18.dp)) {
                        Text(
                            t(S.doctorSays),
                            style = MaterialTheme.typography.labelLarge,
                            fontWeight = FontWeight.SemiBold,
                            color = if (r.urgency == "URGENT") HeroOrange else MaterialTheme.colorScheme.primary,
                        )
                        Spacer(Modifier.height(6.dp))
                        Text(r.recommendation, style = MaterialTheme.typography.bodyMedium)
                    }
                }
                Spacer(Modifier.height(14.dp))
            }
        }

        items(r.findings, key = { it.checkType }) { f ->
            FindingCard(f)
            Spacer(Modifier.height(10.dp))
        }

        if (photos.isNotEmpty()) {
            item {
                Spacer(Modifier.height(8.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        Icons.Outlined.PhotoCamera,
                        contentDescription = null,
                        tint = HeroOrange,
                        modifier = Modifier.size(20.dp),
                    )
                    Spacer(Modifier.width(8.dp))
                    Text(
                        t(S.photosTitle),
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold,
                    )
                }
                Spacer(Modifier.height(4.dp))
                Text(
                    t(S.photosSub),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(Modifier.height(10.dp))
            }
            items(photos, key = { it.id }) { p ->
                PhotoRow(p) { guardianViewModel.openPhoto(p.id) }
                Spacer(Modifier.height(8.dp))
            }
        }

        val image = openPhoto
        if (image != null) {
            item {
                Spacer(Modifier.height(12.dp))
                HeroCard(Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(14.dp)) {
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
                                    .clip(RoundedCornerShape(14.dp)),
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
                            Spacer(Modifier.height(8.dp))
                            Text(image.caption, style = MaterialTheme.typography.bodySmall)
                        }
                        Spacer(Modifier.height(10.dp))
                        OutlinedButton(
                            onClick = { guardianViewModel.closePhoto() },
                            shape = RoundedCornerShape(14.dp),
                        ) {
                            Text(t(S.closeLabel))
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun FindingCard(f: ReleasedFindingDto) {
    HeroCard(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp)) {
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(f.checkType, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                FlagChip(flagOf(f.flag))
            }
            if (f.summary.isNotBlank()) {
                Spacer(Modifier.height(6.dp))
                Text(f.summary, style = MaterialTheme.typography.bodyMedium)
            }
            if (f.note.isNotBlank()) {
                Spacer(Modifier.height(4.dp))
                Text(
                    f.note,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

@Composable
private fun PhotoRow(p: FindingPhotoDto, onOpen: () -> Unit) {
    HeroCard(Modifier.fillMaxWidth()) {
        Row(
            Modifier
                .fillMaxWidth()
                .clickable(onClick = onOpen)
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(Modifier.weight(1f)) {
                Text(p.checkType, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                if (p.caption.isNotBlank()) {
                    Text(
                        p.caption,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
            Text(t(S.viewLabel), style = MaterialTheme.typography.labelLarge, color = HeroBlue)
        }
    }
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
