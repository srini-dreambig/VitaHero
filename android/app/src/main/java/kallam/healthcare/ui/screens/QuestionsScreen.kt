package kallam.healthcare.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.material.icons.automirrored.outlined.HelpOutline
import androidx.compose.material.icons.outlined.Warning
import androidx.compose.material3.Checkbox
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
import kallam.healthcare.data.GuardianViewModel
import kallam.healthcare.data.Kid
import kallam.healthcare.data.QuestionThreadDto
import kallam.healthcare.data.S
import kallam.healthcare.ui.components.AppCard
import kallam.healthcare.ui.components.AppListRow
import kallam.healthcare.ui.components.AppScreenHeader
import kallam.healthcare.ui.components.AppSectionTitle
import kallam.healthcare.ui.components.AppTextField
import kallam.healthcare.ui.components.IconBubble
import kallam.healthcare.ui.components.InfoNote
import kallam.healthcare.ui.components.PrimaryGradientButton
import kallam.healthcare.ui.components.SecondaryButton
import kallam.healthcare.ui.components.SelectChip
import kallam.healthcare.ui.components.StatusBarSpacer
import kallam.healthcare.ui.components.StatusPill
import kallam.healthcare.ui.components.Tone
import kallam.healthcare.ui.components.t
import kallam.healthcare.ui.components.tf
import kallam.healthcare.ui.theme.AppSpacing

/**
 * Ask the school about your child's check-up.
 *
 * Bounded on purpose. The school has promised a reply within a stated number of
 * days and nothing more, so the screen says that plainly, and it will not let a
 * question be sent until the parent has confirmed this is not an emergency —
 * a tick, not a paragraph nobody reads. The server requires the same
 * confirmation, so an app that forgot to ask would be refused.
 */
