package kallam.healthcare.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Checkbox
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.snapshots.SnapshotStateList
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import kallam.healthcare.data.FamilyMenuItemDto
import kallam.healthcare.data.FamilyMenuMealDto
import kallam.healthcare.data.MENU_AGE_GROUPS
import kallam.healthcare.data.MENU_AGE_LABEL
import kallam.healthcare.data.MENU_FREQUENCIES
import kallam.healthcare.data.MENU_FREQUENCY_LABEL
import kallam.healthcare.data.MENU_SLOTS
import kallam.healthcare.data.MENU_SLOT_LABEL
import kallam.healthcare.data.MenuItemDto
import kallam.healthcare.data.MenuMealDto
import kallam.healthcare.data.S
import kallam.healthcare.ui.components.AppTextButton
import kallam.healthcare.ui.components.AppTextField
import kallam.healthcare.ui.components.HeroSingleSelectDropdown
import kallam.healthcare.ui.components.SegmentedChoice
import kallam.healthcare.ui.components.Tone
import kallam.healthcare.ui.components.t
import kallam.healthcare.ui.theme.AppCorners
import kallam.healthcare.ui.theme.AppSpacing

/**
 * The dietician's menu: meals, the foods in each, how much for each age
 * group, and how often. The menu is the same for every age; only the
 * quantities change. The server (functions/diet-menus.ts) caps and cleans
 * what is sent, so these limits only keep the screen from offering more.
 */
private const val MAX_MEALS = 10
private const val MAX_ITEMS = 15

@Composable
internal fun MenuEditor(meals: SnapshotStateList<MenuMealDto>, childAgeGroup: String = "") {
    Text("Menu", style = MaterialTheme.typography.titleMedium)
    Text(
        "The same foods for every age. Fill in how much for each age group; " +
            "each family sees the amount for their own child.",
        style = MaterialTheme.typography.bodySmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
    )
    meals.forEachIndexed { mi, m ->
        Spacer(Modifier.height(AppSpacing.md))
        Surface(
            shape = RoundedCornerShape(AppCorners.medium),
            border = BorderStroke(1.dp,MaterialTheme.colorScheme.outlineVariant),
            modifier = Modifier.fillMaxWidth(),
        ) {
            Column(Modifier.padding(AppSpacing.md)) {
                MealHeader(mi, m, meals)
                m.items.forEachIndexed { ii, item ->
                    Spacer(Modifier.height(AppSpacing.sm))
                    HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
                    Spacer(Modifier.height(AppSpacing.sm))
                    ItemFields(item, childAgeGroup,
                        onChange = { meals[mi] = m.copy(items = m.items.toMutableList().also { l -> l[ii] = it }) },
                        onRemove = { meals[mi] = m.copy(items = m.items.toMutableList().also { l -> l.removeAt(ii) }) },
                    )
                }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    if (m.items.size < MAX_ITEMS) {
                        AppTextButton("Add a food", {
                            meals[mi] = m.copy(items = m.items + MenuItemDto(frequency = "DAILY"))
                        })
                    }
                    Spacer(Modifier.weight(1f))
                    if (mi > 0) {
                        AppTextButton("Move up", {
                            val above = meals[mi - 1]
                            meals[mi - 1] = m
                            meals[mi] = above
                        })
                    }
                    AppTextButton("Remove meal", { meals.removeAt(mi) }, tone = Tone.Alert)
                }
            }
        }
    }
    if (meals.size < MAX_MEALS) {
        AppTextButton("Add a meal", {
            meals.add(MenuMealDto(slot = "LUNCH", label = MENU_SLOT_LABEL["LUNCH"] ?: "", items = listOf(MenuItemDto())))
        })
    }
}

@Composable
private fun MealHeader(mi: Int, m: MenuMealDto, meals: SnapshotStateList<MenuMealDto>) {
    Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(AppSpacing.sm)) {
        HeroSingleSelectDropdown(
            label = "Meal",
            options = MENU_SLOTS.map { MENU_SLOT_LABEL[it] ?: it },
            selected = MENU_SLOT_LABEL[m.slot] ?: m.slot,
            onSelect = { picked ->
                val slot = MENU_SLOTS.firstOrNull { (MENU_SLOT_LABEL[it] ?: it).equals(picked, ignoreCase = true) }
                    ?: return@HeroSingleSelectDropdown
                // The heading follows the meal unless the dietician wrote their own.
                val ownHeading = m.label.isNotBlank() && m.label != MENU_SLOT_LABEL[m.slot]
                meals[mi] = m.copy(slot = slot, label = if (ownHeading) m.label else MENU_SLOT_LABEL[slot] ?: "")
            },
            modifier = Modifier.weight(1f),
        )
        AppTextField(
            value = m.time,
            onValueChange = { meals[mi] = m.copy(time = it.take(20)) },
            label = "Time",
            placeholder = "7:00 pm",
            modifier = Modifier.weight(0.6f),
        )
    }
    Spacer(Modifier.height(AppSpacing.sm))
    AppTextField(
        value = m.label,
        onValueChange = { meals[mi] = m.copy(label = it.take(40)) },
        label = "Heading the family sees",
        modifier = Modifier.fillMaxWidth(),
    )
    Row(verticalAlignment = Alignment.CenterVertically) {
        Checkbox(checked = m.chooseAny, onCheckedChange = { meals[mi] = m.copy(chooseAny = it) })
        Text("Family chooses any one of these", style = MaterialTheme.typography.bodyMedium)
    }
}

