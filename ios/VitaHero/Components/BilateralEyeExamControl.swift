import SwiftUI

/// Bilateral eye examination component for OD (Right Eye) and OS (Left Eye) clinical selection.
struct BilateralEyeExamControl<T: Hashable & RawRepresentable>: View where T.RawValue == String {
    let title: String
    let subtitle: String?
    let options: [T]
    @Binding var odValue: T
    @Binding var osValue: T
    
    var body: some View {
        VStack(alignment: .leading, spacing: AppTheme.Layout.spacing12) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(AppTheme.Typography.font(for: .cardTitleSmall))
                        .foregroundColor(AppTheme.Colors.textPrimary)
                    if let sub = subtitle {
                        Text(sub)
                            .font(AppTheme.Typography.font(for: .captionRegular))
                            .foregroundColor(AppTheme.Colors.textSecondary)
                    }
                }
                Spacer()
                
                Button(action: {
                    // Sync OS to match OD
                    osValue = odValue
                }) {
                    HStack(spacing: 4) {
                        Image(systemName: "arrow.triangle.2.circlepath")
                        Text("Copy OD to OS")
                    }
                    .font(AppTheme.Typography.font(for: .captionMedium))
                    .foregroundColor(AppTheme.Colors.heroBlue)
                }
            }
            
            HStack(spacing: AppTheme.Layout.spacing12) {
                // OD Column (Right Eye)
                VStack(alignment: .leading, spacing: 6) {
                    HStack {
                        Circle().fill(AppTheme.Colors.heroOrange).frame(width: 8, height: 8)
                        Text("OD (Right Eye)")
                            .font(AppTheme.Typography.font(for: .formLabel))
                            .foregroundColor(AppTheme.Colors.heroOrange)
                    }
                    
                    Menu {
                        Picker("OD", selection: $odValue) {
                            ForEach(options, id: \.self) { item in
                                Text(item.rawValue).tag(item)
                            }
                        }
                    } label: {
                        HStack {
                            Text(odValue.rawValue)
                                .font(AppTheme.Typography.font(for: .bodyMedium))
                                .foregroundColor(AppTheme.Colors.textPrimary)
                                .lineLimit(1)
                            Spacer()
                            Image(systemName: "chevron.down")
                                .font(.system(size: 12))
                                .foregroundColor(AppTheme.Colors.textSecondary)
                        }
                        .padding(.horizontal, AppTheme.Layout.spacing12)
                        .frame(height: 44)
                        .background(AppTheme.Colors.heroOrange.opacity(0.06))
                        .cornerRadius(AppTheme.Layout.cornerRadiusSmall)
                        .overlay(
                            RoundedRectangle(cornerRadius: AppTheme.Layout.cornerRadiusSmall)
                                .stroke(AppTheme.Colors.heroOrange.opacity(0.3), lineWidth: 1)
                        )
                    }
                }
                .frame(maxWidth: .infinity)
                
                // OS Column (Left Eye)
                VStack(alignment: .leading, spacing: 6) {
                    HStack {
                        Circle().fill(AppTheme.Colors.heroBlue).frame(width: 8, height: 8)
                        Text("OS (Left Eye)")
                            .font(AppTheme.Typography.font(for: .formLabel))
                            .foregroundColor(AppTheme.Colors.heroBlue)
                    }
                    
                    Menu {
                        Picker("OS", selection: $osValue) {
                            ForEach(options, id: \.self) { item in
                                Text(item.rawValue).tag(item)
                            }
                        }
                    } label: {
                        HStack {
                            Text(osValue.rawValue)
                                .font(AppTheme.Typography.font(for: .bodyMedium))
                                .foregroundColor(AppTheme.Colors.textPrimary)
                                .lineLimit(1)
                            Spacer()
                            Image(systemName: "chevron.down")
                                .font(.system(size: 12))
                                .foregroundColor(AppTheme.Colors.textSecondary)
                        }
                        .padding(.horizontal, AppTheme.Layout.spacing12)
                        .frame(height: 44)
                        .background(AppTheme.Colors.heroBlue.opacity(0.06))
                        .cornerRadius(AppTheme.Layout.cornerRadiusSmall)
                        .overlay(
                            RoundedRectangle(cornerRadius: AppTheme.Layout.cornerRadiusSmall)
                                .stroke(AppTheme.Colors.heroBlue.opacity(0.3), lineWidth: 1)
                        )
                    }
                }
                .frame(maxWidth: .infinity)
            }
        }
        .padding(AppTheme.Layout.spacing12)
        .background(Color.white)
        .cornerRadius(AppTheme.Layout.cornerRadiusMedium)
        .overlay(
            RoundedRectangle(cornerRadius: AppTheme.Layout.cornerRadiusMedium)
                .stroke(AppTheme.Colors.glassBorder, lineWidth: 1)
        )
    }
}
