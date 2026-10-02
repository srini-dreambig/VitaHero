import SwiftUI

/// Symptom Logger & AI Diet Recommendations Screen.
struct SymptomDietView: View {
    @EnvironmentObject var appViewModel: AppViewModel
    @EnvironmentObject var kidsViewModel: KidsViewModel
    @StateObject private var viewModel = SymptomDietViewModel()
    
    @State private var activeSegment: Int = 0 // 0: Symptom Tracker, 1: AI Diet & Food Scanner
    
    var body: some View {
        VStack(spacing: 0) {
            // Top Segment Switcher
            HStack(spacing: 0) {
                Button(action: { withAnimation { activeSegment = 0 } }) {
                    VStack(spacing: 6) {
                        HStack(spacing: 6) {
                            Image(systemName: "stethoscope")
                            Text("Symptom Logger")
                        }
                        .font(AppTheme.Typography.font(for: .buttonLabel))
                        .foregroundColor(activeSegment == 0 ? AppTheme.Colors.heroOrange : AppTheme.Colors.textSecondary)
                        
                        Rectangle()
                            .fill(activeSegment == 0 ? AppTheme.Colors.heroOrange : Color.clear)
                            .frame(height: 3)
                    }
                }
                .frame(maxWidth: .infinity)
                
                Button(action: { withAnimation { activeSegment = 1 } }) {
                    VStack(spacing: 6) {
                        HStack(spacing: 6) {
                            Image(systemName: "leaf.fill")
                            Text("AI Diet & Food")
                        }
                        .font(AppTheme.Typography.font(for: .buttonLabel))
                        .foregroundColor(activeSegment == 1 ? AppTheme.Colors.emerald : AppTheme.Colors.textSecondary)
                        
                        Rectangle()
                            .fill(activeSegment == 1 ? AppTheme.Colors.emerald : Color.clear)
                            .frame(height: 3)
                    }
                }
                .frame(maxWidth: .infinity)
            }
            .padding(.top, AppTheme.Layout.spacing12)
            .background(Color.white)
            .shadow(color: Color.black.opacity(0.03), radius: 3, x: 0, y: 2)
            
            ScrollView {
                if activeSegment == 0 {
                    symptomTrackerSection
                } else {
                    aiDietSection
                }
            }
            .background(AppTheme.Colors.surfaceBackground.ignoresSafeArea())
        }
    }
    
    // MARK: - 1. Symptom Tracker Section
    private var symptomTrackerSection: some View {
        VStack(alignment: .leading, spacing: AppTheme.Layout.spacing20) {
            HeroCard {
                VStack(alignment: .leading, spacing: AppTheme.Layout.spacing16) {
                    HeroFormSectionHeader(
                        title: "Log Child Symptom",
                        subtitle: "AI clinical triage evaluation",
                        iconName: "square.and.pencil",
                        accentColor: AppTheme.Colors.heroOrange
                    )
                    
                    Text("Select Symptom Category")
                        .font(AppTheme.Typography.font(for: .formLabel))
                    
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: AppTheme.Layout.spacing12) {
                            ForEach(SymptomDietViewModel.SymptomCategory.allCases) { cat in
                                Button(action: { viewModel.selectedCategory = cat }) {
                                    HStack(spacing: 6) {
                                        Image(systemName: cat.icon)
                                        Text(cat.rawValue)
                                    }
                                    .font(AppTheme.Typography.font(for: .bodyMedium))
                                    .padding(.horizontal, AppTheme.Layout.spacing16)
                                    .padding(.vertical, 10)
                                    .background(
                                        viewModel.selectedCategory == cat ? AppTheme.Colors.heroOrange : Color.white
                                    )
                                    .foregroundColor(viewModel.selectedCategory == cat ? .white : AppTheme.Colors.textPrimary)
                                    .cornerRadius(20)
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 20)
                                            .stroke(AppTheme.Colors.glassBorder, lineWidth: 1)
                                    )
                                }
                            }
                        }
                    }
                    
                    // Severity Slider
                    VStack(alignment: .leading, spacing: 6) {
                        HStack {
                            Text("Severity Index (1 to 5):")
                                .font(AppTheme.Typography.font(for: .formLabel))
                            Spacer()
                            Text("\(Int(viewModel.severity)) / 5")
                                .font(AppTheme.Typography.font(for: .cardTitleSmall))
                                .foregroundColor(AppTheme.Colors.heroOrange)
                        }
                        Slider(value: $viewModel.severity, in: 1...5, step: 1)
                            .tint(AppTheme.Colors.heroOrange)
                    }
                    
