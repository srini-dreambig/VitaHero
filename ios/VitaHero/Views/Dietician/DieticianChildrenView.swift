import SwiftUI

/// The children at one of this dietician's schools.
///
/// Each row carries only what is needed to choose: the name, the class,
/// whether a plan is running, and how many of the two checks this person may
/// read came back flagged. The readings are one tap away, and that tap is
/// written to the access trail. The search filters here: the list is one
/// school's roster, and the server has already decided who is in it.
struct DieticianChildrenView: View {
    let school: DieticianSchool

    @EnvironmentObject private var dietician: DieticianStore
    @State private var query = ""

    private var children: [DieticianChild] {
        dietician.childrenSchoolId == school.id ? dietician.children : []
    }

    private var shown: [DieticianChild] {
        let q = query.trimmingCharacters(in: .whitespaces).lowercased()
        return q.isEmpty ? children : children.filter { $0.name.lowercased().contains(q) }
    }

    private var onPlan: Int { children.filter(\.hasPlan).count }

    var body: some View {
        List {
            Section {
                Text("\(onPlan) of \(children.count) on a plan")
                    .font(.vh(.subheadline)).foregroundColor(.secondary)
                if let error = dietician.childrenError {
                    Banner(text: error, color: Brand.red)
                }
                // Most children need one of a handful of plans. Writing it
                // once per group is the quick way through a school.
                NavigationLink(value: DieticianRoute.groups(school)) {
                    HStack(spacing: 12) {
                        Image(systemName: "person.3.fill").foregroundColor(Brand.orange)
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Plan by groups").font(.vh(.headline)).foregroundColor(Brand.orange)
                            Text("Children grouped by what their checks found, each with a draft plan to edit and send.")
                                .font(.vh(.footnote)).foregroundColor(.secondary)
                        }
                    }
                    .padding(.vertical, 4)
                }
                .listRowBackground(Brand.orange.opacity(0.08))
            }

            if shown.isEmpty {
                Group {
                    if dietician.childrenLoading && children.isEmpty {
                        EmptyState(icon: "hourglass", title: "Loading…", subtitle: "One moment.")
                    } else if children.isEmpty {
                        EmptyState(icon: "person.3", title: "No children on this roster yet",
                                   subtitle: "The school office builds the roster. Once it is in, every child "
                                       + "here can be given a plan.")
                    } else {
                        EmptyState(icon: "magnifyingglass", title: "Nobody matches that",
                                   subtitle: "Try part of the name.")
                    }
                }
                .listRowBackground(Color.clear)
            } else {
                Section {
                    ForEach(shown) { child in
                        NavigationLink(value: DieticianRoute.child(kidId: child.kidId)) { row(child) }
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
        .searchable(text: $query, prompt: "Search by name")
        .navigationTitle(school.name)
        .navigationBarTitleDisplayMode(.inline)
        .refreshable { await dietician.loadChildren(school.id) }
        .task { await dietician.loadChildren(school.id) }
    }

    private func row(_ child: DieticianChild) -> some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 3) {
                Text(child.name).font(.vh(.body, .semibold)).lineLimit(1)
                let sub = dieticianChildLine(className: child.className, age: child.age)
                if !sub.isEmpty { Text(sub).font(.vh(.caption)).foregroundColor(.secondary) }
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 4) {
                if child.hasPlan { Pill(text: "On a plan", color: Brand.blue) }
                if child.concerns > 0 {
                    Pill(text: child.concerns == 1 ? "1 to look at" : "\(child.concerns) to look at",
                         color: Brand.orange)
                }
            }
        }
        .padding(.vertical, 2)
    }
}
