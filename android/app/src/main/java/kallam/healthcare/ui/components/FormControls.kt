package kallam.healthcare.ui.components

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateColorAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material.icons.filled.ArrowDropUp
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ExposedDropdownMenuAnchorType
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import kallam.healthcare.ui.theme.AppCorners
import kallam.healthcare.ui.theme.AppSpacing
import kallam.healthcare.ui.theme.HeroOrange

/** Format raw option strings into readable Title Case labels. */
fun formatOptionText(option: String): String {
    if (option.isBlank()) return ""
    if (option.startsWith("<") || option.contains("6/") || option.matches(Regex("^[0-9]+.*"))) return option
    return option.split(" ").joinToString(" ") { word ->
        if (word == "/" || word == "&") word
        else word.replaceFirstChar { if (it.isLowerCase()) it.titlecase() else it.toString() }
    }
}

/** Standard Form Group Title with consistent spacing and typography. */
@Composable
fun HeroFormSectionHeader(
    title: String,
    modifier: Modifier = Modifier,
    subtitle: String? = null
) {
    Column(modifier = modifier.fillMaxWidth()) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(AppSpacing.sm)
        ) {
            Box(
                modifier = Modifier
                    .width(4.dp)
                    .height(16.dp)
                    .clip(RoundedCornerShape(2.dp))
                    .background(HeroOrange)
            )
            Text(
                text = title,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onBackground
            )
        }
        if (!subtitle.isNullOrBlank()) {
            Spacer(Modifier.height(AppSpacing.xxs))
            Text(
                text = subtitle,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(start = AppSpacing.md)
            )
        }
    }
}

/**
 * Professional Single-Select Dropdown Selector.
 * Replaces hardcoded chip lists with an elegant Material 3 Exposed Dropdown Menu.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HeroSingleSelectDropdown(
    label: String,
    options: List<String>,
    selected: String,
    onSelect: (String) -> Unit,
    modifier: Modifier = Modifier,
    placeholder: String = "Select an option"
) {
    var expanded by remember { mutableStateOf(false) }

    Column(modifier = modifier) {
        if (label.isNotBlank()) {
            Text(
                text = label,
                style = MaterialTheme.typography.labelLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(bottom = AppSpacing.xs)
            )
        }
        ExposedDropdownMenuBox(
            expanded = expanded,
            onExpandedChange = { expanded = !expanded },
            modifier = Modifier.fillMaxWidth()
        ) {
            OutlinedTextField(
                value = formatOptionText(selected),
                onValueChange = {},
                readOnly = true,
                placeholder = {
                    Text(
                        placeholder,
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f)
                    )
                },
                trailingIcon = {
                    ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded)
                },
                singleLine = true,
                shape = RoundedCornerShape(AppCorners.medium),
                textStyle = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Medium),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = HeroOrange,
                    unfocusedBorderColor = MaterialTheme.colorScheme.outline,
                    focusedContainerColor = MaterialTheme.colorScheme.surface,
                    unfocusedContainerColor = MaterialTheme.colorScheme.surface
                ),
                modifier = Modifier
                    .fillMaxWidth()
                    .menuAnchor(ExposedDropdownMenuAnchorType.PrimaryNotEditable, enabled = true)
            )

            ExposedDropdownMenu(
                expanded = expanded,
                onDismissRequest = { expanded = false },
                modifier = Modifier
                    .background(MaterialTheme.colorScheme.surface)
                    .clip(RoundedCornerShape(AppCorners.large))
            ) {
                options.forEach { option ->
                    val isSelected = option.equals(selected, ignoreCase = true)
                    DropdownMenuItem(
                        text = {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.SpaceBetween,
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Text(
                                    text = formatOptionText(option),
                                    style = MaterialTheme.typography.bodyMedium,
                                    fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                                    color = if (isSelected) HeroOrange else MaterialTheme.colorScheme.onSurface
                                )
                                if (isSelected) {
                                    Icon(
                                        imageVector = Icons.Default.Check,
                                        contentDescription = "Selected",
                                        tint = HeroOrange,
                                        modifier = Modifier.size(18.dp)
                                    )
                                }
                            }
                        },
                        onClick = {
                            onSelect(if (isSelected) "" else option)
                            expanded = false
                        }
                    )
                }
            }
        }
    }
}

/**
 * Professional Multi-Select Dropdown Selector.
 * Displays a summary field and interactive dropdown menu with checkable options.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HeroMultiSelectDropdown(
    label: String,
    options: List<String>,
    selected: Set<String>,
    onSelect: (Set<String>) -> Unit,
    modifier: Modifier = Modifier,
    placeholder: String = "Select options..."
) {
    var expanded by remember { mutableStateOf(false) }

    val displayText = remember(selected) {
        if (selected.isEmpty()) ""
        else selected.map { formatOptionText(it) }.joinToString(", ")
    }

    Column(modifier = modifier) {
        if (label.isNotBlank()) {
            Text(
                text = label,
                style = MaterialTheme.typography.labelLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(bottom = AppSpacing.xs)
            )
        }

        ExposedDropdownMenuBox(
            expanded = expanded,
            onExpandedChange = { expanded = !expanded },
            modifier = Modifier.fillMaxWidth()
        ) {
            OutlinedTextField(
                value = displayText,
                onValueChange = {},
                readOnly = true,
                placeholder = {
                    Text(
                        placeholder,
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f)
                    )
                },
                trailingIcon = {
                    ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded)
                },
                leadingIcon = if (selected.isNotEmpty()) {
                    {
                        Box(
                            modifier = Modifier
                                .size(22.dp)
                                .clip(CircleShape)
                                .background(HeroOrange.copy(alpha = 0.15f)),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = selected.size.toString(),
                                style = MaterialTheme.typography.labelSmall,
                                fontWeight = FontWeight.Bold,
                                color = HeroOrange
                            )
                        }
                    }
                } else null,
                singleLine = true,
                shape = RoundedCornerShape(AppCorners.medium),
                textStyle = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Medium),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = HeroOrange,
                    unfocusedBorderColor = MaterialTheme.colorScheme.outline,
                    focusedContainerColor = MaterialTheme.colorScheme.surface,
                    unfocusedContainerColor = MaterialTheme.colorScheme.surface
                ),
                modifier = Modifier
                    .fillMaxWidth()
                    .menuAnchor(ExposedDropdownMenuAnchorType.PrimaryNotEditable, enabled = true)
            )

            ExposedDropdownMenu(
                expanded = expanded,
                onDismissRequest = { expanded = false },
                modifier = Modifier
                    .heightIn(max = 280.dp)
                    .background(MaterialTheme.colorScheme.surface)
                    .clip(RoundedCornerShape(AppCorners.large))
            ) {
                options.forEach { option ->
                    val isChecked = option in selected || selected.any { it.equals(option, ignoreCase = true) }
                    DropdownMenuItem(
                        text = {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(AppSpacing.sm),
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Checkbox(
                                    checked = isChecked,
                                    onCheckedChange = null,
                                    colors = CheckboxDefaults.colors(checkedColor = HeroOrange)
                                )
                                Text(
                                    text = formatOptionText(option),
                                    style = MaterialTheme.typography.bodyMedium,
                                    fontWeight = if (isChecked) FontWeight.SemiBold else FontWeight.Normal,
                                    color = if (isChecked) HeroOrange else MaterialTheme.colorScheme.onSurface
                                )
                            }
                        },
                        onClick = {
                            val newSet = if (isChecked) {
                                selected.filterNot { it.equals(option, ignoreCase = true) }.toSet()
                            } else {
                                selected + option
                            }
                            onSelect(newSet)
                        }
                    )
                }

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = AppSpacing.md, vertical = AppSpacing.xs),
                    horizontalArrangement = Arrangement.End
                ) {
                    TextButton(onClick = { expanded = false }) {
                        Text(
                            "Done",
                            style = MaterialTheme.typography.labelLarge,
                            color = HeroOrange,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }
        }
    }
}

/**
 * Modern Segmented Control for 2-4 mutually exclusive options.
 * Provides a clean sliding tab appearance for quick selections.
 */
