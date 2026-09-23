package kallam.healthcare.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
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
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.School
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import kallam.healthcare.data.Kid
import kallam.healthcare.data.PartnerSchool
import kallam.healthcare.data.S
import kallam.healthcare.ui.components.HeroCard
import kallam.healthcare.ui.components.IconBubble
import kallam.healthcare.ui.components.StatusBarSpacer
import kallam.healthcare.ui.components.t
import kallam.healthcare.ui.theme.HeroBlue
import kallam.healthcare.ui.theme.HeroOrange

@Composable
fun SchoolsScreen(
    partnerSchools: List<PartnerSchool>,
    availableSchools: List<PartnerSchool>,
    kids: List<Kid>,
    onBack: () -> Unit,
    /** True while the link is with the server. */
) {

    LazyColumn(
        modifier = Modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.background),
        contentPadding = PaddingValues(start = 20.dp, end = 20.dp, bottom = 32.dp)
    ) {
        item {
            StatusBarSpacer()
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(vertical = 8.dp)) {
                Box(
                    Modifier
                        .size(44.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .clickable(onClick = onBack),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(Icons.AutoMirrored.Outlined.ArrowBack, contentDescription = t(S.goBack))
                }
                Spacer(Modifier.width(12.dp))
                Column {
                    Text(t(S.schoolPartners), style = MaterialTheme.typography.headlineLarge, fontWeight = FontWeight.Bold)
                    Text(t(S.schoolPartnersSub), style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            Spacer(Modifier.height(16.dp))
        }

        if (partnerSchools.isNotEmpty()) {
            item {
                Text(t(S.linkedSchools), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                Spacer(Modifier.height(10.dp))
            }
            items(partnerSchools, key = { it.id }) { school ->
                LinkedSchoolCard(school)
                Spacer(Modifier.height(10.dp))
            }
            item { Spacer(Modifier.height(8.dp)) }
        }

        item {
            // How the link is actually made, instead of a form that pretends
            // the parent makes it.
            //
            // This was "Enter partner code": a text field, a child to attach,
            // and a button that created a school enrolment outright. Nobody at
            // the school approved it, and it contradicted what the app already
            // tells a parent with an empty Kids list — that the school adds
            // families using the number it holds. The server refuses it now,
            // so the form could only have taught a parent that by failing.
            HeroCard(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(18.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        IconBubble(Icons.Outlined.School, HeroOrange)
                        Spacer(Modifier.width(12.dp))
                        Text(t(S.schoolLinkTitle), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                    }
                    Spacer(Modifier.height(12.dp))
                    Text(
                        t(S.schoolLinkNote),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
            Spacer(Modifier.height(20.dp))
        }

        item {
            Text(t(S.partnerSchoolsList), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
            Spacer(Modifier.height(10.dp))
        }
        items(availableSchools, key = { it.id }) { school ->
            PartnerSchoolCard(school, isLinked = partnerSchools.any { it.id == school.id })
            Spacer(Modifier.height(10.dp))
        }
    }
}

@Composable
private fun LinkedSchoolCard(school: PartnerSchool) {
    HeroCard(Modifier.fillMaxWidth(), background = HeroOrange.copy(alpha = 0.06f)) {
        Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
            IconBubble(Icons.Outlined.CheckCircle, HeroOrange)
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(school.name, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
                Text("${school.city} · ${school.district}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Text(t(S.linked), style = MaterialTheme.typography.labelSmall, color = HeroOrange, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
private fun PartnerSchoolCard(school: PartnerSchool, isLinked: Boolean) {
    HeroCard(Modifier.fillMaxWidth()) {
        Row(Modifier.padding(16.dp), verticalAlignment = Alignment.Top) {
            Icon(Icons.Outlined.School, contentDescription = null, tint = HeroBlue, modifier = Modifier.size(28.dp))
            Spacer(Modifier.width(14.dp))
            Column {
                Text(school.name, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
                Text("${school.city}, ${school.district}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                if (school.description.isNotBlank()) {
                    Spacer(Modifier.height(6.dp))
                    Text(school.description, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                if (isLinked) {
                    Spacer(Modifier.height(6.dp))
                    Text(t(S.linked), style = MaterialTheme.typography.labelSmall, color = HeroOrange, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}