                    HeroTextField(
                        label: "Symptom Notes & Observations",
                        placeholder: "e.g. Temperature 100.4F, coughing since morning...",
                        text: $viewModel.symptomDescription,
                        iconName: "note.text"
                    )
                    
                    PrimaryGradientButton(
                        title: "Evaluate & Save Symptom",
                        iconName: "paperplane.fill",
                        isLoading: viewModel.isLoggingSymptom
                    ) {
                        Task {
                            let kidId = kidsViewModel.selectedKid?.id ?? "kid_1"
                            _ = await viewModel.logSymptom(kidId: kidId)
                            appViewModel.showToast(title: "Symptom Logged", message: "AI Triage analysis generated.", style: .success)
                        }
                    }
                }
            }
            
            // AI Triage Advice Card
            if let advice = viewModel.aiTriageAdvice {
                HeroCard(backgroundColor: AppTheme.Colors.heroOrange.opacity(0.06)) {
                    VStack(alignment: .leading, spacing: AppTheme.Layout.spacing12) {
                        HStack {
                            Image(systemName: "brain.head.profile")
                                .font(.system(size: 22))
                                .foregroundColor(AppTheme.Colors.heroOrange)
                            Text("AI Clinical Triage Advice")
                                .font(AppTheme.Typography.font(for: .cardTitleMedium))
                                .foregroundColor(AppTheme.Colors.heroOrange)
                        }
                        Text(advice)
                            .font(AppTheme.Typography.font(for: .bodyMedium))
                            .foregroundColor(AppTheme.Colors.textPrimary)
                    }
                }
            }
            
            // Symptom History List
            Text("Past Symptom History")
                .font(AppTheme.Typography.font(for: .sectionTitle))
                .foregroundColor(AppTheme.Colors.textPrimary)
            
            ForEach(viewModel.symptomLogHistory) { log in
                HeroCard(backgroundColor: Color.white) {
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            StatusPill(text: log.category, style: .warning)
                            Spacer()
                            Text(log.date)
                                .font(AppTheme.Typography.font(for: .captionRegular))
                                .foregroundColor(AppTheme.Colors.textSecondary)
                        }
                        Text(log.notes)
                            .font(AppTheme.Typography.font(for: .bodyMedium))
                            .foregroundColor(AppTheme.Colors.textPrimary)
                        if let triage = log.triageAdvice {
                            Text("Advice: \(triage)")
                                .font(AppTheme.Typography.font(for: .captionMedium))
                                .foregroundColor(AppTheme.Colors.heroBlue)
                        }
                    }
                }
            }
        }
        .padding(.horizontal, AppTheme.Layout.spacing20)
        .padding(.vertical, AppTheme.Layout.spacing16)
    }
    
    // MARK: - 2. AI Diet & Food Recognition Section
    private var aiDietSection: some View {
        VStack(alignment: .leading, spacing: AppTheme.Layout.spacing20) {
            // Food Recognition Scanner Action Card
            HeroCard(backgroundColor: AppTheme.Colors.emerald.opacity(0.08)) {
                VStack(alignment: .leading, spacing: AppTheme.Layout.spacing12) {
                    HStack {
                        Image(systemName: "camera.viewfinder")
                            .font(.system(size: 26))
                            .foregroundColor(AppTheme.Colors.emerald)
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Recognize Food with AI")
                                .font(AppTheme.Typography.font(for: .cardTitleMedium))
                            Text("Snap or upload meal photos for instant macros")
                                .font(AppTheme.Typography.font(for: .captionRegular))
                                .foregroundColor(AppTheme.Colors.textSecondary)
                        }
                    }
                    
                    SecondaryOutlineButton(
                        title: viewModel.isScanningFood ? "Analyzing Food Image..." : "Scan Meal Photo",
                        iconName: "camera.fill"
                    ) {
                        Task {
                            await viewModel.recognizeFood(imageBytes: nil)
                        }
                    }
                }
            }
            
            // Food Recognition Results Card
            if let foodResult = viewModel.foodScanResult {
                HeroCard(backgroundColor: Color.white) {
                    VStack(alignment: .leading, spacing: AppTheme.Layout.spacing12) {
                        HStack {
                            StatusPill(text: foodResult.foodName, style: .success)
                            Spacer()
                            Text("\(foodResult.calories) kcal")
                                .font(AppTheme.Typography.font(for: .cardTitleSmall))
                                .foregroundColor(AppTheme.Colors.emerald)
                        }
                        
                        Text("Nutritional Breakdown")
                            .font(AppTheme.Typography.font(for: .formLabel))
                        
                        HStack(spacing: AppTheme.Layout.spacing12) {
                            VStack {
                                Text("Protein")
                                    .font(AppTheme.Typography.font(for: .captionRegular))
                                Text("\(foodResult.proteinGrams)g")
                                    .font(AppTheme.Typography.font(for: .cardTitleSmall))
                            }
                            .frame(maxWidth: .infinity)
                            .padding(8)
                            .background(AppTheme.Colors.surfaceBackground)
                            .cornerRadius(8)
                            
                            VStack {
                                Text("Carbs")
                                    .font(AppTheme.Typography.font(for: .captionRegular))
                                Text("\(foodResult.carbsGrams)g")
                                    .font(AppTheme.Typography.font(for: .cardTitleSmall))
                            }
                            .frame(maxWidth: .infinity)
                            .padding(8)
                            .background(AppTheme.Colors.surfaceBackground)
                            .cornerRadius(8)
                            
                            VStack {
                                Text("Fats")
                                    .font(AppTheme.Typography.font(for: .captionRegular))
                                Text("\(foodResult.fatsGrams)g")
                                    .font(AppTheme.Typography.font(for: .cardTitleSmall))
                            }
                            .frame(maxWidth: .infinity)
                            .padding(8)
                            .background(AppTheme.Colors.surfaceBackground)
                            .cornerRadius(8)
                        }
                    }
                }
            }
            
            // Personalised Diet Generator
            HeroCard {
                VStack(alignment: .leading, spacing: AppTheme.Layout.spacing16) {
                    HeroFormSectionHeader(
                        title: "Generate AI Diet Plan",
                        subtitle: "Tailored to age & health goals",
                        iconName: "sparkles",
                        accentColor: AppTheme.Colors.emerald
                    )
                    
                    HeroTextField(
                        label: "Diet Goal",
                        placeholder: "Immunity Boost, Weight Gain, Focus",
                        text: $viewModel.dietGoal,
                        iconName: "target"
                    )
                    
                    HeroTextField(
                        label: "Dietary Preferences",
                        placeholder: "Vegetarian, Lactose-Free, Nut-Free...",
                        text: $viewModel.dietaryPreferences,
                        iconName: "leaf"
                    )
                    
                    PrimaryGradientButton(
                        title: "Generate Personalised Meal Plan",
                        iconName: "wand.and.stars",
                        isLoading: viewModel.isGeneratingDiet
                    ) {
                        Task {
                            let age = kidsViewModel.selectedKid?.age ?? 6
                            let kidId = kidsViewModel.selectedKid?.id ?? "kid_1"
                            await viewModel.generatePersonalizedDiet(kidId: kidId, age: age)
                        }
                    }
                }
            }
            
            // Generated Diet Tips Output Card
            if let diet = viewModel.generatedDietTips {
                HeroCard(backgroundColor: Color.white) {
                    VStack(alignment: .leading, spacing: AppTheme.Layout.spacing12) {
                        Text(diet.headline)
                            .font(AppTheme.Typography.font(for: .cardTitleLarge))
                            .foregroundColor(AppTheme.Colors.emerald)
                        
                        Text(diet.summary)
                            .font(AppTheme.Typography.font(for: .bodyMedium))
                            .foregroundColor(AppTheme.Colors.textPrimary)
                        
                        Divider()
                        
                        Text("Recommended Daily Meals:")
                            .font(AppTheme.Typography.font(for: .formLabel))
                        
                        ForEach(diet.recommendedMeals, id: \.self) { meal in
                            HStack(alignment: .top, spacing: 8) {
                                Image(systemName: "checkmark.circle.fill")
                                    .foregroundColor(AppTheme.Colors.emerald)
                                Text(meal)
                                    .font(AppTheme.Typography.font(for: .bodyMedium))
                            }
                        }
                    }
                }
            }
        }
        .padding(.horizontal, AppTheme.Layout.spacing20)
        .padding(.vertical, AppTheme.Layout.spacing16)
    }
}
