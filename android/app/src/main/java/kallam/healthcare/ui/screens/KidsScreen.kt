package kallam.healthcare.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
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
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowForwardIos
import androidx.compose.material.icons.outlined.School
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import kallam.healthcare.data.AppLocale
import kallam.healthcare.data.Kid
import kallam.healthcare.data.heightText
import kallam.healthcare.data.weightText
import kallam.healthcare.data.LocalAppLocale
import kallam.healthcare.data.S
import kallam.healthcare.ui.components.AppCard
import kallam.healthcare.ui.components.AppScreenHeader
import kallam.healthcare.ui.components.EmptyState
import kallam.healthcare.ui.components.FlagChip
import kallam.healthcare.ui.components.InfoNote
import kallam.healthcare.ui.components.KidAvatar
import kallam.healthcare.ui.components.StatTile
import kallam.healthcare.ui.components.StatusBarSpacer
import kallam.healthcare.ui.components.Tone
import kallam.healthcare.ui.components.bottomBarClearance
import kallam.healthcare.ui.components.t
import kallam.healthcare.ui.components.tf
import kallam.healthcare.ui.theme.AppSpacing
import kallam.healthcare.ui.theme.AppTheme

@Composable
fun KidsScreen(
    kids: List<Kid>,
    onOpenKid: (String) -> Unit,
) {
    LazyColumn(
        modifier = Modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.background),
        contentPadding = PaddingValues(bottom = bottomBarClearance())
    ) {
        item {
            StatusBarSpacer()
            AppScreenHeader(
                title = t(S.myKids),
                subtitle = if (kids.size == 1) tf(S.childTracked, kids.size.toString())
                else tf(S.childrenTracked, kids.size.toString()),
            )
            Spacer(Modifier.height(AppSpacing.xs))
        }

        if (kids.isEmpty()) {
            item {
                // No button here on purpose. A parent cannot add a child to a
                // closed programme — the school's roster does, matched on the
                // mobile number they hold. An empty list means that number has
                // not been matched, and the only useful thing the app can do is
                // say so and point at the school office.
                EmptyState(
                    icon = Icons.Outlined.School,
                    title = t(S.noKidsYet),
                    subtitle = t(S.noKidsSub),
                )
            }
        } else {
            items(kids, key = { it.id }) { kid ->
                KidCard(kid, Modifier.padding(horizontal = AppSpacing.xl, vertical = 6.dp)) { onOpenKid(kid.id) }
            }
        }

        if (kids.isNotEmpty()) {
            item {
                Spacer(Modifier.height(AppSpacing.sm))
                InfoNote(
                    t(S.childrenFromSchool),
                    Modifier.padding(horizontal = AppSpacing.xl),
                    tone = Tone.Neutral,
                    icon = Icons.Outlined.School,
                )
            }
        }
    }
}

@Composable
private fun KidCard(kid: Kid, modifier: Modifier = Modifier, onClick: () -> Unit) {
    AppCard(modifier = modifier, onClick = onClick) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            KidAvatar(kid.name, kid.avatarColor, size = 56.dp)
            Spacer(Modifier.width(AppSpacing.md))
            Column(Modifier.weight(1f)) {
                Text(kid.name, style = MaterialTheme.typography.titleMedium,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    "${kid.age} yrs · ${kid.gender} · ${kid.grade}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            Icon(
                Icons.AutoMirrored.Outlined.ArrowForwardIos,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(16.dp)
            )
        }
        Spacer(Modifier.height(AppSpacing.lg))
        Row(horizontalArrangement = Arrangement.spacedBy(AppSpacing.sm)) {
            StatTile(t(S.heightLabel), kid.heightText(), Modifier.weight(1f))
            StatTile(t(S.weightLabel), kid.weightText(), Modifier.weight(1f))
        }
        Spacer(Modifier.height(AppSpacing.md))
        Row(horizontalArrangement = Arrangement.spacedBy(AppSpacing.sm)) {
            FlagChip(kid.nutrition)
            FlagChip(kid.eyesight)
        }
    }
}

@Preview(showBackground = true)
@Composable
private fun KidsScreenPreview() {
    androidx.compose.runtime.CompositionLocalProvider(LocalAppLocale provides AppLocale.ENGLISH) {
        AppTheme {
            KidsScreen(
                kids = emptyList(),
                onOpenKid = {},
            )
        }
    }
}
