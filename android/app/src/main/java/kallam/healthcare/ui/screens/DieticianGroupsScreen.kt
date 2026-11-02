package kallam.healthcare.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.Groups
import androidx.compose.material3.Checkbox
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import kallam.healthcare.data.CohortDraftDto
import kallam.healthcare.data.DietTargetDto
import kallam.healthcare.data.DietTemplateDto
import kallam.healthcare.data.DieticianCohortDto
import kallam.healthcare.data.DieticianViewModel
import kallam.healthcare.data.classTitle
import kallam.healthcare.ui.components.EmptyState
import kallam.healthcare.ui.components.HeroCard
import kallam.healthcare.ui.components.IconBubble
import kallam.healthcare.ui.components.Notice
import kallam.healthcare.ui.components.PrimaryGradientButton
import kallam.healthcare.ui.components.StatusBarSpacer
import kallam.healthcare.ui.theme.FlagAlert
import kallam.healthcare.ui.theme.FlagGood
import kallam.healthcare.ui.theme.FlagWatch
import kallam.healthcare.ui.theme.HeroBlue
import kallam.healthcare.ui.theme.HeroOrange

/**
 * One school's children in groups, so a plan is written once for everyone
 * who needs the same thing rather than child by child.
 *
 * The server groups them by what their checks found — growth band, then
 * anaemia, then tooth decay — and hands each group a draft. The dietician can
 * ask the model to improve that draft, edits it, unticks anyone it does not
 * suit, and sends it to the rest. A child who needs something different is
 * still one tap away on the class list.
 */
