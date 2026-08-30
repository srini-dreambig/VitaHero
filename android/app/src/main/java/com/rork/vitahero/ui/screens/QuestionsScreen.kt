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
import androidx.compose.material.icons.automirrored.outlined.HelpOutline
import androidx.compose.material.icons.outlined.Warning
import androidx.compose.material3.Checkbox
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
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.rork.vitahero.data.GuardianViewModel
import com.rork.vitahero.data.Kid
import com.rork.vitahero.data.QuestionThreadDto
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

    var body by remember { mutableStateOf("") }
    var acknowledged by remember { mutableStateOf(false) }
    var kidId by remember(kids) { mutableStateOf(kids.firstOrNull()?.id) }

    LazyColumn(
        modifier = Modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.background),
        contentPadding = PaddingValues(start = 20.dp, end = 20.dp, bottom = 32.dp),
    ) {
        item {
            StatusBarSpacer()
            ScreenHeader(t(S.questionsTitle), t(S.questionsSub), onBack)
            Spacer(Modifier.height(12.dp))
        }

        if (!policy.available) {
            item {
                HeroCard(Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(20.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                        IconBubble(Icons.AutoMirrored.Outlined.HelpOutline, HeroBlue)
                        Spacer(Modifier.height(12.dp))
                        Text(
                            t(S.questionsClosed),
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.SemiBold,
                        )
                        Spacer(Modifier.height(6.dp))
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
            Box(
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(14.dp))
                    .background(HeroOrange.copy(alpha = 0.12f))
                    .padding(14.dp),
            ) {
                Row(verticalAlignment = Alignment.Top) {
                    Icon(
                        Icons.Outlined.Warning,
                        contentDescription = null,
                        tint = HeroOrange,
                        modifier = Modifier.size(20.dp),
                    )
                    Spacer(Modifier.width(10.dp))
                    Text(
                        policy.notice.ifBlank { t(S.questionsNoticeFallback) },
                        style = MaterialTheme.typography.bodySmall,
                    )
                }
            }
            Spacer(Modifier.height(14.dp))
        }

        if (threads.isNotEmpty()) {
            item {
                Text(
                    t(S.yourQuestions),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                )
                Spacer(Modifier.height(8.dp))
            }
            items(threads, key = { it.id }) { th ->
                ThreadRow(th) { guardianViewModel.loadThread(th.id) }
                Spacer(Modifier.height(8.dp))
            }
            item { Spacer(Modifier.height(10.dp)) }
        }

        item {
            HeroCard(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(18.dp)) {
                    Text(
                        t(S.askTheSchool),
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold,
                    )
                    Spacer(Modifier.height(4.dp))
                    Text(
                        tf(S.replyWithinDays, policy.responseWindowDays.toString()),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )

                    if (kids.size > 1) {
                        Spacer(Modifier.height(10.dp))
                        Text(
                            t(S.aboutWhichChild),
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Spacer(Modifier.height(6.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            kids.forEach { kid ->
                                val selected = kidId == kid.id
                                Text(
                                    kid.name,
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(50))
                                        .clickable { kidId = kid.id }
                                        .background(
                                            if (selected) HeroOrange.copy(alpha = 0.15f)
                                            else MaterialTheme.colorScheme.surfaceVariant
                                        )
                                        .padding(horizontal = 14.dp, vertical = 8.dp),
                                    style = MaterialTheme.typography.labelLarge,
                                    fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium,
                                    color = if (selected) HeroOrange else MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                            }
                        }
                    }

                    Spacer(Modifier.height(12.dp))
                    OutlinedTextField(
                        value = body,
                        onValueChange = { body = it.take(2000) },
                        modifier = Modifier.fillMaxWidth(),
                        placeholder = { Text(t(S.questionPlaceholder)) },
                        minLines = 4,
                        shape = RoundedCornerShape(14.dp),
                        colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = HeroOrange),
                    )

                    Spacer(Modifier.height(10.dp))
                    Row(
                        Modifier
                            .fillMaxWidth()
                            .clickable { acknowledged = !acknowledged },
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Checkbox(checked = acknowledged, onCheckedChange = { acknowledged = it })
                        Spacer(Modifier.width(4.dp))
                        Text(t(S.notUrgentAck), style = MaterialTheme.typography.bodySmall)
                    }

                    Spacer(Modifier.height(10.dp))
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
    HeroCard(Modifier.fillMaxWidth()) {
        Row(
            Modifier
                .fillMaxWidth()
                .clickable(onClick = onOpen)
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(Modifier.weight(1f)) {
                Text(
                    th.subject.ifBlank { th.schoolName },
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    listOf(th.schoolName, th.kidName).filter { it.isNotBlank() }.joinToString(" · "),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            // The one fact a waiting parent wants: has the school replied yet.
            Text(
                if (th.awaiting == "SCHOOL") t(S.awaitingSchool) else t(S.schoolReplied),
                style = MaterialTheme.typography.labelMedium,
                fontWeight = FontWeight.SemiBold,
                color = if (th.awaiting == "SCHOOL") HeroOrange else HeroBlue,
            )
        }
    }
}

@Composable
private fun ThreadScreen(
    title: String,
    detail: com.rork.vitahero.data.ThreadDetailDto,
    onBack: () -> Unit,
) {
    LazyColumn(
        modifier = Modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.background),
        contentPadding = PaddingValues(start = 20.dp, end = 20.dp, bottom = 32.dp),
    ) {
        item {
            StatusBarSpacer()
            ScreenHeader(
                title.ifBlank { t(S.questionsTitle) },
                listOf(detail.thread.schoolName, detail.thread.kidName)
                    .filter { it.isNotBlank() }.joinToString(" · "),
                onBack,
            )
            Spacer(Modifier.height(12.dp))
        }
        items(detail.messages, key = { it.id }) { m ->
            val fromSchool = m.side == "SCHOOL"
            HeroCard(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(16.dp)) {
                    Text(
                        if (fromSchool) m.name.ifBlank { t(S.theSchool) } else t(S.you),
                        style = MaterialTheme.typography.labelMedium,
                        fontWeight = FontWeight.SemiBold,
                        color = if (fromSchool) HeroBlue else MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Spacer(Modifier.height(4.dp))
                    Text(m.body, style = MaterialTheme.typography.bodyMedium)
                }
            }
            Spacer(Modifier.height(8.dp))
        }
        item {
            Spacer(Modifier.height(10.dp))
            OutlinedButton(onClick = onBack, shape = RoundedCornerShape(14.dp)) {
                Text(t(S.backLabel))
            }
        }
    }
}
