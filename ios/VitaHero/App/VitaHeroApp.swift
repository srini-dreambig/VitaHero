import SwiftUI
import FirebaseCore
import FirebaseAuth

/// Firebase is set up only when the build carries GoogleService-Info.plist.
/// The file is injected by CI from a secret and is never in the repository;
/// a build without it still launches, and sign-in says what is missing.
final class AppDelegate: NSObject, UIApplicationDelegate {
    func application(_ application: UIApplication,
                     didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        if Bundle.main.path(forResource: "GoogleService-Info", ofType: "plist") != nil {
            FirebaseApp.configure()
        }
        return true
    }

    // Phone sign-in verifies the app with a silent push when APNs is set up,
    // and with a reCAPTCHA page otherwise. These hand both back to Firebase.
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        guard AuthManager.firebaseConfigured else { return }
        Auth.auth().setAPNSToken(deviceToken, type: .unknown)
    }

    func application(_ application: UIApplication, didReceiveRemoteNotification userInfo: [AnyHashable: Any],
                     fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void) {
        if AuthManager.firebaseConfigured && Auth.auth().canHandleNotification(userInfo) {
            completionHandler(.noData)
            return
        }
        completionHandler(.newData)
    }
}

@main
struct VitaHeroApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @StateObject private var auth = AuthManager()
    @StateObject private var store = AppStore()
    @StateObject private var l10n = L10n.shared

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(auth)
                .environmentObject(store)
                .environmentObject(l10n)
                // Every string is looked up when a view is built, so a new
                // language rebuilds the views.
                .id(l10n.language)
                .tint(Brand.orange)
                .onOpenURL { url in
                    if AuthManager.firebaseConfigured { _ = Auth.auth().canHandle(url) }
                }
        }
    }
}
