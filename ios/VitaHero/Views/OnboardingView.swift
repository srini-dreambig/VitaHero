import SwiftUI

/// Onboarding carousel screen explaining VitaHero features.
struct OnboardingView: View {
    @EnvironmentObject var authManager: AuthManager
    @State private var currentPage = 0
    
    struct OnboardingSlide {
        let title: String
        let description: String
        let iconName: String
        let color: Color
    }
    
    let slides = [
        OnboardingSlide(
            title: "School Clinical Screenings",
            description: "World-class pediatric vision, dental, ENT, and health exams conducted right at school with instant parent reports.",
            iconName: "stethoscope.circle.fill",
            color: AppTheme.Colors.heroOrange
        ),
        OnboardingSlide(
            title: "AI Symptom & Diet Intelligence",
            description: "Instant pediatric triage advice, personalized meal plans, and real working AI food recognition.",
            iconName: "leaf.circle.fill",
            color: AppTheme.Colors.emerald
        ),
        OnboardingSlide(
            title: "Direct Specialist Telehealth",
            description: "Book top pediatric ophthalmologists, dentists, and pediatricians for immediate video consultations.",
            iconName: "video.circle.fill",
            color: AppTheme.Colors.heroBlue
        )
    ]
    
    var body: some View {
        VStack(spacing: AppTheme.Layout.spacing24) {
            // Top Navigation Skip
            HStack {
                Spacer()
                Button(action: {
                    authManager.completeOnboarding()
                }) {
                    Text("Skip")
                        .font(AppTheme.Typography.font(for: .buttonLabel))
                        .foregroundColor(AppTheme.Colors.textSecondary)
                }
            }
            .padding(.horizontal, AppTheme.Layout.spacing24)
            .padding(.top, AppTheme.Layout.spacing16)
            
            // Tab View Carousel
            TabView(selection: $currentPage) {
                ForEach(0..<slides.count, id: \.self) { index in
                    VStack(spacing: AppTheme.Layout.spacing32) {
                        ZStack {
                            Circle()
                                .fill(slides[index].color.opacity(0.12))
                                .frame(width: 180, height: 180)
                            Circle()
                                .fill(slides[index].color.opacity(0.25))
                                .frame(width: 140, height: 140)
                            Image(systemName: slides[index].iconName)
                                .font(.system(size: 70))
                                .foregroundColor(slides[index].color)
                        }
                        
                        VStack(spacing: AppTheme.Layout.spacing12) {
                            Text(slides[index].title)
                                .font(AppTheme.Typography.font(for: .displayTitle))
                                .foregroundColor(AppTheme.Colors.textPrimary)
                                .multilineTextAlignment(.center)
                            
                            Text(slides[index].description)
                                .font(AppTheme.Typography.font(for: .bodyMedium))
                                .foregroundColor(AppTheme.Colors.textSecondary)
                                .multilineTextAlignment(.center)
                                .padding(.horizontal, AppTheme.Layout.spacing24)
                        }
                    }
                    .tag(index)
                }
            }
            .tabViewStyle(PageTabViewStyle(indexDisplayMode: .always))
            
            // Bottom Action
            VStack(spacing: AppTheme.Layout.spacing16) {
                PrimaryGradientButton(
                    title: currentPage == slides.count - 1 ? "Get Started" : "Continue",
                    iconName: "arrow.right"
                ) {
                    if currentPage < slides.count - 1 {
                        withAnimation { currentPage += 1 }
                    } else {
                        authManager.completeOnboarding()
                    }
                }
            }
            .padding(.horizontal, AppTheme.Layout.spacing24)
            .padding(.bottom, AppTheme.Layout.spacing32)
        }
        .background(AppTheme.Colors.surfaceBackground.ignoresSafeArea())
    }
}
