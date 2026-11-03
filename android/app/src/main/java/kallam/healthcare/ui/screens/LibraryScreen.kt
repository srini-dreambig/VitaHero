package kallam.healthcare.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.MenuBook
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import kallam.healthcare.data.ArticleDto
import kallam.healthcare.data.GuardianViewModel
import kallam.healthcare.data.S
import kallam.healthcare.ui.components.AppCard
import kallam.healthcare.ui.components.AppListRow
import kallam.healthcare.ui.components.AppScreenHeader
import kallam.healthcare.ui.components.AppSectionTitle
import kallam.healthcare.ui.components.IconBubble
import kallam.healthcare.ui.components.SecondaryButton
import kallam.healthcare.ui.components.StatusBarSpacer
import kallam.healthcare.ui.components.Tone
import kallam.healthcare.ui.components.t
import kallam.healthcare.ui.components.tf2
import kallam.healthcare.ui.theme.AppSpacing

/**
 * Reading, chosen from this family's own results.
 *
 * The "for you" shelf is not a recommendation engine: an article appears there
 * because a physician flagged that check for that child, at that age, and each
 * one says which child and which finding put it there. Everything else is on
 * the general shelf, the same for everyone.
 */
@Composable
fun LibraryScreen(
    guardianViewModel: GuardianViewModel,
    onBack: () -> Unit,
) {
    val library by guardianViewModel.library.collectAsState()
    val open by guardianViewModel.openArticle.collectAsState()

    LaunchedEffect(Unit) { guardianViewModel.loadLibrary() }

    val article = open
    if (article != null) {
        ArticleScreen(article) { guardianViewModel.closeArticle() }
        return
    }

    Column(
        Modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.background)
    ) {
        StatusBarSpacer()
        AppScreenHeader(t(S.libraryTitle), subtitle = t(S.librarySub), onBack = onBack)
        LazyColumn(
            modifier = Modifier.fillMaxWidth(),
            contentPadding = PaddingValues(start = AppSpacing.xl, end = AppSpacing.xl, top = AppSpacing.sm, bottom = AppSpacing.xxxl),
            verticalArrangement = Arrangement.spacedBy(AppSpacing.md),
        ) {
            if (library.forYou.isNotEmpty()) {
                item { AppSectionTitle(t(S.forYourFamily)) }
                items(library.forYou, key = { "you/" + it.slug }) { a ->
                    ArticleRow(a, true) { guardianViewModel.openArticle(a.slug) }
                }
            }

            if (library.general.isNotEmpty()) {
                item {
                    AppSectionTitle(
                        t(S.generalReading),
                        Modifier.padding(top = if (library.forYou.isNotEmpty()) AppSpacing.md else 0.dp),
                    )
                }
                items(library.general, key = { "gen/" + it.slug }) { a ->
                    ArticleRow(a, false) { guardianViewModel.openArticle(a.slug) }
                }
            }

            if (library.forYou.isEmpty() && library.general.isEmpty()) {
                item {
                    AppCard {
                        Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
                            IconBubble(Icons.AutoMirrored.Outlined.MenuBook, MaterialTheme.colorScheme.secondary)
                            Spacer(Modifier.height(AppSpacing.md))
                            Text(
                                t(S.libraryEmpty),
                                style = MaterialTheme.typography.titleMedium,
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ArticleRow(a: ArticleDto, personal: Boolean, onOpen: () -> Unit) {
    // Saying why this article is here matters more than the article: a
    // parent should never wonder whether the app knows something they
    // have not been told.
    val because = a.because
    AppListRow(
        title = a.title,
        subtitle = a.summary.ifBlank { null },
        supporting = if (personal && because != null) tf2(S.becauseOfFinding, because.kidName, because.checkType) else null,
        supportingTone = Tone.Brand,
        showChevron = true,
        onClick = onOpen,
    )
}

@Composable
private fun ArticleScreen(a: ArticleDto, onBack: () -> Unit) {
    Column(
        Modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.background)
    ) {
        StatusBarSpacer()
        AppScreenHeader(a.title, subtitle = a.summary, onBack = onBack)
        LazyColumn(
            modifier = Modifier.fillMaxWidth(),
            contentPadding = PaddingValues(start = AppSpacing.xl, end = AppSpacing.xl, top = AppSpacing.sm, bottom = AppSpacing.xxxl),
        ) {
            item {
                AppCard {
                    Text(a.body, style = MaterialTheme.typography.bodyMedium)
                    Spacer(Modifier.height(AppSpacing.md))
                    Text(
                        t(S.libraryDisclaimer),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                Spacer(Modifier.height(AppSpacing.md))
                SecondaryButton(t(S.backLabel), onClick = onBack)
            }
        }
    }
}
