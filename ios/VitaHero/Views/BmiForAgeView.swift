import SwiftUI

/// Colour of a growth class: green normal, amber past 2 SD (or the 3rd/97th), red past 3 SD.
func growthClassColor(_ cls: String) -> Color {
    switch cls {
    case "Normal": return Brand.green
    case "Overweight", "Wasted", "Stunted", "Underweight", "Low", "Above +2 SD", "Below 3rd", "Above 97th":
        return Brand.amber
    case "Obese", "Severely wasted", "Severely stunted", "Severely underweight", "Severely low":
        return Brand.red
    default: return Brand.blue
    }
}

private func signed(_ z: Double) -> String { String(format: "%+.2f", z) }
private func pct(_ p: Double) -> String { p < 1 || p > 99 ? String(format: "%.1f", p) : "\(Int(p))" }

/// WHO height-for-age class: stunted below -2 SD, severely below -3.
func heightClass(_ z: Double) -> String { z < -3 ? "Severely stunted" : z < -2 ? "Stunted" : "Normal" }

/// WHO weight-for-age class. Above +2 SD is not called overweight: the WHO
/// reads that from BMI-for-age, so the card sends the reader there.
func weightClass(_ z: Double) -> String {
    z < -3 ? "Severely underweight" : z < -2 ? "Underweight" : z > 2 ? "Above +2 SD" : "Normal"
}

// MARK: - The chart

/// Reference lines by age, the bands between them shaded, the child as a dot.
/// One drawing for the WHO's SD curves, the IAP's printed centiles and the
/// MUAC-for-age SD curves.
struct GrowthChartModel {
    /// One reference line, a value at each of the chart's ages. nil colour: the axis colour.
    struct Line {
        let label: String
        let values: [Double]
        var color: Color? = nil
        var bold = false
        var dashed = false
    }
    /// A shaded band between two lines, by index (nil = the chart's edge).
    struct Fill { let from: Int?; let to: Int?; let color: Color }
    struct Key { let color: Color; let label: String }

    let months: [Double]
    let lines: [Line]
    let fills: [Fill]
    let legend: [Key]

    private static func sdColor(_ z: Int) -> Color? {
        switch abs(z) {
        case 0: return Brand.green
        case 2: return Brand.amber
        case 3: return Brand.red
        default: return nil
        }
    }

    private static func sdLines(_ values: (Int) -> [Double]) -> [Line] {
        (-3...3).map { z in
            Line(label: z == 0 ? "0" : String(format: "%+d", z), values: values(z),
                 color: sdColor(z), bold: z == 0, dashed: abs(z) == 3)
        }
    }

    /// Bands of the camp's cut-offs on the low side. SD lines are -3..+3 at indices 0..6.
    private static let lowFills = [
        Fill(from: nil, to: 0, color: Brand.red), Fill(from: 0, to: 1, color: Brand.amber),
        Fill(from: 1, to: nil, color: Brand.green),
    ]
    private static let lowLegend = [
        Key(color: Brand.green, label: "Above −2 SD"), Key(color: Brand.amber, label: "−3 to −2 SD"),
        Key(color: Brand.red, label: "Below −3 SD"),
    ]

    static func who(_ ind: WhoBmi.Indicator, _ sex: String) -> GrowthChartModel {
        let end = min(WhoBmi.lastMonth(of: ind), 228)
        let months = Array(stride(from: 60.0, through: end, by: 2))
        let lines = sdLines { z in months.map { WhoBmi.valueAtZ(WhoBmi.lmsAt(ind, sex, $0), Double(z)) } }
        guard ind == .bfa else { return GrowthChartModel(months: months, lines: lines, fills: lowFills, legend: lowLegend) }
        return GrowthChartModel(
            months: months, lines: lines,
            fills: [
                Fill(from: nil, to: 0, color: Brand.red), Fill(from: 0, to: 1, color: Brand.amber),
                Fill(from: 1, to: 5, color: Brand.green), Fill(from: 5, to: 6, color: Brand.amber),
                Fill(from: 6, to: nil, color: Brand.red),
            ],
            legend: [
                Key(color: Brand.green, label: "Normal"), Key(color: Brand.amber, label: "Wasted / Overweight"),
                Key(color: Brand.red, label: "Severely wasted / Obese"),
            ])
    }

    private static func iapColor(_ label: String) -> Color? {
        if label == "50" { return Brand.green }
        if ["3", "97", "23 AE"].contains(label) { return Brand.amber }
        if label == "27 AE" { return Brand.red }
        return nil
    }

