import SwiftUI

struct MainTabView: View {
    @EnvironmentObject private var store: AppStore

    var body: some View {
        TabView {
            NavigationStack { HomeView() }
                .tabItem { Label(L("nav_home"), systemImage: "house.fill") }
            NavigationStack { KidsView() }
                .tabItem { Label(L("nav_kids"), systemImage: "figure.and.child.holdinghands") }
            NavigationStack { CampsView() }
                .tabItem { Label(L("nav_camps"), systemImage: "cross.case.fill") }
            NavigationStack { RewardsView() }
                .tabItem { Label(L("nav_rewards"), systemImage: "star.fill") }
            NavigationStack { ProfileView() }
                .tabItem { Label(L("nav_profile"), systemImage: "person.crop.circle") }
        }
        .overlay(alignment: .bottom) { ToastView() }
    }
}

/// The store's one-line message, shown for a few seconds above the tab bar.
struct ToastView: View {
    @EnvironmentObject private var store: AppStore

    var body: some View {
        if let text = store.toast {
            Text(text)
                .font(.subheadline)
                .foregroundColor(.white)
                .padding(.horizontal, 16)
                .padding(.vertical, 12)
                .background(Color.black.opacity(0.85))
                .clipShape(Capsule())
                .padding(.horizontal, 24)
                .padding(.bottom, 64)
                .transition(.move(edge: .bottom).combined(with: .opacity))
                .task(id: text) {
                    try? await Task.sleep(nanoseconds: 3_500_000_000)
                    if store.toast == text { withAnimation { store.toast = nil } }
                }
                .onTapGesture { store.toast = nil }
        }
    }
}

/// A row of chips for choosing which child a screen is about.
struct KidPicker: View {
    @EnvironmentObject private var store: AppStore

    var body: some View {
        if store.allKids.count > 1 {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(store.allKids) { kid in
                        let selected = kid.id == store.selectedKid?.id
                        Button {
                            store.selectedKidId = kid.id
                            Task { await store.loadKid(kid.id) }
                        } label: {
                            Text(kid.name)
                                .font(.subheadline.weight(.semibold))
                                .padding(.horizontal, 14)
                                .padding(.vertical, 8)
                                .foregroundColor(selected ? .white : .primary)
                                .background(selected ? Brand.orange : Color(.secondarySystemGroupedBackground))
                                .clipShape(Capsule())
                        }
                    }
                }
            }
        }
    }
}

/// A child's initials in a coloured circle.
struct Avatar: View {
    let kid: Kid
    var size: CGFloat = 44

    private var color: Color {
        let palette = [Brand.orange, Brand.blue, Brand.green, Brand.purple, Brand.amber]
        let sum = kid.name.unicodeScalars.reduce(0) { $0 + Int($1.value) }
        return palette[sum % palette.count]
    }

    var body: some View {
        Text(kid.initials)
            .font(.system(size: size * 0.38, weight: .bold, design: .rounded))
            .foregroundColor(.white)
            .frame(width: size, height: size)
            .background(color)
            .clipShape(Circle())
    }
}

/// The notifications bell, with the unread count.
struct BellButton: View {
    @EnvironmentObject private var store: AppStore

    var body: some View {
        NavigationLink {
            NotificationsView()
        } label: {
            ZStack(alignment: .topTrailing) {
                Image(systemName: "bell.fill")
                if store.unreadCount > 0 {
                    Text("\(min(store.unreadCount, 99))")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundColor(.white)
                        .padding(3)
                        .background(Brand.red)
                        .clipShape(Circle())
                        .offset(x: 8, y: -8)
                }
            }
        }
        .accessibilityLabel(L("notifications"))
    }
}
