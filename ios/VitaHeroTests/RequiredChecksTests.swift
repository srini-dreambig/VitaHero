import XCTest

// The app's copy of the required-field rules, held to the server's tests
// (functions/required-checks.test.ts) and to the Android form's gap check.
// RequiredChecks.swift is compiled straight into this target, so no app host
// is needed.

final class RequiredChecksTests: XCTestCase {

    // MARK: missingRequired, as on the server

    func testMissingWeightIsNamed() {
        XCTAssertEqual(
            RequiredChecks.missingRequired("Height & weight", ["heightCm": "120"]),
            "Height & weight: Weight (kg) is required"
        )
    }

    func testHeightOutOfRangeIsRefused() {
        let message = RequiredChecks.missingRequired("Height & weight", ["heightCm": "1200", "weightKg": "20"])
        XCTAssertTrue(message.contains("Height (cm) must be a number from 40 to 200"), message)
    }

    func testMissingLeftAcuityIsNamed() {
        let message = RequiredChecks.missingRequired("Vision", ["rightAcuity": "6/6"])
        XCTAssertTrue(message.contains("Left eye acuity is required"), message)
    }

    func testCompleteDentalPasses() {
        XCTAssertEqual(
            RequiredChecks.missingRequired("Dental", ["cariesCount": "0", "gums": "Healthy", "hygiene": "Good"]),
            ""
        )
    }

    func testTwoBlanksAreJoinedWithAre() {
        XCTAssertEqual(
            RequiredChecks.missingRequired("ENT", [:]),
            "ENT: Right ear hearing, Left ear hearing are required"
        )
    }

    func testRangesMatchTheServer() {
        XCTAssertTrue(RequiredChecks.missingRequired("Haemoglobin", ["hb": "2.9"]).contains("from 3 to 20"))
        XCTAssertEqual(RequiredChecks.missingRequired("Haemoglobin", ["hb": "11.5"]), "")
        XCTAssertTrue(RequiredChecks.missingRequired("Height & weight", ["heightCm": "120", "weightKg": "151"])
            .contains("Weight (kg) must be a number from 5 to 150"))
        XCTAssertTrue(RequiredChecks.missingRequired("Dental", ["cariesCount": "33", "gums": "Healthy", "hygiene": "Good"])
            .contains("must be a number from 0 to 32"))
    }

    func testCheckWithoutRequiredFieldsPasses() {
        XCTAssertEqual(RequiredChecks.missingRequired("Something new", [:]), "")
    }

    // MARK: screeningGaps, as on Android

    func testUntouchedCheckNamesItsRequiredFields() {
        let gaps = RequiredChecks.screeningGaps(checks: ["Skin"], values: [:], alreadyRecorded: [])
        XCTAssertEqual(gaps, ["Skin: Primary skin finding"])
    }

    func testUntouchedCheckWithoutRequiredFieldsSaysNothingRecorded() {
        let gaps = RequiredChecks.screeningGaps(checks: ["Something new"], values: [:], alreadyRecorded: [])
        XCTAssertEqual(gaps, ["Something new: nothing recorded"])
    }

    func testUntouchedCheckAlreadyRecordedPasses() {
        let gaps = RequiredChecks.screeningGaps(checks: ["Dental"], values: [:], alreadyRecorded: ["Dental"])
        XCTAssertEqual(gaps, [])
    }

    func testPartlyFilledCheckNamesWhatIsMissing() {
        let gaps = RequiredChecks.screeningGaps(
            checks: ["Height & weight", "Dental"],
            values: ["Height & weight": ["heightCm": "120"], "Dental": ["gums": "Healthy"]],
            alreadyRecorded: []
        )
        XCTAssertEqual(gaps, ["Height & weight: Weight", "Dental: Carious count, Oral hygiene"])
    }

    func testNotDoneNeedsAReason() {
        let gaps = RequiredChecks.screeningGaps(
            checks: ["Vision"],
            values: ["Vision": [RequiredChecks.notDone: "true", RequiredChecks.notDoneReason: "  "]],
            alreadyRecorded: []
        )
        XCTAssertEqual(gaps, ["Vision: say why it could not be done"])
    }

    func testNotDoneWithAReasonPasses() {
        let gaps = RequiredChecks.screeningGaps(
            checks: ["Vision"],
            values: ["Vision": [RequiredChecks.notDone: "true", RequiredChecks.notDoneReason: "Child unwell"]],
            alreadyRecorded: []
        )
        XCTAssertEqual(gaps, [])
    }

    func testFalseAloneDoesNotCountAsTouched() {
        let gaps = RequiredChecks.screeningGaps(
            checks: ["Something new"],
            values: ["Something new": ["squint": "false", RequiredChecks.notDone: "false"]],
            alreadyRecorded: []
        )
        XCTAssertEqual(gaps, ["Something new: nothing recorded"])
    }

    func testGapMessageWording() {
        XCTAssertEqual(
            RequiredChecks.gapMessage(["Skin: Primary skin finding", "Vision: say why it could not be done"]),
            "Not saved. Still required — Skin: Primary skin finding; Vision: say why it could not be done. " +
                "Fill these in, or tick Could not be done and give the reason."
        )
        XCTAssertEqual(RequiredChecks.gapMessage([]), "")
    }

    // MARK: What goes up

    func testNotDoneGoesAsNotMeasuredWithTheReason() {
        let sent = RequiredChecks.findings(
            order: ["Vision"],
            values: ["Vision": [RequiredChecks.notDone: "true", RequiredChecks.notDoneReason: " No chart ", "rightAcuity": "6/6"]],
            note: ""
        )
        XCTAssertEqual(sent.count, 1)
        XCTAssertEqual(sent[0]["flag"] as? String, "NOT_MEASURED")
        XCTAssertEqual(sent[0]["note"] as? String, "No chart")
        XCTAssertNil(sent[0]["detail"])
    }

    func testReadingsGoWithoutAFlag() {
        let sent = RequiredChecks.findings(
            order: ["Dental"],
            values: ["Dental": ["cariesCount": "2", "gums": "Healthy", "hygiene": "Good", "pain": "true", "trauma": "false", "__x": "y", "missingCount": ""]],
            note: ""
        )
        XCTAssertEqual(sent.count, 1)
        XCTAssertNil(sent[0]["flag"])
        let detail = sent[0]["detail"] as? [String: Any] ?? [:]
        XCTAssertEqual(detail["cariesCount"] as? String, "2")
        XCTAssertEqual(detail["pain"] as? Bool, true)
        XCTAssertEqual(detail["trauma"] as? Bool, false)
        XCTAssertNil(detail["__x"])
        XCTAssertNil(detail["missingCount"])
    }

    func testOnlyFalseValuesAreNotSent() {
        let sent = RequiredChecks.findings(order: [], values: ["Systemic": ["incubationStay": "false"]], note: "")
        XCTAssertTrue(sent.isEmpty)
    }

    func testRangeProblemsSkipNotDoneAndUntouched() {
        let problems = RequiredChecks.rangeProblems(
            checks: ["Height & weight", "Haemoglobin", "Vision"],
            values: [
                "Height & weight": ["heightCm": "12", "weightKg": "20"],
                "Haemoglobin": [RequiredChecks.notDone: "true", RequiredChecks.notDoneReason: "No kit", "hb": "99"],
            ]
        )
        XCTAssertEqual(problems, ["Height & weight: Height (cm) must be a number from 40 to 200"])
    }
}
