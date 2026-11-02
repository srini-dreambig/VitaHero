import Foundation

/// The WHO 2007 growth reference for 5-19 years: BMI-for-age, height-for-age
/// and weight-for-age (to 10 years only), read the way the WHO's own software
/// reads them.
///
/// Same code as functions/who2007.ts, which is checked against all 933
/// children in the WHO's own worked survey; the tables in WhoTables.swift are
/// generated from the same files by tools/who2007/gen.py, and who2007.test.ts
/// fails if they drift. Change one and change the other.
enum WhoBmi {
    static let minMonths = 60.0
    static let maxMonths = 229.0
    /// Weight-for-age ends at 10 years.
    static let wfaMaxMonths = 120.0

    enum Indicator { case bfa, hfa, wfa }

    /// The last month an indicator has a curve for.
    static func lastMonth(of ind: Indicator) -> Double { ind == .wfa ? wfaMaxMonths : maxMonths }

    struct Lms { let l: Double; let m: Double; let s: Double }

    struct Reading {
        let bmi: Double            // one decimal, as shown
        let heightCm: Double
        let weightKg: Double
        let sex: String            // "M" or "F"
        let ageMonths: Double
        let bmiZ: Double           // two decimals
        let bmiPercentile: Double
        let heightZ: Double
        let heightPercentile: Double
        /// Weight-for-age, two decimals. nil past 10 years, where the WHO has no curve.
        let weightZ: Double?
        let weightPercentile: Double?
        let bmiClass: String
        let stunted: Bool
        /// Under 5 or over 19: read against the nearest end of the 5-19 reference.
        let outsideRange: Bool
        /// Sex not recorded: the more serious of the two readings.
        var sexUnknown = false

        /// The paper sheet's one-word nutritional status.
        var status: String {
            if ["Severely wasted", "Wasted", "Obese"].contains(bmiClass) { return bmiClass }
            return stunted ? "Stunted" : bmiClass
        }
    }

    private static func table(_ ind: Indicator, _ sex: String) -> WhoTables.Lms {
        switch ind {
        case .bfa: return sex == "M" ? WhoTables.BFA_M : WhoTables.BFA_F
        case .hfa: return sex == "M" ? WhoTables.HFA_M : WhoTables.HFA_F
        case .wfa: return sex == "M" ? WhoTables.WFA_M : WhoTables.WFA_F
        }
    }

    /// L, M and S at an age in months, interpolated as the WHO does. Clamped to 60-229 (weight: 60-120).
    static func lmsAt(_ ind: Indicator, _ sex: String, _ ageMonths: Double) -> Lms {
        let t = table(ind, sex)
        let a = min(max(ageMonths, minMonths), lastMonth(of: ind))
        let whole = a.rounded(.towardZero)
        let lo = Int(whole) - Int(minMonths)
        let hi = min(lo + 1, t.m.count - 1)
        let f = a - whole
        func at(_ xs: [Double]) -> Double { xs[lo] + f * (xs[hi] - xs[lo]) }
        return Lms(l: at(t.l), m: at(t.m), s: at(t.s))
    }

    /// The measurement that sits at a given z, on the LMS curve.
    static func valueAtZ(_ c: Lms, _ z: Double) -> Double {
        c.l == 0 ? c.m * exp(c.s * z) : c.m * pow(1 + c.l * c.s * z, 1 / c.l)
    }

    static func rawZ(_ y: Double, _ c: Lms) -> Double {
        c.l == 0 ? log(y / c.m) / c.s : (pow(y / c.m, c.l) - 1) / (c.s * c.l)
    }

    /// z-score, unrounded. BMI and weight are restricted past +/-3 SD; height is not.
    static func z(_ ind: Indicator, _ sex: String, _ ageMonths: Double, _ y: Double) -> Double {
        let c = lmsAt(ind, sex, ageMonths)
        return ind == .hfa ? rawZ(y, c) : restrictedZ(y, c)
    }

    /// z on an LMS curve, restricted past +/-3 SD the WHO's way.
    static func restrictedZ(_ y: Double, _ c: Lms) -> Double {
        let z = rawZ(y, c)
        if z > 3 {
            let sd3 = valueAtZ(c, 3)
            return 3 + (y - sd3) / (sd3 - valueAtZ(c, 2))
        }
        if z < -3 {
            let sd3 = valueAtZ(c, -3)
            return -3 + (y - sd3) / (valueAtZ(c, -2) - sd3)
        }
        return z
    }

    /// The standard normal CDF. Foundation's erfc is exact enough.
    static func normalCdf(_ z: Double) -> Double { 0.5 * erfc(-z / 2.0.squareRoot()) }

    /// Percentile, 0.1 to 99.9, one decimal.
    static func percentileOf(_ z: Double) -> Double {
        let p = normalCdf(z) * 100
        return min(max(jsRound(p * 10) / 10, 0.1), 99.9)
    }

    /// Two decimals; `+ 0` turns -0 into 0, which would print as -0.00.
    static func round2(_ z: Double) -> Double { jsRound(z * 100) / 100 + 0 }

    /// Halves up, as the server's Math.round; Swift's rounded() sends them away from zero.
    private static func jsRound(_ x: Double) -> Double { (x + 0.5).rounded(.down) }

