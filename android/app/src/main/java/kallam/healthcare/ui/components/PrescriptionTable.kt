package kallam.healthcare.ui.components

import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import kallam.healthcare.data.RxEyeDto
import kallam.healthcare.data.RxTableDto
import kallam.healthcare.ui.theme.AppSpacing

/**
 * A glasses prescription as the slip lays it out: distance (D/V) and near
 * (N/V) rows, each eye's SPH, CYL, AXIS and V/A, then the lens.
 */
@Composable
fun PrescriptionTables(tables: List<RxTableDto>, modifier: Modifier = Modifier) {
    Column(modifier) {
        tables.forEach { table ->
            Spacer(Modifier.height(AppSpacing.sm))
            Text(table.title, style = MaterialTheme.typography.labelLarge)
            Spacer(Modifier.height(AppSpacing.xxs))
            Row(Modifier.fillMaxWidth()) {
                Spacer(Modifier.width(LABEL_WIDTH))
                HeaderCell("RIGHT EYE", Modifier.weight(4f))
                HeaderCell("LEFT EYE", Modifier.weight(4f))
            }
            Row(Modifier.fillMaxWidth()) {
                Spacer(Modifier.width(LABEL_WIDTH))
                repeat(2) { listOf("SPH", "CYL", "AXIS", "V/A").forEach { HeaderCell(it, Modifier.weight(1f)) } }
            }
            table.rows.forEach { row ->
                Row(Modifier.fillMaxWidth()) {
                    Text(
                        row.label,
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = FontWeight.Medium,
                        modifier = Modifier.width(LABEL_WIDTH).padding(vertical = AppSpacing.xs),
                    )
                    EyeCells(row.right)
                    EyeCells(row.left)
                }
            }
            if (table.lensType.isNotBlank()) {
                Spacer(Modifier.height(AppSpacing.xxs))
                Text(
                    "Lens: ${table.lensType}",
                    style = MaterialTheme.typography.bodySmall,
                    fontWeight = FontWeight.Medium,
                )
            }
        }
    }
}

private val LABEL_WIDTH = 32.dp

@Composable
private fun HeaderCell(text: String, modifier: Modifier) {
    Text(
        text,
        style = MaterialTheme.typography.labelSmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        textAlign = TextAlign.Center,
        maxLines = 1,
        modifier = modifier.padding(vertical = 2.dp),
    )
}

@Composable
private fun RowScope.EyeCells(eye: RxEyeDto) {
    listOf(eye.sph, eye.cyl, eye.axis, eye.va).forEach { v ->
        Text(
            v.ifBlank { "–" },
            style = MaterialTheme.typography.labelSmall,
            fontWeight = FontWeight.Medium,
            textAlign = TextAlign.Center,
            maxLines = 1,
            modifier = Modifier
                .weight(1f)
                .border(0.5.dp, MaterialTheme.colorScheme.outlineVariant)
                .padding(vertical = AppSpacing.xs),
        )
    }
}
