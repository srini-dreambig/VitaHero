//
//  SessionStore.swift
//  VitaHero
//
//  Created for VitaHero (KidHero Health) iOS Platform.
//

import Foundation

public final class SessionStore {
    private static let tokenKey = "vitahero_session_token"
    private static let roleKey = "vitahero_user_role"
    private static let onboardingKey = "vitahero_onboarding_complete"
    private static let consentKey = "vitahero_consent_accepted"
    
    public static func saveToken(_ token: String) {
        UserDefaults.standard.set(token, forKey: tokenKey)
    }
    
    public static func getToken() -> String? {
        return UserDefaults.standard.string(forKey: tokenKey)
    }
    
    public static func clearToken() {
        UserDefaults.standard.removeObject(forKey: tokenKey)
    }
    
    public static func saveRole(_ role: String) {
        UserDefaults.standard.set(role, forKey: roleKey)
    }
    
    public static func getRole() -> String {
        return UserDefaults.standard.string(forKey: roleKey) ?? "PARENT"
    }
    
    public static func setOnboardingComplete(_ complete: Bool) {
        UserDefaults.standard.set(complete, forKey: onboardingKey)
    }
    
    public static func isOnboardingComplete() -> Bool {
        return UserDefaults.standard.bool(forKey: onboardingKey)
    }
    
    public static func setConsentAccepted(_ accepted: Bool) {
        UserDefaults.standard.set(accepted, forKey: consentKey)
    }
    
    public static func isConsentAccepted() -> Bool {
        return UserDefaults.standard.bool(forKey: consentKey)
    }
}
