import Foundation

/// Where the app finds the Worker API.
///
/// The address is read from Info.plist (`VHApiBaseURL`) so a test build can be
/// pointed at another Worker without a code change, and falls back to the
/// production Worker the Android app uses.
enum AppConfig {
    static let apiBaseURL: URL = {
        let fromPlist = Bundle.main.object(forInfoDictionaryKey: "VHApiBaseURL") as? String
        let raw = (fromPlist?.trimmingCharacters(in: .whitespaces)).flatMap { $0.isEmpty ? nil : $0 }
            ?? "https://vitahero.kallam.workers.dev"
        return URL(string: raw)!
    }()

    /// The server refuses a session minted for one surface on another. This
    /// app is the parent app, the same door the Android app signs in through.
    static let surface = "app"

    /// Parents sign in with an Indian mobile number, as on Android.
    static let countryCode = "+91"

    /// The city the hospital directory opens on when the parent's schools say
    /// nothing and location is off.
    static let defaultCity = "Hyderabad"
}
