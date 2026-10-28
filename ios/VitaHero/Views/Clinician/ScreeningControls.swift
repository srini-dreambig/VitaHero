import SwiftUI

// The clinician form's controls. Each reads and writes one string in the
// check's field map, the same shape the Android form keeps, so the required
// rules in RequiredChecks see exactly what the clinician entered.

/// The server's refusal as it wrote it; anything else, the screen's own words.
func clinicianMessage(_ error: Error, fallback: String) -> String {
    if let api = error as? APIError, case .refused = api { return api.localizedDescription }
    return fallback
}

/// A heading inside a check's card.
struct FormSectionHeader: View {
    let title: String
    var subtitle: String? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title).font(.subheadline.weight(.semibold)).foregroundColor(Brand.orange)
            if let subtitle { Text(subtitle).font(.caption).foregroundColor(.secondary) }
        }
        .padding(.top, 4)
    }
}

/// The label above a field.
private struct FieldLabel: View {
    let text: String
    var body: some View {
        Text(text).font(.caption.weight(.medium)).foregroundColor(.secondary)
    }
}

private struct FieldBox<Content: View>: View {
    @ViewBuilder var content: Content
    var body: some View {
        content
            .padding(.horizontal, 12)
            .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
            .background(Color(.tertiarySystemGroupedBackground))
            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
    }
}

/// A free-text field.
struct TextFieldRow: View {
    let label: String
    @Binding var value: String
    var placeholder = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            FieldLabel(text: label)
            FieldBox { TextField(placeholder, text: $value) }
        }
    }
}

/// A reading. Only digits and one decimal point get in, as on Android.
struct NumberField: View {
    let label: String
    @Binding var value: String

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            FieldLabel(text: label)
            FieldBox {
                TextField("", text: $value)
                    .keyboardType(.decimalPad)
                    .onChange(of: value) { typed in
                        let kept = typed.filter { $0.isNumber || $0 == "." }
                        if kept != typed { value = kept }
                    }
            }
        }
    }
}

/// One choice from a list.
struct ChoiceField: View {
    let label: String
    let options: [String]
    @Binding var value: String

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            FieldLabel(text: label)
            Menu {
                if !value.isEmpty {
                    Button(L("clin_clear_choice"), role: .destructive) { value = "" }
                }
                ForEach(options, id: \.self) { option in
                    Button {
                        value = option
                    } label: {
                        if option == value { Label(option, systemImage: "checkmark") } else { Text(option) }
                    }
                }
            } label: {
                FieldBox {
                    HStack {
                        Text(value.isEmpty ? L("clin_choose") : value)
                            .foregroundColor(value.isEmpty ? .secondary : .primary)
                            .multilineTextAlignment(.leading)
                        Spacer(minLength: 4)
                        Image(systemName: "chevron.up.chevron.down").font(.caption).foregroundColor(.secondary)
                    }
                    .padding(.vertical, 8)
                }
            }
        }
    }
}

/// Several choices, kept as the options joined by commas (the server's form).
///
/// Some options carry commas of their own ("MMR (Measles, Mumps, Rubella)"),
/// so the selection is found by looking for each whole option in the stored
/// value, never by splitting it.
struct MultiChoiceField: View {
    let label: String
    let options: [String]
    @Binding var value: String
    /// Called with the new selection in place of writing `value`, for the
    /// fields that also set flags from what was picked.
    var onSelect: (([String]) -> Void)? = nil

    @State private var open = false

    private var selected: [String] {
        let wrapped = "," + value + ","
        return options.filter { wrapped.contains("," + $0 + ",") }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            FieldLabel(text: label)
            Button { open = true } label: {
                FieldBox {
                    HStack {
                        Text(selected.isEmpty ? L("clin_choose") : selected.joined(separator: "; "))
                            .foregroundColor(selected.isEmpty ? .secondary : .primary)
                            .multilineTextAlignment(.leading)
                        Spacer(minLength: 4)
                        Image(systemName: "list.bullet").font(.caption).foregroundColor(.secondary)
                    }
                    .padding(.vertical, 8)
                }
            }
            .buttonStyle(.plain)
        }
        .sheet(isPresented: $open) {
            NavigationStack {
                List(options, id: \.self) { option in
                    Button { toggle(option) } label: {
                        HStack {
                            Text(option).foregroundColor(.primary)
                            Spacer()
                            if selected.contains(option) {
                                Image(systemName: "checkmark").foregroundColor(Brand.orange)
                            }
                        }
                    }
                }
                .navigationTitle(label)
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .confirmationAction) {
                        Button(L("done")) { open = false }
                    }
                }
            }
        }
    }

    private func toggle(_ option: String) {
        var picked = Set(selected)
        if picked.contains(option) { picked.remove(option) } else { picked.insert(option) }
        let ordered = options.filter { picked.contains($0) }
        if let onSelect { onSelect(ordered) } else { value = ordered.joined(separator: ",") }
    }
}

/// A yes/no, stored as "true" or "false". The whole row is the target.
struct ToggleRow: View {
    let label: String
    @Binding var value: String

    private var isOn: Bool { value == "true" }

    var body: some View {
        Button {
            value = isOn ? "false" : "true"
        } label: {
            HStack(spacing: 10) {
                Image(systemName: isOn ? "checkmark.square.fill" : "square")
                    .font(.title3)
                    .foregroundColor(isOn ? Brand.orange : .secondary)
                Text(label).foregroundColor(.primary)
                Spacer()
            }
            .frame(minHeight: 44)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(isOn ? .isSelected : [])
    }
}
