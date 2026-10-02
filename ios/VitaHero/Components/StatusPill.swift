import SwiftUI

/// Status badge pill with custom color tokens.
struct StatusPill: View {
    let text: String
    var style: PillStyle = .info
    
    enum PillStyle {
        case success, warning, danger, info, neutral
        
        var backgroundColor: Color {
            switch self {
            case .success: return AppTheme.Colors.emerald.opacity(0.12)
            case .warning: return AppTheme.Colors.amber.opacity(0.15)
            case .danger: return AppTheme.Colors.coralRed.opacity(0.15)
            case .info: return AppTheme.Colors.heroBlue.opacity(0.12)
            case .neutral: return Color.gray.opacity(0.12)
            }
        }
        
        var foregroundColor: Color {
            switch self {
            case .success: return AppTheme.Colors.emerald
            case .warning: return AppTheme.Colors.amber
            case .danger: return AppTheme.Colors.coralRed
            case .info: return AppTheme.Colors.heroBlue
            case .neutral: return AppTheme.Colors.textSecondary
            }
        }
    }
    
    var body: some View {
        Text(text)
            .font(AppTheme.Typography.font(for: .badgeText))
            .foregroundColor(style.foregroundColor)
            .padding(.horizontal, AppTheme.Layout.spacing12)
            .padding(.vertical, 4)
            .background(style.backgroundColor)
            .cornerRadius(AppTheme.Layout.cornerRadiusFull)
    }
}
