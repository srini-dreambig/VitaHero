import XCTest

// The app's copy of the WHO 2007 BMI-for-age reading, held to the WHO's own
// worked survey (functions/who2007-oracle.json, all 933 children of which the
// server's who2007.test.ts checks). These rows cover both sexes, the middle of
// the curve, and the restricted readings beyond +3 and -3 SD. WhoBmi.swift and
// WhoTables.swift are compiled straight into this target.

final class WhoBmiTests: XCTestCase {

    // sex (1 boy, 2 girl), age in months, weight kg, height cm, WHO height z, WHO BMI z
    private let survey: [(Int, Double, Double, Double, Double, Double)] = [
        (1, 188.57, 126.4, 171.4, -0.07, 4.21),
        (1, 149.48, 77.2, 156.1, 0.55, 3.14),
        (1, 144.13, 27.7, 145.2, -0.56, -3.24),
        (1, 174.08, 42.2, 171.7, 0.69, -3.14),
        (1, 166.59, 50.7, 153.7, -1.13, 0.94),
        (1, 80.65, 18.8, 114.6, -1.07, -0.87),
        (2, 133.88, 46.5, 144.3, -0.25, 1.65),
        (1, 212.19, 73.9, 160.8, -2.01, 1.9),
    ]

    func testMatchesTheWhoSurveyToTwoDecimals() {
        for (sex, age, w, h, zh, zb) in survey {
            let s = sex == 1 ? "M" : "F"
            XCTAssertEqual(WhoBmi.round2(WhoBmi.z(.bfa, s, age, w / pow(h / 100, 2))), zb, "BMI z at \(age)")
            XCTAssertEqual(WhoBmi.round2(WhoBmi.z(.hfa, s, age, h)), zh, "height z at \(age)")
        }
    }

    func testTheMedianIsTheWhoM() {
        XCTAssertEqual(WhoBmi.lmsAt(.bfa, "M", 120).m, 16.4433, accuracy: 1e-4)
        XCTAssertEqual(WhoBmi.percentileOf(0), 50)
    }

    func testCutOffsAreStrict() {
        XCTAssertEqual(WhoBmi.bmiClass(-3.01), "Severely wasted")
        XCTAssertEqual(WhoBmi.bmiClass(-3), "Wasted")
        XCTAssertEqual(WhoBmi.bmiClass(-2), "Normal")
        XCTAssertEqual(WhoBmi.bmiClass(2), "Normal")
        XCTAssertEqual(WhoBmi.bmiClass(2.01), "Overweight")
        XCTAssertEqual(WhoBmi.bmiClass(3), "Overweight")
        XCTAssertEqual(WhoBmi.bmiClass(3.01), "Obese")
    }

    func testAge() {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "UTC")!
        let on = cal.date(from: DateComponents(year: 2026, month: 11, day: 2))!
        XCTAssertEqual(WhoBmi.ageInMonths(dob: "2016-11-02", ageYears: nil, on: on)!, 120, accuracy: 0.1)
        XCTAssertEqual(WhoBmi.ageInMonths(dob: "02/11/2016", ageYears: nil, on: on)!, 120, accuracy: 0.1)
        XCTAssertEqual(WhoBmi.ageInMonths(dob: "", ageYears: 10, on: on), 126)
        XCTAssertNil(WhoBmi.ageInMonths(dob: "", ageYears: 0, on: on))
        XCTAssertNil(WhoBmi.parseDob("31-02-2016"))
    }

    func testAnObeseTenYearOldBoy() {
        let r = WhoBmi.reading(heightCm: 120, weightKg: 42, sex: "M", ageMonths: 120)!
        XCTAssertEqual(r.status, "Obese")
        XCTAssertGreaterThan(r.bmiZ, 3)
    }

    func testAnOverweightTenYearOldBoy() {
        let r = WhoBmi.reading(heightCm: 140, weightKg: 45, sex: "M", ageMonths: 120)!
        XCTAssertEqual(r.status, "Overweight")
    }
}
