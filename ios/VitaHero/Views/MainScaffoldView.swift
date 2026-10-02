import SwiftUI

/// Main Root Navigation Scaffold with custom glassmorphic tab bar & global toast system.
struct MainScaffoldView: View {
    @EnvironmentObject var appViewModel: AppViewModel
    @EnvironmentObject var authManager: AuthManager
    @EnvironmentObject var clinicianViewModel: ClinicianViewModel
    @EnvironmentObject var kidsViewModel: KidsViewModel
    
    @State private var showingScreeningForm: Bool = false
    
    var body: some View {
        ZStack(alignment: .bottom) {
            // Main Tab Content View Switcher
            Group {
                switch appViewModel.activeTab {
                case .home:
                    HomeDashboardView()
                case .symptomsDiet:
                    SymptomDietView()
                case .specialists:
                    BookSpecialistView()
                case .clinician:
                    ClinicianRosterView(showingScreeningForm: $showingScreeningForm)
                case .profile:
                    ProfileSettingsView()
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .padding(.bottom, 64) // Space for bottom tab bar
            
            // Custom Glassmorphic Bottom Navigation Bar
            customTabBar
            
            // Global Toast Notification Banner Overlay
            if let toast = appViewModel.toastMessage {
                VStack {
                    HStack(spacing: AppTheme.Layout.spacing12) {
                        Image(systemName: toast.style.icon)
                            .font(.system(size: 20))
                            .foregroundColor(toast.style.color)
                        
                        VStack(alignment: .leading, spacing: 2) {
                            Text(toast.title)
                                .font(AppTheme.Typography.font(for: .cardTitleSmall))
                                .foregroundColor(AppTheme.Colors.textPrimary)
                            Text(toast.message)
                                .font(AppTheme.Typography.font(for: .captionRegular))
                                .foregroundColor(AppTheme.Colors.textSecondary)
                        }
                        Spacer()
                    }
                    .padding(AppTheme.Layout.spacing16)
                    .background(Color.white)
                    .cornerRadius(AppTheme.Layout.cornerRadiusMedium)
                    .shadow(color: Color.black.opacity(0.12), radius: 10, x: 0, y: 4)
                    .padding(.horizontal, AppTheme.Layout.spacing20)
                    .padding(.top, 10)
                    
                    Spacer()
                }
                .transition(.move(edge: .top).combined(with: .opacity))
                .animation(.spring(), value: appViewModel.toastMessage?.id)
            }
        }
        .sheet(isPresented: $showingScreeningForm) {
            ClinicianScreeningView()
        }
        .sheet(isPresented: $appViewModel.showAddChildModal) {
            addChildModalView
        }
    }
    
    // Custom Bottom Tab Bar
    private var customTabBar: some View {
        HStack {
            ForEach(AppViewModel.AppTab.allCases) { tab in
                Button(action: {
                    withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
                        appViewModel.activeTab = tab
                    }
                }) {
                    VStack(spacing: 4) {
                        Image(systemName: tab.iconName)
                            .font(.system(size: 20, weight: appViewModel.activeTab == tab ? .bold : .regular))
                            .foregroundColor(appViewModel.activeTab == tab ? AppTheme.Colors.heroOrange : AppTheme.Colors.textSecondary)
                        
                        Text(tab.rawValue)
                            .font(AppTheme.Typography.font(for: .captionMedium))
                            .foregroundColor(appViewModel.activeTab == tab ? AppTheme.Colors.heroOrange : AppTheme.Colors.textSecondary)
                    }
                    .frame(maxWidth: .infinity)
                }
            }
        }
        .padding(.vertical, 10)
        .background(
            ZStack {
                Color.white.opacity(0.95)
                BlurView(style: .systemThinMaterial)
            }
        )
        .overlay(
            Rectangle()
                .fill(AppTheme.Colors.glassBorder)
                .frame(height: 1),
            alignment: .top
        )
        .shadow(color: Color.black.opacity(0.06), radius: 8, x: 0, y: -2)
    }
    
    // Add Child Profile Sheet
    private var addChildModalView: some View {
        NavigationView {
            Form {
                Section(header: Text("Child Basic Info")) {
                    TextField("Child Full Name", text: $kidsViewModel.newChildName)
                    TextField("Age (Years)", text: $kidsViewModel.newChildAge)
                        .keyboardType(.numberPad)
                    Picker("Gender", selection: $kidsViewModel.newChildGender) {
                        Text("Male").tag("Male")
                        Text("Female").tag("Female")
                        Text("Other").tag("Other")
                    }
                    Picker("Blood Group", selection: $kidsViewModel.newChildBloodGroup) {
                        ForEach(["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"], id: \.self) { bg in
                            Text(bg).tag(bg)
                        }
                    }
                }
                
                Section {
                    Button(action: {
                        Task {
                            let ok = await kidsViewModel.addChild()
                            if ok {
                                appViewModel.showAddChildModal = false
                                appViewModel.showToast(title: "Child Profile Added", message: "Successfully created profile.", style: .success)
                            }
                        }
                    }) {
                        if kidsViewModel.isSubmittingChild {
                            ProgressView()
                        } else {
                            Text("Save Child Profile")
                                .font(.headline)
                                .foregroundColor(.white)
                                .frame(maxWidth: .infinity)
                        }
                    }
                    .listRowBackground(AppTheme.Colors.heroOrange)
                }
            }
            .navigationTitle("Add Child Profile")
            .navigationBarItems(trailing: Button("Cancel") { appViewModel.showAddChildModal = false })
        }
    }
}

// UIKit Visual Effect Blur helper for glassmorphic tab bar
struct BlurView: UIViewRepresentable {
    var style: UIBlurEffect.Style
    func makeUIView(context: Context) -> UIVisualEffectView {
        return UIVisualEffectView(effect: UIBlurEffect(style: style))
    }
    func updateUIView(_ uiView: UIVisualEffectView, context: Context) {}
}
