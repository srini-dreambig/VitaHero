import SwiftUI

/// Premium button suite: Primary Gradient, Secondary Outline, Icon Button.
struct PrimaryGradientButton: View {
    let title: String
    var iconName: String? = nil
    var isLoading: Bool = false
    var isEnabled: Bool = true
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            HStack(spacing: AppTheme.Layout.spacing8) {
                if isLoading {
                    ProgressView()
                        .tint(.white)
                } else {
                    if let icon = iconName {
                        Image(systemName: icon)
                            .font(.system(size: 16, weight: .bold))
                    }
                    Text(title)
                        .font(AppTheme.Typography.font(for: .buttonLabel))
                }
            }
            .foregroundColor(.white)
            .frame(maxWidth: .infinity)
            .frame(height: 52)
            .background(
                isEnabled ? AppTheme.Gradients.primaryOrange : LinearGradient(colors: [Color.gray.opacity(0.4)], startPoint: .leading, endPoint: .trailing)
            )
            .cornerRadius(AppTheme.Layout.cornerRadiusMedium)
            .shadow(color: isEnabled ? AppTheme.Colors.heroOrange.opacity(0.35) : Color.clear, radius: 8, x: 0, y: 4)
        }
        .disabled(!isEnabled || isLoading)
    }
}

struct SecondaryOutlineButton: View {
    let title: String
    var iconName: String? = nil
    var isEnabled: Bool = true
    let action: () -> Void
    
    var body: some View {
        Button(action: action) {
            HStack(spacing: AppTheme.Layout.spacing8) {
                if let icon = iconName {
                    Image(systemName: icon)
                        .font(.system(size: 15, weight: .semibold))
                }
                Text(title)
                    .font(AppTheme.Typography.font(for: .buttonLabel))
            }
            .foregroundColor(AppTheme.Colors.heroOrange)
            .frame(maxWidth: .infinity)
            .frame(height: 48)
            .background(Color.white)
            .overlay(
                RoundedRectangle(cornerRadius: AppTheme.Layout.cornerRadiusMedium)
                    .stroke(AppTheme.Colors.heroOrange, lineWidth: 1.5)
            )
            .cornerRadius(AppTheme.Layout.cornerRadiusMedium)
        }
        .disabled(!isEnabled)
    }
}