    static func iap(_ m: GrowthRefs.Measure, _ sex: String) -> GrowthChartModel {
        let t = GrowthRefs.chart(m, sex)
        // The printed rows, every half year; the chart's lines are straight between them.
        let months = (0..<27).map { 60.0 + Double($0) * 6 }
        var lines: [Line] = []
        for (k, label) in t.labels.enumerated() {
            lines.append(Line(label: label, values: t.centiles[k], color: iapColor(label), bold: label == "50"))
        }
        let last = lines.count - 1
        switch m {
        case .bmi:
            return GrowthChartModel(
                months: months, lines: lines,
                fills: [
                    Fill(from: nil, to: 0, color: Brand.amber), Fill(from: 0, to: last - 1, color: Brand.green),
                    Fill(from: last - 1, to: last, color: Brand.amber), Fill(from: last, to: nil, color: Brand.red),
                ],
                legend: [
                    Key(color: Brand.green, label: "3rd–23 AE"), Key(color: Brand.amber, label: "Below 3rd / 23–27 AE"),
                    Key(color: Brand.red, label: "Above 27 AE"),
                ])
        case .ht:
            return GrowthChartModel(
                months: months, lines: lines,
                fills: [Fill(from: nil, to: 0, color: Brand.amber), Fill(from: 0, to: nil, color: Brand.green)],
                legend: [Key(color: Brand.green, label: "From the 3rd"), Key(color: Brand.amber, label: "Below 3rd")])
        case .wt:
            return GrowthChartModel(
                months: months, lines: lines,
                fills: [
                    Fill(from: nil, to: 0, color: Brand.amber), Fill(from: 0, to: last, color: Brand.green),
                    Fill(from: last, to: nil, color: Brand.amber),
                ],
                legend: [Key(color: Brand.green, label: "3rd–97th"), Key(color: Brand.amber, label: "Below 3rd / above 97th")])
        }
    }

    static func muac(_ sex: String) -> GrowthChartModel {
        let months = Array(stride(from: 60.0, through: 228, by: 2))
        let lines = sdLines { z in months.map { WhoBmi.valueAtZ(GrowthRefs.muacLmsAt(sex, $0), Double(z)) } }
        return GrowthChartModel(months: months, lines: lines, fills: lowFills, legend: lowLegend)
    }
}

struct GrowthChart: View {
    let model: GrowthChartModel
    let ageMonths: Double
    let value: Double

    var body: some View {
        Canvas { ctx, size in draw(ctx, size) }
    }

