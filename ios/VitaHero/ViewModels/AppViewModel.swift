import Foundation
import Combine
import SwiftUI

/// Main App View Model handling navigation, global alerts, app state, and role management.
@MainActor
final class AppViewModel: ObservableObject {
    // MARK: - Published Properties
    @Published var activeTab: AppTab = .home
    @Published var toastMessage: ToastMessage? = nil
    @Published var isLoading: Bool = false
    @Published var selectedKidId: String? = nil
    @Published var showAddChildModal: Bool = false
    @Published var showConsentModal: Bool = false
    @Published var isOfflineMode: Bool = false
    
    // Global Navigation Path
    @Published var navigationPath = NavigationPath()
    
    // Dependencies
    let sessionStore: SessionStore
    let authManager: AuthManager
    
    private var cancellables = Set<AnyCancellable>()
    
    init(sessionStore: SessionStore = .shared, authManager: AuthManager = .shared) {
        self.sessionStore = sessionStore
        self.authManager = authManager
        
        setupSubscriptions()
    }
    
    private func setupSubscriptions() {
        // Automatically switch default tab based on logged-in role
        authManager.$userRole
            .sink { [weak self] role in
                guard let self = self else { return }
                if role == .clinician {
                    self.activeTab = .clinician
                } else if self.activeTab == .clinician && role == .parent {
                    self.activeTab = .home
                }
            }
            .store(in: &cancellables)
    }
    
    // MARK: - App Tabs
    enum AppTab: String, CaseIterable, Identifiable {
        case home = "Home"
        case symptomsDiet = "Health & Diet"
        case specialists = "Specialists"
        case clinician = "Screening"
        case profile = "Profile"
        
        var id: String { rawValue }
        
        var iconName: String {
            switch self {
            case .home: return "house.fill"
            case .symptomsDiet: return "leaf.fill"
            case .specialists: return "stethoscope"
            case .clinician: return "cross.case.fill"
            case .profile: return "person.crop.circle.fill"
            }
        }
    }
    
    // MARK: - Toast Helpers
    struct ToastMessage: Identifiable {
        let id = UUID()
        let title: String
        let message: String
        let style: ToastStyle
        
        enum ToastStyle {
            case success, error, info, warning
            
            var color: Color {
                switch self {
                case .success: return AppTheme.Colors.emerald
                case .error: return AppTheme.Colors.coralRed
                case .info: return AppTheme.Colors.heroBlue
                case .warning: return AppTheme.Colors.amber
                }
            }
            
            var icon: String {
                switch self {
                case .success: return "checkmark.circle.fill"
                case .error: return "xmark.octagon.fill"
                case .info: return "info.circle.fill"
                case .warning: return "exclamationmark.triangle.fill"
                }
            }
        }
    }
    
    func showToast(title: String, message: String, style: ToastMessage.ToastStyle = .info) {
        withAnimation(.spring()) {
            self.toastMessage = ToastMessage(title: title, message: message, style: style)
        }
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 3.5) {
            withAnimation {
                if self.toastMessage?.id == self.toastMessage?.id {
                    self.toastMessage = nil
                }
            }
        }
    }
}
