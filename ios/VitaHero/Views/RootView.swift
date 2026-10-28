import SwiftUI

/// Restoring, signed out, or signed in: the three places the app can open to.
struct RootView: View {
    @EnvironmentObject private var auth: AuthManager
    @EnvironmentObject private var store: AppStore
    @EnvironmentObject private var l10n: L10n

    var body: some View {
        Group {
            switch auth.phase {
            case .restoring:
                SplashView()
            case .signedOut:
                if l10n.hasChosen { SignInView() } else { LanguagePickerView(firstRun: true) }
            case .signedIn:
                MainTabView()
            }
        }
        .task { if auth.phase == .restoring { await auth.restore() } }
        .onChange(of: auth.phase) { phase in
            switch phase {
            case .signedIn:
                Task {
                    await syncLanguage()
                    await store.loadAll(profile: auth.profile)
                }
            case .signedOut:
                store.reset()
            case .restoring:
                break
            }
        }
    }

    /// The language the parent chose on this phone is the one the server
    /// keeps, so notifications reach them in it.
    private func syncLanguage() async {
        guard let profile = auth.profile, profile.localeCode != l10n.language.rawValue else { return }
        try? await auth.save { $0.localeCode = l10n.language.rawValue }
    }
}

struct SplashView: View {
    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "heart.text.square.fill")
                .font(.system(size: 64))
                .foregroundStyle(Brand.gradient)
            Text("VitaHero").font(.largeTitle.bold())
            ProgressView()
        }
    }
}

/// The first screen on a new phone, and the language row in Profile.
struct LanguagePickerView: View {
    var firstRun = false
    @EnvironmentObject private var l10n: L10n
    @EnvironmentObject private var auth: AuthManager
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        List {
            if firstRun {
                Section {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("VitaHero").font(.largeTitle.bold())
                        Text(L("app_subtitle")).foregroundColor(.secondary)
                    }
                    .padding(.vertical, 8)
                }
            }
            Section(L("language")) {
                ForEach(AppLanguage.allCases) { language in
                    Button {
                        choose(language)
                    } label: {
                        HStack {
                            Text(language.nativeName).foregroundColor(.primary)
                            Spacer()
                            if language == l10n.language && l10n.hasChosen {
                                Image(systemName: "checkmark").foregroundColor(Brand.orange)
                            }
                        }
                    }
                }
            }
        }
        .navigationTitle(firstRun ? "" : L("language"))
    }

    private func choose(_ language: AppLanguage) {
        l10n.set(language)
        guard !firstRun else { return }
        Task { try? await auth.save { $0.localeCode = language.rawValue } }
        dismiss()
    }
}

/// Phone number, then the SMS code.
struct SignInView: View {
    @EnvironmentObject private var auth: AuthManager
    @State private var phone = ""
    @State private var code = ""
    @State private var codeSent = false
    @State private var busy = false
    @State private var error: String?
    @State private var resendIn = 0
    @State private var timer: Timer?

    private var digits: String { phone.filter(\.isNumber) }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                VStack(alignment: .leading, spacing: 6) {
                    Image(systemName: "heart.text.square.fill")
                        .font(.system(size: 48))
                        .foregroundStyle(Brand.gradient)
                    Text(codeSent ? L("otp_title") : L("verify_number")).font(.largeTitle.bold())
                    Text(codeSent ? "\(L("otp_subtitle")) \(AppConfig.countryCode) \(digits)" : L("we_will_send_code"))
                        .foregroundColor(.secondary)
                }
                .padding(.top, 40)

                if let notice = auth.notice { Banner(text: notice) }
                if let error { Banner(text: error, color: Brand.red) }

                if codeSent { codeStep } else { phoneStep }
            }
            .padding(20)
        }
        .onDisappear { timer?.invalidate() }
    }

    private var phoneStep: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text(L("phone_label")).font(.subheadline.weight(.semibold))
            HStack {
                Text(AppConfig.countryCode).font(.title3.weight(.semibold))
                TextField(L("phone_placeholder"), text: $phone)
                    .keyboardType(.phonePad)
                    .textContentType(.telephoneNumber)
                    .font(.title3)
            }
            .padding(14)
            .background(Color(.secondarySystemBackground))
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            Text(L("sms_note")).font(.footnote).foregroundColor(.secondary)
            PrimaryButton(title: L("send_otp"), busy: busy, enabled: digits.count == 10) { send() }
        }
    }

    private var codeStep: some View {
        VStack(alignment: .leading, spacing: 16) {
            TextField("••••••", text: $code)
                .keyboardType(.numberPad)
                .textContentType(.oneTimeCode)
                .font(.system(size: 32, weight: .semibold, design: .monospaced))
                .multilineTextAlignment(.center)
                .padding(14)
                .background(Color(.secondarySystemBackground))
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                .onChange(of: code) { value in
                    let clean = String(value.filter(\.isNumber).prefix(6))
                    if clean != value { code = clean }
                }
            PrimaryButton(title: L("verify"), busy: busy, enabled: code.count == 6) { verify() }
            HStack {
                Text(L("didnt_get_code")).foregroundColor(.secondary)
                if resendIn > 0 {
                    Text(L("resend_in", String(resendIn))).foregroundColor(.secondary)
                } else {
                    Button(L("resend")) { send() }.disabled(busy)
                }
            }
            .font(.footnote)
            Button(L("back")) {
                codeSent = false; code = ""; error = nil
            }
            .font(.footnote)
        }
    }

    private func send() {
        busy = true; error = nil
        Task {
            do {
                try await auth.sendCode(to: digits)
                codeSent = true
                startResendTimer()
            } catch {
                self.error = error.localizedDescription
            }
            busy = false
        }
    }

    private func verify() {
        busy = true; error = nil
        Task {
            do {
                try await auth.verify(code: code)
            } catch {
                self.error = error.localizedDescription
            }
            busy = false
        }
    }

    private func startResendTimer() {
        resendIn = 30
        timer?.invalidate()
        timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { t in
            Task { @MainActor in
                if resendIn > 0 { resendIn -= 1 } else { t.invalidate() }
            }
        }
    }
}
