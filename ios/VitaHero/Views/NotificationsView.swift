import SwiftUI

struct NotificationsView: View {
    @EnvironmentObject private var store: AppStore

    var body: some View {
        List {
            if store.notifications.isEmpty {
                EmptyState(icon: "bell.slash", title: L("all_caught_up"), subtitle: L("all_caught_up_sub"))
            }
            ForEach(store.notifications) { note in
                HStack(alignment: .top, spacing: 12) {
                    let style = Self.style(note.type)
                    Image(systemName: style.icon)
                        .foregroundColor(style.color)
                        .frame(width: 36, height: 36)
                        .background(style.color.opacity(0.14))
                        .clipShape(Circle())
                    VStack(alignment: .leading, spacing: 4) {
                        HStack {
                            Text(note.title).font(.headline)
                            Spacer()
                            if note.unread { Circle().fill(Brand.orange).frame(width: 8, height: 8) }
                        }
                        Text(note.body).font(.subheadline)
                        if !note.time.isEmpty { Text(note.time).font(.caption).foregroundColor(.secondary) }
                    }
                }
                .padding(.vertical, 4)
            }
        }
        .navigationTitle(L("notif_center"))
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if store.unreadCount > 0 {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(L("mark_all_read")) { Task { await store.markRead(store.notifications.map(\.id)) } }
                }
            }
        }
        .task { await store.refreshNotifications() }
        .refreshable { await store.refreshNotifications() }
        .onDisappear { Task { await store.markRead(store.notifications.map(\.id)) } }
    }

    static func style(_ type: String) -> (icon: String, color: Color) {
        switch type {
        case "CHECKUP": return ("stethoscope", Brand.blue)
        case "DIET": return ("fork.knife", Brand.green)
        case "REWARD": return ("star.fill", Brand.amber)
        case "CONSENT": return ("checkmark.shield.fill", Brand.orange)
        case "RESULT": return ("doc.text.fill", Brand.purple)
        case "REFERRAL": return ("arrow.triangle.turn.up.right.circle.fill", Brand.red)
        default: return ("cross.case.fill", Brand.orange)
        }
    }
}
