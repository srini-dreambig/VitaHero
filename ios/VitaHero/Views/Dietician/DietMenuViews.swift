import SwiftUI

// The dietician's menu: meals, the foods in each, how much for each age
// group, and how often. The menu is the same for every age; only the
// quantities change. The server (functions/diet-menus.ts) caps and cleans
// what is sent, so these limits only keep the screen from offering more.
// Android's DietMenu.kt is the same screen.

private let maxMeals = 10
private let maxItems = 15

/// Text cut to a length as it is typed.
private func limited(_ binding: Binding<String>, _ max: Int) -> Binding<String> {
    Binding(get: { binding.wrappedValue }, set: { binding.wrappedValue = String($0.prefix(max)) })
}

struct MenuEditorView: View {
    @Binding var meals: [MenuMeal]
    /// The child's age group when writing for one child, so its column is marked.
    var childAgeGroup = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Menu").font(.vh(.subheadline, .semibold))
            Text("The same foods for every age. Fill in how much for each age group; "
                 + "each family sees the amount for their own child.")
                .font(.vh(.footnote)).foregroundColor(.secondary)
            ForEach($meals) { $meal in
                mealCard($meal)
            }
            if meals.count < maxMeals {
                Button("Add a meal") {
                    meals.append(MenuMeal(slot: "LUNCH", label: DietMenu.slotLabels["LUNCH"] ?? "",
                                          items: [MenuItem()]))
                }
                .font(.vh(.footnote, .semibold))
                .buttonStyle(.borderless)
            }
        }
    }

    private func mealCard(_ meal: Binding<MenuMeal>) -> some View {
        let id = meal.wrappedValue.id
        return VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .bottom, spacing: 8) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Meal").font(.vh(.caption, .medium)).foregroundColor(.secondary)
                    Menu {
                        ForEach(DietMenu.slots, id: \.self) { slot in
                            Button(DietMenu.slotLabels[slot] ?? slot) { pick(slot, meal) }
                        }
                    } label: {
                        HStack {
                            Text(DietMenu.slotLabels[meal.wrappedValue.slot] ?? meal.wrappedValue.slot)
                                .foregroundColor(.primary)
                            Spacer(minLength: 4)
                            Image(systemName: "chevron.down").font(.caption).foregroundColor(.secondary)
                        }
                        .padding(.horizontal, 10)
                        .frame(maxWidth: .infinity, minHeight: 44)
                        .background(Color(.tertiarySystemGroupedBackground))
                        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                    }
                }
                TextFieldRow(label: "Time", value: limited(meal.time, 20), placeholder: "7:00 pm")
                    .frame(maxWidth: 120)
            }
            TextFieldRow(label: "Heading the family sees", value: limited(meal.label, 40))
            Toggle("Family chooses any one of these", isOn: meal.chooseAny)
                .font(.vh(.footnote))
            ForEach(meal.items) { $item in
                Divider()
                itemFields($item, meal: meal)
            }
            HStack(spacing: 14) {
                if meal.wrappedValue.items.count < maxItems {
                    Button("Add a food") { meal.wrappedValue.items.append(MenuItem()) }
                }
                Spacer()
                if let i = meals.firstIndex(where: { $0.id == id }), i > 0 {
                    Button("Move up") { meals.swapAt(i, i - 1) }
                }
                Button("Remove meal") { meals.removeAll { $0.id == id } }
                    .foregroundColor(Brand.red)
            }
            .font(.vh(.footnote, .semibold))
            .buttonStyle(.borderless)
            .frame(minHeight: 44)
        }
        .padding(12)
        .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).stroke(Color(.separator), lineWidth: 1))
    }

    /// The heading follows the meal unless the dietician wrote their own.
    private func pick(_ slot: String, _ meal: Binding<MenuMeal>) {
        let m = meal.wrappedValue
        let ownHeading = !m.label.isEmpty && m.label != DietMenu.slotLabels[m.slot]
        meal.wrappedValue.slot = slot
        if !ownHeading { meal.wrappedValue.label = DietMenu.slotLabels[slot] ?? "" }
    }

    private func itemFields(_ item: Binding<MenuItem>, meal: Binding<MenuMeal>) -> some View {
        let id = item.wrappedValue.id
        return VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .bottom, spacing: 8) {
                TextFieldRow(label: "Food", value: limited(item.name, 120))
                Button("Remove") { meal.wrappedValue.items.removeAll { $0.id == id } }
                    .font(.vh(.footnote))
                    .foregroundColor(Brand.red)
                    .buttonStyle(.borderless)
                    .frame(minHeight: 44)
            }
            HStack(alignment: .bottom, spacing: 6) {
                ForEach(DietMenu.ageGroups, id: \.self) { g in
                    TextFieldRow(label: (DietMenu.ageLabels[g] ?? g) + (g == childAgeGroup ? " ✓" : ""),
                                 value: quantity(item, g), placeholder: "Amount")
                }
            }
            Picker("How often", selection: item.frequency) {
                ForEach(DietMenu.frequencies, id: \.self) { f in
                    Text(DietMenu.frequencyLabels[f] ?? f).tag(f)
                }
            }
            .pickerStyle(.segmented)
        }
    }

    private func quantity(_ item: Binding<MenuItem>, _ group: String) -> Binding<String> {
        Binding(
            get: { item.wrappedValue.qty[group] ?? "" },
            set: { item.wrappedValue.qty[group] = String($0.prefix(60)) }
        )
    }
}

/// What a family reads: each meal, its foods, and the amount for their own
/// child. Read-only; the dietician's screens use `MenuEditorView`.
struct FamilyMenuView: View {
    let menu: [FamilyMenuMeal]

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            ForEach(Array(menu.enumerated()), id: \.offset) { _, meal in
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text(meal.label).font(.vh(.subheadline, .semibold))
                        Spacer()
                        if !meal.time.isEmpty {
                            Text(meal.time).font(.vh(.caption)).foregroundColor(.secondary)
                        }
                    }
                    if meal.chooseAny && meal.items.count > 1 {
                        Text(L("diet_menu_choose_any")).font(.vh(.caption, .medium)).foregroundColor(Brand.orange)
                    }
                    ForEach(Array(meal.items.enumerated()), id: \.offset) { _, item in
                        HStack(alignment: .top, spacing: 8) {
                            Text("•  " + item.name).font(.vh(.subheadline))
                            Spacer(minLength: 8)
                            let side = [item.quantity, dietMenuFrequencyText(item.frequency)]
                                .filter { !$0.isEmpty }.joined(separator: " · ")
                            if !side.isEmpty {
                                Text(side).font(.vh(.footnote)).foregroundColor(.secondary)
                                    .multilineTextAlignment(.trailing)
                            }
                        }
                    }
                }
            }
        }
    }
}

/// "Once a week" / "Twice a week" in the family's language; daily needs no label.
func dietMenuFrequencyText(_ code: String) -> String {
    switch code {
    case "WEEKLY_ONCE": return L("diet_menu_once_a_week")
    case "WEEKLY_TWICE": return L("diet_menu_twice_a_week")
    default: return ""
    }
}

/// The child's age group in the family's language, or "" for an unknown code.
func dietAgeGroupText(_ code: String) -> String {
    switch code {
    case "UNDER_5": return L("diet_age_under_5")
    case "AGE_6_10": return L("diet_age_6_10")
    case "AGE_11_16": return L("diet_age_11_16")
    default: return ""
    }
}