@Composable
private fun ItemFields(
    item: MenuItemDto,
    childAgeGroup: String,
    onChange: (MenuItemDto) -> Unit,
    onRemove: () -> Unit,
) {
    Row(verticalAlignment = Alignment.Bottom) {
        AppTextField(
            value = item.name,
            onValueChange = { onChange(item.copy(name = it.take(120))) },
            label = "Food",
            modifier = Modifier.weight(1f),
        )
        AppTextButton("Remove", onRemove, tone = Tone.Alert)
    }
    Spacer(Modifier.height(AppSpacing.xs))
    Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(AppSpacing.xs)) {
        MENU_AGE_GROUPS.forEach { g ->
            AppTextField(
                value = item.qty[g] ?: "",
                onValueChange = { onChange(item.copy(qty = item.qty + (g to it.take(60)))) },
                label = (MENU_AGE_LABEL[g] ?: g) + if (g == childAgeGroup) " ✓" else "",
                placeholder = "Amount",
                modifier = Modifier.weight(1f),
            )
        }
    }
    Spacer(Modifier.height(AppSpacing.xs))
    SegmentedChoice(
        options = MENU_FREQUENCIES,
        selected = item.frequency.ifBlank { "DAILY" },
        onSelect = { onChange(item.copy(frequency = it)) },
        label = { MENU_FREQUENCY_LABEL[it] ?: it },
    )
}

/**
 * What a family reads: each meal, its foods, and the amount for their own
 * child. Read-only; the dietician's screens use [MenuEditor].
 */
@Composable
internal fun FamilyMenu(menu: List<FamilyMenuMealDto>) {
    menu.forEachIndexed { i, m ->
        if (i > 0) Spacer(Modifier.height(AppSpacing.md))
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(m.label, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
            if (m.time.isNotBlank()) {
                Text(m.time, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
        if (m.chooseAny && m.items.size > 1) {
            Text(
                t(S.dietMenuChooseAny),
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.primary,
            )
        }
        m.items.forEach { it ->
            Row(Modifier.fillMaxWidth().padding(top = AppSpacing.xxs), verticalAlignment = Alignment.Top) {
                Text("•  " + it.name, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.weight(1f))
                val side = listOf(it.quantity, menuFrequencyLabel(it.frequency)).filter { s -> s.isNotBlank() }.joinToString(" · ")
                if (side.isNotBlank()) {
                    Text(
                        side,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(start = AppSpacing.sm),
                    )
                }
            }
        }
    }
}

/** "Once a week" / "Twice a week" in the family's language; daily needs no label. */
@Composable
internal fun menuFrequencyLabel(code: String): String = when (code) {
    "WEEKLY_ONCE" -> t(S.dietMenuOnceAWeek)
    "WEEKLY_TWICE" -> t(S.dietMenuTwiceAWeek)
    else -> ""
}

/** The child's age group in the family's language, or "" for an unknown code. */
@Composable
internal fun menuAgeLabel(code: String): String = when (code) {
    "UNDER_5" -> t(S.dietAgeUnder5)
    "AGE_6_10" -> t(S.dietAge6to10)
    "AGE_11_16" -> t(S.dietAge11to16)
    else -> ""
}

/**
 * A menu as one age group's family reads it — the same thing the server's
 * menuFor() sends a parent, so the dietician sees what the family will see.
 */
internal fun familyMenuOf(meals: List<MenuMealDto>, ageGroup: String): List<FamilyMenuMealDto> =
    meals.map { m ->
        FamilyMenuMealDto(
            slot = m.slot,
            label = m.label,
            time = m.time,
            chooseAny = m.chooseAny,
            items = m.items.map { i ->
                FamilyMenuItemDto(
                    name = i.name,
                    quantity = i.qty[ageGroup].orEmpty(),
                    frequency = i.frequency,
                    frequencyLabel = if (i.frequency == "DAILY") "" else MENU_FREQUENCY_LABEL[i.frequency].orEmpty(),
                )
            },
        )
    }
