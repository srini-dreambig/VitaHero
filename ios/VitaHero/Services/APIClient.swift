import Foundation

/// Why a call to the Worker did not give the app what it asked for.
///
/// Three different things, kept apart because the app answers each one
/// differently: a 401 ends the session; no answer at all keeps the session and
/// the data already on screen; a refusal shows the server's own words.
enum APIError: LocalizedError {
    /// The server answered 401: the session token is no longer good.
    case unauthorized
    /// No answer: offline, DNS, timeout, TLS. The session is still good.
    case unreachable
    /// The server answered and said no, with its message and code.
    case refused(status: Int, code: String, message: String)
    /// The server answered with something the app could not read.
    case unreadable

    var errorDescription: String? {
        switch self {
        case .unauthorized: return L("auth_session_ended")
        case .unreachable: return L("server_unreachable")
        case .refused(_, _, let message): return message.isEmpty ? L("sync_failed") : message
        case .unreadable: return L("sync_failed")
        }
    }

    var code: String {
        if case .refused(_, let code, _) = self { return code }
        return ""
    }
}

extension Notification.Name {
    /// Posted when the server rejects the session token.
    static let vhSessionEnded = Notification.Name("vh.sessionEnded")
}

/// Talks to the VitaHero Worker with the parent's session token.
final class APIClient: @unchecked Sendable {
    static let shared = APIClient()

    private static let tokenAccount = "session_token"
    private let session: URLSession
    private let lock = NSLock()
    private var cachedToken: String?

    private init() {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 20
        config.waitsForConnectivity = false
        session = URLSession(configuration: config)
        cachedToken = Keychain.read(APIClient.tokenAccount)
    }

    var token: String? {
        get { lock.lock(); defer { lock.unlock() }; return cachedToken }
        set {
            lock.lock(); cachedToken = newValue; lock.unlock()
            Keychain.write(newValue, for: APIClient.tokenAccount)
        }
    }

    // MARK: Calls

    func get<T: Decodable>(_ path: String, query: [String: String] = [:]) async throws -> T {
        try decode(try await send("GET", path, query: query, body: nil))
    }

    /// A list endpoint. An element the app cannot read is dropped, not fatal.
    func getList<T: Decodable>(_ path: String, query: [String: String] = [:]) async throws -> [T] {
        let rows: [Lossy<T>] = try decode(try await send("GET", path, query: query, body: nil))
        return rows.compactMap(\.value)
    }

    func post<T: Decodable>(_ path: String, json: Any? = nil) async throws -> T {
        try decode(try await send("POST", path, query: [:], body: json))
    }

    func post(_ path: String, json: Any? = nil) async throws {
        _ = try await send("POST", path, query: [:], body: json)
    }

    func delete(_ path: String) async throws {
        _ = try await send("DELETE", path, query: [:], body: nil)
    }

    // MARK: Plumbing

    private func send(_ method: String, _ path: String, query: [String: String], body: Any?) async throws -> Data {
        var components = URLComponents(url: AppConfig.apiBaseURL.appendingPathComponent(path),
                                       resolvingAgainstBaseURL: false)!
        let items = query.filter { !$0.value.isEmpty }.sorted { $0.key < $1.key }
            .map { URLQueryItem(name: $0.key, value: $0.value) }
        if !items.isEmpty { components.queryItems = items }

        var request = URLRequest(url: components.url!)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let token { request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
        if let body {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
        }

        let result: (Data, URLResponse)
        do {
            result = try await session.data(for: request)
        } catch {
            if error is CancellationError || (error as? URLError)?.code == .cancelled { throw CancellationError() }
            throw APIError.unreachable
        }
        let data = result.0
        guard let http = result.1 as? HTTPURLResponse else { throw APIError.unreadable }
        if (200..<300).contains(http.statusCode) { return data }

        let (code, message) = errorBody(data)
        // A 401 on the sign-in call itself means the code was wrong, not that
        // a session ended. Anywhere else it is the session.
        if http.statusCode == 401 && !path.hasPrefix("/api/auth/phone/") {
            NotificationCenter.default.post(name: .vhSessionEnded, object: nil)
            throw APIError.unauthorized
        }
        throw APIError.refused(status: http.statusCode, code: code, message: message)
    }

    private func decode<T: Decodable>(_ data: Data) throws -> T {
        // A route that answers 200 with an empty body or `null` (a streak not
        // started yet) still has to come back as something.
        let payload = data.isEmpty ? Data("null".utf8) : data
        do {
            return try JSONDecoder().decode(T.self, from: payload)
        } catch {
            throw APIError.unreadable
        }
    }

    private func errorBody(_ data: Data) -> (code: String, message: String) {
        guard let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return ("", "") }
        return ((object["code"] as? String) ?? "", (object["error"] as? String) ?? (object["message"] as? String) ?? "")
    }
}
