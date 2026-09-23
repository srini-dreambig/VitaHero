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
import kallam.healthcare.data.DieticianViewModel
import kallam.healthcare.ui.components.HeroCard
import kallam.healthcare.ui.components.Notice
import kallam.healthcare.ui.components.PrimaryGradientButton
import kallam.healthcare.ui.components.StatusBarSpacer
import kallam.healthcare.ui.theme.HeroOrange

/**
 * C4 — what a dietician writes for every family, not just one child.
 *
 * The reading library already existed and was operations-only; this is the
 * permission change with a place to type. An article written here is offered
 * to families whose child was flagged on growth or haemoglobin, which is the
 * same scope this role reads — so a dietician is writing to the people they
 * would otherwise be writing individual plans for.
 *
 * Editing somebody else's article is refused by the server, and the refusal is
 * shown as written: "that article was written by somebody else" is a sentence
 * that tells you to change the title, and "save failed" is not.
 */
@Composable
fun DieticianArticlesScreen(
    dietician: DieticianViewModel,
    onBack: () -> Unit,
) {
    val articles by dietician.articles.collectAsState()
    val busy by dietician.busy.collectAsState()
    val message by dietician.message.collectAsState()
    val saved by dietician.saved.collectAsState()

    var writing by remember { mutableStateOf(false) }
    var title by remember { mutableStateOf("") }
    var summary by remember { mutableStateOf("") }
    var body by remember { mutableStateOf("") }
    var locale by remember { mutableStateOf("en") }

    LaunchedEffect(Unit) { dietician.loadArticles() }
    LaunchedEffect(saved) {
        if (saved) {
            writing = false
            title = ""; summary = ""; body = ""
            dietician.clearSaved()
        }
    }

    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = 40.dp)) {
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
                        "What families read",
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold,
                    )
                    Text(
                        "Shown to families whose child was flagged on growth or haemoglobin",
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

        if (!writing) {
            item {
                HeroCard(Modifier.fillMaxWidth().padding(horizontal = 20.dp)) {
                    Column(Modifier.padding(16.dp)) {
                        Text(
                            "Write something for everyone",
                            style = MaterialTheme.typography.titleSmall,
                            fontWeight = FontWeight.SemiBold,
                        )
                        Spacer(Modifier.height(4.dp))
                        Text(
                            "A plan is for one child. This is the advice that is the same "
                                + "for every family — what iron-rich food costs nothing, "
                                + "what a growing child's plate looks like.",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Spacer(Modifier.height(12.dp))
                        PrimaryGradientButton(
                            text = "Write an article",
                            onClick = { writing = true },
                            modifier = Modifier.fillMaxWidth(),
                            enabled = !busy,
                        )
                    }
                }
                Spacer(Modifier.height(14.dp))
            }
        } else {
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
                            colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = HeroOrange),
                        )
                        Spacer(Modifier.height(10.dp))
                        OutlinedTextField(
                            value = summary,
                            onValueChange = { summary = it },
                            label = { Text("One line, shown in the list") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(14.dp),
                            colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = HeroOrange),
                        )
                        Spacer(Modifier.height(10.dp))
                        OutlinedTextField(
                            value = body,
                            onValueChange = { body = it },
                            label = { Text("The article") },
                            minLines = 6,
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(14.dp),
                            colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = HeroOrange),
                        )
                        Spacer(Modifier.height(10.dp))
                        Text(
                            "Language",
                            style = MaterialTheme.typography.labelLarge,
                            fontWeight = FontWeight.SemiBold,
                        )
                        Spacer(Modifier.height(6.dp))
                        Row {
                            LOCALES.forEach { (code, label) ->
                                LocaleChip(label, locale == code) { locale = code }
                                Spacer(Modifier.width(6.dp))
                            }
                        }
                        Spacer(Modifier.height(6.dp))
                        Text(
                            // Said out loud because a family reading Telugu is
                            // shown the English one when there is no Telugu
                            // version, and an author should know that.
                            "A family sees the version in their own language, or the "
                                + "English one if you have not written theirs.",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Spacer(Modifier.height(14.dp))
                        PrimaryGradientButton(
                            text = if (busy) "Publishing…" else "Publish",
                            onClick = { dietician.saveArticle(title, summary, body, locale) },
                            modifier = Modifier.fillMaxWidth(),
                            enabled = !busy && title.trim().length >= 3 && body.trim().length >= 40,
                        )
                        Spacer(Modifier.height(6.dp))
                        Text(
                            "A title and a few sentences. Write it for a parent, not for a "
                                + "clinician.",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Spacer(Modifier.height(10.dp))
                        Text(
                            "Cancel",
                            style = MaterialTheme.typography.labelLarge,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.clickable { writing = false },
                        )
                    }
                }
                Spacer(Modifier.height(14.dp))
            }
        }

        if (articles.isEmpty()) {
            item {
                Text(
                    if (busy) "Loading…" else "You have not written anything yet.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(horizontal = 20.dp),
                )
            }
        } else {
            items(articles.size) { i ->
                val a = articles[i]
                HeroCard(
                    Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 20.dp, vertical = 5.dp)
                        .clickable {
                            title = a.title
                            summary = a.summary
                            body = a.body
                            locale = a.locale
                            writing = true
                        },
                ) {
                    Column(Modifier.padding(14.dp)) {
                        Text(
                            a.title,
                            style = MaterialTheme.typography.titleSmall,
                            fontWeight = FontWeight.SemiBold,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                        Text(
                            listOf(localeLabel(a.locale), if (a.published) "" else "not published")
                                .filter { it.isNotBlank() }.joinToString(" · "),
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        if (a.summary.isNotBlank()) {
                            Spacer(Modifier.height(4.dp))
                            Text(
                                a.summary,
                                style = MaterialTheme.typography.bodySmall,
                                maxLines = 2,
                                overflow = TextOverflow.Ellipsis,
                            )
                        }
                    }
                }
            }
        }
    }
}

private val LOCALES = listOf("en" to "English", "hi" to "हिन्दी", "te" to "తెలుగు")

private fun localeLabel(code: String): String =
    LOCALES.firstOrNull { it.first == code }?.second ?: code

@Composable
private fun LocaleChip(text: String, selected: Boolean, onClick: () -> Unit) {
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