@Composable
fun QuestionsScreen(
    kids: List<Kid>,
    guardianViewModel: GuardianViewModel,
    onBack: () -> Unit,
) {
    val policy by guardianViewModel.questionPolicy.collectAsState()
    val threads by guardianViewModel.threads.collectAsState()
    val openThread by guardianViewModel.openThread.collectAsState()
    val busy by guardianViewModel.busy.collectAsState()

    LaunchedEffect(Unit) { guardianViewModel.loadQuestions() }

    val detail = openThread
    if (detail != null) {
        ThreadScreen(detail.thread.subject, detail, onBack = { guardianViewModel.closeThread() })
        return
    }

    var body by rememberSaveable { mutableStateOf("") }
    var acknowledged by rememberSaveable { mutableStateOf(false) }
    var kidId by remember(kids) { mutableStateOf(kids.firstOrNull()?.id) }

    Column(
        Modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.background)
    ) {
        StatusBarSpacer()
        AppScreenHeader(t(S.questionsTitle), subtitle = t(S.questionsSub), onBack = onBack)
        LazyColumn(
            modifier = Modifier.fillMaxWidth(),
            contentPadding = PaddingValues(start = AppSpacing.xl, end = AppSpacing.xl, top = AppSpacing.sm, bottom = AppSpacing.xxxl),
        ) {
            if (!policy.available) {
                item {
                    AppCard {
                        Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
                            IconBubble(Icons.AutoMirrored.Outlined.HelpOutline, MaterialTheme.colorScheme.secondary)
                            Spacer(Modifier.height(AppSpacing.md))
                            Text(
                                t(S.questionsClosed),
                                style = MaterialTheme.typography.titleMedium,
                            )
                            Spacer(Modifier.height(AppSpacing.sm))
                            Text(
                                t(S.questionsClosedSub),
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                }
                return@LazyColumn
            }

            // The safety notice is the first thing on the screen, above the box,
            // and it is the server's own words rather than a copy that could drift.
            item {
                InfoNote(
                    policy.notice.ifBlank { t(S.questionsNoticeFallback) },
                    tone = Tone.Watch,
                    icon = Icons.Outlined.Warning,
                )
                Spacer(Modifier.height(AppSpacing.xxl))
            }

            if (threads.isNotEmpty()) {
                item {
                    AppSectionTitle(t(S.yourQuestions))
                    Spacer(Modifier.height(AppSpacing.md))
                }
                items(threads, key = { it.id }) { th ->
                    ThreadRow(th) { guardianViewModel.loadThread(th.id) }
                    Spacer(Modifier.height(AppSpacing.md))
                }
                item { Spacer(Modifier.height(AppSpacing.md)) }
            }

            item {
                AppCard {
                    Text(
                        t(S.askTheSchool),
                        style = MaterialTheme.typography.titleMedium,
                    )
                    Spacer(Modifier.height(AppSpacing.xs))
                    Text(
                        tf(S.replyWithinDays, policy.responseWindowDays.toString()),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )

                    if (kids.size > 1) {
                        Spacer(Modifier.height(AppSpacing.md))
                        Text(
                            t(S.aboutWhichChild),
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Spacer(Modifier.height(AppSpacing.sm))
                        Row(horizontalArrangement = Arrangement.spacedBy(AppSpacing.sm)) {
                            kids.forEach { kid ->
                                SelectChip(
                                    text = kid.name,
                                    selected = kidId == kid.id,
                                    onClick = { kidId = kid.id },
                                )
                            }
                        }
                    }

                    Spacer(Modifier.height(AppSpacing.md))
                    AppTextField(
                        value = body,
                        onValueChange = { body = it.take(2000) },
                        modifier = Modifier.fillMaxWidth(),
                        placeholder = t(S.questionPlaceholder),
                        singleLine = false,
                        minLines = 4,
                    )

                    Spacer(Modifier.height(AppSpacing.md))
                    Row(
                        Modifier
                            .fillMaxWidth()
                            .clickable { acknowledged = !acknowledged },
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Checkbox(checked = acknowledged, onCheckedChange = { acknowledged = it })
                        Spacer(Modifier.width(AppSpacing.xs))
                        Text(t(S.notUrgentAck), style = MaterialTheme.typography.bodySmall)
                    }

                    Spacer(Modifier.height(AppSpacing.md))
                    PrimaryGradientButton(
                        text = t(S.sendQuestion),
                        onClick = {
                            val school = policy.schools.firstOrNull()?.id.orEmpty()
                            guardianViewModel.ask(school, kidId, body.trim(), acknowledged) {
                                body = ""
                                acknowledged = false
                            }
                        },
                        modifier = Modifier.fillMaxWidth(),
                        enabled = !busy && acknowledged && body.trim().length >= 5,
                    )
                }
            }
        }
    }
}

@Composable
private fun ThreadRow(th: QuestionThreadDto, onOpen: () -> Unit) {
    val awaitingSchool = th.awaiting == "SCHOOL"
    AppListRow(
        title = th.subject.ifBlank { th.schoolName },
        subtitle = listOf(th.schoolName, th.kidName).filter { it.isNotBlank() }.joinToString(" · "),
        // The one fact a waiting parent wants: has the school replied yet.
        trailing = {
            StatusPill(
                if (awaitingSchool) t(S.awaitingSchool) else t(S.schoolReplied),
                if (awaitingSchool) Tone.Watch else Tone.Info,
            )
        },
        onClick = onOpen,
    )
}

@Composable
private fun ThreadScreen(
    title: String,
    detail: kallam.healthcare.data.ThreadDetailDto,
    onBack: () -> Unit,
) {
    Column(
        Modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.background)
    ) {
        StatusBarSpacer()
        AppScreenHeader(
            title.ifBlank { t(S.questionsTitle) },
            subtitle = listOf(detail.thread.schoolName, detail.thread.kidName)
                .filter { it.isNotBlank() }.joinToString(" · "),
            onBack = onBack,
        )
        LazyColumn(
            modifier = Modifier.fillMaxWidth(),
            contentPadding = PaddingValues(start = AppSpacing.xl, end = AppSpacing.xl, top = AppSpacing.sm, bottom = AppSpacing.xxxl),
            verticalArrangement = Arrangement.spacedBy(AppSpacing.md),
        ) {
            items(detail.messages, key = { it.id }) { m ->
                val fromSchool = m.side == "SCHOOL"
                AppCard {
                    Text(
                        if (fromSchool) m.name.ifBlank { t(S.theSchool) } else t(S.you),
                        style = MaterialTheme.typography.labelMedium,
                        color = if (fromSchool) MaterialTheme.colorScheme.secondary else MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Spacer(Modifier.height(AppSpacing.xs))
                    Text(m.body, style = MaterialTheme.typography.bodyMedium)
                }
            }
            item {
                SecondaryButton(t(S.backLabel), onClick = onBack)
            }
        }
    }
}
