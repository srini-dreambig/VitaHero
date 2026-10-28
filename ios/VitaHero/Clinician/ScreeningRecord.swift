import Foundation

// A check that could not be done still carries what the clinician did see.
//
// The server keeps a WATCH or ALERT that such a detail raises (severe pallor
// with no Hb meter is still an ALERT) and stores detail.notDone = true. This
// is the same mapping the Android form and the console use, in both
// directions. Foundation only, like RequiredChecks, so the unit tests compile
// it on its own.

enum ScreeningRecord {
    /// The findings to send. A check marked could not be done goes as
    /// NOT_MEASURED with its reason as the note and whatever was filled in as
    /// the detail; every other check is as RequiredChecks builds it.
    static func findings(order: [String], values: [String: [String: String]], note: String) -> [[String: Any]] {
        RequiredChecks.findings(order: order, values: values, note: note).map { finding in
            guard let check = finding["checkType"] as? String,
                  values[check]?[RequiredChecks.notDone] == "true" else { return finding }
            var out = finding
            out["detail"] = seen(values[check] ?? [:])
            return out
        }
    }

    /// The filled fields of a not-done check: no form keys, no blanks, no
    /// unticked boxes.
    static func seen(_ fields: [String: String]) -> [String: Any] {
        var detail: [String: Any] = [:]
        for (key, value) in fields
        where !key.hasPrefix("__") && key != "notDone" && !RequiredChecks.isBlank(value) && value != "false" {
            detail[key] = RequiredChecks.asJSON(value)
        }
        return detail
    }

    /// A saved finding back as form fields. It reopens as could not be done
    /// when the server marked it so, or when it is NOT_MEASURED with a reason;
    /// the reason comes back from the note and the other fields stay.
    static func restore(flag: String, note: String, detail: [String: String]) -> [String: String] {
        var fields = detail
        let markedNotDone = fields["notDone"] == "true"
        fields["notDone"] = nil
        if markedNotDone || (flag == "NOT_MEASURED" && !RequiredChecks.isBlank(note)) {
            fields[RequiredChecks.notDone] = "true"
            fields[RequiredChecks.notDoneReason] = note
        }
        return fields
    }
}
