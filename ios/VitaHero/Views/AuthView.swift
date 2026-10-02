import SwiftUI

/// Authentication screen supporting Parent/Guardian & Clinician login, signup, and demo mode.
struct AuthView: View {
    @EnvironmentObject var authManager: AuthManager
    @EnvironmentObject var appViewModel: AppViewModel
    
    @State private var isSignUp: Bool = false
    @State private var phoneOrEmail: String = ""
    @State private var password: String = ""
    @State private var fullName: String = ""
    
    var body: some View {
        ScrollView {
            VStack(spacing: AppTheme.Layout.spacing24) {
                // Header Logo
                VStack(spacing: AppTheme.Layout.spacing12) {
                    ZStack {
                        Circle()
                            .fill(AppTheme.Gradients.primaryOrange)
                            .frame(width: 72, height: 72)
                        Image(systemName: "cross.case.fill")
                            .font(.system(size: 34))
                            .foregroundColor(.white)
                    }
                    
                    Text("VitaHero")
                        .font(AppTheme.Typography.font(for: .heroHeader))
                        .foregroundColor(AppTheme.Colors.textPrimary)
                    
                    Text("Pediatric Health & Clinical Screening Platform")
                        .font(AppTheme.Typography.font(for: .captionMedium))
                        .foregroundColor(AppTheme.Colors.textSecondary)
                }
                .padding(.top, AppTheme.Layout.spacing32)
                
                // Role Selector Switch
                HStack(spacing: 0) {
                    Button(action: {
                        withAnimation { authManager.userRole = .parent }
                    }) {
                        HStack(spacing: 6) {
                            Image(systemName: "figure.2.and.child.holdinghands")
                            Text("Parent / Guardian")
                        }
                        .font(AppTheme.Typography.font(for: .buttonLabel))
                        .foregroundColor(authManager.userRole == .parent ? .white : AppTheme.Colors.textSecondary)
                        .frame(maxWidth: .infinity)
                        .frame(height: 44)
                        .background(authManager.userRole == .parent ? AppTheme.Colors.heroOrange : Color.clear)
                        .cornerRadius(AppTheme.Layout.cornerRadiusMedium)
                    }
                    
                    Button(action: {
                        withAnimation { authManager.userRole = .clinician }
                    }) {
                        HStack(spacing: 6) {
                            Image(systemName: "stethoscope")
                            Text("Clinician / Doctor")
                        }
                        .font(AppTheme.Typography.font(for: .buttonLabel))
                        .foregroundColor(authManager.userRole == .clinician ? .white : AppTheme.Colors.textSecondary)
                        .frame(maxWidth: .infinity)
                        .frame(height: 44)
                        .background(authManager.userRole == .clinician ? AppTheme.Colors.heroBlue : Color.clear)
                        .cornerRadius(AppTheme.Layout.cornerRadiusMedium)
                    }
                }
                .padding(4)
                .background(Color.white)
                .cornerRadius(AppTheme.Layout.cornerRadiusMedium)
                .overlay(
                    RoundedRectangle(cornerRadius: AppTheme.Layout.cornerRadiusMedium)
                        .stroke(AppTheme.Colors.glassBorder, lineWidth: 1)
                )
                
                // Form Fields Card
                HeroCard {
                    VStack(spacing: AppTheme.Layout.spacing16) {
                        if isSignUp {
                            HeroTextField(
                                label: "Full Name",
                                placeholder: "Dr. Sarah Jenkins or Parent Name",
                                text: $fullName,
                                iconName: "person.fill"
                            )
                        }
                        
                        HeroTextField(
                            label: "Email or Mobile Number",
                            placeholder: "parent@vitahero.health or +1 555-0192",
                            text: $phoneOrEmail,
                            iconName: "envelope.fill",
                            keyboardType: .emailAddress
                        )
                        
                        HeroTextField(
                            label: "Password",
                            placeholder: "••••••••",
                            text: $password,
                            iconName: "lock.fill",
                            isSecure: true
                        )
                        
                        if let error = authManager.errorMessage {
                            Text(error)
                                .font(AppTheme.Typography.font(for: .captionMedium))
                                .foregroundColor(AppTheme.Colors.coralRed)
                                .multilineTextAlignment(.center)
                        }
                        
                        PrimaryGradientButton(
                            title: isSignUp ? "Create Account" : "Sign In",
                            iconName: "arrow.right.circle.fill",
                            isLoading: authManager.isLoading
                        ) {
                            Task {
                                let success = await authManager.login(identifier: phoneOrEmail, password: password)
                                if success {
                                    appViewModel.showToast(title: "Welcome back!", message: "Successfully logged in.", style: .success)
                                }
                            }
                        }
                        
                        Button(action: {
                            withAnimation { isSignUp.toggle() }
                        }) {
                            Text(isSignUp ? "Already have an account? Sign In" : "Don't have an account? Register")
                                .font(AppTheme.Typography.font(for: .bodyMedium))
                                .foregroundColor(AppTheme.Colors.heroOrange)
                        }
                    }
                }
                
                // Demo Mode Fast Bypass Card
                HeroCard(backgroundColor: AppTheme.Colors.heroBlue.opacity(0.06)) {
                    VStack(spacing: AppTheme.Layout.spacing12) {
                        HStack {
                            Image(systemName: "bolt.shield.fill")
                                .foregroundColor(AppTheme.Colors.heroBlue)
                            Text("Instant Demo Bypass Mode")
                                .font(AppTheme.Typography.font(for: .cardTitleSmall))
                                .foregroundColor(AppTheme.Colors.heroBlue)
                        }
                        
                        Text("Explore zero-latency clinical eye screenings & parent dashboard with sample data instantly.")
                            .font(AppTheme.Typography.font(for: .captionRegular))
                            .foregroundColor(AppTheme.Colors.textSecondary)
                            .multilineTextAlignment(.center)
                        
                        HStack(spacing: AppTheme.Layout.spacing12) {
                            Button(action: {
                                authManager.loginDemo(role: .parent)
                                appViewModel.showToast(title: "Parent Demo Active", message: "Loaded sample children dashboard.", style: .info)
                            }) {
                                HStack(spacing: 4) {
                                    Image(systemName: "person.fill")
                                    Text("Demo Parent")
                                }
                                .font(AppTheme.Typography.font(for: .captionMedium))
                                .foregroundColor(.white)
                                .frame(maxWidth: .infinity)
                                .frame(height: 38)
                                .background(AppTheme.Colors.heroOrange)
                                .cornerRadius(AppTheme.Layout.cornerRadiusSmall)
                            }
                            
                            Button(action: {
                                authManager.loginDemo(role: .clinician)
                                appViewModel.showToast(title: "Clinician Portal Active", message: "Loaded pediatric eye screening roster.", style: .info)
                            }) {
                                HStack(spacing: 4) {
                                    Image(systemName: "stethoscope")
                                    Text("Demo Doctor")
                                }
                                .font(AppTheme.Typography.font(for: .captionMedium))
                                .foregroundColor(.white)
                                .frame(maxWidth: .infinity)
                                .frame(height: 38)
                                .background(AppTheme.Colors.heroBlue)
                                .cornerRadius(AppTheme.Layout.cornerRadiusSmall)
                            }
                        }
                    }
                }
                .padding(.bottom, AppTheme.Layout.spacing32)
            }
            .padding(.horizontal, AppTheme.Layout.spacing24)
        }
        .background(AppTheme.Colors.surfaceBackground.ignoresSafeArea())
    }
}
