package kallam.healthcare.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
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
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.DeleteOutline
import androidx.compose.material.icons.outlined.Download
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
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
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import kallam.healthcare.data.GuardianViewModel
import kallam.healthcare.data.Kid
import kallam.healthcare.data.S
import kallam.healthcare.ui.components.AppCard
import kallam.healthcare.ui.components.AppListRow
import kallam.healthcare.ui.components.AppScreenHeader
import kallam.healthcare.ui.components.AppSectionTitle
import kallam.healthcare.ui.components.AppTextButton
import kallam.healthcare.ui.components.AppTextField
import kallam.healthcare.ui.components.IconBubble
import kallam.healthcare.ui.components.PrimaryGradientButton
import kallam.healthcare.ui.components.SecondaryButton
import kallam.healthcare.ui.components.StatusBarSpacer
import kallam.healthcare.ui.components.Tone
import kallam.healthcare.ui.components.t
import androidx.compose.ui.platform.LocalContext
import kallam.healthcare.ui.theme.AppSpacing

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

    Column(
        Modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.background)
    ) {
        StatusBarSpacer()
        AppScreenHeader(t(S.privacyTitle), subtitle = t(S.privacySub), onBack = onBack)
        LazyColumn(
            modifier = Modifier.fillMaxWidth(),
            contentPadding = PaddingValues(start = AppSpacing.xl, end = AppSpacing.xl, top = AppSpacing.sm, bottom = AppSpacing.xxxl),
            verticalArrangement = Arrangement.spacedBy(AppSpacing.md),
        ) {
            item {
                AppCard {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            Icons.Outlined.CheckCircle,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.secondary,
                            modifier = Modifier.size(20.dp),
                        )
                        Spacer(Modifier.width(AppSpacing.sm))
                        Text(
                            t(S.careIsFreeTitle),
                            style = MaterialTheme.typography.titleMedium,
                        )
                    }
                    Spacer(Modifier.height(AppSpacing.sm))
                    Text(
                        entitlements.notice.ifBlank { t(S.careIsFreeBody) },
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }

            item {
                AppCard {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        IconBubble(Icons.Outlined.Lock, MaterialTheme.colorScheme.primary)
                        Spacer(Modifier.width(AppSpacing.md))
                        Text(
                            t(S.withdrawTitle),
                            style = MaterialTheme.typography.titleMedium,
                        )
                    }
                    Spacer(Modifier.height(AppSpacing.sm))
                    Text(
                        t(S.withdrawBody),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Spacer(Modifier.height(AppSpacing.md))
                    if (!withdrawing) {
                        SecondaryButton(
                            text = t(S.withdrawAction),
                            onClick = { withdrawing = true },
                            modifier = Modifier.fillMaxWidth(),
                        )
                    } else {
                        AppTextField(
                            value = reason,
                            onValueChange = { reason = it.take(500) },
                            modifier = Modifier.fillMaxWidth(),
                            placeholder = t(S.withdrawReasonHint),
                            singleLine = false,
                            minLines = 2,
                        )
                        Spacer(Modifier.height(AppSpacing.sm))
                        Row(horizontalArrangement = Arrangement.spacedBy(AppSpacing.sm)) {
                            SecondaryButton(
                                text = t(S.withdrawConfirm),
                                onClick = {
                                    guardianViewModel.withdrawConsent(reason.trim()) {
                                        withdrawing = false
                                        reason = ""
                                    }
                                },
                                enabled = !busy,
                                modifier = Modifier.weight(1f),
                            )
                            SecondaryButton(
                                text = t(S.cancelLabel),
                                onClick = { withdrawing = false },
                                modifier = Modifier.weight(1f),
                            )
                        }
                    }
                }
            }

            // Erasure. It lives here rather than beside a child's health data,
            // because deleting a medical record is a right a parent exercises
            // deliberately, not a tidy-up button next to their test results.
            if (kids.isNotEmpty()) {
                item {
                    AppCard {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            IconBubble(Icons.Outlined.DeleteOutline, MaterialTheme.colorScheme.error)
                            Spacer(Modifier.width(AppSpacing.md))
                            Text(
                                t(S.eraseTitle),
                                style = MaterialTheme.typography.titleMedium,
                            )
                        }
                        Spacer(Modifier.height(AppSpacing.sm))
                        Text(
                            t(S.eraseBody),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Spacer(Modifier.height(AppSpacing.md))
                        kids.forEach { kid ->
                            val confirming = erasing == kid.id
                            Row(
                                Modifier.fillMaxWidth().padding(vertical = AppSpacing.xs),
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
                                    SecondaryButton(
                                        text = t(S.eraseAction),
                                        onClick = { erasing = kid.id },
                                    )
                                } else {
                                    // A text action in the alert tone: the
                                    // outlined button has no destructive colour,
                                    // and the confirm must read as the dangerous one.
                                    AppTextButton(
                                        text = t(S.eraseConfirm),
                                        onClick = {
                                            guardianViewModel.eraseChild(kid.id) {
                                                onErased(kid.id)
                                                erasing = null
                                            }
                                        },
                                        enabled = !busy,
                                        tone = Tone.Alert,
                                    )
                                    Spacer(Modifier.width(AppSpacing.sm))
                                    SecondaryButton(
                                        text = t(S.cancelLabel),
                                        onClick = { erasing = null },
                                    )
                                }
                            }
                        }
                    }
                }
            }

            // The access right itself.
            //
            // /api/me/export has been served since data rights were built, and the
            // only thing this screen offered was the *history* of rights actions —
            // a parent could see that they had withdrawn consent, and could not
            // get the record the withdrawal was about.
            item {
                AppCard {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        IconBubble(Icons.Outlined.Download, MaterialTheme.colorScheme.secondary)
                        Spacer(Modifier.width(AppSpacing.md))
                        Text(
                            t(S.exportTitle),
                            style = MaterialTheme.typography.titleMedium,
                        )
                    }
                    Spacer(Modifier.height(AppSpacing.sm))
                    Text(
                        t(S.exportSub),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Spacer(Modifier.height(AppSpacing.md))
                    PrimaryGradientButton(
                        text = if (busy) t(S.pleaseWait) else t(S.exportAction),
                        enabled = !busy,
                        onClick = startExport,
                    )
                    if (exportError) {
                        Spacer(Modifier.height(AppSpacing.sm))
                        Text(
                            t(S.exportFailed),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.error,
                        )
                    }
                }
            }

            if (rights.isNotEmpty()) {
                item {
                    AppSectionTitle(
                        t(S.rightsHistoryTitle),
                        Modifier.padding(top = AppSpacing.md),
                        subtitle = t(S.rightsHistorySub),
                    )
                }
                items(rights, key = { it.action + it.at }) { entry ->
                    AppListRow(
                        title = entry.action.replace('_', ' ').lowercase()
                            .replaceFirstChar { it.uppercase() },
                        supporting = entry.detail.ifBlank { null },
                    )
                }
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
