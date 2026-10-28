import SwiftUI

struct ProfileView: View {
    @EnvironmentObject private var auth: AuthManager
    @EnvironmentObject private var store: AppStore
    @EnvironmentObject private var l10n: L10n
    @State private var name = ""
    @State private var editingName = false
    @State private var confirmLogout = false

    private var version: String {
        let info = Bundle.main.infoDictionary
        let short = info?["CFBundleShortVersionString"] as? String ?? ""
        let build = info?["CFBundleVersion"] as? String ?? ""
        return "\(short) (\(build))"
    }

    var body: some View {
        List {
            if let profile = auth.profile {
                Section {
                    HStack(spacing: 14) {
                        Image(systemName: "person.crop.circle.fill")
                            .font(.system(size: 48))
                            .foregroundStyle(Brand.gradient)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(profile.name.isEmpty ? L("your_name") : profile.name).font(.headline)
                            Text(profile.phone).font(.subheadline).foregroundColor(.secondary)
                        }
                        Spacer()
                        Button(L("edit")) {
                            name = profile.name
                            editingName = true
                        }
                    }
                    .padding(.vertical, 4)
                }

                Section {
                    NavigationLink { LanguagePickerView() } label: {
                        HStack {
                            Label(L("language"), systemImage: "globe")
                            Spacer()
                            Text(l10n.language.nativeName).foregroundColor(.secondary)
                        }
                    }
                    NavigationLink { FamilyView() } label: { Label(L("family_sharing"), systemImage: "person.3.fill") }
                    NavigationLink { BookingView() } label: { Label(L("book_visit"), systemImage: "stethoscope") }
                    NavigationLink { NotificationsView() } label: { Label(L("notifications"), systemImage: "bell.fill") }
                }

                Section(L("notifications")) {
                    Toggle(isOn: setting(\.notificationsEnabled)) { Text(L("push_notif")) }
                    Toggle(isOn: setting(\.campRemindersEnabled)) {
                        VStack(alignment: .leading) {
                            Text(L("camp_reminders"))
                            Text(L("camp_reminder_sub")).font(.caption).foregroundColor(.secondary)
                        }
                    }
                }
            }

            Section {
                Button(L("logout"), role: .destructive) { confirmLogout = true }
            }

            Section {
                Text(L("medical_disclaimer")).font(.caption).foregroundColor(.secondary)
                Text("VitaHero \(version)").font(.caption).foregroundColor(.secondary)
            }
        }
        .navigationTitle(L("nav_profile"))
        .refreshable { await auth.refreshProfile() }
        .alert(L("your_name"), isPresented: $editingName) {
            TextField(L("name_placeholder"), text: $name)
            Button(L("cancel"), role: .cancel) {}
            Button(L("save")) {
                let value = name.trimmingCharacters(in: .whitespaces)
                guard !value.isEmpty else { return }
                Task { await save { $0.name = value } }
            }
        }
        .confirmationDialog(L("logout"), isPresented: $confirmLogout, titleVisibility: .visible) {
            Button(L("logout"), role: .destructive) { Task { await auth.signOut() } }
        }
    }

    /// A settings switch that saves as soon as it is flipped.
    private func setting(_ key: WritableKeyPath<Profile, Bool>) -> Binding<Bool> {
        Binding(
            get: { auth.profile?[keyPath: key] ?? false },
            set: { value in Task { await save { $0[keyPath: key] = value } } })
    }

    private func save(_ update: @escaping (inout Profile) -> Void) async {
        do { try await auth.save(update) } catch { store.toast = error.localizedDescription }
    }
}
