import SwiftUI

/// Profile & Application Settings Screen.
struct ProfileSettingsView: View {
    @EnvironmentObject var appViewModel: AppViewModel
    @EnvironmentObject var authManager: AuthManager
    @EnvironmentObject var kidsViewModel: KidsViewModel
    
    @State private var notificationsEnabled: Bool = true
    @State private var darkModeEnabled: Bool = false
    @State private var selectedLanguage: String = "English"
    
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: AppTheme.Layout.spacing20) {
                // Profile Banner Card
                HeroCard(backgroundColor: Color.white) {
                    HStack(spacing: AppTheme.Layout.spacing16) {
                        Circle()
                            .fill(AppTheme.Gradients.primaryOrange)
                            .frame(width: 60, height: 60)
                            .overlay(
                                Image(systemName: authManager.userRole == .clinician ? "stethoscope" : "person.fill")
                                    .font(.system(size: 26))
                                    .foregroundColor(.white)
                            )
                        
                        VStack(alignment: .leading, spacing: 4) {
                            Text(authManager.userRole == .clinician ? "Dr. Sarah Jenkins" : "Eleanor Vance")
                                .font(AppTheme.Typography.font(for: .cardTitleLarge))
                                .foregroundColor(AppTheme.Colors.textPrimary)
                            
                            StatusPill(
                                text: authManager.userRole == .clinician ? "Licensed Pediatric Doctor" : "Primary Parent Guardian",
                                style: .info
                            )
                        }
                    }
                }
                
                // Managed Children Section (If Parent)
                if authManager.userRole == .parent {
                    Text("Managed Child Profiles")
                        .font(AppTheme.Typography.font(for: .sectionTitle))
                        .foregroundColor(AppTheme.Colors.textPrimary)
                    
                    ForEach(kidsViewModel.kids) { kid in
                        HeroCard(backgroundColor: Color.white) {
                            HStack {
                                Circle()
                                    .fill(AppTheme.Colors.heroOrange.opacity(0.12))
                                    .frame(width: 40, height: 40)
                                    .overlay(
                                        Text(String(kid.name.prefix(1)))
                                            .font(.system(size: 16, weight: .bold))
                                            .foregroundColor(AppTheme.Colors.heroOrange)
                                    )
                                
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(kid.name)
                                        .font(AppTheme.Typography.font(for: .cardTitleMedium))
                                    Text("Age \(kid.age) • Blood Group \(kid.bloodGroup)")
                                        .font(AppTheme.Typography.font(for: .captionRegular))
                                        .foregroundColor(AppTheme.Colors.textSecondary)
                                }
                                Spacer()
                                StatusPill(text: "Score \(kid.healthScore)", style: .success)
                            }
                        }
                    }
                    
                    SecondaryOutlineButton(
                        title: "Add Another Child Profile",
                        iconName: "plus.circle.fill"
                    ) {
                        appViewModel.showAddChildModal = true
                    }
                }
                
                // App Settings & Actions
                Text("Account & Security")
                    .font(AppTheme.Typography.font(for: .sectionTitle))
                    .foregroundColor(AppTheme.Colors.textPrimary)
                
                HeroCard(backgroundColor: Color.white) {
                    VStack(spacing: AppTheme.Layout.spacing16) {
                        Toggle(isOn: $notificationsEnabled) {
                            HStack {
                                Image(systemName: "bell.fill").foregroundColor(AppTheme.Colors.heroOrange)
                                Text("Health Reminders & Screening Alerts")
                                    .font(AppTheme.Typography.font(for: .bodyMedium))
                            }
                        }
                        .tint(AppTheme.Colors.heroOrange)
                        
                        Divider()
                        
                        HStack {
                            Image(systemName: "globe").foregroundColor(AppTheme.Colors.heroBlue)
                            Text("Language")
                                .font(AppTheme.Typography.font(for: .bodyMedium))
                            Spacer()
                            Text(selectedLanguage)
                                .font(AppTheme.Typography.font(for: .bodyMedium))
                                .foregroundColor(AppTheme.Colors.textSecondary)
                        }
                        
                        Divider()
                        
                        Button(action: {
                            appViewModel.showToast(
                                title: "Health Passport Exported",
                                message: "Downloaded PDF to Documents.",
                                style: .success
                            )
                        }) {
                            HStack {
                                Image(systemName: "doc.text.fill").foregroundColor(AppTheme.Colors.emerald)
                                Text("Export Pediatric Health Passport (PDF)")
                                    .font(AppTheme.Typography.font(for: .bodyMedium))
                                    .foregroundColor(AppTheme.Colors.textPrimary)
                                Spacer()
                                Image(systemName: "arrow.down.doc.fill").foregroundColor(AppTheme.Colors.emerald)
                            }
                        }
                    }
                }
                
                // Switch Role & Sign Out Buttons
                VStack(spacing: AppTheme.Layout.spacing12) {
                    Button(action: {
                        let newRole: UserRole = (authManager.userRole == .parent) ? .clinician : .parent
                        authManager.userRole = newRole
                        appViewModel.showToast(title: "Role Switched", message: "Active mode: \(newRole.title)", style: .info)
                    }) {
                        HStack {
                            Image(systemName: "arrow.triangle.2.circlepath")
                            Text("Switch Mode to \(authManager.userRole == .parent ? "Clinician Doctor" : "Parent")")
                        }
                        .font(AppTheme.Typography.font(for: .buttonLabel))
                        .foregroundColor(AppTheme.Colors.heroBlue)
                        .frame(maxWidth: .infinity)
                        .frame(height: 48)
                        .background(AppTheme.Colors.heroBlue.opacity(0.1))
                        .cornerRadius(AppTheme.Layout.cornerRadiusMedium)
                    }
                    
                    Button(action: {
                        authManager.logout()
                        appViewModel.showToast(title: "Signed Out", message: "Session closed safely.", style: .info)
                    }) {
                        HStack {
                            Image(systemName: "rectangle.portrait.and.arrow.right")
                            Text("Sign Out")
                        }
                        .font(AppTheme.Typography.font(for: .buttonLabel))
                        .foregroundColor(AppTheme.Colors.coralRed)
                        .frame(maxWidth: .infinity)
                        .frame(height: 48)
                        .background(AppTheme.Colors.coralRed.opacity(0.1))
                        .cornerRadius(AppTheme.Layout.cornerRadiusMedium)
                    }
                }
                .padding(.top, AppTheme.Layout.spacing12)
                .padding(.bottom, AppTheme.Layout.spacing32)
            }
            .padding(.horizontal, AppTheme.Layout.spacing20)
            .padding(.vertical, AppTheme.Layout.spacing16)
        }
        .background(AppTheme.Colors.surfaceBackground.ignoresSafeArea())
    }
}
