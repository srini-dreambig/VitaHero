import Foundation

// What a screening form cannot be saved without.
//
// The server is the authority: clinical.ts refuses a check with a blank
// required field, a number out of range, or a NOT_MEASURED with no reason, and
// the app shows that refusal word for word. This file says the same thing
// before the request, so a clinician hears it by name while the child is still
// in front of them. It is Foundation only so the unit tests can compile it on
// its own; keep it in step with REQUIRED_FIELDS in functions/clinical.ts and
// with the Android form.

enum RequiredChecks {
    /// Set on a check the clinician could not do; its reason travels as the note.
    static let notDone = "__notDone"
    static let notDoneReason = "__reason"

    /// The fields each check cannot be saved without, by the keys clinical.ts
    /// reads, with the short labels the app uses in its own gap message.
    static let requiredFields: [String: [(key: String, label: String)]] = [
        "Height & weight": [("heightCm", "Height"), ("weightKg", "Weight")],
        "Vision": [("rightAcuity", "Right eye"), ("leftAcuity", "Left eye")],
        "Dental": [("cariesCount", "Carious count"), ("gums", "Gums"), ("hygiene", "Oral hygiene")],
        "Haemoglobin": [("hb", "Haemoglobin")],
        "ENT": [("rightHearing", "Right ear"), ("leftHearing", "Left ear")],
        "Skin": [("skinCondition", "Primary skin finding")],
        "Spine": [("posture", "Posture"), ("gaitLimb", "Gait & lower limb")],
        "Immunisation review": [("vaccineStatus", "Vaccine status")],
    ]

    /// The same table with the server's labels, which its refusals use.
    static let serverRequiredFields: [String: [(key: String, label: String)]] = [
        "Height & weight": [("heightCm", "Height (cm)"), ("weightKg", "Weight (kg)")],
        "Vision": [("rightAcuity", "Right eye acuity"), ("leftAcuity", "Left eye acuity")],
        "Dental": [("cariesCount", "Carious (decayed) teeth"), ("gums", "Gums condition"), ("hygiene", "Oral hygiene")],
        "Haemoglobin": [("hb", "Haemoglobin (g/dL)")],
        "ENT": [("rightHearing", "Right ear hearing"), ("leftHearing", "Left ear hearing")],
        "Skin": [("skinCondition", "Skin condition")],
        "Spine": [("posture", "Posture"), ("gaitLimb", "Gait & lower limbs")],
        "Immunisation review": [("vaccineStatus", "Vaccination status")],
    ]

    /// Plausible values, as the server holds them. Outside these is a typo.
    static let ranges: [String: (min: Double, max: Double)] = [
        "heightCm": (40, 200),
        "weightKg": (5, 150),
        "hb": (3, 20),
        "cariesCount": (0, 32),
    ]

    /// The server's own check, in its own words: a blank required field, else
    /// a required number out of range, else "".
    static func missingRequired(_ checkType: String, _ detail: [String: String]) -> String {
        let fields = serverRequiredFields[checkType] ?? []
        let blank = fields
            .filter { (detail[$0.key] ?? "").trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
            .map(\.label)
        if !blank.isEmpty {
            return "\(checkType): \(blank.joined(separator: ", ")) \(blank.count == 1 ? "is" : "are") required"
        }
        for field in fields {
            guard let range = ranges[field.key] else { continue }
            let n = number(detail[field.key])
            if n == nil || n! < range.min || n! > range.max {
                return "\(checkType): \(field.label) must be a number from \(format(range.min)) to \(format(range.max))"
            }
        }
        return ""
    }

    /// What still stops this form being saved, one line per check, or empty.
    ///
    /// A check is done in full, or marked could not be done with a reason. One
    /// left untouched only passes when it was already recorded earlier.
    static func screeningGaps(
        checks: [String],
        values: [String: [String: String]],
        alreadyRecorded: Set<String>
    ) -> [String] {
        checks.compactMap { check in
            let fields = values[check] ?? [:]
            if fields[notDone] == "true" {
                return isBlank(fields[notDoneReason]) ? "\(check): say why it could not be done" : nil
            }
            let touched = fields.contains { !$0.key.hasPrefix("__") && !isBlank($0.value) && $0.value != "false" }
            if !touched && alreadyRecorded.contains(check) { return nil }
            let missing = (requiredFields[check] ?? [])
                .filter { isBlank(fields[$0.key]) }
                .map(\.label)
            if !missing.isEmpty { return "\(check): \(missing.joined(separator: ", "))" }
            if !touched { return "\(check): nothing recorded" }
            return nil
        }
    }

    /// The message shown at the top of the form and again above Save.
    static func gapMessage(_ gaps: [String]) -> String {
        gaps.isEmpty ? "" :
            "Not saved. Still required — " + gaps.joined(separator: "; ") +
            ". Fill these in, or tick Could not be done and give the reason."
    }

    /// Numbers out of the server's range, in its words, for the checks that
    /// are going up with readings. Caught here so a slipped decimal point is
    /// fixed at the camp, not discovered as a refusal.
    static func rangeProblems(checks: [String], values: [String: [String: String]]) -> [String] {
        checks.compactMap { check in
            let fields = values[check] ?? [:]
            if fields[notDone] == "true" { return nil }
            let touched = fields.contains { !$0.key.hasPrefix("__") && !isBlank($0.value) && $0.value != "false" }
            guard touched else { return nil }
            let problem = missingRequired(check, fields)
            return problem.isEmpty ? nil : problem
        }
    }

    /// The findings as the server takes them, in the order given.
    ///
    /// A check marked could not be done goes as NOT_MEASURED with its reason as
    /// the note, and nothing else: the server decides every other flag. A check
    /// whose only values are blank or "false" is not sent at all.
    static func findings(order: [String], values: [String: [String: String]], note: String) -> [[String: Any]] {
        var keys = order.filter { values[$0] != nil }
        keys += values.keys.filter { !keys.contains($0) }.sorted()
        return keys.compactMap { check in
            let fields = values[check] ?? [:]
            if fields[notDone] == "true" {
                return [
                    "checkType": check,
                    "flag": "NOT_MEASURED",
                    "note": (fields[notDoneReason] ?? "").trimmingCharacters(in: .whitespacesAndNewlines),
                ]
            }
            let kept = fields.filter { !$0.key.hasPrefix("__") && !isBlank($0.value) }
            if kept.isEmpty || kept.values.allSatisfy({ $0 == "false" }) { return nil }
            var detail: [String: Any] = [:]
            for (key, value) in kept { detail[key] = asJSON(value) }
            return ["checkType": check, "detail": detail, "note": note]
        }
    }

    /// "true" and "false" go as booleans, which the server's rules compare
    /// against; everything else goes as the text that was entered.
    static func asJSON(_ value: String) -> Any {
        switch value {
        case "true": return true
        case "false": return false
        default: return value.trimmingCharacters(in: .whitespacesAndNewlines)
        }
    }

    // MARK: Helpers

    static func isBlank(_ value: String?) -> Bool {
        (value ?? "").trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private static func number(_ value: String?) -> Double? {
        let text = (value ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        return text.isEmpty ? nil : Double(text)
    }

    private static func format(_ value: Double) -> String {
        value == value.rounded() ? String(Int(value)) : String(value)
    }
}
