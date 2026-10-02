//
//  AppTheme.swift
//  VitaHero
//
//  Created for VitaHero (KidHero Health) iOS Platform.
//

import SwiftUI

/// VitaHero Color Palette & Design Tokens
public enum AppColors {
    public static let heroOrange = Color(red: 244/255, green: 123/255, blue: 32/255) // #F47B20
    public static let heroOrangeLight = Color(red: 251/255, green: 146/255, blue: 60/255) // #FB923C
    public static let heroBlue = Color(red: 37/255, green: 99/255, blue: 235/255)   // #2563EB
    public static let heroBlueLight = Color(red: 96/255, green: 165/255, blue: 250/255) // #60A5FA
    public static let heroGreen = Color(red: 16/255, green: 185/255, blue: 129/255) // #10B981
    public static let heroRed = Color(red: 239/255, green: 68/255, blue: 68/255)    // #EF4444
    public static let heroPurple = Color(red: 139/255, green: 92/255, blue: 246/255) // #8B5CF6
    
    // Backgrounds
    public static let backgroundDark = Color(red: 11/255, green: 17/255, blue: 33/255) // #0B1121
    public static let cardDark = Color(red: 30/255, green: 41/255, blue: 59/255)      // #1E293B
    public static let cardLight = Color.white
    public static let surfaceVariantDark = Color(red: 51/255, green: 65/255, blue: 85/255)
    public static let surfaceVariantLight = Color(red: 241/255, green: 245/255, blue: 249/255)
    
    // Gradients
    public static let primaryGradient = LinearGradient(
        colors: [heroOrange, Color(red: 249/255, green: 115/255, blue: 22/255)],
        startPoint: .leading,
        endPoint: .trailing
    )
    
    public static let blueGradient = LinearGradient(
        colors: [heroBlue, heroBlueLight],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )
}

/// Spacing System based on strict 4-pt grid
public enum AppSpacing {
    public static let xxs: CGFloat = 2
    public static let xs: CGFloat = 4
    public static let sm: CGFloat = 8
    public static let md: CGFloat = 12
    public static let lg: CGFloat = 16
    public static let xl: CGFloat = 24
    public static let xxl: CGFloat = 32
}

/// Corner Radius Tokens
public enum AppCorners {
    public static let small: CGFloat = 8
    public static let medium: CGFloat = 12
    public static let large: CGFloat = 16
    public static let xLarge: CGFloat = 24
    public static let pill: CGFloat = 999
}
