import Foundation

#if DEBUG
/// Signs a simulator in without a person at it, so CI can take the App Store
/// screenshots (.github/workflows/ios-screenshots.yml).
///
/// Only a Debug build has this. The number must be one of Firebase's test
/// phone numbers: Firebase accepts its fixed code and sends no SMS, and app
/// verification is switched off for the run so the simulator needs neither
/// APNs nor a reCAPTCHA page. The values arrive as launch environment
/// (`SIMCTL_CHILD_VH_SHOT_*` from `simctl launch`), never from the repository.
enum ScreenshotMode {
    private static var env: [String: String] { ProcessInfo.processInfo.environment }

    /// Ten-digit mobile number, without the country code.
    static var phone: String? { env["VH_SHOT_PHONE"].flatMap { $0.isEmpty ? nil : $0 } }
    static var code: String? { env["VH_SHOT_CODE"].flatMap { $0.isEmpty ? nil : $0 } }
    static var isOn: Bool { phone != nil && code != nil }

    /// The tab the family app opens on: 0 Home, 1 Kids, 2 Camps, 3 Rewards, 4 Profile.
    static var tab: Int { Int(env["VH_SHOT_TAB"] ?? "") ?? 0 }
}
#endif