    private func draw(_ ctx: GraphicsContext, _ size: CGSize) {
        let months = model.months
        guard let start = months.first, let end = months.last, end > start,
              let lowest = model.lines.first?.values.min(), let highest = model.lines.last?.values.max() else { return }
        let padL: CGFloat = 30, padR: CGFloat = 36, padT: CGFloat = 8, padB: CGFloat = 20
        let cw = size.width - padL - padR, ch = size.height - padT - padB
        let lo0 = min(lowest, value), hi0 = max(highest, value)
        let margin = (hi0 - lo0) * 0.04
        let lo = lo0 - margin, hi = hi0 + margin
        func x(_ m: Double) -> CGFloat { padL + CGFloat((m - start) / (end - start)) * cw }
        func y(_ v: Double) -> CGFloat { padT + ch - CGFloat((v - lo) / (hi - lo)) * ch }
        let grid = Color.secondary.opacity(0.25)

        // Horizontal grid, labelled in the measure's own units.
        let span = hi - lo
        let step = span > 60 ? 10.0 : span > 24 ? 5.0 : span > 10 ? 2.0 : 1.0
        var g = (lo / step).rounded(.down) * step + step
        while g < hi {
            var p = Path(); p.move(to: CGPoint(x: padL, y: y(g))); p.addLine(to: CGPoint(x: padL + cw, y: y(g)))
            ctx.stroke(p, with: .color(grid), lineWidth: 0.5)
            ctx.draw(Text("\(Int(g))").font(.vh(.caption2)).foregroundColor(.secondary),
                     at: CGPoint(x: padL - 4, y: y(g)), anchor: .trailing)
            g += step
        }
        // Year ticks: every year up to 8 years' span, every other year past it.
        let y0 = Int(start / 12), y1 = Int(end / 12)
        for yr in stride(from: y0, through: y1, by: y1 - y0 > 8 ? 2 : 1) {
            let gx = x(Double(yr * 12))
            var p = Path(); p.move(to: CGPoint(x: gx, y: padT)); p.addLine(to: CGPoint(x: gx, y: padT + ch))
            ctx.stroke(p, with: .color(grid), lineWidth: 0.5)
            ctx.draw(Text("\(yr)y").font(.vh(.caption2)).foregroundColor(.secondary),
                     at: CGPoint(x: gx, y: size.height - 2), anchor: .bottom)
        }

        for b in model.fills {
            let from = b.from.map { model.lines[$0].values }, to = b.to.map { model.lines[$0].values }
            var p = Path()
            for (i, m) in months.enumerated() {
                let pt = CGPoint(x: x(m), y: y(from?[i] ?? lo))
                if i == 0 { p.move(to: pt) } else { p.addLine(to: pt) }
            }
            for i in months.indices.reversed() { p.addLine(to: CGPoint(x: x(months[i]), y: y(to?[i] ?? hi))) }
            p.closeSubpath()
            ctx.fill(p, with: .color(b.color.opacity(0.14)))
        }

        for line in model.lines {
            var p = Path()
            for (i, v) in line.values.enumerated() {
                let pt = CGPoint(x: x(months[i]), y: y(v))
                if i == 0 { p.move(to: pt) } else { p.addLine(to: pt) }
            }
            let dash: [CGFloat] = line.dashed ? [5, 4] : []
            ctx.stroke(p, with: .color(line.color ?? Color.secondary.opacity(0.6)),
                       style: StrokeStyle(lineWidth: line.bold ? 2.5 : 1.3, lineCap: .round, dash: dash))
        }

        // Line names at the right end, nudged apart where lines run close.
        let ends = model.lines.map { y($0.values.last ?? lo) }
        var placed = ends
        var prev = CGFloat.greatestFiniteMagnitude
        for i in ends.indices.sorted(by: { ends[$0] > ends[$1] }) {
            placed[i] = min(ends[i], prev - 10)
            prev = placed[i]
        }
        for (i, line) in model.lines.enumerated() {
            let font: Font = line.bold ? .caption2.bold() : .caption2
            ctx.draw(Text(line.label).font(font).foregroundColor(line.color ?? .secondary),
                     at: CGPoint(x: padL + cw + 4, y: placed[i]), anchor: .leading)
        }

        // The child: a guide at their age, and the dot.
        let c = CGPoint(x: x(min(max(ageMonths, start), end)), y: y(value))
        var guide = Path(); guide.move(to: CGPoint(x: c.x, y: padT)); guide.addLine(to: CGPoint(x: c.x, y: padT + ch))
        ctx.stroke(guide, with: .color(Brand.orange.opacity(0.5)), style: StrokeStyle(lineWidth: 1, dash: [4, 4]))
        ctx.fill(Path(ellipseIn: CGRect(x: c.x - 7, y: c.y - 7, width: 14, height: 14)), with: .color(Brand.orange))
        ctx.fill(Path(ellipseIn: CGRect(x: c.x - 3, y: c.y - 3, width: 6, height: 6)), with: .color(.white))
    }
}

// MARK: - The cards

/// One reference's view of a measure: its stats, its chart, its note.
struct ChartSide {
    struct Stat { let label: String; let value: String }
    let name: String
    let stats: [Stat]
    let model: GrowthChartModel
    let note: String
}

private struct StatusChip: View {
    let text: String
    var body: some View {
        let tone = growthClassColor(text)
        Text(text).font(.vh(.subheadline, .bold)).foregroundColor(tone)
            .padding(.horizontal, 12).padding(.vertical, 6)
            .background(tone.opacity(0.16)).clipShape(Capsule())
    }
}

/// One measure: IAP 2015 and WHO 2007 on a toggle, the way growth-chart apps
/// show them.
private struct MeasureCard: View {
    let title: String
    let value: String
    let cls: String
    let sides: [ChartSide]
    let ageMonths: Double
    let y: Double
    let note: String?

    @State private var pick = 0

