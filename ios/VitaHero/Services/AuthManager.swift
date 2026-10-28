import Foundation
import FirebaseCore
import FirebaseAuth

/// Phone sign-in, the same way the Android app does it.
///
/// Firebase sends and checks the SMS code; its ID token is then exchanged at
/// `/api/auth/phone/firebase-verify` for the Worker's own session token, which
/// is the only credential the app keeps. Firebase's sign-in is dropped as soon
/// as the exchange is done.
///
/// Who may sign in is the server's decision: a number no school enrolled gets
/// NOT_PROVISIONED, a staff number gets WRONG_SURFACE_APP, and the app shows
/// the server's words for each rather than its own guess.
@MainActor
final class AuthManager: ObservableObject {
    enum Phase: Equatable { case restoring, signedOut, signedIn }

    @Published private(set) var phase: Phase = .restoring
    @Published private(set) var profile: Profile?
    /// Why the parent is looking at the sign-in screen, when it was not their choice.
    @Published var notice: String?

    private var verificationID: String?
    private var sessionObserver: NSObjectProtocol?
    private let api = APIClient.shared
    private static let profileCacheKey = "vh.profile"

    init() {
        sessionObserver = NotificationCenter.default.addObserver(
            forName: .vhSessionEnded, object: nil, queue: .main
        ) { [weak self] _ in
            Task { @MainActor in self?.endSession(notice: L("auth_session_ended")) }
        }
    }

    nonisolated static var firebaseConfigured: Bool { FirebaseApp.app() != nil }

    // MARK: Restore

    /// Picks up the saved session on launch. Only a 401 signs the parent out;
    /// a server that cannot be reached leaves them signed in on what the app
    /// last knew, as Android does.
    func restore() async {
        guard api.token != nil else { phase = .signedOut; return }
        do {
            let me: Profile = try await api.get("/api/auth/me")
            setProfile(me)
            phase = .signedIn
        } catch APIError.unauthorized {
            // The session-ended notification has already signed the parent out.
        } catch {
            profile = cachedProfile()
            phase = .signedIn
        }
    }

    // MARK: Sign in

    /// Asks Firebase to text a code to the number. `digits` is the ten-digit
    /// mobile number without the country code.
    func sendCode(to digits: String) async throws {
        guard AuthManager.firebaseConfigured else { throw SignInError.notConfigured }
        let e164 = digits.hasPrefix("+") ? digits : AppConfig.countryCode + digits
        do {
            verificationID = try await PhoneAuthProvider.provider().verifyPhoneNumber(e164, uiDelegate: nil)
        } catch {
            throw SignInError.firebase(error, fallback: L("auth_otp_send_failed"))
        }
    }

    /// Checks the code with Firebase, then trades Firebase's token for a session.
    func verify(code: String) async throws {
        guard let verificationID else { throw SignInError.message(L("auth_otp_send_failed")) }
        let credential = PhoneAuthProvider.provider().credential(
            withVerificationID: verificationID, verificationCode: code)

        let idToken: String
        do {
            let result = try await Auth.auth().signIn(with: credential)
            idToken = try await result.user.getIDToken()
        } catch {
            throw SignInError.firebase(error, fallback: L("auth_otp_invalid"))
        }
        // The Worker's session is the credential from here on.
        if AuthManager.firebaseConfigured { try? Auth.auth().signOut() }

        let response: SignInResponse
        do {
            response = try await api.post("/api/auth/phone/firebase-verify",
                                          json: ["idToken": idToken, "surface": AppConfig.surface])
        } catch let error as APIError {
            throw SignInError.message(error.localizedDescription)
        }
        guard !response.token.isEmpty else { throw SignInError.message(L("auth_missing_token")) }
        api.token = response.token

        // /api/auth/me carries the settings the sign-in response leaves out.
        let me = try? await api.get("/api/auth/me") as Profile
        guard let signedIn = me ?? response.profile else {
            throw SignInError.message(L("auth_signin_failed"))
        }
        setProfile(signedIn)
        self.verificationID = nil
        notice = nil
        phase = .signedIn
    }

    // MARK: Profile

    /// Saves a change to the parent's settings (language, family code).
    func save(_ update: (inout Profile) -> Void) async throws {
        guard var next = profile else { return }
        update(&next)
        try await api.post("/api/profiles", json: next.upsertBody)
        // The server may keep less than was sent (a family code is kept only
        // once its owner approves), so what it has is read back.
        if let saved = try? await api.get("/api/auth/me") as Profile { setProfile(saved) } else { setProfile(next) }
    }

    func refreshProfile() async {
        if let me = try? await api.get("/api/auth/me") as Profile { setProfile(me) }
    }

    // MARK: Sign out

    func signOut() async {
        try? await api.post("/api/auth/logout")
        endSession(notice: nil)
    }

    private func endSession(notice: String?) {
        guard phase != .signedOut || api.token != nil else { return }
        api.token = nil
        if AuthManager.firebaseConfigured { try? Auth.auth().signOut() }
        UserDefaults.standard.removeObject(forKey: AuthManager.profileCacheKey)
        profile = nil
        self.notice = notice
        phase = .signedOut
    }

    private func setProfile(_ value: Profile) {
        profile = value
        if let data = try? JSONEncoder().encode(value) {
            UserDefaults.standard.set(data, forKey: AuthManager.profileCacheKey)
        }
    }

    private func cachedProfile() -> Profile? {
        guard let data = UserDefaults.standard.data(forKey: AuthManager.profileCacheKey) else { return nil }
        return try? JSONDecoder().decode(Profile.self, from: data)
    }
}

enum SignInError: LocalizedError {
    case notConfigured
    case message(String)
    case firebase(Error, fallback: String)

    var errorDescription: String? {
        switch self {
        case .notConfigured:
            return "Phone sign-in is not set up in this build (GoogleService-Info.plist is missing)."
        case .message(let text):
            return text
        case .firebase(let error, let fallback):
            // Firebase's own codes, by number so the check does not depend on
            // which SDK version spells the enum which way.
            switch (error as NSError).code {
            case 17044, 17051: return L("auth_otp_invalid")   // invalid / expired code
            case 17010: return L("auth_otp_send_failed")      // too many requests
            case 17020: return L("server_unreachable")        // network error
            default: return fallback
            }
        }
    }
}
