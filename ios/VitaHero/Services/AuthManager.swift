//
//  AuthManager.swift
//  VitaHero
//
//  Created for VitaHero (KidHero Health) iOS Platform.
//

import Foundation
import Combine

public final class AuthManager: ObservableObject {
    @Published public var isLoggedIn: Bool = false
    @Published public var onboardingComplete: Bool = false
    @Published public var role: String = "PARENT"
    @Published public var parentName: String = "Kallam Family"
    @Published public var authLoading: Bool = false
    @Published public var authError: String? = nil
    
    public init() {
        if let token = SessionStore.getToken(), !token.isEmpty {
            self.isLoggedIn = true
            self.role = SessionStore.getRole()
            ApiService.shared.sessionToken = token
        }
        self.onboardingComplete = SessionStore.isOnboardingComplete()
    }
    
    public func demoSignIn(role: String = "PARENT") {
        let token = "demo_session_token_1234567890_1234567890"
        SessionStore.saveToken(token)
        SessionStore.saveRole(role)
        SessionStore.setOnboardingComplete(true)
        
        ApiService.shared.sessionToken = token
        self.role = role
        self.parentName = (role == "PHYSICIAN") ? "Dr. Kallam" : "Kallam Family"
        self.onboardingComplete = true
        self.isLoggedIn = true
    }
    
    public func logout() {
        SessionStore.clearToken()
        SessionStore.saveRole("PARENT")
        ApiService.shared.clearSession()
        self.role = "PARENT"
        self.isLoggedIn = false
    }
    
    public func completeOnboarding() {
        SessionStore.setOnboardingComplete(true)
        self.onboardingComplete = true
    }
    
    public func setOnboardingComplete(_ complete: Bool) {
        SessionStore.setOnboardingComplete(complete)
        self.onboardingComplete = complete
    }
}