@Composable
fun HeroSegmentedPicker(
    options: List<String>,
    selected: String,
    onSelect: (String) -> Unit,
    modifier: Modifier = Modifier,
    label: String? = null
) {
    Column(modifier = modifier.fillMaxWidth()) {
        if (!label.isNullOrBlank()) {
            Text(
                text = label,
                style = MaterialTheme.typography.labelLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(bottom = AppSpacing.xs)
            )
        }
        Surface(
            shape = RoundedCornerShape(AppCorners.medium),
            color = MaterialTheme.colorScheme.surfaceVariant,
            modifier = Modifier.fillMaxWidth()
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(AppSpacing.xxs),
                horizontalArrangement = Arrangement.spacedBy(AppSpacing.xxs)
            ) {
                options.forEach { option ->
                    val isSelected = option.equals(selected, ignoreCase = true)
                    val bgColor by animateColorAsState(
                        targetValue = if (isSelected) MaterialTheme.colorScheme.surface else Color.Transparent,
                        label = "segmented_bg"
                    )
                    val textColor by animateColorAsState(
                        targetValue = if (isSelected) HeroOrange else MaterialTheme.colorScheme.onSurfaceVariant,
                        label = "segmented_text"
                    )

                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(AppCorners.small))
                            .background(bgColor)
                            .clickable { onSelect(if (isSelected) "" else option) }
                            .padding(vertical = AppSpacing.sm, horizontal = AppSpacing.xs),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = formatOptionText(option),
                            style = MaterialTheme.typography.labelMedium,
                            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                            color = textColor,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                }
            }
        }
    }
}

/**
 * Modern Chip Grid with consistent text styling, alignment, and checkmarks.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun HeroMultiChoiceChips(
    options: List<String>,
    selected: Set<String>,
    onSelect: (Set<String>) -> Unit,
    modifier: Modifier = Modifier
) {
    FlowRow(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(AppSpacing.sm),
        verticalArrangement = Arrangement.spacedBy(AppSpacing.sm)
    ) {
        options.forEach { option ->
            val isSelected = option in selected || selected.any { it.equals(option, ignoreCase = true) }
            Surface(
                shape = RoundedCornerShape(AppCorners.pill),
                color = if (isSelected) HeroOrange.copy(alpha = 0.14f) else MaterialTheme.colorScheme.surfaceVariant,
                border = if (isSelected) androidx.compose.foundation.BorderStroke(1.dp, HeroOrange) else null,
                modifier = Modifier
                    .clip(RoundedCornerShape(AppCorners.pill))
                    .clickable {
                        val newSet = if (isSelected) {
                            selected.filterNot { it.equals(option, ignoreCase = true) }.toSet()
                        } else {
                            selected + option
                        }
                        onSelect(newSet)
                    }
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(AppSpacing.xs),
                    modifier = Modifier.padding(horizontal = AppSpacing.md, vertical = 7.dp)
                ) {
                    if (isSelected) {
                        Icon(
                            imageVector = Icons.Default.Check,
                            contentDescription = null,
                            tint = HeroOrange,
                            modifier = Modifier.size(15.dp)
                        )
                    }
                    Text(
                        text = formatOptionText(option),
                        style = MaterialTheme.typography.labelMedium,
                        fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                        color = if (isSelected) HeroOrange else MaterialTheme.colorScheme.onSurface
                    )
                }
            }
        }
    }
}
