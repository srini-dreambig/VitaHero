import Foundation

/// The IAP 2015 Indian growth charts (height, weight and BMI, 5 to 18 years)
/// and the Mramba 2017 MUAC-for-age reference (5 to 19 years), read beside the
/// WHO's.
///
/// Same code as functions/growthrefs.ts, which is checked against the papers'
/// printed tables; the tables in GrowthRefTables.swift are generated from the
/// same files by tools/growthrefs/gen.py. Change one and change the other.
///
/// IAP: the chart's lines are the printed centiles, at every half year. A child
/// between two lines is read between them, linearly in z, so the centile always
/// agrees with the dot on the chart; past the outer lines, the distance is read
/// off the LMS curve fitted to that row.
enum GrowthRefs {
    static let iapMinMonths = 60.0
    static let iapMaxMonths = 216.0
    static let muacMinMonths = 60.0
    static let muacMaxMonths = 228.0

    enum Measure { case ht, wt, bmi }

    static func chart(_ m: Measure, _ sex: String) -> GrowthRefTables.Iap {
        switch m {
        case .ht: return sex == "M" ? GrowthRefTables.IAP_HT_M : GrowthRefTables.IAP_HT_F
        case .wt: return sex == "M" ? GrowthRefTables.IAP_WT_M : GrowthRefTables.IAP_WT_F
        case .bmi: return sex == "M" ? GrowthRefTables.IAP_BMI_M : GrowthRefTables.IAP_BMI_F
        }
    }

    /// Row index and fraction between half years, clamped to 5-18.
    private static func rowAt(_ months: Double) -> (Int, Double) {
        let x = (min(max(months, iapMinMonths), iapMaxMonths) - iapMinMonths) / 6
        let lo = min(Int(x.rounded(.down)), 25)
        return (lo, x - Double(lo))
    }

    private static func between(_ xs: [Double], _ lo: Int, _ f: Double) -> Double { xs[lo] + f * (xs[lo + 1] - xs[lo]) }

    /// The chart's lines (3rd to 97th, or the BMI chart's 3rd to 27 AE) at an age in months.
    static func linesAt(_ m: Measure, _ sex: String, _ months: Double) -> [Double] {
        let (lo, f) = rowAt(months)
        return chart(m, sex).centiles.map { between($0, lo, f) }
    }

    static func lmsAt(_ m: Measure, _ sex: String, _ months: Double) -> WhoBmi.Lms {
        let t = chart(m, sex).lms
        let (lo, f) = rowAt(months)
        return WhoBmi.Lms(l: between(t.l, lo, f), m: between(t.m, lo, f), s: between(t.s, lo, f))
    }

    /// Inverse normal CDF by bisection; only ever asked for the charts' few centiles.
    static func zOfPercent(_ p: Double) -> Double {
        var lo = -10.0, hi = 10.0
        for _ in 0..<100 {
            let mid = (lo + hi) / 2
            if WhoBmi.normalCdf(mid) < p / 100 { lo = mid } else { hi = mid }
        }
        return (lo + hi) / 2
    }

    /// z on the IAP chart, unrounded.
    static func z(_ m: Measure, _ sex: String, _ months: Double, _ y: Double) -> Double {
        let t = chart(m, sex)
        let lines = linesAt(m, sex, months)
        let zs = t.percents.map(zOfPercent)
        let last = lines.count - 1
        if y <= lines[0] || y >= lines[last] {
            let c = lmsAt(m, sex, months)
            let k = y <= lines[0] ? 0 : last
            return zs[k] + WhoBmi.rawZ(y, c) - WhoBmi.rawZ(lines[k], c)
        }
        var k = 0
        while y > lines[k + 1] { k += 1 }
        return zs[k] + (zs[k + 1] - zs[k]) * (y - lines[k]) / (lines[k + 1] - lines[k])
    }

    private static func isNumber(_ s: String) -> Bool { !s.isEmpty && s.allSatisfy(\.isNumber) }

    private static func lineName(_ label: String) -> String {
        isNumber(label) ? label + (label.hasSuffix("3") && label != "13" ? "rd" : "th") : label
    }

    /// Which two lines the reading sits between, in the chart's words.
    static func band(_ m: Measure, _ sex: String, _ months: Double, _ y: Double) -> String {
        let t = chart(m, sex)
        let lines = linesAt(m, sex, months)
        let last = lines.count - 1
        func name(_ k: Int) -> String { isNumber(t.labels[k]) ? lineName(t.labels[k]) : "the \(t.labels[k]) line" }
        if y < lines[0] { return "below \(name(0))" }
        if y > lines[last] { return "above \(name(last))" }
        // A reading exactly on a line counts as on its way up: the 50th reads "50th–75th".
        var k = 0
        while k < last - 1 && y >= lines[k + 1] { k += 1 }
        return "\(lineName(t.labels[k]))–\(lineName(t.labels[k + 1]))"
    }

    struct IapReading { let z: Double; let percentile: Double; let band: String }

    /// nil under 5 or past 18, where the IAP charts have no lines.
    static func iapReading(_ m: Measure, _ sex: String, _ months: Double, _ y: Double) -> IapReading? {
        guard y > 0, months.isFinite, months >= iapMinMonths, months < iapMaxMonths + 1 else { return nil }
        let z = WhoBmi.round2(z(m, sex, months, y))
        return IapReading(z: z, percentile: WhoBmi.percentileOf(z), band: band(m, sex, months, y))
    }

    /// Mramba L, M, S at an age in months, interpolated between whole months. Clamped to 60-228.
    static func muacLmsAt(_ sex: String, _ months: Double) -> WhoBmi.Lms {
        let t = sex == "M" ? GrowthRefTables.MUAC_M : GrowthRefTables.MUAC_F
        let a = min(max(months, muacMinMonths), muacMaxMonths)
        let whole = a.rounded(.towardZero)
        let lo = Int(whole) - Int(muacMinMonths)
        let hi = min(lo + 1, t.m.count - 1)
        let f = a - whole
        func at(_ xs: [Double]) -> Double { xs[lo] + f * (xs[hi] - xs[lo]) }
        return WhoBmi.Lms(l: at(t.l), m: at(t.m), s: at(t.s))
    }

    struct MuacReading { let z: Double; let percentile: Double }

    /// nil under 5 or past 19 (under 5 the camp uses the WHO's 11.5 and 12.5 cm).
    static func muacReading(_ sex: String, _ months: Double, _ cm: Double) -> MuacReading? {
        guard cm > 0, months.isFinite, months >= muacMinMonths, months < muacMaxMonths + 1 else { return nil }
        let z = WhoBmi.round2(WhoBmi.restrictedZ(cm, muacLmsAt(sex, months)))
        return MuacReading(z: z, percentile: WhoBmi.percentileOf(z))
    }

    /// MUAC class, on the same cut-offs as the clinical rules (muacBand in clinical.ts).
    static func muacClass(_ z: Double) -> String { z < -3 ? "Severely low" : z < -2 ? "Low" : "Normal" }

    /// Under five: the WHO's screening cut-offs in cm.
    static func muacClassUnderFive(_ cm: Double) -> String { cm < 11.5 ? "Severely low" : cm < 12.5 ? "Low" : "Normal" }
}
