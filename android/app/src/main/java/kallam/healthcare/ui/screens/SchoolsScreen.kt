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
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.School
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import kallam.healthcare.data.Kid
import kallam.healthcare.data.PartnerSchool
import kallam.healthcare.data.S
import kallam.healthcare.ui.components.AppCard
import kallam.healthcare.ui.components.AppListRow
import kallam.healthcare.ui.components.AppScreenHeader
import kallam.healthcare.ui.components.AppSectionTitle
import kallam.healthcare.ui.components.IconBubble
import kallam.healthcare.ui.components.StatusBarSpacer
import kallam.healthcare.ui.components.StatusPill
import kallam.healthcare.ui.components.Tone
import kallam.healthcare.ui.components.t
import kallam.healthcare.ui.theme.AppSpacing

@Composable
fun SchoolsScreen(
    partnerSchools: List<PartnerSchool>,
    availableSchools: List<PartnerSchool>,
    kids: List<Kid>,
    onBack: () -> Unit,
    /** True while the link is with the server. */
) {

    Column(
        Modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.background)
    ) {
        StatusBarSpacer()
        AppScreenHeader(
            title = t(S.schoolPartners),
            subtitle = t(S.schoolPartnersSub),
            onBack = onBack,
        )
        LazyColumn(
            modifier = Modifier.fillMaxWidth(),
            contentPadding = PaddingValues(start = AppSpacing.xl, end = AppSpacing.xl, top = AppSpacing.sm, bottom = AppSpacing.xxxl),
            verticalArrangement = Arrangement.spacedBy(AppSpacing.md),
        ) {
            if (partnerSchools.isNotEmpty()) {
                item {
                    AppSectionTitle(t(S.linkedSchools))
                }
                items(partnerSchools, key = { it.id }) { school ->
                    LinkedSchoolCard(school)
                }
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
                AppCard(
                    Modifier.padding(top = if (partnerSchools.isNotEmpty()) AppSpacing.md else 0.dp)
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        IconBubble(Icons.Outlined.School, MaterialTheme.colorScheme.primary)
                        Spacer(Modifier.width(AppSpacing.md))
                        Text(t(S.schoolLinkTitle), style = MaterialTheme.typography.titleMedium)
                    }
                    Spacer(Modifier.height(AppSpacing.md))
                    Text(
                        t(S.schoolLinkNote),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }

            item {
                AppSectionTitle(t(S.partnerSchoolsList), Modifier.padding(top = AppSpacing.md))
            }
            items(availableSchools, key = { it.id }) { school ->
                PartnerSchoolCard(school, isLinked = partnerSchools.any { it.id == school.id })
            }
        }
    }
}

@Composable
private fun LinkedSchoolCard(school: PartnerSchool) {
    AppListRow(
        title = school.name,
        subtitle = "${school.city} · ${school.district}",
        leading = { IconBubble(Icons.Outlined.CheckCircle, MaterialTheme.colorScheme.primary) },
        trailing = { StatusPill(t(S.linked), Tone.Brand) },
    )
}

/**
 * Not an [AppListRow]: the description runs to several lines and the row
 * would cut it at two.
 */
@Composable
private fun PartnerSchoolCard(school: PartnerSchool, isLinked: Boolean) {
    AppCard {
        Row(verticalAlignment = Alignment.Top) {
            Icon(Icons.Outlined.School, contentDescription = null, tint = MaterialTheme.colorScheme.secondary, modifier = Modifier.size(28.dp))
            Spacer(Modifier.width(AppSpacing.md))
            Column(Modifier.weight(1f)) {
                Text(school.name, style = MaterialTheme.typography.titleMedium,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
                Text("${school.city}, ${school.district}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                if (school.description.isNotBlank()) {
                    Spacer(Modifier.height(AppSpacing.sm))
                    Text(school.description, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                if (isLinked) {
                    Spacer(Modifier.height(AppSpacing.sm))
                    StatusPill(t(S.linked), Tone.Brand)
                }
            }
        }
    }
}
