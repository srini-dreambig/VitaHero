package kallam.healthcare.ui.screens

import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
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
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Groups
import androidx.compose.material3.Checkbox
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshots.SnapshotStateList
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import kallam.healthcare.data.CohortDraftDto
import kallam.healthcare.data.DietTargetDto
import kallam.healthcare.data.DietTemplateDto
import kallam.healthcare.data.DieticianCohortDto
import kallam.healthcare.data.DieticianViewModel
import kallam.healthcare.data.classTitle
import kallam.healthcare.ui.components.AppCard
import kallam.healthcare.ui.components.AppListRow
import kallam.healthcare.ui.components.AppScreenHeader
import kallam.healthcare.ui.components.AppSectionTitle
import kallam.healthcare.ui.components.AppTextButton
import kallam.healthcare.ui.components.AppTextField
import kallam.healthcare.ui.components.EmptyState
import kallam.healthcare.ui.components.IconBubble
import kallam.healthcare.ui.components.InfoNote
import kallam.healthcare.ui.components.Notice
import kallam.healthcare.ui.components.PrimaryGradientButton
import kallam.healthcare.ui.components.SelectChip
import kallam.healthcare.ui.components.StatusBarSpacer
import kallam.healthcare.ui.components.StatusPill
import kallam.healthcare.ui.components.Tone
import kallam.healthcare.ui.theme.AppSpacing
import kallam.healthcare.ui.theme.FlagAlert
import kallam.healthcare.ui.theme.FlagGood
import kallam.healthcare.ui.theme.FlagWatch
import kallam.healthcare.ui.theme.HeroBlue

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

    Column(Modifier.fillMaxSize()) {
        StatusBarSpacer()
        AppScreenHeader(
            open?.label ?: "Plan by groups",
            subtitle = listOf(schoolName, if (grade.isBlank()) "All classes" else classTitle(grade))
                .filter { it.isNotBlank() }.joinToString(" · "),
            onBack = {
                if (open != null) {
                    openKey = ""
                    dietician.clearCohortDraft()
                } else onBack()
            },
        )
        if (message.isNotBlank()) Notice(message, error = true)

        LazyColumn(
            Modifier.fillMaxSize(),
            contentPadding = PaddingValues(
                start = AppSpacing.xl,
                end = AppSpacing.xl,
                top = AppSpacing.sm,
                bottom = AppSpacing.xxl,
            ),
            verticalArrangement = Arrangement.spacedBy(AppSpacing.md),
        ) {
            if (open == null) {
                // The twelve plans written before the camp. Each family gets the
                // one for their child's group as soon as the results are released.
                item {
                    AppCard(onClick = { precamp = true }) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            IconBubble(Icons.Outlined.Groups, MaterialTheme.colorScheme.primary)
                            Spacer(Modifier.width(AppSpacing.md))
                            Column(Modifier.weight(1f)) {
                                Text(
                                    "Pre-camp diet plans",
                                    style = MaterialTheme.typography.titleMedium,
                                )
                                Text(
                                    "One plan per group, written before the camp. Families get " +
                                        "their child's plan when the results are released.",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                            }
                            val t = templates
                            Spacer(Modifier.width(AppSpacing.sm))
                            Text(
                                if (t == null) "" else "${t.ready} of ${t.templates.size}",
                                style = MaterialTheme.typography.titleMedium,
                            )
                        }
                    }
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
                return@LazyColumn
            }

            // Classes to narrow by. Built from the whole school's list, so picking
            // one does not make the others disappear.
            val grades = d?.grades.orEmpty()
            if (grades.size > 1) {
                item {
                    Row(
                        Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                        horizontalArrangement = Arrangement.spacedBy(AppSpacing.sm),
                    ) {
                        SelectChip("All classes", grade.isBlank(), onClick = { grade = "" })
                        grades.forEach { g ->
                            SelectChip(classTitle(g), grade == g, onClick = { grade = g })
                        }
                    }
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
                    )
                }
                return@LazyColumn
            }

            item {
                Text(
                    "${d.total} children with check results, in ${d.cohorts.size} " +
                        (if (d.cohorts.size == 1) "group" else "groups") +
                        ". Most urgent first.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            items(d.cohorts, key = { it.key }) { c ->
                AppListRow(
                    title = c.label,
                    subtitle = "${c.summary.withPlan} on a plan",
                    supporting = summaryLine(c),
                    leading = { IconBubble(Icons.Outlined.Groups, cohortColour(c)) },
                    trailing = {
                        Text("${c.summary.count}", style = MaterialTheme.typography.titleMedium)
                    },
                    onClick = {
                        dietician.clearCohortDraft()
                        openKey = c.key
                    },
                )
            }
        }
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

    Column {
        Text(
            summaryLine(cohort),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(Modifier.height(AppSpacing.md))

        if (saved > 0) {
            InfoNote(
                "Sent to ${if (saved == 1) "1 family" else "$saved families"}. " +
                    "Each child's earlier plan was kept as history.",
            )
            Spacer(Modifier.height(AppSpacing.md))
        }

        AppCard {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    "The plan",
                    style = MaterialTheme.typography.titleMedium,
                    modifier = Modifier.weight(1f),
                )
                StatusPill(
                    when (source) {
                        "AI" -> "Drafted by AI"
                        "TEMPLATE" -> "Your pre-camp plan"
                        else -> "Starter draft"
                    },
                    if (source == "AI" || source == "TEMPLATE") Tone.Brand else Tone.Neutral,
                )
            }
            Spacer(Modifier.height(AppSpacing.xs))
            Text(
                "A starting point. Change anything before you send it.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(Modifier.height(AppSpacing.md))
            PlanFields(
                title = title,
                onTitle = { title = it },
                guidance = guidance,
                onGuidance = { guidance = it },
                targets = targets,
            )
            Spacer(Modifier.height(AppSpacing.xs))
            AppTextButton(if (busy) "Working…" else "Draft with AI", onAskAi, enabled = !busy)
            Text(
                "The AI is told the group's make-up — ages, how many girls and boys, " +
                    "what was found — and never a child's name.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }

        Spacer(Modifier.height(AppSpacing.xxl))
        AppSectionTitle(
            "Children (${ticked.size} of ${cohort.children.size} ticked)",
            actionLabel = if (ticked.size == cohort.children.size) "Untick all" else "Tick all",
            onAction = {
                if (ticked.size == cohort.children.size) ticked.clear()
                else { ticked.clear(); ticked.addAll(cohort.children.map { it.kidId }) }
            },
        )
        cohort.children.forEach { k ->
            Row(
                Modifier.fillMaxWidth().padding(vertical = AppSpacing.xxs),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Checkbox(
                    checked = k.kidId in ticked,
                    onCheckedChange = { on -> if (on) ticked.add(k.kidId) else ticked.remove(k.kidId) },
                )
                Column(Modifier.weight(1f).clickable { onOpenChild(k.kidId) }) {
                    Text(k.name, style = MaterialTheme.typography.titleMedium)
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

        Spacer(Modifier.height(AppSpacing.lg))
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
        Spacer(Modifier.height(AppSpacing.sm))
        Text(
            "Tap a name to open that child's record and write them a plan of their own.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

/**
 * Title, guidance and the target rows. The group editor and the pre-camp
 * editor had two identical copies of this; it is one here so they stay alike.
 */
@Composable
private fun PlanFields(
    title: String,
    onTitle: (String) -> Unit,
    guidance: String,
    onGuidance: (String) -> Unit,
    targets: SnapshotStateList<DietTargetDto>,
) {
    AppTextField(
        value = title,
        onValueChange = onTitle,
        label = "Title",
        modifier = Modifier.fillMaxWidth(),
    )
    Spacer(Modifier.height(AppSpacing.md))
    AppTextField(
        value = guidance,
        onValueChange = onGuidance,
        label = "What the family should do",
        singleLine = false,
        minLines = 6,
        modifier = Modifier.fillMaxWidth(),
    )
    Spacer(Modifier.height(AppSpacing.lg))
    Text("Targets", style = MaterialTheme.typography.titleMedium)
    targets.forEachIndexed { i, t ->
        Spacer(Modifier.height(AppSpacing.sm))
        Row(
            verticalAlignment = Alignment.Bottom,
            horizontalArrangement = Arrangement.spacedBy(AppSpacing.sm),
        ) {
            AppTextField(
                value = t.label,
                onValueChange = { targets[i] = t.copy(label = it) },
                label = "Such as",
                modifier = Modifier.weight(1f),
            )
            AppTextField(
                value = t.value,
                onValueChange = { targets[i] = t.copy(value = it) },
                label = "How much",
                modifier = Modifier.weight(1f),
            )
            AppTextButton("Remove", { targets.removeAt(i) })
        }
    }
    if (targets.size < 8) {
        AppTextButton("Add a target", { targets.add(DietTargetDto("", "")) })
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
internal fun PrecampPlansScreen(dietician: DieticianViewModel, onBack: () -> Unit) {
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

    Column(Modifier.fillMaxSize()) {
        StatusBarSpacer()
        val d = data
        AppScreenHeader(
            open?.label ?: "Pre-camp diet plans",
            subtitle = if (d == null) "Loading…" else "${d.ready} of ${d.templates.size} written",
            onBack = {
                if (open != null) {
                    openKey = ""
                    dietician.clearTemplateSaved()
                } else onBack()
            },
        )
        if (message.isNotBlank()) Notice(message, error = true)

        LazyColumn(
            Modifier.fillMaxSize(),
            contentPadding = PaddingValues(
                start = AppSpacing.xl,
                end = AppSpacing.xl,
                top = AppSpacing.sm,
                bottom = AppSpacing.xxl,
            ),
            verticalArrangement = Arrangement.spacedBy(AppSpacing.md),
        ) {
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
                return@LazyColumn
            }

            item {
                Text(
                    "Write these before the camp. When a child's results are released, the family " +
                        "gets the plan for the child's group, with your number to phone about a milk " +
                        "intolerance or a food allergy.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }

            // Six growth groups, written once for girls and once for boys.
            val all = data?.templates.orEmpty()
            for ((sex, heading) in listOf("+GIRLS" to "Girls", "+BOYS" to "Boys")) {
                val part = all.filter { it.key.endsWith(sex) }
                if (part.isEmpty()) continue
                item(key = "h$sex") {
                    AppSectionTitle(heading, subtitle = "${part.count { it.saved }} of ${part.size} written")
                }
                items(part, key = { it.key }) { t ->
                    AppListRow(
                        title = t.label,
                        subtitle = t.title,
                        leading = {
                            IconBubble(
                                Icons.Outlined.Groups,
                                if (t.saved) FlagGood else MaterialTheme.colorScheme.secondary,
                            )
                        },
                        trailing = {
                            StatusPill(
                                if (t.saved) "Written" else "Starter draft",
                                if (t.saved) Tone.Good else Tone.Neutral,
                            )
                        },
                        onClick = {
                            dietician.clearTemplateSaved()
                            openKey = t.key
                        },
                    )
                }
            }
        }
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

    Column {
        if (saved) {
            InfoNote("Saved. Families in this group get it when their child's results are released.")
            Spacer(Modifier.height(AppSpacing.md))
        }
        AppCard {
            Text(
                if (template.saved) "Your plan for this group" else "A starter draft. Change anything before you save it.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(Modifier.height(AppSpacing.md))
            PlanFields(
                title = title,
                onTitle = { title = it },
                guidance = guidance,
                onGuidance = { guidance = it },
                targets = targets,
            )
        }
        Spacer(Modifier.height(AppSpacing.lg))
        PrimaryGradientButton(
            text = if (busy) "Saving…" else "Save this group's plan",
            onClick = { onSave(title.trim(), guidance.trim(), targets.filter { it.label.isNotBlank() }) },
            modifier = Modifier.fillMaxWidth(),
            enabled = !busy && guidance.trim().length >= 10,
        )
        Spacer(Modifier.height(AppSpacing.sm))
        Text(
            "Families are asked to phone you before following it if their child has a milk " +
                "intolerance or a food allergy.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}
