import SwiftUI

@main
struct VitaHeroApp: App {
    @StateObject private var sessionStore = SessionStore.shared
    @StateObject private var authManager = AuthManager.shared
    @StateObject private var appViewModel = AppViewModel()
    @StateObject private var clinicianViewModel = ClinicianViewModel()
    @StateObject private var kidsViewModel = KidsViewModel()
    
    var body: some Scene {
        WindowGroup {
            Group {
                if !authManager.hasConsented {
                    ConsentView()
                } else if !authManager.hasOnboarded {
                    OnboardingView()
                } else if !authManager.isAuthenticated {
                    AuthView()
                } else {
                    MainScaffoldView()
                }
            }
            .environmentObject(sessionStore)
            .environmentObject(authManager)
            .environmentObject(appViewModel)
            .environmentObject(clinicianViewModel)
            .environmentObject(kidsViewModel)
            .accentColor(AppTheme.Colors.heroOrange)
        }
    }
}
