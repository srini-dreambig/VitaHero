import XCTest

// The not-done mapping, held to the console's cleanDetail and formFromFinding
// (functions/portal.ts) and to the server's notDone handling in camps.ts.

final class ScreeningRecordTests: XCTestCase {

    func testNotDoneSendsWhatWasSeen() {
        let findings = ScreeningRecord.findings(
            order: ["Haemoglobin"],
            values: ["Haemoglobin": [
                RequiredChecks.notDone: "true", RequiredChecks.notDoneReason: "  No Hb meter ",
                "pallor": "Severe", "hb": "", "squint": "false",
            ]],
            note: ""
        )
        XCTAssertEqual(findings.count, 1)
        XCTAssertEqual(findings[0]["flag"] as? String, "NOT_MEASURED")
        XCTAssertEqual(findings[0]["note"] as? String, "No Hb meter")
        let detail = findings[0]["detail"] as? [String: Any]
        XCTAssertEqual(detail?.count, 1)
        XCTAssertEqual(detail?["pallor"] as? String, "Severe")
    }

    func testNotDoneWithNothingSeenSendsEmptyDetail() {
        let findings = ScreeningRecord.findings(
            order: ["Vision"],
            values: ["Vision": [RequiredChecks.notDone: "true", RequiredChecks.notDoneReason: "Child unwell"]],
            note: ""
        )
        XCTAssertEqual((findings.first?["detail"] as? [String: Any])?.count, 0)
    }

    func testDoneCheckIsUnchanged() {
        let values = ["Haemoglobin": ["hb": "11.2", "squint": "true"]]
        let mine = ScreeningRecord.findings(order: ["Haemoglobin"], values: values, note: "n")
        let base = RequiredChecks.findings(order: ["Haemoglobin"], values: values, note: "n")
        XCTAssertEqual(mine.count, base.count)
        XCTAssertNil(mine[0]["flag"])
        let detail = mine[0]["detail"] as? [String: Any]
        XCTAssertEqual(detail?["hb"] as? String, "11.2")
        XCTAssertEqual(detail?["squint"] as? Bool, true)
    }

    func testRestoreFromServerNotDoneMark() {
        let fields = ScreeningRecord.restore(flag: "ALERT", note: "No Hb meter",
                                             detail: ["notDone": "true", "pallor": "Severe"])
        XCTAssertEqual(fields[RequiredChecks.notDone], "true")
        XCTAssertEqual(fields[RequiredChecks.notDoneReason], "No Hb meter")
        XCTAssertEqual(fields["pallor"], "Severe")
        XCTAssertNil(fields["notDone"])
    }

    func testRestoreFromNotMeasuredWithReason() {
        let fields = ScreeningRecord.restore(flag: "NOT_MEASURED", note: "Refused", detail: [:])
        XCTAssertEqual(fields[RequiredChecks.notDone], "true")
        XCTAssertEqual(fields[RequiredChecks.notDoneReason], "Refused")
    }

    func testRestoreOrdinaryFindingKeepsDetail() {
        let fields = ScreeningRecord.restore(flag: "GOOD", note: "", detail: ["hb": "12"])
        XCTAssertEqual(fields, ["hb": "12"])
    }
}