    /// BMI-for-age class, on the camp's own cut-offs: normal from -2 to +2 SD,
    /// above +2 overweight, above +3 obese, below -2 wasted, below -3 severely
    /// wasted. Boundaries are strict. Same as bmiClass in who2007.ts.
    static func bmiClass(_ z: Double) -> String {
        if z < -3 { return "Severely wasted" }
        if z < -2 { return "Wasted" }
        if z > 3 { return "Obese" }
        if z > 2 { return "Overweight" }
        return "Normal"
    }

    /// Mirrors referenceSex() in clinical.ts. nil when the sex is not recorded.
    static func referenceSex(_ gender: String) -> String? {
        let g = gender.trimmingCharacters(in: .whitespaces).lowercased()
        if g.hasPrefix("b") || g == "male" || g == "m" { return "M" }
        if g.hasPrefix("g") || g == "female" || g == "f" { return "F" }
        return nil
    }

    /// Age in months today, from a date of birth, or failing that from whole
    /// years read as the middle of that year. WHO counts a month as 365.25 / 12 days.
    static func ageInMonths(dob: String?, ageYears: Int?, on: Date = Date()) -> Double? {
        if let born = parseDob(dob ?? "") {
            let days = on.timeIntervalSince(born) / 86_400
            if days > 0 && days < 30 * 365.25 { return days / (365.25 / 12) }
        }
        guard let y = ageYears, y > 0, y < 30 else { return nil }
        return Double(y) * 12 + 6
    }

    /// YYYY-MM-DD (or a timestamp), DD-MM-YYYY and DD/MM/YYYY. nil for anything else.
    static func parseDob(_ s: String) -> Date? {
        let v = s.trimmingCharacters(in: .whitespaces)
        var y = 0, mo = 0, d = 0
        if let r = v.range(of: #"^\d{4}-\d{1,2}-\d{1,2}"#, options: .regularExpression) {
            let p = v[r].split(separator: "-").compactMap { Int($0) }
            (y, mo, d) = (p[0], p[1], p[2])
        } else if v.range(of: #"^\d{1,2}[-/.]\d{1,2}[-/.]\d{4}$"#, options: .regularExpression) != nil {
            let p = v.split(whereSeparator: { "-/.".contains($0) }).compactMap { Int($0) }
            (d, mo, y) = (p[0], p[1], p[2])
        } else { return nil }
        guard y >= 1900, (1...12).contains(mo), (1...31).contains(d) else { return nil }
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "UTC")!
        let comps = DateComponents(year: y, month: mo, day: d)
        guard comps.isValidDate(in: cal) else { return nil }
        return cal.date(from: comps)
    }

    /// One child's reading against one sex's curves. nil when the numbers cannot be read.
    static func reading(heightCm: Double, weightKg: Double, sex: String, ageMonths: Double) -> Reading? {
        guard heightCm > 0, weightKg > 0, ageMonths.isFinite else { return nil }
        let raw = weightKg / pow(heightCm / 100, 2)
        let bmiZ = round2(z(.bfa, sex, ageMonths, raw))
        let heightZ = round2(z(.hfa, sex, ageMonths, heightCm))
        let weightZ: Double? = ageMonths < wfaMaxMonths + 1 ? round2(z(.wfa, sex, ageMonths, weightKg)) : nil
        return Reading(
            bmi: jsRound(raw * 10) / 10, heightCm: heightCm, weightKg: weightKg, sex: sex, ageMonths: ageMonths,
            bmiZ: bmiZ, bmiPercentile: percentileOf(bmiZ),
            heightZ: heightZ, heightPercentile: percentileOf(heightZ),
            weightZ: weightZ, weightPercentile: weightZ.map { percentileOf($0) },
            bmiClass: bmiClass(bmiZ), stunted: heightZ < -2,
            outsideRange: ageMonths < minMonths || ageMonths > maxMonths + 1)
    }

    private static let severity: [String: Int] = [
        "Normal": 0, "Overweight": 1, "Stunted": 1, "Wasted": 1, "Obese": 2, "Severely wasted": 2,
    ]

    /// The reading for a child as recorded. With the sex not recorded, both
    /// references are read and the more serious one is shown, as the server does.
    static func forChild(heightCm: Double, weightKg: Double, gender: String, dob: String?, ageYears: Int?) -> Reading? {
        guard let months = ageInMonths(dob: dob, ageYears: ageYears) else { return nil }
        if let sex = referenceSex(gender) {
            return reading(heightCm: heightCm, weightKg: weightKg, sex: sex, ageMonths: months)
        }
        guard var m = reading(heightCm: heightCm, weightKg: weightKg, sex: "M", ageMonths: months),
              var f = reading(heightCm: heightCm, weightKg: weightKg, sex: "F", ageMonths: months) else { return nil }
        m.sexUnknown = true
        f.sexUnknown = true
        let sm = severity[m.status] ?? 0, sf = severity[f.status] ?? 0
        if sm != sf { return sm > sf ? m : f }
        return abs(m.bmiZ) >= abs(f.bmiZ) ? m : f
    }
}
