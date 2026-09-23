package kallam.healthcare.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.Groups
import androidx.compose.material.icons.outlined.Search
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
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import kallam.healthcare.data.DieticianViewModel
import kallam.healthcare.ui.components.EmptyState
import kallam.healthcare.ui.components.HeroCard
import kallam.healthcare.ui.components.IconBubble
import kallam.healthcare.ui.components.Notice
import kallam.healthcare.ui.components.StatusBarSpacer
import kallam.healthcare.ui.theme.HeroBlue
import kallam.healthcare.ui.theme.HeroOrange

/**
 * The children at one of this dietician's schools.
 *
 * Each row carries only what is needed to choose: the name, the class, whether
 * a plan is running, and how many of the two checks this person may read came
 * back flagged. Not the readings — those are one tap away, and that tap is
 * written to the access trail.
 *
 * The filter is done here rather than on the server because the list is one
 * school's roster and a round trip to re-filter a few hundred names is a round
 * trip spent to feel slower. The server still decides which names are in it.
 */
@Composable
fun DieticianChildrenScreen(
    schoolId: String,
    schoolName: String,
    dietician: DieticianViewModel,
    onOpenChild: (kidId: String) -> Unit,
    onBack: () -> Unit,
) {
    val children by dietician.children.collectAsState()
    val busy by dietician.busy.collectAsState()
    val message by dietician.message.collectAsState()
    var query by rememberSaveable { mutableStateOf("") }

    LaunchedEffect(schoolId) { dietician.loadChildren(schoolId) }

    val q = query.trim().lowercase()
    val shown = if (q.isEmpty()) children else children.filter { it.name.lowercase().contains(q) }
    val onPlan = children.count { it.hasPlan }

    LazyColumn(Modifier.fillMaxSize()) {
        item {
            StatusBarSpacer()
            Row(
                Modifier.fillMaxWidth().padding(8.dp, 8.dp, 20.dp, 0.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                IconButton(onClick = onBack) {
                    Icon(Icons.AutoMirrored.Outlined.ArrowBack, contentDescription = "Back")
                }
                Column(Modifier.weight(1f)) {
                    Text(
                        schoolName,
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Text(
                        "$onPlan of ${children.size} on a plan",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
            if (message.isNotBlank()) {
                Column(Modifier.padding(horizontal = 20.dp)) { Notice(message, error = true) }
            }
            Spacer(Modifier.height(12.dp))
            OutlinedTextField(
                value = query,
                onValueChange = { query = it },
                modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp),
                placeholder = { Text("Search by name") },
                leadingIcon = { Icon(Icons.Outlined.Search, contentDescription = null) },
                singleLine = true,
                shape = RoundedCornerShape(14.dp),
                colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = HeroOrange),
            )
            Spacer(Modifier.height(12.dp))
        }

        if (shown.isEmpty()) {
            item {
                EmptyState(
                    icon = Icons.Outlined.Groups,
                    title = when {
                        busy -> "Loading…"
                        children.isEmpty() -> "No children on this roster yet"
                        else -> "Nobody matches that"
                    },
                    subtitle = when {
                        busy -> "One moment."
                        children.isEmpty() -> (
                            "The school office builds the roster. Once it is in, every child "
                                + "here can be given a plan."
                        )
                        else -> "Try part of the name."
                    },
                    modifier = Modifier.padding(20.dp),
                )
            }
        } else {
            items(shown, key = { it.kidId }) { child ->
                HeroCard(
                    Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 20.dp, vertical = 6.dp)
                        .clickable { onOpenChild(child.kidId) }
                ) {
                    Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                        IconBubble(Icons.Outlined.Groups, if (child.concerns > 0) HeroOrange else HeroBlue)
                        Spacer(Modifier.width(12.dp))
                        Column(Modifier.weight(1f)) {
                            Text(
                                child.name,
                                style = MaterialTheme.typography.titleSmall,
                                fontWeight = FontWeight.SemiBold,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                            )
                            Text(
                                listOf(
                                    listOf(child.grade, child.section).filter { it.isNotBlank() }
                                        .joinToString(" "),
                                    child.age?.let { "$it yrs" } ?: "",
                                ).filter { it.isNotBlank() }.joinToString(" · "),
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                        Column(horizontalAlignment = Alignment.End) {
                            if (child.hasPlan) DietChip("On a plan", HeroBlue)
                            if (child.concerns > 0) {
                                if (child.hasPlan) Spacer(Modifier.height(4.dp))
                                DietChip(
                                    if (child.concerns == 1) "1 to look at" else "${child.concerns} to look at",
                                    HeroOrange,
                                )
                            }
                        }
                    }
                }
            }
        }
        item { Spacer(Modifier.height(24.dp)) }
    }
}

@Composable
private fun DietChip(text: String, colour: Color) {
    Box(
        Modifier
            .clip(RoundedCornerShape(50))
            .background(colour.copy(alpha = 0.12f))
            .padding(horizontal = 8.dp, vertical = 2.dp),
    ) {
        Text(
            text,
            style = MaterialTheme.typography.labelSmall,
            fontWeight = FontWeight.SemiBold,
            color = colour,
        )
    }
}
