import SwiftUI

/// Where a screen in the clinician's stack can go.
enum ClinicianRoute: Hashable {
    case roster(ClinicianCamp)
    case screening(campId: String, kidId: String)
    case review(ClinicianCamp)
    case reviewChild(campId: String, kidId: String)
}

/// What a screener or physician opens to: their camps, then a camp's day.
struct ClinicianHomeView: View {
    @State private var path: [ClinicianRoute] = []

    var body: some View {
        NavigationStack(path: $path) {
            ClinicianCampsView()
                .navigationDestination(for: ClinicianRoute.self) { route in
                    switch route {
                    case .roster(let camp): ClinicianRosterView(camp: camp)
                    case .screening(let campId, let kidId): ClinicianScreeningView(campId: campId, kidId: kidId)
                    case .review(let camp): ClinicianReviewView(camp: camp)
                    case .reviewChild(let campId, let kidId): ClinicianReviewChildView(campId: campId, kidId: kidId)
                    }
                }
        }
        .tint(Brand.orange)
    }
}

/// The camps this clinician was put on, and nothing else.
struct ClinicianCampsView: View {
    @EnvironmentObject private var auth: AuthManager
    @EnvironmentObject private var clinician: ClinicianStore
    @State private var confirmLogout = false

    private var subtitle: String? {
        let name = (auth.profile?.name ?? "").trimmingCharacters(in: .whitespaces)
        return name.isEmpty || name == "Parent" ? nil : name
    }

    var body: some View {
        List {
            if let subtitle {
                Text(subtitle).font(.subheadline).foregroundColor(.secondary)
                    .listRowBackground(Color.clear)
            }
            if clinician.camps.isEmpty {
                Group {
                    if clinician.campsLoading {
                        EmptyState(icon: "hourglass", title: L("clin_loading_camps"), subtitle: L("clin_one_moment"))
                    } else if let error = clinician.campsError {
                        EmptyState(icon: "wifi.exclamationmark", title: L("clin_camps_failed"), subtitle: error)
                    } else {
                        EmptyState(icon: "calendar.badge.exclamationmark", title: L("clin_no_camps"), subtitle: L("clin_no_camps_sub"))
                    }
                }
                .padding(.vertical, 40)
                .listRowBackground(Color.clear)
            } else {
                if let error = clinician.campsError {
                    Banner(text: error, color: Brand.red).listRowBackground(Color.clear)
                }
                ForEach(clinician.camps) { camp in
                    NavigationLink(value: ClinicianRoute.roster(camp)) {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(camp.title).font(.headline)
                            Text([camp.schoolName, camp.date].filter { !$0.isEmpty }.joined(separator: " · "))
                                .font(.subheadline).foregroundColor(.secondary)
                            Text(L("clin_x_of_y_screened", String(camp.screened), String(camp.participants)))
                                .font(.caption.weight(.semibold)).foregroundColor(Brand.blue)
                        }
                        .padding(.vertical, 4)
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle(L("clin_my_camps"))
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button { confirmLogout = true } label: {
                    Image(systemName: "rectangle.portrait.and.arrow.right")
                }
                .accessibilityLabel(L("logout"))
            }
        }
        .confirmationDialog(L("logout"), isPresented: $confirmLogout, titleVisibility: .visible) {
            Button(L("logout"), role: .destructive) { Task { await auth.signOut() } }
        }
        .refreshable { await clinician.loadCamps() }
        .task { await clinician.loadCamps() }
    }
}
