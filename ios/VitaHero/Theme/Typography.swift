//
//  Typography.swift
//  VitaHero
//
//  Created for VitaHero (KidHero Health) iOS Platform.
//

import SwiftUI

/// Standardized Typography Scale for VitaHero iOS App
public enum AppTypography {
    public static let displayLarge = Font.system(size: 32, weight: .bold, design: .rounded)
    public static let displayMedium = Font.system(size: 28, weight: .bold, design: .rounded)
    public static let headline = Font.system(size: 22, weight: .semibold, design: .rounded)
    public static let titleLarge = Font.system(size: 18, weight: .bold, design: .default)
    public static let titleMedium = Font.system(size: 16, weight: .semibold, design: .default)
    public static let titleSmall = Font.system(size: 14, weight: .semibold, design: .default)
    public static let bodyLarge = Font.system(size: 16, weight: .regular, design: .default)
    public static let bodyMedium = Font.system(size: 14, weight: .regular, design: .default)
    public static let bodySmall = Font.system(size: 12, weight: .regular, design: .default)
    public static let labelLarge = Font.system(size: 14, weight: .medium, design: .default)
    public static let labelMedium = Font.system(size: 12, weight: .medium, design: .default)
    public static let labelSmall = Font.system(size: 10, weight: .semibold, design: .default)
}
