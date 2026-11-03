package kallam.healthcare.ui.screens

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.widget.Toast
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.ContentCopy
import androidx.compose.material.icons.outlined.GroupAdd
import androidx.compose.material.icons.outlined.Groups
import androidx.compose.material.icons.outlined.PersonAdd
import androidx.compose.material.icons.outlined.Share
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import kallam.healthcare.data.CoParent
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
import kallam.healthcare.ui.theme.AppCorners
import kallam.healthcare.ui.theme.AppSpacing
import kallam.healthcare.ui.theme.HeroPurple


@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FamilySharingScreen(
    familyCode: String,
    coParents: List<CoParent>,
    onBack: () -> Unit,
    onJoinFamily: (String) -> Unit,
    /** True while a family-sharing write is with the server. */
    busy: Boolean = false,
    onGenerateCode: () -> Unit,
    onShareCode: () -> Unit,
    /**
     * The owner's answer to a request to join (true approves). Pending rows
     * reach only the family's owner, and the server checks it again.
     */
    onAnswerRequest: (coParentId: String, approve: Boolean) -> Unit = { _, _ -> },
) {
    val context = LocalContext.current
    var joinCode by rememberSaveable { mutableStateOf("") }
    var showJoin by rememberSaveable { mutableStateOf(false) }

    Column(
        Modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.background)
    ) {
        StatusBarSpacer()
        AppScreenHeader(t(S.familyTitle), subtitle = t(S.familySubtitle), onBack = onBack)
        LazyColumn(
            modifier = Modifier.fillMaxWidth(),
            contentPadding = PaddingValues(start = AppSpacing.xl, end = AppSpacing.xl, top = AppSpacing.sm, bottom = AppSpacing.xxxl)
        ) {
            // Your family code card
            item {
                Box(
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(AppCorners.xlarge))
                        .background(MaterialTheme.colorScheme.secondaryContainer)
                        .padding(AppSpacing.xxl)
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        IconBubble(Icons.Outlined.Groups, MaterialTheme.colorScheme.onSurface, size = 56.dp, bg = MaterialTheme.colorScheme.surface)
                        Spacer(Modifier.height(AppSpacing.md))
                        Text(t(S.yourFamilyCode), color = MaterialTheme.colorScheme.onSurface, style = MaterialTheme.typography.titleMedium)
                        Spacer(Modifier.height(AppSpacing.sm))
                        if (familyCode.isBlank()) {
                            Text(
                                t(S.noFamilyCodeYet),
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                style = MaterialTheme.typography.bodyMedium
                            )
                            Spacer(Modifier.height(AppSpacing.md))
                            PrimaryGradientButton(
                                text = if (busy) t(S.pleaseWait) else t(S.generateFamilyCode),
                                enabled = !busy,
                                onClick = onGenerateCode,
                                modifier = Modifier.fillMaxWidth()
                            )
                        } else {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(
                                    familyCode,
                                    color = MaterialTheme.colorScheme.onSurface,
                                    style = MaterialTheme.typography.displayMedium,
                                )
                                Spacer(Modifier.width(AppSpacing.md))
                                IconButton(
                                    onClick = {
                                        val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                                        clipboard.setPrimaryClip(ClipData.newPlainText("familyCode", familyCode))
                                        Toast.makeText(context, "Family code copied!", Toast.LENGTH_SHORT).show()
                                    }
                                ) {
                                    Icon(Icons.Outlined.ContentCopy, contentDescription = "Copy code", tint = MaterialTheme.colorScheme.onSurfaceVariant)
                                }
                            }
                            Spacer(Modifier.height(AppSpacing.md))
                            Text(
                                t(S.shareYourCode),
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                style = MaterialTheme.typography.bodySmall
                            )
                            Spacer(Modifier.height(AppSpacing.lg))
                            // White pill on the blue block: kit buttons are drawn for
                            // the page background, not for a tinted fill.
                            Box(
                                Modifier
                                    .clip(RoundedCornerShape(50))
                                    .background(Color.White)
                                    .clickable {
                                        val intent = Intent(Intent.ACTION_SEND).apply {
                                            type = "text/plain"
                                            putExtra(Intent.EXTRA_TEXT, "Join me on VitaHero! Use family code: $familyCode")
                                            putExtra(Intent.EXTRA_SUBJECT, "VitaHero Family Sharing")
                                        }
                                        context.startActivity(Intent.createChooser(intent, "Share family code"))
                                    }
                                    .padding(horizontal = AppSpacing.xxl, vertical = AppSpacing.md)
                            ) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Icon(Icons.Outlined.Share, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(18.dp))
                                    Spacer(Modifier.width(AppSpacing.sm))
                                    // Was .take(25) + "…", which cut every language
                                    // mid-word — Telugu inside a consonant cluster.
                                    // One line, ellipsised by the text layout, which
                                    // knows where the characters actually end.
                                    Text(
                                        t(S.shareYourCode),
                                        color = MaterialTheme.colorScheme.primary,
                                        style = MaterialTheme.typography.labelLarge,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis,
                                    )
                                }
                            }
                        }
                    }
                }
                Spacer(Modifier.height(AppSpacing.xxl))
            }

            // Co-parents list
            if (coParents.isNotEmpty()) {
                item {
                    AppSectionTitle(t(S.coParentsSection))
                    Spacer(Modifier.height(AppSpacing.md))
                }
                coParents.forEach { co ->
                    item {
                        if (co.status == "PENDING") {
                            // A pending request carries two answers, which a
                            // single list row has no room for.
                            AppCard {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    IconBubble(Icons.Outlined.PersonAdd, HeroPurple)
                                    Spacer(Modifier.width(AppSpacing.md))
                                    Column(Modifier.weight(1f)) {
                                        Text(
                                            co.name,
                                            style = MaterialTheme.typography.titleMedium,
                                            maxLines = 1,
                                            overflow = TextOverflow.Ellipsis,
                                        )
                                        Text(
                                            t(S.coParentPending),
                                            style = MaterialTheme.typography.bodySmall,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant
                                        )
                                    }
                                }
                                Row(
                                    Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.End,
                                ) {
                                    AppTextButton(t(S.coParentDecline), onClick = { onAnswerRequest(co.id, false) }, enabled = !busy, tone = Tone.Neutral)
                                    Spacer(Modifier.width(AppSpacing.sm))
                                    AppTextButton(t(S.coParentApprove), onClick = { onAnswerRequest(co.id, true) }, enabled = !busy)
                                }
                            }
                        } else {
                            AppListRow(
                                title = co.name,
                                subtitle = "${co.relation}${if (co.joinedDate.isNotEmpty()) " · Joined ${co.joinedDate}" else ""}",
                                leading = { IconBubble(Icons.Outlined.PersonAdd, HeroPurple) },
                            )
                        }
                        Spacer(Modifier.height(AppSpacing.md))
                    }
                }
            }

            // Join family section
            item {
                Spacer(Modifier.height(AppSpacing.md))
                if (!showJoin) {
                    SecondaryButton(
                        text = t(S.enterFamilyCode),
                        onClick = { showJoin = true },
                        modifier = Modifier.fillMaxWidth(),
                        leadingIcon = Icons.Outlined.GroupAdd,
                    )
                } else {
                    AppCard {
                        Text(t(S.enterFamilyCode), style = MaterialTheme.typography.titleMedium)
                        Text(t(S.askForCode), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Spacer(Modifier.height(AppSpacing.md))
                        AppTextField(
                            value = joinCode,
                            onValueChange = { joinCode = it.take(6) },
                            placeholder = t(S.familyCodePlaceholder),
                            singleLine = true,
                            keyboardType = KeyboardType.Text,
                            modifier = Modifier.fillMaxWidth()
                        )
                        Spacer(Modifier.height(AppSpacing.md))
                        PrimaryGradientButton(
                            text = if (busy) t(S.pleaseWait) else t(S.joinFamily),
                            enabled = joinCode.length >= 4 && !busy,
                            // The form used to close and clear itself the
                            // instant this was tapped, before the code had
                            // been validated. A parent who mistyped saw the
                            // form vanish and a complaint arrive with
                            // nothing left to correct. It stays until the
                            // shared children actually appear.
                            onClick = { onJoinFamily(joinCode) },
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                }
            }

            item {
                Spacer(Modifier.height(AppSpacing.xxl))
                Text(
                    t(S.familyInfo),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}