    private var side: ChartSide? { sides.indices.contains(pick) ? sides[pick] : sides.first }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(title).font(.vh(.caption)).foregroundColor(.secondary)
                    Text(value).font(.vh(.headline))
                }
                Spacer()
                StatusChip(text: cls)
            }
            if sides.count > 1 {
                Picker(title, selection: $pick) {
                    ForEach(sides.indices, id: \.self) { i in Text(sides[i].name).tag(i) }
                }
                .pickerStyle(.segmented)
            } else if let side {
                Text(side.name).font(.vh(.caption, .bold)).foregroundColor(Brand.blue)
            }
            if let side { sideView(side) }
            if let note { Text(note).font(.vh(.footnote)).foregroundColor(.secondary) }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(growthClassColor(cls).opacity(0.07))
        .clipShape(RoundedRectangle(cornerRadius: 14))
    }

    @ViewBuilder
    private func sideView(_ side: ChartSide) -> some View {
        HStack {
            ForEach(side.stats.indices, id: \.self) { i in
                VStack(alignment: .leading, spacing: 2) {
                    Text(side.stats[i].label).font(.vh(.caption2)).foregroundColor(.secondary)
                    Text(side.stats[i].value).font(.vh(.subheadline, .bold))
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        GrowthChart(model: side.model, ageMonths: ageMonths, value: y).frame(height: 220)
        HStack(spacing: 12) {
            ForEach(side.model.legend.indices, id: \.self) { i in
                HStack(spacing: 4) {
                    RoundedRectangle(cornerRadius: 3).fill(side.model.legend[i].color.opacity(0.35))
                        .frame(width: 10, height: 10)
                    Text(side.model.legend[i].label).font(.vh(.caption2)).foregroundColor(.secondary)
                }
            }
        }
        Text(side.note).font(.vh(.footnote)).foregroundColor(.secondary)
    }
}

private let iapNote = "IAP 2015 Indian charts, 5–18 y. The lines are the printed centiles; the z-score is read between them."

private func iapSide(_ m: GrowthRefs.Measure, _ sex: String, _ r: GrowthRefs.IapReading, note: String = iapNote) -> ChartSide {
    ChartSide(name: "IAP 2015",
              stats: [.init(label: "Centile", value: r.band), .init(label: "z-score", value: signed(r.z)),
                      .init(label: "Percentile", value: pct(r.percentile))],
              model: .iap(m, sex), note: note)
}

private func whoSide(_ ind: WhoBmi.Indicator, _ sex: String, _ z: Double, _ p: Double, _ note: String) -> ChartSide {
    ChartSide(name: "WHO 2007",
              stats: [.init(label: "z-score", value: signed(z)), .init(label: "Percentile", value: pct(p))],
              model: .who(ind, sex), note: note)
}

/// Class from an IAP reading alone, where the WHO has no chart: outside the 3rd or 97th line.
private func iapClass(_ r: GrowthRefs.IapReading?) -> String {
    guard let r else { return "Normal" }
    if r.band.hasPrefix("below") { return "Below 3rd" }
    if r.band.hasPrefix("above") { return "Above 97th" }
    return "Normal"
}

/// Every growth chart for a child of 5 to 19, drawn as soon as the numbers are
/// in: height, weight and BMI on the IAP 2015 Indian charts and the WHO 2007
/// reference, and mid-arm circumference on the Mramba 2017 MUAC-for-age
/// reference. The nutritional status at the top is the WHO reading the server
/// saves, on the camp's cut-offs. Same panel as GrowthChartsPanel on Android.
struct GrowthChartsPanel: View {
    let reading: WhoBmi.Reading
    var muacCm: Double? = nil
    /// The clinician's growth form asks for BMI for age and nothing more.
    var bmiOnly = false

    private var r: WhoBmi.Reading { reading }
    private var rawBmi: Double { r.weightKg / pow(r.heightCm / 100, 2) }
    private var iapGone: String? {
        r.ageMonths < GrowthRefs.iapMinMonths || r.ageMonths >= GrowthRefs.iapMaxMonths + 1
            ? "The IAP charts run 5 to 18 years, so only the WHO chart is shown." : nil
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            statusCard
            if !bmiOnly {
                heightCard
                weightCard
            }
            bmiCard
            if !bmiOnly, let cm = muacCm, cm > 0 { muacCard(cm) }
        }
    }

    private var statusCard: some View {
        let years = Int(r.ageMonths / 12), months = Int(r.ageMonths - Double(years * 12))
        let who = r.sexUnknown ? "sex not recorded" : r.sex == "M" ? "Boy" : "Girl"
        var notes = ["WHO BMI-for-age: normal −2 to +2 SD; overweight above +2, obese above +3; "
            + "wasted below −2, severely wasted below −3. Stunted: height-for-age below −2 SD."]
        if r.sexUnknown { notes.append("Sex not recorded: read against both boys' and girls' curves, the more serious shown.") }
        if r.outsideRange { notes.append("Outside 5–19 years: read against the nearest end of the WHO reference.") }
        return VStack(alignment: .leading, spacing: 6) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Nutritional status · \(who), \(years)y \(months)m").font(.vh(.caption)).foregroundColor(.secondary)
                    Text(String(format: "BMI %.1f kg/m²", r.bmi)).font(.vh(.headline))
                }
                Spacer()
                StatusChip(text: r.status)
            }
            ForEach(notes, id: \.self) { Text($0).font(.vh(.footnote)).foregroundColor(.secondary) }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(growthClassColor(r.status).opacity(0.07))
        .clipShape(RoundedRectangle(cornerRadius: 14))
    }

    private var heightCard: some View {
        var sides: [ChartSide] = []
        if let h = GrowthRefs.iapReading(.ht, r.sex, r.ageMonths, r.heightCm) { sides.append(iapSide(.ht, r.sex, h)) }
        sides.append(whoSide(.hfa, r.sex, r.heightZ, r.heightPercentile,
                             "WHO 2007, 5–19 y. Stunted below −2 SD, severely stunted below −3 SD."))
        return MeasureCard(
            title: "Height-for-age", value: String(format: "%.1f cm", r.heightCm), cls: heightClass(r.heightZ),
            sides: sides, ageMonths: r.ageMonths, y: r.heightCm, note: iapGone)
    }

    /// Weight. The WHO's weight-for-age stops at 10.
    private var weightCard: some View {
        let iapW = GrowthRefs.iapReading(.wt, r.sex, r.ageMonths, r.weightKg)
        var sides: [ChartSide] = []
        if let iapW { sides.append(iapSide(.wt, r.sex, iapW)) }
        if let wz = r.weightZ, let wp = r.weightPercentile {
            sides.append(whoSide(.wfa, r.sex, wz, wp,
                                 "WHO 2007, 5–10 y. Underweight below −2 SD, severely below −3 SD. "
                                 + "Above +2 SD, read BMI-for-age for overweight."))
        }
        let note: String?
        if r.weightZ == nil && iapW == nil {
            note = "No weight-for-age chart at this age: the WHO's ends at 10 years and the IAP's at 18. BMI-for-age is the measure."
        } else if r.weightZ == nil {
            note = "The WHO's weight-for-age chart ends at 10 years; BMI-for-age is the WHO measure from 10."
        } else {
            note = iapGone
        }
        return MeasureCard(
            title: "Weight-for-age", value: String(format: "%.1f kg", r.weightKg),
            cls: r.weightZ.map(weightClass) ?? iapClass(iapW),
            sides: sides, ageMonths: r.ageMonths, y: r.weightKg, note: note)
    }

    private var bmiCard: some View {
        var sides: [ChartSide] = []
        if let b = GrowthRefs.iapReading(.bmi, r.sex, r.ageMonths, rawBmi) {
            sides.append(iapSide(.bmi, r.sex, b, note: iapNote
                + " 23 AE and 27 AE are the lines that meet adult BMI 23 (overweight) and 27 (obese) at 18."))
        }
        sides.append(whoSide(.bfa, r.sex, r.bmiZ, r.bmiPercentile,
                             "WHO 2007, 5–19 y. The nutritional status above is read from this chart."))
        return MeasureCard(
            title: "BMI-for-age", value: String(format: "%.1f kg/m²", r.bmi), cls: r.bmiClass,
            sides: sides, ageMonths: r.ageMonths, y: rawBmi, note: iapGone)
    }

    private func muacCard(_ cm: Double) -> MeasureCard {
        let age = r.ageMonths
        // Sex not recorded: the lower of the two readings, as the clinical rules do.
        var sex = r.sex
        var read = GrowthRefs.muacReading(r.sex, age, cm)
        if r.sexUnknown, let m = GrowthRefs.muacReading("M", age, cm), let f = GrowthRefs.muacReading("F", age, cm) {
            if f.z < m.z {
                sex = "F"; read = f
            } else {
                sex = "M"; read = m
            }
        }
        let value = String(format: "%.1f cm", cm)
        guard let reading = read else {
            let under5 = age < GrowthRefs.muacMinMonths
            return MeasureCard(
                title: "Mid-arm circumference", value: value,
                cls: under5 ? GrowthRefs.muacClassUnderFive(cm) : "Not read",
                sides: [], ageMonths: age, y: cm,
                note: under5 ? "Under 5: the WHO's cut-offs, low below 12.5 cm, severely low below 11.5 cm."
                    : "The MUAC-for-age reference ends at 19 years.")
        }
        return MeasureCard(
            title: "Mid-arm circumference-for-age", value: value, cls: GrowthRefs.muacClass(reading.z),
            sides: [ChartSide(name: "Mramba 2017",
                              stats: [.init(label: "z-score", value: signed(reading.z)),
                                      .init(label: "Percentile", value: pct(reading.percentile))],
                              model: .muac(sex),
                              note: "MUAC-for-age, 5–19 y (BMJ 2017). Low below −2 SD, severely low below −3 SD.")],
            ageMonths: age, y: cm, note: nil)
    }
}
