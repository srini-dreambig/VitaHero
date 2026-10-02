import SwiftUI

/// Clinical & Telehealth Consent & Terms Agreement Screen.
struct ConsentView: View {
    @EnvironmentObject var appViewModel: AppViewModel
    @EnvironmentObject var authManager: AuthManager
    
    @State private var acceptTerms: Bool = false
    @State private var acceptTelemetry: Bool = false
    @State private var acceptClinicalShare: Bool = false
    
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: AppTheme.Layout.spacing24) {
                // Header Icon
                ZStack {
                    Circle()
                        .fill(AppTheme.Gradients.primaryOrange)
                        .frame(width: 80, height: 80)
                    Image(systemName: "hand.raised.shield.fill")
                        .font(.system(size: 38))
                        .foregroundColor(.white)
                }
                .frame(maxWidth: .infinity)
                .padding(.top, AppTheme.Layout.spacing24)
                
                VStack(spacing: AppTheme.Layout.spacing8) {
                    Text("Child Health & Data Privacy")
                        .font(AppTheme.Typography.font(for: .displayTitle))
                        .foregroundColor(AppTheme.Colors.textPrimary)
                        .multilineTextAlignment(.center)
                    
                    Text("VitaHero protects your family's pediatric medical records with HIPAA & GDPR compliant end-to-end encryption.")
                        .font(AppTheme.Typography.font(for: .bodyMedium))
                        .foregroundColor(AppTheme.Colors.textSecondary)
                        .multilineTextAlignment(.center)
                }
                .frame(maxWidth: .infinity)
                
                // Card Details
                HeroCard {
                    VStack(alignment: .leading, spacing: AppTheme.Layout.spacing16) {
                        HStack(spacing: AppTheme.Layout.spacing12) {
                            Image(systemName: "lock.shield.fill")
                                .foregroundColor(AppTheme.Colors.emerald)
                                .font(.system(size: 20))
                            Text("Medical Confidentiality")
                                .font(AppTheme.Typography.font(for: .cardTitleMedium))
                        }
                        Text("Screening data captured by school clinicians is accessible only to authorized health specialists and your designated parent account.")
                            .font(AppTheme.Typography.font(for: .bodyMedium))
                            .foregroundColor(AppTheme.Colors.textSecondary)
                    }
                }
                
                // Toggle Checkboxes
                VStack(spacing: AppTheme.Layout.spacing16) {
                    Toggle(isOn: $acceptTerms) {
                        Text("I accept the Terms of Service & Privacy Policy")
                            .font(AppTheme.Typography.font(for: .bodyMedium))
                    }
                    .tint(AppTheme.Colors.heroOrange)
                    
                    Toggle(isOn: $acceptTelemetry) {
                        Text("Allow anonymous pediatric health telemetry for AI growth model accuracy")
                            .font(AppTheme.Typography.font(for: .bodyMedium))
                    }
                    .tint(AppTheme.Colors.heroOrange)
                    
                    Toggle(isOn: $acceptClinicalShare) {
                        Text("Authorize school clinicians to upload vision and dental screening results")
                            .font(AppTheme.Typography.font(for: .bodyMedium))
                    }
                    .tint(AppTheme.Colors.heroOrange)
                }
                .padding(AppTheme.Layout.spacing16)
                .background(Color.white)
                .cornerRadius(AppTheme.Layout.cornerRadiusMedium)
                
                // Action Button
                PrimaryGradientButton(
                    title: "Agree & Continue",
                    iconName: "checkmark.circle.fill",
                    isEnabled: acceptTerms && acceptClinicalShare
                ) {
                    authManager.completeConsent()
                }
                .padding(.bottom, AppTheme.Layout.spacing32)
            }
            .padding(.horizontal, AppTheme.Layout.spacing24)
        }
        .background(AppTheme.Colors.surfaceBackground.ignoresSafeArea())
    }
}
