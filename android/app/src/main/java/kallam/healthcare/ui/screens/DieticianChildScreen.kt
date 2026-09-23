package kallam.healthcare.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
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
import kallam.healthcare.data.DietTargetDto
import kallam.healthcare.data.DieticianFindingDto
import kallam.healthcare.data.DieticianViewModel
import kallam.healthcare.data.FoodLogDayDto
import kallam.healthcare.ui.components.HeroCard
import kallam.healthcare.ui.components.Notice
import kallam.healthcare.ui.components.PrimaryGradientButton
import kallam.healthcare.ui.components.StatusBarSpacer
import kallam.healthcare.ui.theme.FlagAlert
import kallam.healthcare.ui.theme.FlagGood
import kallam.healthcare.ui.theme.FlagWatch
import kallam.healthcare.ui.theme.HeroBlue
import kallam.healthcare.ui.theme.HeroOrange

/**
 * One child, and the plan they are given.
 *
 * What is on this screen is everything the server was willing to send: growth
 * and haemoglobin from released camps, the last week of the food log rolled up
 * by day, and the plans written so far. The dental and eye findings are not
 * hidden here — they never left the server, so there is nothing on this device
 * to hide.
 *
 * The plan form opens pre-filled from the server's draft. A dietician at the
 * end of a long day corrects a sentence rather than facing an empty box, and
 * the draft names the finding rather than giving the advice, because the
 * advice is the part only they can give.
 */
