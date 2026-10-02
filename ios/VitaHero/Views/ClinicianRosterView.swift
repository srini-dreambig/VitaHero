import SwiftUI

/// Clinician School Roster & Student Selection View.
struct ClinicianRosterView: View {
    @EnvironmentObject var appViewModel: AppViewModel
    @EnvironmentObject var clinicianViewModel: ClinicianViewModel
    
    @Binding var showingScreeningForm: Bool
    
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: AppTheme.Layout.spacing20) {
                // Header Banner
                VStack(alignment: .leading, spacing: 4) {
                    Text("School Health Screening")
                        .font(AppTheme.Typography.font(for: .displayTitle))
                        .foregroundColor(AppTheme.Colors.textPrimary)
                    Text("Pediatric Eye, Dental, ENT & General Examinations")
                        .font(AppTheme.Typography.font(for: .captionMedium))
                        .foregroundColor(AppTheme.Colors.textSecondary)
                }
                
                // Roster Summary Banner Card
                HeroCard(backgroundColor: AppTheme.Colors.heroBlue.opacity(0.08)) {
                    HStack(spacing: AppTheme.Layout.spacing16) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("St. Jude Elementary Roster")
                                .font(AppTheme.Typography.font(for: .cardTitleMedium))
                                .foregroundColor(AppTheme.Colors.heroBlue)
                            Text("Grade 3-B • Fall 2026 Drive")
                                .font(AppTheme.Typography.font(for: .captionRegular))
                                .foregroundColor(AppTheme.Colors.textSecondary)
                        }
                        Spacer()
                        
                        VStack(alignment: .trailing, spacing: 2) {
                            Text("\(clinicianViewModel.students.count)")
                                .font(.system(size: 28, weight: .bold))
                                .foregroundColor(AppTheme.Colors.heroBlue)
                            Text("Students")
                                .font(AppTheme.Typography.font(for: .badgeText))
                                .foregroundColor(AppTheme.Colors.textSecondary)
                        }
                    }
                }
                
                // Search Bar & Filters
                VStack(spacing: AppTheme.Layout.spacing12) {
                    HeroTextField(
                        label: "Find Student",
                        placeholder: "Name, Roll #, Class...",
                        text: $clinicianViewModel.searchQuery,
                        iconName: "magnifyingglass"
                    )
                    
                    // Filter Pills
                    HStack(spacing: AppTheme.Layout.spacing8) {
                        ForEach(ClinicianViewModel.ScreeningFilter.allCases) { filter in
                            Button(action: { clinicianViewModel.selectedFilter = filter }) {
                                Text(filter.rawValue)
                                    .font(AppTheme.Typography.font(for: .captionMedium))
                                    .padding(.horizontal, 14)
                                    .padding(.vertical, 8)
                                    .background(
                                        clinicianViewModel.selectedFilter == filter ? AppTheme.Colors.heroBlue : Color.white
                                    )
                                    .foregroundColor(clinicianViewModel.selectedFilter == filter ? .white : AppTheme.Colors.textPrimary)
                                    .cornerRadius(16)
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 16)
                                            .stroke(AppTheme.Colors.glassBorder, lineWidth: 1)
                                    )
                            }
                        }
                    }
                }
                
                // Students List
                if clinicianViewModel.isLoadingRoster {
                    ProgressView("Fetching student roster...")
                        .frame(maxWidth: .infinity)
                        .padding(.top, 40)
                } else {
                    ForEach(clinicianViewModel.filteredStudents) { student in
                        HeroCard(backgroundColor: Color.white) {
                            VStack(alignment: .leading, spacing: AppTheme.Layout.spacing12) {
                                HStack(alignment: .top) {
                                    Circle()
                                        .fill(AppTheme.Colors.heroOrange.opacity(0.15))
                                        .frame(width: 46, height: 46)
                                        .overlay(
                                            Text(String(student.studentName.prefix(1)))
                                                .font(.system(size: 18, weight: .bold))
                                                .foregroundColor(AppTheme.Colors.heroOrange)
                                        )
                                    
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(student.studentName)
                                            .font(AppTheme.Typography.font(for: .cardTitleMedium))
                                            .foregroundColor(AppTheme.Colors.textPrimary)
                                        Text("Roll #\(student.rollNumber) • Grade \(student.gradeClass)")
                                            .font(AppTheme.Typography.font(for: .captionRegular))
                                            .foregroundColor(AppTheme.Colors.textSecondary)
                                    }
                                    Spacer()
                                    
                                    statusPillForStudent(student)
                                }
                                
                                Divider()
                                
                                HStack {
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text("Guardian: \(student.guardianName)")
                                            .font(AppTheme.Typography.font(for: .captionRegular))
                                            .foregroundColor(AppTheme.Colors.textSecondary)
                                        Text("Age: \(student.age) yrs • \(student.gender)")
                                            .font(AppTheme.Typography.font(for: .captionRegular))
                                            .foregroundColor(AppTheme.Colors.textSecondary)
                                    }
                                    Spacer()
                                    
                                    Button(action: {
                                        clinicianViewModel.selectStudent(student)
                                        showingScreeningForm = true
                                    }) {
                                        HStack(spacing: 4) {
                                            Image(systemName: "cross.case.fill")
                                            Text(student.status == .pending ? "Examine" : "Review / Edit")
                                        }
                                        .font(AppTheme.Typography.font(for: .buttonLabel))
                                        .foregroundColor(.white)
                                        .padding(.horizontal, 14)
                                        .padding(.vertical, 8)
                                        .background(
                                            student.status == .pending ? AppTheme.Colors.heroOrange : AppTheme.Colors.heroBlue
                                        )
                                        .cornerRadius(AppTheme.Layout.cornerRadiusSmall)
                                    }
                                }
                            }
                        }
                    }
                }
            }
            .padding(.horizontal, AppTheme.Layout.spacing20)
            .padding(.vertical, AppTheme.Layout.spacing16)
        }
        .background(AppTheme.Colors.surfaceBackground.ignoresSafeArea())
    }
    
    @ViewBuilder
    private func statusPillForStudent(_ student: ClinicianStudentDto) -> some View {
        switch student.status {
        case .pending:
            StatusPill(text: "Pending", style: .warning)
        case .completed:
            StatusPill(text: "Screened", style: .success)
        case .referred:
            StatusPill(text: "Referred", style: .danger)
        }
    }
}
