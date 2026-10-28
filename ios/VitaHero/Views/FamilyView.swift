import SwiftUI

/// Family sharing. The owner makes a code and answers requests; anyone else
/// asks to join with a code and sees the family's children once approved.
struct FamilyView: View {
    @EnvironmentObject private var auth: AuthManager
    @EnvironmentObject private var store: AppStore
    @State private var joinCode = ""
    @State private var joinName = ""
    @State private var owner: String?
    @State private var busy = false
    @State private var error: String?
    @State private var info: String?

    /// A code this phone asked to join with and is waiting on. The server
    /// keeps a family code on a profile only once its owner approves, so the
    /// save is tried again each time this screen opens.
    @AppStorage("vh.pendingFamilyCode") private var pendingCode = ""

    private static let alphabet = Array("ABCDEFGHJKLMNPQRSTUVWXYZ23456789")

    private var myCode: String { auth.profile?.familyCode ?? "" }
    private var requests: [CoParent] { store.coParents.filter { !$0.isOwnerRow && $0.status == "PENDING" } }
    private var members: [CoParent] { store.coParents.filter { $0.isOwnerRow || $0.status == "APPROVED" } }

    var body: some View {
        List {
            Section { Text(L("family_subtitle")).foregroundColor(.secondary) }
            if let error { Banner(text: error, color: Brand.red).listRowInsets(EdgeInsets()) }
            if let info { Banner(text: info, color: Brand.green).listRowInsets(EdgeInsets()) }

            Section(header: Text(L("your_family_code")), footer: Text(L("family_info"))) {
                if myCode.isEmpty {
                    Text(L("no_family_code_yet")).foregroundColor(.secondary)
                    Button(L("generate_family_code")) { generate() }.disabled(busy)
                } else {
                    Text(myCode)
                        .font(.system(size: 30, weight: .bold, design: .monospaced))
                        .kerning(4)
                        .frame(maxWidth: .infinity)
                        .textSelection(.enabled)
                    ShareLink(item: L("family_share_message", myCode)) {
                        Label(L("share_your_code"), systemImage: "square.and.arrow.up")
                    }
                }
            }

            if !requests.isEmpty {
                Section(L("co_parent_pending")) {
                    ForEach(requests) { request in
                        VStack(alignment: .leading, spacing: 8) {
                            Text(request.name).font(.headline)
                            Text([request.relation, request.joinedDate].filter { !$0.isEmpty }.joined(separator: " · "))
                                .font(.caption).foregroundColor(.secondary)
                            HStack {
                                Button(L("co_parent_approve")) { Task { await store.answerCoParent(request, approve: true) } }
                                    .buttonStyle(.borderedProminent)
                                Button(L("co_parent_decline"), role: .destructive) {
                                    Task { await store.answerCoParent(request, approve: false) }
                                }
                                .buttonStyle(.bordered)
                            }
                        }
                        .padding(.vertical, 4)
                    }
                }
            }

            if !members.isEmpty {
                Section(L("co_parents_section")) {
                    ForEach(members) { member in
                        HStack {
                            Image(systemName: member.isOwnerRow ? "crown.fill" : "person.fill")
                                .foregroundColor(member.isOwnerRow ? Brand.amber : Brand.purple)
                            Text(member.name)
                            Spacer()
                            Text(member.relation).font(.caption).foregroundColor(.secondary)
                        }
                    }
                }
            }

            if !store.sharedKids.isEmpty {
                Section(L("linked_children")) {
                    ForEach(store.sharedKids) { kid in
                        HStack(spacing: 10) { Avatar(kid: kid, size: 32); Text(kid.name) }
                    }
                }
            }

            Section(L("enter_family_code")) {
                if !pendingCode.isEmpty {
                    Label(L("family_request_sent"), systemImage: "hourglass").foregroundColor(.secondary)
                }
                TextField(L("family_code_placeholder"), text: $joinCode)
                    .textInputAutocapitalization(.characters)
                    .autocorrectionDisabled()
                    .onChange(of: joinCode) { value in
                        let clean = String(value.uppercased().filter { $0.isLetter || $0.isNumber }.prefix(8))
                        if clean != value { joinCode = clean }
                        owner = nil
                    }
                TextField(L("your_name"), text: $joinName).textContentType(.name)
                if let owner { Label(owner, systemImage: "person.crop.circle.badge.checkmark").foregroundColor(Brand.green) }
                Button(owner == nil ? L("verify") : L("join_family")) { owner == nil ? validate() : join() }
                    .disabled(busy || joinCode.count < 4 || (owner != nil && joinName.trimmingCharacters(in: .whitespaces).isEmpty))
            }
        }
        .navigationTitle(L("family_title"))
        .navigationBarTitleDisplayMode(.inline)
        .task {
            if joinName.isEmpty { joinName = auth.profile?.name ?? "" }
            await retryPending()
        }
        .refreshable {
            await retryPending()
            await store.loadAll(profile: auth.profile)
        }
    }

    private func generate() {
        let code = String((0..<6).map { _ in Self.alphabet.randomElement()! })
        run {
            try await auth.save { $0.familyCode = code }
        }
    }

    private func validate() {
        run {
            let result = try await store.validateFamily(code: joinCode)
            if result.valid {
                owner = result.familyOwner.isEmpty ? joinCode : result.familyOwner
            } else {
                error = result.error.isEmpty ? L("family_invalid") : result.error
            }
        }
    }

    private func join() {
        let code = joinCode
        run {
            let result = try await store.joinFamily(code: code, name: joinName.trimmingCharacters(in: .whitespaces),
                                                    relation: L("co_parent_relation"))
            guard result.success else {
                error = result.error.isEmpty ? L("family_invalid") : result.error
                return
            }
            pendingCode = code
            joinCode = ""; owner = nil
            await retryPending()
            if !pendingCode.isEmpty { info = L("family_request_sent") }
        }
    }

    /// Saves the code asked for; the server keeps it once the owner approves.
    private func retryPending() async {
        guard !pendingCode.isEmpty, pendingCode != myCode else {
            pendingCode = ""
            return
        }
        try? await auth.save { $0.familyCode = pendingCode }
        if auth.profile?.familyCode == pendingCode {
            pendingCode = ""
            await store.loadSharedKids(familyCode: myCode)
        }
    }

    private func run(_ work: @escaping () async throws -> Void) {
        busy = true; error = nil; info = nil
        Task {
            do { try await work() } catch { self.error = error.localizedDescription }
            busy = false
        }
    }
}