@Composable
fun DieticianGroupsScreen(
    schoolId: String,
    schoolName: String,
    dietician: DieticianViewModel,
    onOpenChild: (kidId: String) -> Unit,
    onBack: () -> Unit,
) {
    val data by dietician.cohorts.collectAsState()
    val busy by dietician.busy.collectAsState()
    val message by dietician.message.collectAsState()
    val aiDraft by dietician.cohortDraft.collectAsState()
    val saved by dietician.cohortSaved.collectAsState()
    var grade by rememberSaveable { mutableStateOf("") }
    var openKey by rememberSaveable { mutableStateOf("") }
    var precamp by rememberSaveable { mutableStateOf(false) }
    val templates by dietician.templates.collectAsState()

    LaunchedEffect(schoolId, grade) {
        dietician.clearMessage()
        dietician.loadCohorts(schoolId, grade)
    }

    LaunchedEffect(Unit) { dietician.loadTemplates() }

    if (precamp) {
        PrecampPlansScreen(dietician) {
            precamp = false
            // The groups' drafts start from these plans: read them again.
            dietician.loadCohorts(schoolId, grade)
        }
        return
    }

    val d = data
    val open = d?.cohorts?.firstOrNull { it.key == openKey }

    LazyColumn(Modifier.fillMaxSize()) {
        item {
            StatusBarSpacer()
            Row(
                Modifier.fillMaxWidth().padding(8.dp, 8.dp, 20.dp, 0.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                IconButton(onClick = {
                    if (open != null) {
                        openKey = ""
                        dietician.clearCohortDraft()
                    } else onBack()
                }) {
                    Icon(Icons.AutoMirrored.Outlined.ArrowBack, contentDescription = "Back")
                }
                Column(Modifier.weight(1f)) {
                    Text(
                        open?.label ?: "Plan by groups",
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Text(
                        listOf(schoolName, if (grade.isBlank()) "All classes" else classTitle(grade))
                            .filter { it.isNotBlank() }.joinToString(" · "),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
            if (message.isNotBlank()) {
                Column(Modifier.padding(horizontal = 20.dp)) { Notice(message, error = true) }
            }
            Spacer(Modifier.height(8.dp))
        }

        if (open == null) {
            // The twelve plans written before the camp. Each family gets the
            // one for their child's group as soon as the results are released.
            item {
                HeroCard(
                    Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 20.dp, vertical = 6.dp)
                        .clickable { precamp = true }
                ) {
                    Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                        IconBubble(Icons.Outlined.Groups, HeroOrange)
                        Spacer(Modifier.width(12.dp))
                        Column(Modifier.weight(1f)) {
                            Text(
                                "Pre-camp diet plans",
                                style = MaterialTheme.typography.titleSmall,
                                fontWeight = FontWeight.SemiBold,
                            )
                            Text(
                                "One plan per group, written before the camp. Families get " +
                                    "their child's plan when the results are released.",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                        val t = templates
                        Text(
                            if (t == null) "" else "${t.ready} of ${t.templates.size}",
                            style = MaterialTheme.typography.titleSmall,
                            fontWeight = FontWeight.Bold,
                        )
                    }
                }
                Spacer(Modifier.height(6.dp))
            }
        }

        if (open != null) {
            item(key = "editor_$openKey") {
                CohortEditor(
                    cohort = open,
                    aiDraft = aiDraft,
                    busy = busy,
                    saved = saved,
                    onAskAi = { dietician.draftCohort(schoolId, open.key, grade) },
                    onOpenChild = onOpenChild,
                    onSave = { kids, title, guidance, targets ->
                        dietician.saveCohortPlan(schoolId, grade, kids, title, open.focus, guidance, targets)
                    },
                )
            }
            item { Spacer(Modifier.height(28.dp)) }
            return@LazyColumn
        }

        // Classes to narrow by. Built from the whole school's list, so picking
        // one does not make the others disappear.
        val grades = d?.grades.orEmpty()
        if (grades.size > 1) {
            item {
                Row(
                    Modifier.fillMaxWidth().horizontalScroll(rememberScrollState())
                        .padding(horizontal = 20.dp),
                ) {
                    GroupChip("All classes", grade.isBlank()) { grade = "" }
                    grades.forEach { g ->
                        Spacer(Modifier.width(6.dp))
                        GroupChip(classTitle(g), grade == g) { grade = g }
                    }
                }
                Spacer(Modifier.height(10.dp))
            }
        }

        if (d == null || d.cohorts.isEmpty()) {
            item {
                EmptyState(
                    icon = Icons.Outlined.Groups,
                    title = when {
                        busy || d == null -> "Loading…"
                        else -> "No checks to plan from yet"
                    },
                    subtitle = when {
                        busy || d == null -> "One moment."
                        else -> "Groups appear once a camp's doctors have recorded growth " +
                            "or teeth for these children."
                    },
                    modifier = Modifier.padding(20.dp),
                )
            }
            return@LazyColumn
        }

        item {
            Text(
                "${d.total} children with check results, in ${d.cohorts.size} " +
                    (if (d.cohorts.size == 1) "group" else "groups") +
                    ". Most urgent first.",
                Modifier.padding(horizontal = 20.dp),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(Modifier.height(6.dp))
        }

        items(d.cohorts, key = { it.key }) { c ->
            HeroCard(
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp, vertical = 6.dp)
                    .clickable {
                        dietician.clearCohortDraft()
                        openKey = c.key
                    }
            ) {
                Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                    IconBubble(Icons.Outlined.Groups, cohortColour(c))
                    Spacer(Modifier.width(12.dp))
                    Column(Modifier.weight(1f)) {
                        Text(
                            c.label,
                            style = MaterialTheme.typography.titleSmall,
                            fontWeight = FontWeight.SemiBold,
                        )
                        Text(
                            summaryLine(c),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                    Column(horizontalAlignment = Alignment.End) {
                        Text(
                            "${c.summary.count}",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold,
                        )
                        Text(
                            "${c.summary.withPlan} on a plan",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }
        }
        item { Spacer(Modifier.height(24.dp)) }
    }
}

/** The plan for one group, and who it goes to. */
@Composable
private fun CohortEditor(
    cohort: DieticianCohortDto,
    aiDraft: CohortDraftDto?,
    busy: Boolean,
    saved: Int,
    onAskAi: () -> Unit,
    onOpenChild: (String) -> Unit,
    onSave: (kids: List<String>, title: String, guidance: String, targets: List<DietTargetDto>) -> Unit,
) {
    val start = cohort.draft
    var title by remember(cohort.key) { mutableStateOf(start.title) }
    var guidance by remember(cohort.key) { mutableStateOf(start.guidance) }
    val targets = remember(cohort.key) { mutableStateListOf<DietTargetDto>().apply { addAll(start.targets) } }
    // Everyone ticked to begin with: the group is the reason they are here.
    val ticked = remember(cohort.key) { mutableStateListOf<String>().apply { addAll(cohort.children.map { it.kidId }) } }
    var source by remember(cohort.key) { mutableStateOf(start.source) }

    // A new draft from the model replaces the text, which is still the
    // dietician's to change before anything is sent.
    LaunchedEffect(aiDraft) {
        val a = aiDraft ?: return@LaunchedEffect
        title = a.title
        guidance = a.guidance
        targets.clear(); targets.addAll(a.targets)
        source = a.source
    }

    Column(Modifier.padding(horizontal = 20.dp)) {
        Text(
            summaryLine(cohort),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(Modifier.height(10.dp))

        if (saved > 0) {
            Notice(
                "Sent to ${if (saved == 1) "1 family" else "$saved families"}. " +
                    "Each child's earlier plan was kept as history.",
                error = false,
            )
            Spacer(Modifier.height(8.dp))
        }

        HeroCard(Modifier.fillMaxWidth()) {
            Column(Modifier.padding(16.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        "The plan",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.weight(1f),
                    )
                    GroupChip(
                        when (source) {
                            "AI" -> "Drafted by AI"
                            "TEMPLATE" -> "Your pre-camp plan"
                            else -> "Starter draft"
                        },
                        source == "AI" || source == "TEMPLATE",
                    ) {}
                }
                Spacer(Modifier.height(4.dp))
                Text(
                    "A starting point. Change anything before you send it.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(Modifier.height(10.dp))
                OutlinedTextField(
                    value = title,
                    onValueChange = { title = it },
                    label = { Text("Title") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(14.dp),
                    colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = HeroOrange),
                )
                Spacer(Modifier.height(10.dp))
                OutlinedTextField(
                    value = guidance,
                    onValueChange = { guidance = it },
                    label = { Text("What the family should do") },
                    minLines = 6,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(14.dp),
                    colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = HeroOrange),
                )
                Spacer(Modifier.height(10.dp))
                Text("Targets", style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.SemiBold)
                targets.forEachIndexed { i, t ->
                    Spacer(Modifier.height(6.dp))
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        OutlinedTextField(
                            value = t.label,
                            onValueChange = { targets[i] = t.copy(label = it) },
                            label = { Text("Such as") },
                            singleLine = true,
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(14.dp),
                            colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = HeroOrange),
                        )
                        Spacer(Modifier.width(6.dp))
                        OutlinedTextField(
                            value = t.value,
                            onValueChange = { targets[i] = t.copy(value = it) },
                            label = { Text("How much") },
                            singleLine = true,
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(14.dp),
                            colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = HeroOrange),
                        )
                        TextButton(onClick = { targets.removeAt(i) }) { Text("Remove") }
                    }
                }
                if (targets.size < 8) {
                    TextButton(onClick = { targets.add(DietTargetDto("", "")) }) { Text("Add a target") }
                }
                Spacer(Modifier.height(4.dp))
                TextButton(onClick = onAskAi, enabled = !busy) {
                    Text(if (busy) "Working…" else "Draft with AI")
                }
                Text(
                    "The AI is told the group's make-up — ages, how many girls and boys, " +
                        "what was found — and never a child's name.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }

        Spacer(Modifier.height(14.dp))
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                "Children (${ticked.size} of ${cohort.children.size} ticked)",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.weight(1f),
            )
            TextButton(onClick = {
                if (ticked.size == cohort.children.size) ticked.clear()
                else { ticked.clear(); ticked.addAll(cohort.children.map { it.kidId }) }
            }) { Text(if (ticked.size == cohort.children.size) "Untick all" else "Tick all") }
        }
        cohort.children.forEach { k ->
            Row(
                Modifier.fillMaxWidth().padding(vertical = 2.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Checkbox(
                    checked = k.kidId in ticked,
                    onCheckedChange = { on -> if (on) ticked.add(k.kidId) else ticked.remove(k.kidId) },
                )
                Column(Modifier.weight(1f).clickable { onOpenChild(k.kidId) }) {
                    Text(k.name, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold)
                    Text(
                        listOf(
                            listOf(k.grade, k.section).filter { it.isNotBlank() }.joinToString(" "),
                            k.age?.let { "$it yrs" } ?: "",
                            k.band,
                            when (k.anaemia) { "SEVERE" -> "severe anaemia"; "MILD" -> "anaemia"; else -> "" },
                            if (k.toothDecay) "tooth decay" else "",
                            if (k.hasPlan) "has a plan, will be replaced" else "",
                        ).filter { it.isNotBlank() }.joinToString(" · "),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }

        Spacer(Modifier.height(14.dp))
        PrimaryGradientButton(
            text = when {
                busy -> "Saving…"
                ticked.isEmpty() -> "Tick at least one child"
                ticked.size == 1 -> "Send to 1 family"
                else -> "Send to ${ticked.size} families"
            },
            onClick = {
                onSave(
                    cohort.children.map { it.kidId }.filter { it in ticked },
                    title.trim(),
                    guidance.trim(),
                    targets.filter { it.label.isNotBlank() },
                )
            },
            modifier = Modifier.fillMaxWidth(),
            enabled = !busy && ticked.isNotEmpty() && guidance.trim().length >= 10,
        )
        Spacer(Modifier.height(6.dp))
        Text(
            "Tap a name to open that child's record and write them a plan of their own.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

private fun summaryLine(c: DieticianCohortDto): String {
    val s = c.summary
    val ages = when {
        s.ageMin == null -> ""
        s.ageMin == s.ageMax -> "age ${s.ageMin}"
        else -> "ages ${s.ageMin}–${s.ageMax}"
    }
    return listOf(
        ages,
        "${s.girls} girls, ${s.boys} boys",
        if (s.severeAnaemia > 0) "${s.severeAnaemia} severe anaemia" else "",
        if (s.toothDecay > 0) "${s.toothDecay} tooth decay" else "",
    ).filter { it.isNotBlank() }.joinToString(" · ")
}

private fun cohortColour(c: DieticianCohortDto): Color = when {
    c.key.startsWith("SEVERE") || c.summary.severeAnaemia > 0 -> FlagAlert
    c.key.startsWith("NORMAL") && !c.key.contains("+") -> FlagGood
    c.key.startsWith("UNKNOWN") && !c.key.contains("+") -> HeroBlue
    else -> FlagWatch
}

/** The twelve pre-camp plans, and the one being written. */
@Composable
private fun PrecampPlansScreen(dietician: DieticianViewModel, onBack: () -> Unit) {
    val data by dietician.templates.collectAsState()
    val busy by dietician.busy.collectAsState()
    val message by dietician.message.collectAsState()
    val savedKey by dietician.templateSaved.collectAsState()
    var openKey by rememberSaveable { mutableStateOf("") }
    val open = data?.templates?.firstOrNull { it.key == openKey }

    LaunchedEffect(Unit) {
        dietician.clearMessage()
        dietician.clearTemplateSaved()
        dietician.loadTemplates()
    }

    LazyColumn(Modifier.fillMaxSize()) {
        item {
            StatusBarSpacer()
            Row(
                Modifier.fillMaxWidth().padding(8.dp, 8.dp, 20.dp, 0.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                IconButton(onClick = {
                    if (open != null) {
                        openKey = ""
                        dietician.clearTemplateSaved()
                    } else onBack()
                }) {
                    Icon(Icons.AutoMirrored.Outlined.ArrowBack, contentDescription = "Back")
                }
                Column(Modifier.weight(1f)) {
                    Text(
                        open?.label ?: "Pre-camp diet plans",
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    val d = data
                    Text(
                        if (d == null) "Loading…" else "${d.ready} of ${d.templates.size} written",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
            if (message.isNotBlank()) {
                Column(Modifier.padding(horizontal = 20.dp)) { Notice(message, error = true) }
            }
            Spacer(Modifier.height(8.dp))
        }

        if (open != null) {
            item(key = "tpl_$openKey") {
                TemplateEditor(
                    template = open,
                    busy = busy,
                    saved = savedKey == open.key,
                    onSave = { title, guidance, targets ->
                        dietician.saveTemplate(open.key, title, guidance, targets)
                    },
                )
            }
            item { Spacer(Modifier.height(28.dp)) }
            return@LazyColumn
        }

        item {
            Text(
                "Write these before the camp. When a child's results are released, the family " +
                    "gets the plan for the child's group, with your number to phone about a milk " +
                    "intolerance or a food allergy.",
                Modifier.padding(horizontal = 20.dp),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(Modifier.height(6.dp))
        }

        items(data?.templates.orEmpty(), key = { it.key }) { t ->
            HeroCard(
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp, vertical = 6.dp)
                    .clickable {
                        dietician.clearTemplateSaved()
                        openKey = t.key
                    }
            ) {
                Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                    IconBubble(Icons.Outlined.Groups, if (t.saved) FlagGood else HeroBlue)
                    Spacer(Modifier.width(12.dp))
                    Column(Modifier.weight(1f)) {
                        Text(t.label, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                        Text(
                            t.title,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                    }
                    GroupChip(if (t.saved) "Written" else "Starter draft", t.saved) {}
                }
            }
        }
        item { Spacer(Modifier.height(24.dp)) }
    }
}

@Composable
private fun TemplateEditor(
    template: DietTemplateDto,
    busy: Boolean,
    saved: Boolean,
    onSave: (title: String, guidance: String, targets: List<DietTargetDto>) -> Unit,
) {
    var title by remember(template.key) { mutableStateOf(template.title) }
    var guidance by remember(template.key) { mutableStateOf(template.guidance) }
    val targets = remember(template.key) { mutableStateListOf<DietTargetDto>().apply { addAll(template.targets) } }

    Column(Modifier.padding(horizontal = 20.dp)) {
        if (saved) {
            Notice("Saved. Families in this group get it when their child's results are released.", error = false)
            Spacer(Modifier.height(8.dp))
        }
        HeroCard(Modifier.fillMaxWidth()) {
            Column(Modifier.padding(16.dp)) {
                Text(
                    if (template.saved) "Your plan for this group" else "A starter draft. Change anything before you save it.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(Modifier.height(10.dp))
                OutlinedTextField(
                    value = title,
                    onValueChange = { title = it },
                    label = { Text("Title") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(14.dp),
                    colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = HeroOrange),
                )
                Spacer(Modifier.height(10.dp))
                OutlinedTextField(
                    value = guidance,
                    onValueChange = { guidance = it },
                    label = { Text("What the family should do") },
                    minLines = 6,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(14.dp),
                    colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = HeroOrange),
                )
                Spacer(Modifier.height(10.dp))
                Text("Targets", style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.SemiBold)
                targets.forEachIndexed { i, t ->
                    Spacer(Modifier.height(6.dp))
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        OutlinedTextField(
                            value = t.label,
                            onValueChange = { targets[i] = t.copy(label = it) },
                            label = { Text("Such as") },
                            singleLine = true,
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(14.dp),
                            colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = HeroOrange),
                        )
                        Spacer(Modifier.width(6.dp))
                        OutlinedTextField(
                            value = t.value,
                            onValueChange = { targets[i] = t.copy(value = it) },
                            label = { Text("How much") },
                            singleLine = true,
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(14.dp),
                            colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = HeroOrange),
                        )
                        TextButton(onClick = { targets.removeAt(i) }) { Text("Remove") }
                    }
                }
                if (targets.size < 8) {
                    TextButton(onClick = { targets.add(DietTargetDto("", "")) }) { Text("Add a target") }
                }
            }
        }
        Spacer(Modifier.height(14.dp))
        PrimaryGradientButton(
            text = if (busy) "Saving…" else "Save this group's plan",
            onClick = { onSave(title.trim(), guidance.trim(), targets.filter { it.label.isNotBlank() }) },
            modifier = Modifier.fillMaxWidth(),
            enabled = !busy && guidance.trim().length >= 10,
        )
        Spacer(Modifier.height(6.dp))
        Text(
            "Families are asked to phone you before following it if their child has a milk " +
                "intolerance or a food allergy.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

@Composable
private fun GroupChip(text: String, selected: Boolean, onClick: () -> Unit) {
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
