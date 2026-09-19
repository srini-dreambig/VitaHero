package com.rork.vitahero.ui.screens

import androidx.compose.foundation.background
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
import androidx.compose.material.icons.outlined.DeleteOutline
import androidx.compose.material.icons.outlined.Download
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.rork.vitahero.data.GuardianViewModel
import com.rork.vitahero.data.Kid
import com.rork.vitahero.data.S
import com.rork.vitahero.ui.components.HeroCard
import com.rork.vitahero.ui.components.IconBubble
import com.rork.vitahero.ui.components.PrimaryGradientButton
import com.rork.vitahero.ui.components.StatusBarSpacer
import com.rork.vitahero.ui.components.t
import androidx.compose.ui.platform.LocalContext
import com.rork.vitahero.ui.theme.HeroBlue
import com.rork.vitahero.ui.theme.HeroOrange

/**
 * Your child's record, and what you can do about it.
 *
 * Two things a parent should be able to find without asking anyone: how to
 * withdraw from the school programme, and confirmation that their child's
 * health results are not something they can be charged for. Both are here, and
 * the second is read from the server's own entitlement response rather than
 * asserted by this screen, so it cannot quietly become untrue.
 */
@Composable
fun PrivacyScreen(
    kids: List<Kid>,
    guardianViewModel: GuardianViewModel,
    onBack: () -> Unit,
    onErased: (kidId: String) -> Unit = {},
) {
    val rights by guardianViewModel.dataRights.collectAsState()
    val entitlements by guardianViewModel.entitlements.collectAsState()
    val busy by guardianViewModel.busy.collectAsState()

    LaunchedEffect(Unit) { guardianViewModel.loadDataRights() }

    var withdrawing by rememberSaveable { mutableStateOf(false) }
    var reason by rememberSaveable { mutableStateOf("") }
    var erasing by remember { mutableStateOf<String?>(null) }
    var exportError by remember { mutableStateOf(false) }
    val context = LocalContext.current
    // Hoisted rather than written inline: the button takes a no-argument
    // lambda, and nesting the one-argument callback inside it reads as though
    // the button itself took a parameter.
    val startExport: () -> Unit = {
        guardianViewModel.exportMyData(context.cacheDir) { file ->
            exportError = file == null
            // The same chooser a health report uses, so the parent can save
            // it, mail it, or hand it to a doctor.
            if (file != null) shareJson(context, file)
        }
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.background),
        contentPadding = PaddingValues(start = 20.dp, end = 20.dp, bottom = 32.dp),
    ) {
        item {
            StatusBarSpacer()
            ScreenHeader(t(S.privacyTitle), t(S.privacySub), onBack)
            Spacer(Modifier.height(12.dp))
        }

        item {
            HeroCard(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(18.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            Icons.Outlined.CheckCircle,
                            contentDescription = null,
                            tint = HeroBlue,
                            modifier = Modifier.size(20.dp),
                        )
                        Spacer(Modifier.width(8.dp))
                        Text(
                            t(S.careIsFreeTitle),
                            style = MaterialTheme.typography.titleSmall,
                            fontWeight = FontWeight.SemiBold,
                        )
                    }
                    Spacer(Modifier.height(6.dp))
                    Text(
                        entitlements.notice.ifBlank { t(S.careIsFreeBody) },
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
            Spacer(Modifier.height(14.dp))
        }

        item {
            HeroCard(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(18.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        IconBubble(Icons.Outlined.Lock, HeroOrange)
                        Spacer(Modifier.width(12.dp))
                        Text(
                            t(S.withdrawTitle),
                            style = MaterialTheme.typography.titleSmall,
                            fontWeight = FontWeight.SemiBold,
                        )
                    }
                    Spacer(Modifier.height(8.dp))
                    Text(
                        t(S.withdrawBody),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Spacer(Modifier.height(12.dp))
                    if (!withdrawing) {
                        OutlinedButton(
                            onClick = { withdrawing = true },
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(14.dp),
                        ) {
                            Text(t(S.withdrawAction))
                        }
                    } else {
                        OutlinedTextField(
                            value = reason,
                            onValueChange = { reason = it.take(500) },
                            modifier = Modifier.fillMaxWidth(),
                            placeholder = { Text(t(S.withdrawReasonHint)) },
                            minLines = 2,
                            shape = RoundedCornerShape(14.dp),
                            colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = HeroOrange),
                        )
                        Spacer(Modifier.height(8.dp))
                        Row {
                            OutlinedButton(
                                onClick = {
                                    guardianViewModel.withdrawConsent(reason.trim()) {
                                        withdrawing = false
                                        reason = ""
                                    }
                                },
                                enabled = !busy,
                                shape = RoundedCornerShape(14.dp),
                            ) {
                                Text(t(S.withdrawConfirm))
                            }
                            Spacer(Modifier.width(8.dp))
                            OutlinedButton(
                                onClick = { withdrawing = false },
                                shape = RoundedCornerShape(14.dp),
                            ) {
                                Text(t(S.cancelLabel))
                            }
                        }
                    }
                }
            }
            Spacer(Modifier.height(14.dp))
        }

        // Erasure. It lives here rather than beside a child's health data,
        // because deleting a medical record is a right a parent exercises
        // deliberately, not a tidy-up button next to their test results.
        if (kids.isNotEmpty()) {
            item {
                HeroCard(Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(18.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            IconBubble(Icons.Outlined.DeleteOutline, MaterialTheme.colorScheme.error)
                            Spacer(Modifier.width(12.dp))
                            Text(
                                t(S.eraseTitle),
                                style = MaterialTheme.typography.titleSmall,
                                fontWeight = FontWeight.SemiBold,
                            )
                        }
                        Spacer(Modifier.height(8.dp))
                        Text(
                            t(S.eraseBody),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Spacer(Modifier.height(12.dp))
                        kids.forEach { kid ->
                            val confirming = erasing == kid.id
                            Row(
                                Modifier.fillMaxWidth().padding(vertical = 4.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Text(
                                    kid.name,
                                    style = MaterialTheme.typography.bodyMedium,
                                    modifier = Modifier.weight(1f),
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis,
                                )
                                if (!confirming) {
                                    OutlinedButton(
                                        onClick = { erasing = kid.id },
                                        shape = RoundedCornerShape(12.dp),
                                    ) {
                                        Text(t(S.eraseAction))
                                    }
                                } else {
                                    OutlinedButton(
                                        onClick = {
                                            guardianViewModel.eraseChild(kid.id) {
                                                onErased(kid.id)
                                                erasing = null
                                            }
                                        },
                                        enabled = !busy,
                                        shape = RoundedCornerShape(12.dp),
                                    ) {
                                        Text(
                                            t(S.eraseConfirm),
                                            color = MaterialTheme.colorScheme.error,
                                        )
                                    }
                                    Spacer(Modifier.width(6.dp))
                                    OutlinedButton(
                                        onClick = { erasing = null },
                                        shape = RoundedCornerShape(12.dp),
                                    ) {
                                        Text(t(S.cancelLabel))
                                    }
                                }
                            }
                        }
                    }
                }
                Spacer(Modifier.height(14.dp))
            }
        }

        // The access right itself.
        //
        // /api/me/export has been served since data rights were built, and the
        // only thing this screen offered was the *history* of rights actions —
        // a parent could see that they had withdrawn consent, and could not
        // get the record the withdrawal was about.
        item {
            HeroCard(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(16.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        IconBubble(Icons.Outlined.Download, HeroBlue)
                        Spacer(Modifier.width(12.dp))
                        Text(
                            t(S.exportTitle),
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.SemiBold,
                        )
                    }
                    Spacer(Modifier.height(10.dp))
                    Text(
                        t(S.exportSub),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Spacer(Modifier.height(14.dp))
                    PrimaryGradientButton(
                        text = if (busy) t(S.pleaseWait) else t(S.exportAction),
                        enabled = !busy,
                        onClick = startExport,
                    )
                    if (exportError) {
                        Spacer(Modifier.height(10.dp))
                        Text(
                            t(S.exportFailed),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.error,
                        )
                    }
                }
            }
            Spacer(Modifier.height(14.dp))
        }

        if (rights.isNotEmpty()) {
            item {
                Text(
                    t(S.rightsHistoryTitle),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                )
                Spacer(Modifier.height(4.dp))
                Text(
                    t(S.rightsHistorySub),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(Modifier.height(8.dp))
            }
            items(rights, key = { it.action + it.at }) { entry ->
                HeroCard(Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(14.dp)) {
                        Text(
                            entry.action.replace('_', ' ').lowercase()
                                .replaceFirstChar { it.uppercase() },
                            style = MaterialTheme.typography.titleSmall,
                            fontWeight = FontWeight.SemiBold,
                        )
                        if (entry.detail.isNotBlank()) {
                            Text(
                                entry.detail,
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                }
                Spacer(Modifier.height(8.dp))
            }
        }
    }
}


/**
 * Hand the export to whatever the parent wants to do with it.
 *
 * The same FileProvider the health report uses — a data export that can only
 * be looked at inside the app is not an export.
 */
private fun shareJson(context: android.content.Context, file: java.io.File) {
    val uri = androidx.core.content.FileProvider.getUriForFile(
        context, "${'$'}{context.packageName}.fileprovider", file
    )
    val intent = android.content.Intent(android.content.Intent.ACTION_SEND).apply {
        type = "application/json"
        putExtra(android.content.Intent.EXTRA_STREAM, uri)
        putExtra(android.content.Intent.EXTRA_SUBJECT, "VitaHero \u2014 my family's data")
        addFlags(android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION)
    }
    context.startActivity(android.content.Intent.createChooser(intent, "Save or send"))
}