@Composable
fun DieticianChildScreen(
    kidId: String,
    dietician: DieticianViewModel,
    onBack: () -> Unit,
) {
    val record by dietician.record.collectAsState()
    val busy by dietician.busy.collectAsState()
    val message by dietician.message.collectAsState()
    val saved by dietician.saved.collectAsState()

    LaunchedEffect(kidId) { dietician.openChild(kidId) }

    val current = record?.plans?.firstOrNull { it.status == "ACTIVE" }
    val draft = record?.draft

    var writing by remember(kidId) { mutableStateOf(false) }
    var title by remember(kidId, draft) { mutableStateOf(draft?.title ?: "") }
    var focus by remember(kidId, draft) { mutableStateOf(draft?.focus ?: "GENERAL") }
    var guidance by remember(kidId, draft) { mutableStateOf(draft?.guidance ?: "") }
    var targetLabel by remember(kidId) { mutableStateOf("") }
    var targetValue by remember(kidId) { mutableStateOf("") }

    LaunchedEffect(saved) {
        if (saved) {
            writing = false
            dietician.clearSaved()
        }
    }

    LazyColumn(
        Modifier.fillMaxSize(),
        contentPadding = PaddingValues(bottom = 40.dp),
    ) {
        item {
            StatusBarSpacer()
            Row(
                Modifier.fillMaxWidth().padding(8.dp, 8.dp, 20.dp, 0.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                IconButton(onClick = {
                    dietician.closeChild()
                    onBack()
                }) {
                    Icon(Icons.AutoMirrored.Outlined.ArrowBack, contentDescription = "Back")
                }
                Column(Modifier.weight(1f)) {
                    Text(
                        record?.child?.name ?: "…",
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Text(
                        listOfNotNull(
                            record?.child?.let {
                                listOf(it.grade, it.section).filter { p -> p.isNotBlank() }
                                    .joinToString(" ")
                            },
                            record?.child?.age?.let { "$it yrs" },
                            record?.child?.schoolName,
                        ).filter { it.isNotBlank() }.joinToString(" · "),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
            if (message.isNotBlank()) {
                Column(Modifier.padding(horizontal = 20.dp)) { Notice(message, error = true) }
            }
            Spacer(Modifier.height(12.dp))
        }

        if (record == null) {
            item {
                Text(
                    if (busy) "Loading…" else "Nothing to show.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(20.dp),
                )
            }
        } else {
            val r = record!!

            // ── what the camps found ──
            item {
                SectionTitle("What the camps found")
                if (r.findings.isEmpty()) {
                    Text(
                        "Nobody has measured this child yet. A camp records growth and "
                            + "haemoglobin, and those are the two you see here.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(horizontal = 20.dp),
                    )
                    Spacer(Modifier.height(8.dp))
                }
            }
            items(r.findings.size) { i -> FindingRow(r.findings[i]) }

            // ── the food log ──
            item {
                Spacer(Modifier.height(10.dp))
                SectionTitle("The last week of meals")
                if (r.foodLog.isEmpty()) {
                    Text(
                        "This family has not logged any meals yet.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(horizontal = 20.dp),
                    )
                    Spacer(Modifier.height(8.dp))
                }
            }
            items(r.foodLog.size) { i -> FoodLogRow(r.foodLog[i]) }

            // ── the plan ──
            item {
                Spacer(Modifier.height(10.dp))
                SectionTitle("The plan")
                if (current == null && !writing) {
                    HeroCard(Modifier.fillMaxWidth().padding(horizontal = 20.dp)) {
                        Column(Modifier.padding(16.dp)) {
                            Text(
                                "No plan yet",
                                style = MaterialTheme.typography.titleSmall,
                                fontWeight = FontWeight.SemiBold,
                            )
                            Spacer(Modifier.height(4.dp))
                            Text(
                                "What you write here is what the family reads in the app, "
                                    + "against their own food log.",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                            Spacer(Modifier.height(12.dp))
                            PrimaryGradientButton(
                                text = "Write a plan",
                                onClick = { writing = true },
                                modifier = Modifier.fillMaxWidth(),
                                enabled = !busy,
                            )
                        }
                    }
                } else if (current != null && !writing) {
                    HeroCard(Modifier.fillMaxWidth().padding(horizontal = 20.dp)) {
                        Column(Modifier.padding(16.dp)) {
                            Text(
                                current.title.ifBlank { "Plan" },
                                style = MaterialTheme.typography.titleSmall,
                                fontWeight = FontWeight.SemiBold,
                            )
                            Text(
                                listOf(focusLabel(current.focus), current.authorName, current.startsOn)
                                    .filter { it.isNotBlank() }.joinToString(" · "),
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                            Spacer(Modifier.height(8.dp))
                            Text(current.guidance, style = MaterialTheme.typography.bodyMedium)
                            current.targets.forEach { t ->
                                Spacer(Modifier.height(6.dp))
                                Row {
                                    Text(
                                        t.label,
                                        style = MaterialTheme.typography.bodySmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                        modifier = Modifier.weight(1f),
                                    )
                                    Text(
                                        t.value,
                                        style = MaterialTheme.typography.bodySmall,
                                        fontWeight = FontWeight.SemiBold,
                                    )
                                }
                            }
                            Spacer(Modifier.height(12.dp))
                            PrimaryGradientButton(
                                text = "Replace this plan",
                                onClick = {
                                    title = current.title
                                    focus = current.focus
                                    guidance = current.guidance
                                    writing = true
                                },
                                modifier = Modifier.fillMaxWidth(),
                                enabled = !busy,
                            )
                            Spacer(Modifier.height(6.dp))
                            Text(
                                "The plan before it is kept, so the family can see what changed.",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                }
            }

            if (writing) {
                item {
                    HeroCard(Modifier.fillMaxWidth().padding(horizontal = 20.dp)) {
                        Column(Modifier.padding(16.dp)) {
                            OutlinedTextField(
                                value = title,
                                onValueChange = { title = it },
                                label = { Text("Title") },
                                singleLine = true,
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(14.dp),
                                colors = OutlinedTextFieldDefaults.colors(
                                    focusedBorderColor = HeroOrange,
                                ),
                            )
                            Spacer(Modifier.height(10.dp))
                            Text(
                                "What this plan is for",
                                style = MaterialTheme.typography.labelLarge,
                                fontWeight = FontWeight.SemiBold,
                            )
                            Spacer(Modifier.height(6.dp))
                            Row {
                                FOCUS.forEach { f ->
                                    FocusChip(focusLabel(f), focus == f) { focus = f }
                                    Spacer(Modifier.width(6.dp))
                                }
                            }
                            Spacer(Modifier.height(10.dp))
                            OutlinedTextField(
                                value = guidance,
                                onValueChange = { guidance = it },
                                label = { Text("What the family should do") },
                                minLines = 4,
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(14.dp),
                                colors = OutlinedTextFieldDefaults.colors(
                                    focusedBorderColor = HeroOrange,
                                ),
                            )
                            Spacer(Modifier.height(10.dp))
                            Text(
                                "One thing to aim for (optional)",
                                style = MaterialTheme.typography.labelLarge,
                                fontWeight = FontWeight.SemiBold,
                            )
                            Spacer(Modifier.height(6.dp))
                            Row {
                                OutlinedTextField(
                                    value = targetLabel,
                                    onValueChange = { targetLabel = it },
                                    label = { Text("Such as") },
                                    singleLine = true,
                                    modifier = Modifier.weight(1f),
                                    shape = RoundedCornerShape(14.dp),
                                    colors = OutlinedTextFieldDefaults.colors(
                                        focusedBorderColor = HeroOrange,
                                    ),
                                )
                                Spacer(Modifier.width(8.dp))
                                OutlinedTextField(
                                    value = targetValue,
                                    onValueChange = { targetValue = it },
                                    label = { Text("How much") },
                                    singleLine = true,
                                    modifier = Modifier.weight(1f),
                                    shape = RoundedCornerShape(14.dp),
                                    colors = OutlinedTextFieldDefaults.colors(
                                        focusedBorderColor = HeroOrange,
                                    ),
                                )
                            }
                            Spacer(Modifier.height(14.dp))
                            PrimaryGradientButton(
                                text = if (busy) "Saving…" else "Send this plan to the family",
                                onClick = {
                                    dietician.savePlan(
                                        kidId = kidId,
                                        title = title,
                                        focus = focus,
                                        startsOn = "",
                                        guidance = guidance,
                                        targets = if (targetLabel.isBlank()) emptyList()
                                        else listOf(DietTargetDto(targetLabel, targetValue)),
                                    )
                                },
                                modifier = Modifier.fillMaxWidth(),
                                enabled = !busy && guidance.trim().length >= 10,
                            )
                            Spacer(Modifier.height(6.dp))
                            Text(
                                "A plan needs a sentence the family can act on.",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                }
            }

            // ── what came before ──
            val past = r.plans.filter { it.status != "ACTIVE" }
            if (past.isNotEmpty()) {
                item {
                    Spacer(Modifier.height(10.dp))
                    SectionTitle("Plans before this one")
                }
                items(past.size) { i ->
                    val p = past[i]
                    HeroCard(Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 5.dp)) {
                        Column(Modifier.padding(14.dp)) {
                            Text(
                                p.title.ifBlank { "Plan" },
                                style = MaterialTheme.typography.titleSmall,
                                fontWeight = FontWeight.SemiBold,
                            )
                            Text(
                                listOf(focusLabel(p.focus), p.authorName)
                                    .filter { it.isNotBlank() }.joinToString(" · "),
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                            Spacer(Modifier.height(4.dp))
                            Text(
                                p.guidance,
                                style = MaterialTheme.typography.bodySmall,
                                maxLines = 3,
                                overflow = TextOverflow.Ellipsis,
                            )
                        }
                    }
                }
            }
        }
    }
}

private val FOCUS = listOf("GENERAL", "WEIGHT_GAIN", "WEIGHT_CONTROL", "ANAEMIA")

private fun focusLabel(v: String): String = when (v) {
    "WEIGHT_GAIN" -> "Growth"
    "WEIGHT_CONTROL" -> "Weight"
    "ANAEMIA" -> "Iron"
    "GENERAL" -> "Everyday"
    else -> v
}

@Composable
private fun SectionTitle(text: String) {
    Text(
        text,
        style = MaterialTheme.typography.titleMedium,
        fontWeight = FontWeight.SemiBold,
        modifier = Modifier.padding(start = 20.dp, end = 20.dp, bottom = 8.dp),
    )
}

@Composable
private fun FocusChip(text: String, selected: Boolean, onClick: () -> Unit) {
    Box(
        Modifier
            .clip(RoundedCornerShape(50))
            .background(
                if (selected) HeroOrange.copy(alpha = 0.16f)
                else MaterialTheme.colorScheme.surfaceVariant,
            )
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 6.dp),
    ) {
        Text(
            text,
            style = MaterialTheme.typography.labelMedium,
            fontWeight = if (selected) FontWeight.SemiBold else FontWeight.Normal,
            color = if (selected) HeroOrange else MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

@Composable
private fun FindingRow(f: DieticianFindingDto) {
    val colour = when (f.flag) {
        "ALERT" -> FlagAlert
        "WATCH" -> FlagWatch
        else -> FlagGood
    }
    HeroCard(Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 5.dp)) {
        Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(
                Modifier
                    .width(4.dp)
                    .height(36.dp)
                    .clip(RoundedCornerShape(2.dp))
                    .background(colour),
            )
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(
                    f.checkType,
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold,
                )
                Text(
                    listOf(f.valueText, f.rationale).filter { it.isNotBlank() }.first(),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                if (f.date.isNotBlank()) {
                    Text(
                        listOf(f.campTitle, f.date).filter { it.isNotBlank() }.joinToString(" · "),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
    }
}

@Composable
private fun FoodLogRow(d: FoodLogDayDto) {
    Row(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = 24.dp, vertical = 5.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(d.day, style = MaterialTheme.typography.bodySmall, modifier = Modifier.weight(1f))
        Text(
            "${d.eaten} of ${d.items} logged",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(Modifier.width(12.dp))
        Text(
            "${d.kcal} kcal",
            style = MaterialTheme.typography.bodySmall,
            fontWeight = FontWeight.SemiBold,
            color = HeroBlue,
        )
    }
}
