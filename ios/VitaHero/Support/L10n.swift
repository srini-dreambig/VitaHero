import Foundation
import SwiftUI

/// The three languages the parent app speaks, the same three as Android.
enum AppLanguage: String, CaseIterable, Identifiable {
    case en, hi, te

    var id: String { rawValue }

    /// Each language is named in itself, so a parent who cannot read the
    /// current one can still find their own.
    var nativeName: String {
        switch self {
        case .en: return "English"
        case .hi: return "हिन्दी"
        case .te: return "తెలుగు"
        }
    }

    static func from(_ code: String?) -> AppLanguage {
        AppLanguage(rawValue: (code ?? "").lowercased().prefix(2).description) ?? .en
    }
}

/// The app's language, chosen in the app rather than in iOS Settings.
///
/// Strings come from Resources/<lang>.lproj/Localizable.strings, generated from
/// the Android app's LocaleStrings.kt by ios/tools/gen_strings.py. A key Hindi
/// or Telugu has no translation for falls back to English, as on Android.
final class L10n: ObservableObject {
    static let shared = L10n()

    private static let storeKey = "vh.locale"
    private static let missing = "\u{1}missing\u{1}"

    @Published private(set) var language: AppLanguage
    private var bundle: Bundle
    private let english: Bundle

    private init() {
        english = L10n.bundle(for: .en)
        let saved = AppLanguage.from(UserDefaults.standard.string(forKey: L10n.storeKey))
        language = saved
        bundle = L10n.bundle(for: saved)
    }

    var hasChosen: Bool { UserDefaults.standard.string(forKey: L10n.storeKey) != nil }

    func set(_ language: AppLanguage) {
        UserDefaults.standard.set(language.rawValue, forKey: L10n.storeKey)
        bundle = L10n.bundle(for: language)
        self.language = language
    }

    func text(_ key: String) -> String {
        let value = bundle.localizedString(forKey: key, value: L10n.missing, table: nil)
        if value != L10n.missing { return value }
        let fallback = english.localizedString(forKey: key, value: L10n.missing, table: nil)
        return fallback == L10n.missing ? key : fallback
    }

    private static func bundle(for language: AppLanguage) -> Bundle {
        guard let path = Bundle.main.path(forResource: language.rawValue, ofType: "lproj"),
              let bundle = Bundle(path: path) else { return .main }
        return bundle
    }
}

/// A string in the app's chosen language.
func L(_ key: String) -> String { L10n.shared.text(key) }

/// A formatted string in the app's chosen language (`%@`, `%d`, `%1$@`).
func L(_ key: String, _ args: CVarArg...) -> String {
    String(format: L10n.shared.text(key), arguments: args)
}
