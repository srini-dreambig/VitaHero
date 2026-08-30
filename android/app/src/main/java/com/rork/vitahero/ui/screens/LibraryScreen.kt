package com.rork.vitahero.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.material.icons.automirrored.outlined.MenuBook
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.rork.vitahero.data.ArticleDto
import com.rork.vitahero.data.GuardianViewModel
import com.rork.vitahero.data.S
import com.rork.vitahero.ui.components.HeroCard
import com.rork.vitahero.ui.components.IconBubble
import com.rork.vitahero.ui.components.StatusBarSpacer
import com.rork.vitahero.ui.components.t
import com.rork.vitahero.ui.components.tf2
import com.rork.vitahero.ui.theme.HeroBlue
import com.rork.vitahero.ui.theme.HeroOrange

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

    LazyColumn(
        modifier = Modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.background),
        contentPadding = PaddingValues(start = 20.dp, end = 20.dp, bottom = 32.dp),
    ) {
        item {
            StatusBarSpacer()
            ScreenHeader(t(S.libraryTitle), t(S.librarySub), onBack)
            Spacer(Modifier.height(12.dp))
        }

        if (library.forYou.isNotEmpty()) {
            item {
                Text(
                    t(S.forYourFamily),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                )
                Spacer(Modifier.height(8.dp))
            }
            items(library.forYou, key = { "you/" + it.slug }) { a ->
                ArticleRow(a, true) { guardianViewModel.openArticle(a.slug) }
                Spacer(Modifier.height(8.dp))
            }
            item { Spacer(Modifier.height(12.dp)) }
        }

        if (library.general.isNotEmpty()) {
            item {
                Text(
                    t(S.generalReading),
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                )
                Spacer(Modifier.height(8.dp))
            }
            items(library.general, key = { "gen/" + it.slug }) { a ->
                ArticleRow(a, false) { guardianViewModel.openArticle(a.slug) }
                Spacer(Modifier.height(8.dp))
            }
        }

        if (library.forYou.isEmpty() && library.general.isEmpty()) {
            item {
                HeroCard(Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(20.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                        IconBubble(Icons.AutoMirrored.Outlined.MenuBook, HeroBlue)
                        Spacer(Modifier.height(12.dp))
                        Text(
                            t(S.libraryEmpty),
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.SemiBold,
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun ArticleRow(a: ArticleDto, personal: Boolean, onOpen: () -> Unit) {
    HeroCard(Modifier.fillMaxWidth()) {
        Column(
            Modifier
                .fillMaxWidth()
                .clickable(onClick = onOpen)
                .padding(16.dp),
        ) {
            Text(a.title, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
            if (a.summary.isNotBlank()) {
                Spacer(Modifier.height(4.dp))
                Text(
                    a.summary,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            // Saying why this article is here matters more than the article: a
            // parent should never wonder whether the app knows something they
            // have not been told.
            val because = a.because
            if (personal && because != null) {
                Spacer(Modifier.height(8.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        Icons.AutoMirrored.Outlined.MenuBook,
                        contentDescription = null,
                        tint = HeroOrange,
                        modifier = Modifier.size(16.dp),
                    )
                    Spacer(Modifier.width(6.dp))
                    Text(
                        tf2(S.becauseOfFinding, because.kidName, because.checkType),
                        style = MaterialTheme.typography.labelMedium,
                        color = HeroOrange,
                    )
                }
            }
        }
    }
}

@Composable
private fun ArticleScreen(a: ArticleDto, onBack: () -> Unit) {
    LazyColumn(
        modifier = Modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.background),
        contentPadding = PaddingValues(start = 20.dp, end = 20.dp, bottom = 32.dp),
    ) {
        item {
            StatusBarSpacer()
            ScreenHeader(a.title, a.summary, onBack)
            Spacer(Modifier.height(12.dp))
            HeroCard(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(18.dp)) {
                    Text(a.body, style = MaterialTheme.typography.bodyMedium)
                    Spacer(Modifier.height(14.dp))
                    Text(
                        t(S.libraryDisclaimer),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
            Spacer(Modifier.height(14.dp))
            OutlinedButton(onClick = onBack, shape = RoundedCornerShape(14.dp)) {
                Text(t(S.backLabel))
            }
        }
    }
}
