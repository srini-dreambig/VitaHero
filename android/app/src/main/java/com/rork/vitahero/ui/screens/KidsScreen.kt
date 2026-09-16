package com.rork.vitahero.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowForwardIos
import androidx.compose.material.icons.outlined.School
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.rork.vitahero.data.AppLocale
import com.rork.vitahero.data.Kid
import com.rork.vitahero.data.heightText
import com.rork.vitahero.data.weightText
import com.rork.vitahero.data.LocalAppLocale
import com.rork.vitahero.data.S
import com.rork.vitahero.ui.components.EmptyState
import com.rork.vitahero.ui.components.FlagChip
import com.rork.vitahero.ui.components.HeroCard
import com.rork.vitahero.ui.components.KidAvatar
import com.rork.vitahero.ui.components.StatusBarSpacer
import com.rork.vitahero.ui.components.bottomBarClearance
import com.rork.vitahero.ui.components.t
import com.rork.vitahero.ui.components.tf
import com.rork.vitahero.ui.theme.AppTheme

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
            Row(
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(Modifier.weight(1f)) {
                    Text(t(S.myKids), style = MaterialTheme.typography.headlineLarge, fontWeight = FontWeight.Bold)
                    Text(
                        if (kids.size == 1) tf(S.childTracked, kids.size.toString())
                        else tf(S.childrenTracked, kids.size.toString()),
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
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
                KidCard(kid, Modifier.padding(horizontal = 20.dp, vertical = 7.dp)) { onOpenKid(kid.id) }
            }
        }

        if (kids.isNotEmpty()) {
            item {
                Spacer(Modifier.height(8.dp))
                RosterNote(Modifier.padding(horizontal = 20.dp))
            }
        }
    }
}

@Composable
private fun KidCard(kid: Kid, modifier: Modifier = Modifier, onClick: () -> Unit) {
    HeroCard(modifier = modifier.fillMaxWidth().clickable(onClick = onClick)) {
        Column(Modifier.padding(18.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                KidAvatar(kid.name, kid.avatarColor, size = 56.dp)
                Spacer(Modifier.width(14.dp))
                Column(Modifier.weight(1f)) {
                    Text(kid.name, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold,
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
            Spacer(Modifier.height(16.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Metric(t(S.heightLabel), kid.heightText(), Modifier.weight(1f))
                Metric(t(S.weightLabel), kid.weightText(), Modifier.weight(1f))
            }
            Spacer(Modifier.height(14.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FlagChip(kid.nutrition)
                FlagChip(kid.eyesight)
            }
        }
    }
}

@Composable
private fun Metric(label: String, value: String, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier
            .background(MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(14.dp))
            .padding(vertical = 12.dp, horizontal = 12.dp)
    ) {
        Text(label, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Spacer(Modifier.height(2.dp))
        Text(value, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun RosterNote(modifier: Modifier = Modifier) {
    HeroCard(
        modifier = modifier.fillMaxWidth(),
        background = MaterialTheme.colorScheme.surfaceVariant,
        border = false
    ) {
        Row(
            Modifier.padding(18.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                Icons.Outlined.School,
                contentDescription = null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(22.dp),
            )
            Spacer(Modifier.width(14.dp))
            Text(
                t(S.childrenFromSchool),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
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
