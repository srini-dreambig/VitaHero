import SwiftUI

/// The VitaHero palette. The same hex values are in the Android app's
/// ui/theme/Color.kt and in the :root block of functions/portal.ts; change all
/// three together.
///
/// Fills are the soft pastels: pink for the main action, yellow, olive and blue
/// for cards, tags and stat tiles, all on a white page. Text and icons never use
/// a pastel; they use the deep shade of the same hue so they stay readable.
enum Brand {
    // Fills
    static let cream = Color(hex: 0xFFFFFF)
    static let beige = Color(hex: 0xF6F6F7)
    static let beigeDeep = Color(hex: 0xECECEE)
    static let pink = Color(hex: 0xFFB2DD)
    static let pinkLight = Color(hex: 0xFAE0E4)
    static let yellow = Color(hex: 0xF7D66E)
    static let yellowLight = Color(hex: 0xFEEFBF)
    static let olive = Color(hex: 0x9AAB65)
    static let oliveLight = Color(hex: 0xE1E6D1)
    static let sky = Color(hex: 0xB6CAEB)
    static let skyLight = Color(hex: 0xEAF0F9)

    // Text
    static let ink = Color(hex: 0x2D2D2B)
    static let inkSoft = Color(hex: 0x66625A)

    // Deep shades, for text and icons
    static let pinkDeep = Color(hex: 0xB0457C)
    static let yellowDeep = Color(hex: 0x8A6A0C)
    static let oliveDeep = Color(hex: 0x55642A)
    static let blueDeep = Color(hex: 0x3B5B94)

    // Older names, kept so views read the new palette without a rename sweep.
    static let orange = pinkDeep
    static let blue = blueDeep
    static let green = oliveDeep
    static let amber = Color(hex: 0xA86E12)
    /// Clinical alerts stay red: an alert must never read as decoration.
    static let red = Color(hex: 0xC8372D)
    static let purple = oliveDeep

    /// The main button's fill. A flat pink; kept as a style so the views that
    /// paint an icon with it still compile.
    static let gradient = LinearGradient(colors: [pink, pink], startPoint: .leading, endPoint: .trailing)
}

extension Color {
    init(hex: UInt32) {
        self.init(red: Double((hex >> 16) & 0xFF) / 255,
                  green: Double((hex >> 8) & 0xFF) / 255,
                  blue: Double(hex & 0xFF) / 255)
    }
}

/// The app's two typefaces: Bricolage Grotesque for titles, Host Grotesk for
/// everything else, the same as Android. Sizes follow Dynamic Type through
/// `relativeTo`, so a parent's larger text setting still applies.
extension Font {
    static func vh(_ style: TextStyle, _ weight: Weight? = nil) -> Font {
        let size: CGFloat
        switch style {
        case .largeTitle: size = 34
        case .title: size = 28
        case .title2: size = 22
        case .title3: size = 20
        case .headline: size = 17
        case .body: size = 17
        case .callout: size = 16
        case .subheadline: size = 15
        case .footnote: size = 13
        case .caption: size = 12
        case .caption2: size = 11
        default: size = 17
        }
        let w = weight ?? (style == .headline ? .semibold : .regular)
        let display: Bool = [.largeTitle, .title, .title2].contains(style) && (w == .bold || w == .heavy || w == .black)
        let name: String
        if display {
            name = style == .title2 ? "BricolageGrotesque96pt-Bold" : "BricolageGrotesque96pt-ExtraBold"
        } else {
            switch w {
            case .bold, .heavy, .black: name = "HostGrotesk-Bold"
            case .semibold: name = "HostGrotesk-SemiBold"
            case .medium: name = "HostGrotesk-Medium"
            default: name = "HostGrotesk-Regular"
            }
        }
        return .custom(name, size: size, relativeTo: style)
    }
}

/// The app logo, wherever the brand shows: splash, sign-in, the language
/// screen and the profile footer.
struct BrandLogo: View {
    var height: CGFloat = 56

    var body: some View {
        Image("VitaHeroLogo")
            .resizable()
            .scaledToFit()
            .frame(height: height)
            .accessibilityLabel("VitaHero")
    }
}

/// A beige card on the cream page, used for every block of content.
struct Card<Content: View>: View {
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 10) { content }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Brand.beige)
            .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
    }
}

/// A small coloured label for a status (a camp's state, a result's flag).
struct Pill: View {
    let text: String
    var color: Color = Brand.blue

    var body: some View {
        Text(text)
            .font(.vh(.caption, .semibold))
            .foregroundColor(color)
            .padding(.horizontal, 10)
            .padding(.vertical, 4)
            .background(color.opacity(0.16))
            .clipShape(Capsule())
    }
}

/// The pink, full-width pill the app's main actions use, with ink text.
struct PrimaryButton: View {
    let title: String
    var busy = false
    var enabled = true
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            ZStack {
                if busy { ProgressView().tint(Brand.ink) } else { Text(title).font(.vh(.body, .semibold)) }
            }
            .foregroundColor(enabled ? Brand.ink : Brand.inkSoft)
            .frame(maxWidth: .infinity, minHeight: 56)
            .background(enabled ? Brand.pink : Brand.beigeDeep)
            .clipShape(Capsule())
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
            Illustration(scene: .empty).frame(width: 120, height: 120)
            Text(title).font(.vh(.headline))
            if let subtitle { Text(subtitle).font(.vh(.subheadline)).foregroundColor(.secondary) }
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
        .font(.vh(.footnote))
        .foregroundColor(color)
        .padding(12)
        .background(color.opacity(0.12))
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
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
