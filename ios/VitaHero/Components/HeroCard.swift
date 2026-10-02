import SwiftUI

/// Premium glassmorphic HeroCard with subtle border and gradient elevation.
struct HeroCard<Content: View>: View {
    let content: Content
    var backgroundColor: Color
    var cornerRadius: CGFloat
    var padding: CGFloat
    var shadowColor: Color
    
    init(
        backgroundColor: Color = AppTheme.Colors.cardBackground,
        cornerRadius: CGFloat = AppTheme.Layout.cornerRadiusLarge,
        padding: CGFloat = AppTheme.Layout.spacing16,
        shadowColor: Color = AppTheme.Colors.glassShadow,
        @ViewBuilder content: () -> Content
    ) {
        self.backgroundColor = backgroundColor
        self.cornerRadius = cornerRadius
        self.padding = padding
        self.shadowColor = shadowColor
        self.content = content()
    }
    
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            content
        }
        .padding(padding)
        .background(
            ZStack {
                backgroundColor
                RoundedRectangle(cornerRadius: cornerRadius)
                    .stroke(AppTheme.Colors.glassBorder, lineWidth: 1)
            }
        )
        .clipShape(RoundedRectangle(cornerRadius: cornerRadius))
        .shadow(color: shadowColor, radius: 10, x: 0, y: 4)
    }
}
