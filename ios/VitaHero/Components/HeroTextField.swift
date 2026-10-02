import SwiftUI

/// Standardized text input field with icon, floating label, and validation border.
struct HeroTextField: View {
    let label: String
    let placeholder: String
    @Binding var text: String
    var iconName: String? = nil
    var isSecure: Bool = false
    var keyboardType: UIKeyboardType = .default
    
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label)
                .font(AppTheme.Typography.font(for: .formLabel))
                .foregroundColor(AppTheme.Colors.textPrimary)
            
            HStack(spacing: AppTheme.Layout.spacing12) {
                if let icon = iconName {
                    Image(systemName: icon)
                        .foregroundColor(AppTheme.Colors.heroOrange)
                        .font(.system(size: 16))
                }
                
                if isSecure {
                    SecureField(placeholder, text: $text)
                        .keyboardType(keyboardType)
                        .font(AppTheme.Typography.font(for: .bodyMedium))
                } else {
                    TextField(placeholder, text: $text)
                        .keyboardType(keyboardType)
                        .font(AppTheme.Typography.font(for: .bodyMedium))
                }
                
                if !text.isEmpty {
                    Button(action: { text = "" }) {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundColor(AppTheme.Colors.textSecondary)
                    }
                }
            }
            .padding(.horizontal, AppTheme.Layout.spacing16)
            .frame(height: 48)
            .background(Color.white)
            .cornerRadius(AppTheme.Layout.cornerRadiusMedium)
            .overlay(
                RoundedRectangle(cornerRadius: AppTheme.Layout.cornerRadiusMedium)
                    .stroke(AppTheme.Colors.glassBorder, lineWidth: 1)
            )
        }
    }
}
