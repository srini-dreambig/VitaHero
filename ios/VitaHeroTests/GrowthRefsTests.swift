import XCTest

// The app's copy of the IAP 2015 charts and the Mramba 2017 MUAC-for-age
// reference, held to the same printed rows functions/growthrefs.test.ts checks.
// GrowthRefs.swift and GrowthRefTables.swift are compiled straight into this target.

final class GrowthRefsTests: XCTestCase {

    func testIapLinesAreThePrintedCentiles() {
        // Khadilkar et al., Indian Pediatr 2015, Tables II-VII.
        XCTAssertEqual(GrowthRefs.linesAt(.ht, "M", 120), [123.6, 128.1, 132.6, 137.2, 141.9, 146.6, 151.4])
        XCTAssertEqual(GrowthRefs.linesAt(.wt, "F", 150), [27.6, 31.6, 36.3, 41.8, 48.2, 55.8, 64.8])
        XCTAssertEqual(GrowthRefs.linesAt(.bmi, "M", 96), [12.5, 12.8, 13.3, 14.2, 15.5, 16.7, 18.8])
    }

    func testOnTheFiftiethIsZeroAndTheBandNamesTheLines() {
        let r = GrowthRefs.iapReading(.ht, "M", 120, 137.2)!
        XCTAssertEqual(r.z, 0)
        XCTAssertEqual(r.percentile, 50)
        XCTAssertEqual(r.band, "50th–75th")
        XCTAssertEqual(GrowthRefs.band(.ht, "M", 120, 135), "25th–50th")
        XCTAssertEqual(GrowthRefs.band(.ht, "M", 120, 120), "below 3rd")
        XCTAssertEqual(GrowthRefs.band(.bmi, "M", 96, 19), "above the 27 AE line")
        XCTAssertEqual(GrowthRefs.band(.bmi, "F", 180, 23), "23 AE–27 AE")
    }

    func testNoIapReadingUnderFiveOrPastEighteen() {
        XCTAssertNil(GrowthRefs.iapReading(.ht, "M", 59, 110))
        XCTAssertNil(GrowthRefs.iapReading(.ht, "M", 217, 170))
    }

    func testMuacMedianIsZeroAndLowCutOffs() {
        let r = GrowthRefs.muacReading("M", 120, 19.90962018)!
        XCTAssertEqual(r.z, 0)
        XCTAssertEqual(r.percentile, 50)
        let low = GrowthRefs.muacReading("M", 126, 15.8)!
        XCTAssertEqual(GrowthRefs.muacClass(low.z), "Low")
        XCTAssertEqual(GrowthRefs.muacClass(GrowthRefs.muacReading("M", 126, 13)!.z), "Severely low")
        XCTAssertEqual(GrowthRefs.muacClassUnderFive(11.4), "Severely low")
        XCTAssertEqual(GrowthRefs.muacClassUnderFive(12.0), "Low")
        XCTAssertNil(GrowthRefs.muacReading("M", 59, 14))
    }
}
