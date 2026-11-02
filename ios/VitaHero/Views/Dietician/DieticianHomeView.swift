import SwiftUI

/// Where a screen in the dietician's stack can go.
enum DieticianRoute: Hashable {
    case school(DieticianSchool)
    case child(kidId: String)
    case groups(DieticianSchool)
    case cohort(school: DieticianSchool, grade: String, cohort: DieticianCohort)
    case articles
    case precampPlans
    case precampPlan(key: String)
}

/// What a dietician opens to: their schools, then a school's children, one
/// child's record and plan, the school in groups, and the reading list.
struct DieticianHomeView: View {
    @State private var path: [DieticianRoute] = []

    var body: some View {
        NavigationStack(path: $path) {
            DieticianSchoolsView()
                .navigationDestination(for: DieticianRoute.self) { route in
                    switch route {
                    case .school(let school): DieticianChildrenView(school: school)
                    case .child(let kidId): DieticianChildView(kidId: kidId)
                    case .groups(let school): DieticianGroupsView(school: school)
                    case .cohort(let school, let grade, let cohort):
                        DieticianCohortView(school: school, grade: grade, cohort: cohort)
                    case .articles: DieticianArticlesView()
                    case .precampPlans: DieticianTemplatesView()
                    case .precampPlan(let key): DieticianTemplateView(key: key)
                    }
                }
        }
        .tint(Brand.orange)
    }
}

/// The schools this dietician was assigned. Schools rather than camps: a
/// camp is a day, a diet plan runs for weeks, so the unit of work is a school.
struct DieticianSchoolsView: View {
    @EnvironmentObject private var auth: AuthManager
    @EnvironmentObject private var dietician: DieticianStore
    @State private var confirmLogout = false

    private var subtitle: String? {
        let me = dietician.me
        guard !me.name.trimmingCharacters(in: .whitespaces).isEmpty else { return nil }
        return [me.name, me.qualification].filter { !$0.isEmpty }.joined(separator: " · ")
    }

    var body: some View {
        List {
            if let subtitle {
                Text(subtitle).font(.subheadline).foregroundColor(.secondary)
                    .listRowBackground(Color.clear)
            }
            if let error = dietician.schoolsError, !dietician.schools.isEmpty {
                Banner(text: error, color: Brand.red).listRowBackground(Color.clear)
            }
            if dietician.schools.isEmpty {
                Group {
                    if dietician.schoolsLoading {
                        EmptyState(icon: "hourglass", title: "Loading your schools…", subtitle: "One moment.")
                    } else if let error = dietician.schoolsError {
                        EmptyState(icon: "wifi.exclamationmark", title: "Your schools could not be loaded",
                                   subtitle: error)
                    } else {
                        EmptyState(icon: "building.columns", title: "No schools yet",
                                   subtitle: "VitaHero operations assigns you to a school. Once they do, its "
                                       + "children appear here with their growth and haemoglobin.")
                    }
                }
                .listRowBackground(Color.clear)
            } else {
                Section {
                    ForEach(dietician.schools) { school in
                        NavigationLink(value: DieticianRoute.school(school)) {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(school.name).font(.headline).lineLimit(1)
                                if !school.city.isEmpty {
                                    Text(school.city).font(.subheadline).foregroundColor(.secondary)
                                }
                                Text("\(school.children) children · \(school.plans) on a plan")
                                    .font(.caption.weight(.semibold)).foregroundColor(Brand.blue)
                            }
                            .padding(.vertical, 4)
                        }
                    }
                }
            }
            // The other half of the job. A plan is for one child; the reading
            // list is the advice that is the same for every family.
            Section {
                NavigationLink(value: DieticianRoute.articles) {
                    HStack(spacing: 12) {
                        Image(systemName: "book").foregroundColor(Brand.blue)
                        VStack(alignment: .leading, spacing: 2) {
                            Text("What families read").font(.headline)
                            Text("Write for every family, not one child at a time")
                                .font(.footnote).foregroundColor(.secondary)
                        }
                    }
                    .padding(.vertical, 4)
                }
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle("My schools")
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
        .refreshable { await dietician.loadSchools() }
        .task { await dietician.loadSchools() }
    }
}

// MARK: - Shared pieces

/// The four things a plan can be for, in the order Android offers them.
let dietFocuses = ["GENERAL", "WEIGHT_GAIN", "WEIGHT_CONTROL", "ANAEMIA"]

/// A plan's focus as a dietician reads it.
func dietFocusLabel(_ focus: String) -> String {
    switch focus {
    case "WEIGHT_GAIN": return "Growth"
    case "WEIGHT_CONTROL": return "Weight"
    case "ANAEMIA": return "Iron"
    case "GENERAL": return "Everyday"
    default: return focus
    }
}

/// "5 B · 9 yrs" from whatever of the two is there.
func dieticianChildLine(className: String, age: Int?) -> String {
    [className, age.map { "\($0) yrs" } ?? ""].filter { !$0.isEmpty }.joined(separator: " · ")
}

/// A choice in a row of choices: a class, a plan's focus, a language.
struct DieticianChip: View {
    let title: String
    let selected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.footnote.weight(selected ? .semibold : .medium))
                .foregroundColor(selected ? .white : .primary)
                .padding(.horizontal, 12)
                .frame(minHeight: 32)
                .background(Capsule().fill(selected ? Brand.orange : Color(.tertiarySystemGroupedBackground)))
        }
        .buttonStyle(.borderless)
        .accessibilityAddTraits(selected ? .isSelected : [])
    }
}

/// A labelled box for several lines: a plan's guidance, an article's body.
struct DieticianTextArea: View {
    let label: String
    @Binding var text: String
    var minHeight: CGFloat = 120

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label).font(.caption.weight(.medium)).foregroundColor(.secondary)
            TextEditor(text: $text)
                .frame(minHeight: minHeight)
                .padding(6)
                .background(Color(.tertiarySystemGroupedBackground))
                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        }
    }
}
