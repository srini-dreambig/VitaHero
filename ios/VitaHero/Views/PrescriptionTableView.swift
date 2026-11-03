import SwiftUI

/// A glasses prescription as the slip lays it out: distance (D/V) and near
/// (N/V) rows, each eye's SPH, CYL, AXIS and V/A, then the lens.
struct PrescriptionTableView: View {
    let table: CampResult.Sheet.Rx

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(table.title).font(.vh(.subheadline, .semibold))
            Grid(horizontalSpacing: 0, verticalSpacing: 0) {
                GridRow {
                    Color.clear.frame(width: 32, height: 1)
                    header("RIGHT EYE").gridCellColumns(4)
                    header("LEFT EYE").gridCellColumns(4)
                }
                GridRow {
                    Color.clear.frame(width: 32, height: 1)
                    ForEach(0..<8, id: \.self) { i in header(["SPH", "CYL", "AXIS", "V/A"][i % 4]) }
                }
                ForEach(table.rows) { row in
                    GridRow {
                        Text(row.label).font(.vh(.caption2, .medium))
                            .frame(width: 32, alignment: .leading)
                        cells(row.right)
                        cells(row.left)
                    }
                }
            }
            if !table.lensType.isEmpty {
                Text("Lens: \(table.lensType)").font(.vh(.caption, .medium))
            }
        }
    }

    private func header(_ text: String) -> some View {
        Text(text).font(.vh(.caption2)).foregroundColor(.secondary)
            .lineLimit(1).minimumScaleFactor(0.7)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 2)
    }

    @ViewBuilder
    private func cells(_ eye: CampResult.Sheet.Rx.Eye?) -> some View {
        ForEach(Array([eye?.sph, eye?.cyl, eye?.axis, eye?.va].map { $0 ?? "" }.enumerated()), id: \.offset) { _, value in
            Text(value.isEmpty ? "–" : value).font(.vh(.caption2, .medium))
                .lineLimit(1).minimumScaleFactor(0.7)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 6)
                .border(Color(.separator), width: 0.5)
        }
    }
}
