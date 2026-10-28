import SwiftUI

/// The VitaHero palette, the same orange and blue as the Android app.
enum Brand {
    static let orange = Color(red: 244 / 255, green: 123 / 255, blue: 32 / 255)
    static let blue = Color(red: 37 / 255, green: 99 / 255, blue: 235 / 255)
    static let green = Color(red: 16 / 255, green: 185 / 255, blue: 129 / 255)
    static let amber = Color(red: 245 / 255, green: 158 / 255, blue: 11 / 255)
    static let red = Color(red: 239 / 255, green: 68 / 255, blue: 68 / 255)
    static let purple = Color(red: 139 / 255, green: 92 / 255, blue: 246 / 255)

    static let gradient = LinearGradient(
        colors: [orange, Color(red: 249 / 255, green: 115 / 255, blue: 22 / 255)],
        startPoint: .leading, endPoint: .trailing)
}

/// A rounded card on the grouped background, used for every block of content.
struct Card<Content: View>: View {
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 10) { content }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color(.secondarySystemGroupedBackground))
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }
}

/// A small coloured label for a status (a camp's state, a result's flag).
struct Pill: View {
    let text: String
    var color: Color = Brand.blue

    var body: some View {
        Text(text)
            .font(.caption.weight(.semibold))
            .foregroundColor(color)
            .padding(.horizontal, 10)
            .padding(.vertical, 4)
            .background(color.opacity(0.14))
            .clipShape(Capsule())
    }
}

/// The orange, full-width button the app's main actions use.
struct PrimaryButton: View {
    let title: String
    var busy = false
    var enabled = true
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            ZStack {
                if busy { ProgressView().tint(.white) } else { Text(title).fontWeight(.semibold) }
            }
            .foregroundColor(.white)
            .frame(maxWidth: .infinity, minHeight: 50)
            .background(enabled ? AnyShapeStyle(Brand.gradient) : AnyShapeStyle(Color.gray.opacity(0.4)))
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        }
        .disabled(!enabled || busy)
    }
}

/// What a screen shows when it has nothing to list.
struct EmptyState: View {
    let icon: String
    let title: String
    var subtitle: String? = nil

    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: icon).font(.system(size: 40)).foregroundColor(.secondary)
            Text(title).font(.headline)
            if let subtitle { Text(subtitle).font(.subheadline).foregroundColor(.secondary) }
        }
        .multilineTextAlignment(.center)
        .frame(maxWidth: .infinity)
        .padding(.vertical, 32)
    }
}

/// A one-line message across the top of a screen: the server could not be
/// reached, or a write the parent made was refused.
struct Banner: View {
    let text: String
    var color: Color = Brand.amber

    var body: some View {
        HStack(alignment: .top, spacing: 8) {
            Image(systemName: "exclamationmark.triangle.fill")
            Text(text).frame(maxWidth: .infinity, alignment: .leading)
        }
        .font(.footnote)
        .foregroundColor(color)
        .padding(12)
        .background(color.opacity(0.12))
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
}

/// A health flag as the server reports it: GOOD, WATCH, ALERT, or not measured.
enum HealthFlag: String {
    case good = "GOOD", watch = "WATCH", alert = "ALERT", notMeasured = "NOT_MEASURED"

    /// A value the app cannot read is an absence of data, not a clean result.
    init(server: String?) {
        self = HealthFlag(rawValue: (server ?? "").uppercased()) ?? .notMeasured
    }

    var color: Color {
        switch self {
        case .good: return Brand.green
        case .watch: return Brand.amber
        case .alert: return Brand.red
        case .notMeasured: return .secondary
        }
    }

    var label: String {
        switch self {
        case .good: return L("flag_good")
        case .watch: return L("flag_watch")
        case .alert: return L("flag_alert")
        case .notMeasured: return L("flag_not_measured")
        }
    }
}
