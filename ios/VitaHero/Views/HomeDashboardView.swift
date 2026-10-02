import SwiftUI

/// Main Parent Home Dashboard View.
struct HomeDashboardView: View {
    @EnvironmentObject var appViewModel: AppViewModel
    @EnvironmentObject var kidsViewModel: KidsViewModel
    @EnvironmentObject var bookingViewModel: BookingViewModel
    
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: AppTheme.Layout.spacing20) {
                // Top Kid Selector Header
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Welcome Back 👋")
                            .font(AppTheme.Typography.font(for: .captionMedium))
                            .foregroundColor(AppTheme.Colors.textSecondary)
                        Text(kidsViewModel.selectedKid?.name ?? "My Child")
                            .font(AppTheme.Typography.font(for: .heroHeader))
                            .foregroundColor(AppTheme.Colors.textPrimary)
                    }
                    Spacer()
                    
                    // Kid Selector Menu Pill
                    Menu {
                        ForEach(kidsViewModel.kids) { kid in
                            Button(action: {
                                kidsViewModel.selectedKid = kid
                            }) {
                                HStack {
                                    Text(kid.name)
                                    if kid.id == kidsViewModel.selectedKid?.id {
                                        Image(systemName: "checkmark")
                                    }
                                }
                            }
                        }
                        Divider()
                        Button(action: {
                            appViewModel.showAddChildModal = true
                        }) {
                            Label("Add Child Profile", systemImage: "plus.circle")
                        }
                    } label: {
                        HStack(spacing: 6) {
                            Circle()
                                .fill(AppTheme.Gradients.primaryOrange)
                                .frame(width: 32, height: 32)
                                .overlay(
                                    Text(String(kidsViewModel.selectedKid?.name.prefix(1) ?? "K"))
                                        .font(.system(size: 14, weight: .bold))
                                        .foregroundColor(.white)
                                )
                            Text(kidsViewModel.selectedKid?.name ?? "Select")
                                .font(AppTheme.Typography.font(for: .bodyMedium))
                                .foregroundColor(AppTheme.Colors.textPrimary)
                            Image(systemName: "chevron.down")
                                .font(.system(size: 12))
                                .foregroundColor(AppTheme.Colors.textSecondary)
                        }
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                        .background(Color.white)
                        .cornerRadius(20)
                        .shadow(color: Color.black.opacity(0.05), radius: 4, x: 0, y: 2)
                    }
                }
                
                // VitaHero Overall Pediatric Health Score Card
                HeroCard(backgroundColor: Color.white) {
                    HStack(spacing: AppTheme.Layout.spacing16) {
                        // Score Circle Indicator
                        ZStack {
                            Circle()
                                .stroke(AppTheme.Colors.emerald.opacity(0.15), lineWidth: 10)
                                .frame(width: 84, height: 84)
                            Circle()
                                .trim(from: 0.0, to: CGFloat(kidsViewModel.selectedKid?.healthScore ?? 92) / 100.0)
                                .stroke(
                                    AppTheme.Gradients.emeraldGradient,
                                    style: StrokeStyle(lineWidth: 10, lineCap: .round)
                                )
                                .rotationEffect(.degrees(-90))
                                .frame(width: 84, height: 84)
                            
                            VStack(spacing: 0) {
                                Text("\(kidsViewModel.selectedKid?.healthScore ?? 92)")
                                    .font(.system(size: 24, weight: .bold, design: .rounded))
                                    .foregroundColor(AppTheme.Colors.emerald)
                                Text("Score")
                                    .font(AppTheme.Typography.font(for: .badgeText))
                                    .foregroundColor(AppTheme.Colors.textSecondary)
                            }
                        }
                        
                        VStack(alignment: .leading, spacing: 6) {
                            StatusPill(text: "Optimal Growth Trajectory", style: .success)
                            Text("All vital indicators normal")
                                .font(AppTheme.Typography.font(for: .cardTitleMedium))
                                .foregroundColor(AppTheme.Colors.textPrimary)
                            Text("Last vision & dental screening: 2 weeks ago")
                                .font(AppTheme.Typography.font(for: .captionRegular))
                                .foregroundColor(AppTheme.Colors.textSecondary)
                        }
                    }
                }
                
                // Quick Action Shortcuts Grid
                Text("Quick Health Actions")
                    .font(AppTheme.Typography.font(for: .sectionTitle))
                    .foregroundColor(AppTheme.Colors.textPrimary)
                
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: AppTheme.Layout.spacing16) {
                    // Action 1: Log Symptoms
                    Button(action: { appViewModel.activeTab = .symptomsDiet }) {
                        VStack(alignment: .leading, spacing: 10) {
                            ZStack {
                                Circle().fill(AppTheme.Colors.heroOrange.opacity(0.12)).frame(width: 42, height: 42)
                                Image(systemName: "stethoscope.circle.fill")
                                    .font(.system(size: 22))
                                    .foregroundColor(AppTheme.Colors.heroOrange)
                            }
                            Text("Log Symptoms")
                                .font(AppTheme.Typography.font(for: .cardTitleSmall))
                                .foregroundColor(AppTheme.Colors.textPrimary)
                            Text("AI Triage & Advice")
                                .font(AppTheme.Typography.font(for: .captionRegular))
                                .foregroundColor(AppTheme.Colors.textSecondary)
                        }
                        .padding(AppTheme.Layout.spacing16)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Color.white)
                        .cornerRadius(AppTheme.Layout.cornerRadiusMedium)
                        .shadow(color: Color.black.opacity(0.04), radius: 6, x: 0, y: 3)
                    }
                    
                    // Action 2: AI Personalized Diet
                    Button(action: { appViewModel.activeTab = .symptomsDiet }) {
                        VStack(alignment: .leading, spacing: 10) {
                            ZStack {
                                Circle().fill(AppTheme.Colors.emerald.opacity(0.12)).frame(width: 42, height: 42)
                                Image(systemName: "leaf.fill")
                                    .font(.system(size: 20))
                                    .foregroundColor(AppTheme.Colors.emerald)
                            }
                            Text("AI Diet Tips")
                                .font(AppTheme.Typography.font(for: .cardTitleSmall))
                                .foregroundColor(AppTheme.Colors.textPrimary)
                            Text("Recognize Food & Plan")
                                .font(AppTheme.Typography.font(for: .captionRegular))
                                .foregroundColor(AppTheme.Colors.textSecondary)
                        }
                        .padding(AppTheme.Layout.spacing16)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Color.white)
                        .cornerRadius(AppTheme.Layout.cornerRadiusMedium)
                        .shadow(color: Color.black.opacity(0.04), radius: 6, x: 0, y: 3)
                    }
                    
                    // Action 3: Book Specialist
                    Button(action: { appViewModel.activeTab = .specialists }) {
                        VStack(alignment: .leading, spacing: 10) {
                            ZStack {
                                Circle().fill(AppTheme.Colors.heroBlue.opacity(0.12)).frame(width: 42, height: 42)
                                Image(systemName: "calendar.badge.clock")
                                    .font(.system(size: 20))
                                    .foregroundColor(AppTheme.Colors.heroBlue)
                            }
                            Text("Book Doctor")
                                .font(AppTheme.Typography.font(for: .cardTitleSmall))
                                .foregroundColor(AppTheme.Colors.textPrimary)
                            Text("Pediatric Specialists")
                                .font(AppTheme.Typography.font(for: .captionRegular))
                                .foregroundColor(AppTheme.Colors.textSecondary)
                        }
                        .padding(AppTheme.Layout.spacing16)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Color.white)
                        .cornerRadius(AppTheme.Layout.cornerRadiusMedium)
                        .shadow(color: Color.black.opacity(0.04), radius: 6, x: 0, y: 3)
                    }
                    
                    // Action 4: Clinical Screenings View
                    Button(action: { appViewModel.activeTab = .clinician }) {
                        VStack(alignment: .leading, spacing: 10) {
                            ZStack {
                                Circle().fill(AppTheme.Colors.purple.opacity(0.12)).frame(width: 42, height: 42)
                                Image(systemName: "cross.case.fill")
                                    .font(.system(size: 20))
                                    .foregroundColor(AppTheme.Colors.purple)
                            }
                            Text("School Screening")
                                .font(AppTheme.Typography.font(for: .cardTitleSmall))
                                .foregroundColor(AppTheme.Colors.textPrimary)
                            Text("Eye & Dental Records")
                                .font(AppTheme.Typography.font(for: .captionRegular))
                                .foregroundColor(AppTheme.Colors.textSecondary)
                        }
                        .padding(AppTheme.Layout.spacing16)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Color.white)
                        .cornerRadius(AppTheme.Layout.cornerRadiusMedium)
                        .shadow(color: Color.black.opacity(0.04), radius: 6, x: 0, y: 3)
                    }
                }
                
                // Growth & Vitals Summary Card
                HeroCard {
                    VStack(alignment: .leading, spacing: AppTheme.Layout.spacing12) {
                        HeroFormSectionHeader(
                            title: "Vitals & Growth Metrics",
                            subtitle: "WHO Percentiles updated monthly",
                            iconName: "chart.line.uptrend.xyaxis",
                            accentColor: AppTheme.Colors.heroBlue
                        )
                        
                        HStack(spacing: AppTheme.Layout.spacing12) {
                            VStack(spacing: 4) {
                                Text("Height")
                                    .font(AppTheme.Typography.font(for: .captionRegular))
                                    .foregroundColor(AppTheme.Colors.textSecondary)
                                Text("\(String(format: "%.1f", kidsViewModel.selectedKid?.heightCm ?? 110.0)) cm")
                                    .font(AppTheme.Typography.font(for: .cardTitleMedium))
                                    .foregroundColor(AppTheme.Colors.textPrimary)
                                StatusPill(text: "75th %ile", style: .info)
                            }
                            .frame(maxWidth: .infinity)
                            .padding(AppTheme.Layout.spacing12)
                            .background(AppTheme.Colors.surfaceBackground)
                            .cornerRadius(AppTheme.Layout.cornerRadiusSmall)
                            
                            VStack(spacing: 4) {
                                Text("Weight")
                                    .font(AppTheme.Typography.font(for: .captionRegular))
                                    .foregroundColor(AppTheme.Colors.textSecondary)
                                Text("\(String(format: "%.1f", kidsViewModel.selectedKid?.weightKg ?? 18.5)) kg")
                                    .font(AppTheme.Typography.font(for: .cardTitleMedium))
                                    .foregroundColor(AppTheme.Colors.textPrimary)
                                StatusPill(text: "60th %ile", style: .info)
                            }
                            .frame(maxWidth: .infinity)
                            .padding(AppTheme.Layout.spacing12)
                            .background(AppTheme.Colors.surfaceBackground)
                            .cornerRadius(AppTheme.Layout.cornerRadiusSmall)
                            
                            VStack(spacing: 4) {
                                Text("BMI")
                                    .font(AppTheme.Typography.font(for: .captionRegular))
                                    .foregroundColor(AppTheme.Colors.textSecondary)
                                Text("\(String(format: "%.1f", kidsViewModel.selectedKid?.bmi ?? 15.3))")
                                    .font(AppTheme.Typography.font(for: .cardTitleMedium))
                                    .foregroundColor(AppTheme.Colors.textPrimary)
                                StatusPill(text: "Normal", style: .success)
                            }
                            .frame(maxWidth: .infinity)
                            .padding(AppTheme.Layout.spacing12)
                            .background(AppTheme.Colors.surfaceBackground)
                            .cornerRadius(AppTheme.Layout.cornerRadiusSmall)
                        }
                    }
                }
                .padding(.bottom, AppTheme.Layout.spacing24)
            }
            .padding(.horizontal, AppTheme.Layout.spacing20)
            .padding(.top, AppTheme.Layout.spacing16)
        }
        .background(AppTheme.Colors.surfaceBackground.ignoresSafeArea())
    }
}
