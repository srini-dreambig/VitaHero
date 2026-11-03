package kallam.healthcare.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import kallam.healthcare.data.DieticianViewModel
import kallam.healthcare.ui.components.AppCard
import kallam.healthcare.ui.components.AppListRow
import kallam.healthcare.ui.components.AppScreenHeader
import kallam.healthcare.ui.components.AppTextButton
import kallam.healthcare.ui.components.AppTextField
import kallam.healthcare.ui.components.Notice
import kallam.healthcare.ui.components.PrimaryGradientButton
import kallam.healthcare.ui.components.SelectChip
import kallam.healthcare.ui.components.StatusBarSpacer
import kallam.healthcare.ui.components.StatusPill
import kallam.healthcare.ui.components.Tone
import kallam.healthcare.ui.theme.AppSpacing

/**
 * C4 — what a dietician writes for every family, not just one child.
 *
 * The reading library already existed and was operations-only; this is the
 * permission change with a place to type. An article written here is offered
 * to families whose child was flagged on growth, which is the
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

    Column(Modifier.fillMaxSize()) {
        StatusBarSpacer()
        AppScreenHeader(
            "What families read",
            subtitle = "Shown to families whose child was flagged on growth",
            onBack = onBack,
        )
        if (message.isNotBlank()) Notice(message, error = true)

        LazyColumn(
            Modifier.fillMaxSize(),
            contentPadding = PaddingValues(
                start = AppSpacing.xl,
                end = AppSpacing.xl,
                top = AppSpacing.sm,
                bottom = AppSpacing.xxxl,
            ),
            verticalArrangement = Arrangement.spacedBy(AppSpacing.md),
        ) {
            if (!writing) {
                item {
                    AppCard {
                        Text(
                            "Write something for everyone",
                            style = MaterialTheme.typography.titleMedium,
                        )
                        Spacer(Modifier.height(AppSpacing.xs))
                        Text(
                            "A plan is for one child. This is the advice that is the same "
                                + "for every family — what iron-rich food costs nothing, "
                                + "what a growing child's plate looks like.",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Spacer(Modifier.height(AppSpacing.md))
                        PrimaryGradientButton(
                            text = "Write an article",
                            onClick = { writing = true },
                            modifier = Modifier.fillMaxWidth(),
                            enabled = !busy,
                        )
                    }
                }
            } else {
                item {
                    AppCard {
                        AppTextField(
                            value = title,
                            onValueChange = { title = it },
                            label = "Title",
                            modifier = Modifier.fillMaxWidth(),
                        )
                        Spacer(Modifier.height(AppSpacing.md))
                        AppTextField(
                            value = summary,
                            onValueChange = { summary = it },
                            label = "One line, shown in the list",
                            modifier = Modifier.fillMaxWidth(),
                        )
                        Spacer(Modifier.height(AppSpacing.md))
                        AppTextField(
                            value = body,
                            onValueChange = { body = it },
                            label = "The article",
                            singleLine = false,
                            minLines = 6,
                            modifier = Modifier.fillMaxWidth(),
                        )
                        Spacer(Modifier.height(AppSpacing.md))
                        Text(
                            "Language",
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Spacer(Modifier.height(AppSpacing.xs))
                        Row(horizontalArrangement = Arrangement.spacedBy(AppSpacing.sm)) {
                            LOCALES.forEach { (code, label) ->
                                SelectChip(label, locale == code, onClick = { locale = code })
                            }
                        }
                        Spacer(Modifier.height(AppSpacing.sm))
                        Text(
                            // Said out loud because a family reading Telugu is
                            // shown the English one when there is no Telugu
                            // version, and an author should know that.
                            "A family sees the version in their own language, or the "
                                + "English one if you have not written theirs.",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Spacer(Modifier.height(AppSpacing.lg))
                        PrimaryGradientButton(
                            text = if (busy) "Publishing…" else "Publish",
                            onClick = { dietician.saveArticle(title, summary, body, locale) },
                            modifier = Modifier.fillMaxWidth(),
                            enabled = !busy && title.trim().length >= 3 && body.trim().length >= 40,
                        )
                        Spacer(Modifier.height(AppSpacing.sm))
                        Text(
                            "A title and a few sentences. Write it for a parent, not for a "
                                + "clinician.",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Spacer(Modifier.height(AppSpacing.xs))
                        AppTextButton("Cancel", { writing = false }, tone = Tone.Neutral)
                    }
                }
            }

            if (articles.isEmpty()) {
                item {
                    Text(
                        if (busy) "Loading…" else "You have not written anything yet.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            } else {
                items(articles.size) { i ->
                    val a = articles[i]
                    AppListRow(
                        title = a.title,
                        subtitle = localeLabel(a.locale),
                        supporting = a.summary.ifBlank { null },
                        trailing = if (a.published) null else {
                            { StatusPill("not published", Tone.Neutral) }
                        },
                        onClick = {
                            title = a.title
                            summary = a.summary
                            body = a.body
                            locale = a.locale
                            writing = true
                        },
                    )
                }
            }
        }
    }
}

private val LOCALES = listOf("en" to "English", "hi" to "हिन्दी", "te" to "తెలుగు")

private fun localeLabel(code: String): String =
    LOCALES.firstOrNull { it.first == code }?.second ?: code
