import SwiftUI

/// Section header with icon badge, title, and optional badge subtitle.
struct HeroFormSectionHeader: View {
    let title: String
    let subtitle: String?
    let iconName: String
    var accentColor: Color = AppTheme.Colors.heroOrange
    
    var body: some View {
        HStack(spacing: AppTheme.Layout.spacing12) {
            ZStack {
                Circle()
                    .fill(accentColor.opacity(0.15))
                    .frame(width: 36, height: 36)
                Image(systemName: iconName)
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundColor(accentColor)
            }
            
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(AppTheme.Typography.font(for: .sectionTitle))
                    .foregroundColor(AppTheme.Colors.textPrimary)
                
                if let sub = subtitle {
                    Text(sub)
                        .font(AppTheme.Typography.font(for: .captionRegular))
                        .foregroundColor(AppTheme.Colors.textSecondary)
                }
            }
            Spacer()
        }
        .padding(.vertical, 4)
    }
}
