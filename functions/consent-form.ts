// E1 — the paper a school hands out.
//
// The programme already had two ways to take consent: the guardian answers in
// the app, or the school marks a paper slip as received. The second one had no
// paper. Somebody had to write it, and whatever they wrote would ask different
// questions from the app — which is how a school ends up holding a signature
// for something the child was never asked about.
//
// So the form is generated here, from the camp row, and its wording is the
// app's wording. Not "similar to": the same strings, keyed the same way, with
// consent-form.test.ts reading LocaleStrings.kt and failing if the two ever
// part company. Change the question in the app and this form changes with it
// or the build stops.
//
// It prints one page per child, pre-filled with their name and class, so a
// class teacher can hand out a stack and key the answers back in as PAPER.

import { Sql } from "./common";
import { Actor, ApiError } from "./schools";
import { assertCampAccess } from "./camps";

/**
 * The app's own consent copy, in the app's three languages.
 *
 * Kept as the app's keys rather than prose so the gate can compare them one
 * for one. A locale the app has not translated falls back to English there and
 * falls back to English here, for the same reason: a half-translated form is
 * worse than an English one.
 */
export const CONSENT_COPY: Record<string, Record<string, string>> = {
  en: {
    campConsentSub: "The school is asking to check your child",
    consentChecksTitle: "What will be checked",
    consentChecksHint:
      "Untick anything you do not want done. Your child will still get the rest.",
    consentGrant: "Yes, go ahead",
    campConsentDecline: "No, not this time",
    consentDeadlineMsg: "Please answer by %s.",
    consentChangeMind:
      "You can change your mind at any time, before or after the camp.",
    photoConsentTitle: "Photographs",
    photoConsentBody:
      "At this camp the doctor may want to photograph something they find — a rash, or an eye. This is a separate question. You can say yes to the check-up and no to photographs.",
    photoConsentAgree: "Photographs are allowed",
  },
  hi: {
    campConsentSub: "स्कूल आपके बच्चे की जाँच की अनुमति माँग रहा है",
    consentChecksTitle: "क्या-क्या जाँचा जाएगा",
    consentChecksHint: "जो नहीं करवाना चाहते उसे हटा दें। बाकी जाँचें फिर भी होंगी।",
    consentGrant: "हाँ, कर सकते हैं",
    campConsentDecline: "नहीं, इस बार नहीं",
    consentDeadlineMsg: "कृपया %s तक जवाब दें।",
    consentChangeMind: "आप कभी भी अपना निर्णय बदल सकते हैं — कैंप से पहले या बाद में।",
    photoConsentTitle: "फ़ोटो",
    photoConsentBody: "इस कैंप में डॉक्टर जो मिले उसकी फ़ोटो लेना चाह सकते हैं — जैसे कोई चकत्ता या आँख। यह अलग सवाल है। आप जाँच के लिए हाँ और फ़ोटो के लिए ना कह सकते हैं।",
    photoConsentAgree: "फ़ोटो लेने की अनुमति है",
  },
  te: {
    campConsentSub: "మీ బిడ్డను పరీక్షించడానికి పాఠశాల అనుమతి అడుగుతోంది",
    consentChecksTitle: "ఏమి పరీక్షిస్తారు",
    consentChecksHint: "మీకు వద్దనుకున్నదాన్ని తీసివేయండి. మిగతా పరీక్షలు మామూలుగానే జరుగుతాయి.",
    consentGrant: "అవును, చేయవచ్చు",
    campConsentDecline: "వద్దు, ఈసారి కాదు",
    consentDeadlineMsg: "దయచేసి %s లోపు సమాధానం ఇవ్వండి.",
    consentChangeMind: "మీరు ఎప్పుడైనా మీ నిర్ణయాన్ని మార్చుకోవచ్చు — శిబిరానికి ముందు లేదా తర్వాత.",
    photoConsentTitle: "ఫోటోలు",
    photoConsentBody: "ఈ శిబిరంలో డాక్టర్ కనిపించిన దానిని ఫోటో తీయాలనుకోవచ్చు — దద్దుర్లు లేదా కన్ను. ఇది వేరే ప్రశ్న. మీరు పరీక్షకు అవును అని, ఫోటోలకు వద్దని చెప్పవచ్చు.",
    photoConsentAgree: "ఫోటోలు తీయడానికి అనుమతి ఉంది",
  },
};

/**
 * Wording that exists only on paper, so it has no key in the app.
 *
 * The app knows who is signing — it is the guardian who signed in. Paper does
 * not, so the slip has to ask, and has to say where to send it back.
 */
const PAPER_COPY: Record<string, Record<string, string>> = {
  en: {
    heading: "Health check-up — permission slip",
    child: "Child",
    className: "Class",
    studentRef: "Student ID",
    when: "When",
    where: "Where",
    guardianName: "Parent or guardian (please print)",
    guardianPhone: "Mobile number",
    signature: "Signature",
    signedOn: "Date",
    tickOne: "Tick one",
    perCheck: "Yes / No against each check below",
    yes: "Yes",
    no: "No",
    returnTo: "Please return this slip to the class teacher.",
    alsoInApp:
      "You can also answer in the VitaHero app on your phone, and you do not need to do both.",
    office: "School use only",
    recordedBy: "Recorded by",
  },
  hi: {
    heading: "स्वास्थ्य जाँच — अनुमति पर्ची",
    child: "बच्चा",
    className: "कक्षा",
    studentRef: "छात्र आईडी",
    when: "कब",
    where: "कहाँ",
    guardianName: "माता-पिता या अभिभावक (साफ़ अक्षरों में)",
    guardianPhone: "मोबाइल नंबर",
    signature: "हस्ताक्षर",
    signedOn: "तारीख़",
    tickOne: "एक पर निशान लगाएँ",
    perCheck: "नीचे हर जाँच के सामने हाँ / ना",
    yes: "हाँ",
    no: "ना",
    returnTo: "यह पर्ची कक्षा अध्यापक को लौटा दें।",
    alsoInApp: "आप अपने फ़ोन पर VitaHero ऐप में भी जवाब दे सकते हैं। दोनों करने की ज़रूरत नहीं।",
    office: "केवल स्कूल के उपयोग के लिए",
    recordedBy: "दर्ज किया",
  },
  te: {
    heading: "ఆరోగ్య పరీక్ష — అనుమతి పత్రం",
    child: "బిడ్డ",
    className: "తరగతి",
    studentRef: "విద్యార్థి ఐడీ",
    when: "ఎప్పుడు",
    where: "ఎక్కడ",
    guardianName: "తల్లిదండ్రులు లేదా సంరక్షకులు (స్పష్టంగా)",
    guardianPhone: "మొబైల్ నంబరు",
    signature: "సంతకం",
    signedOn: "తేదీ",
    tickOne: "ఒకదాన్ని ఎంచుకోండి",
    perCheck: "క్రింది ప్రతి పరీక్ష పక్కన అవును / కాదు",
    yes: "అవును",
    no: "కాదు",
    returnTo: "ఈ పత్రాన్ని తరగతి ఉపాధ్యాయుడికి తిరిగి ఇవ్వండి.",
    alsoInApp: "మీ ఫోన్‌లో VitaHero యాప్‌లో కూడా సమాధానం ఇవ్వవచ్చు. రెండూ చేయనక్కర్లేదు.",
    office: "పాఠశాల ఉపయోగం కోసం మాత్రమే",
    recordedBy: "నమోదు చేసినవారు",
  },
};

export const CONSENT_FORM_LANGS = Object.keys(CONSENT_COPY);

/** The app falls back to English for an untranslated key; so does the paper. */
function copy(lang: string, key: string): string {
  const table = CONSENT_COPY[lang] || CONSENT_COPY.en;
  return table[key] || CONSENT_COPY.en[key] || "";
}

function paper(lang: string, key: string): string {
  const table = PAPER_COPY[lang] || PAPER_COPY.en;
  return table[key] || PAPER_COPY.en[key] || "";
}

function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const STYLE = `
  @page { size: A4; margin: 14mm 12mm; }
  * { box-sizing: border-box; }
  body { font-family: "Noto Sans", -apple-system, "Segoe UI", Roboto, sans-serif;
         margin: 0; color: #111; font-size: 11.5pt; line-height: 1.5; background: #fff; }
  .slip { page-break-after: always; padding: 0 0 6mm; }
  .slip:last-child { page-break-after: auto; }
  .top { display: flex; justify-content: space-between; align-items: flex-start;
         border-bottom: 2px solid #111; padding-bottom: 5px; margin-bottom: 10px; }
  .brand { font-weight: 700; letter-spacing: .02em; }
  .school { text-align: right; font-size: 10.5pt; }
  h1 { font-size: 14pt; margin: 0 0 2px; }
  .sub { color: #444; margin: 0 0 10px; }
  table.facts { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
  table.facts td { padding: 3px 6px 3px 0; vertical-align: top; }
  table.facts td.k { color: #555; width: 30%; white-space: nowrap; }
  table.facts td.v { font-weight: 600; }
  h2 { font-size: 11.5pt; margin: 12px 0 2px; }
  .hint { color: #555; font-size: 10pt; margin: 0 0 6px; }
  table.checks { width: 100%; border-collapse: collapse; }
  table.checks th, table.checks td { border: 1px solid #999; padding: 5px 7px; text-align: left; }
  table.checks th { background: #f0f0f0; font-size: 10pt; }
  table.checks td.tick { width: 16mm; text-align: center; }
  .box { display: inline-block; width: 5mm; height: 5mm; border: 1.5px solid #111; }
  .photo { border: 1px solid #999; padding: 8px 10px; margin-top: 10px; }
  .photo .t { font-weight: 700; }
  .photo .b { font-size: 10pt; color: #333; margin: 3px 0 6px; }
  .decide { margin-top: 12px; }
  .decide .opt { display: inline-block; margin-right: 18px; }
  .sign { margin-top: 14px; }
  .sign .line { display: inline-block; border-bottom: 1px solid #111; min-width: 55mm; height: 16px; }
  .sign td { padding: 10px 10px 0 0; font-size: 10pt; color: #444; }
  .foot { margin-top: 12px; font-size: 9.5pt; color: #444; }
  .office { margin-top: 10px; border-top: 1px dashed #999; padding-top: 6px;
            font-size: 9.5pt; color: #444; }
  .none { padding: 40px; text-align: center; color: #555; }
  @media screen {
    body { background: #e9ecec; padding: 16px; }
    .slip { background: #fff; max-width: 210mm; margin: 0 auto 16px; padding: 16mm 14mm; }
  }
`;

type Row = Record<string, unknown>;

function slip(
  lang: string,
  camp: Row,
  checks: string[],
  p: Row,
): string {
  const t = (k: string) => esc(copy(lang, k));
  const pp = (k: string) => esc(paper(lang, k));
  const when = [camp.date, camp.time].map((v) => String(v || "")).filter(Boolean).join(" · ");
  const klass = [p.grade, p.section].map((v) => String(v || "")).filter(Boolean).join(" ");
  const deadline = String(camp.consent_deadline || "");
  const deadlineLine = deadline
    ? `<p class="foot">${esc(copy(lang, "consentDeadlineMsg").replace("%s", deadline))}</p>`
    : "";

  const rows = checks
    .map(
      (c) => `<tr><td>${esc(c)}</td>
        <td class="tick"><span class="box"></span></td>
        <td class="tick"><span class="box"></span></td></tr>`,
    )
    .join("");

  const photoBlock = camp.photos_enabled === true
    ? `<div class="photo">
         <div class="t">${t("photoConsentTitle")}</div>
         <div class="b">${t("photoConsentBody")}</div>
         <div><span class="box"></span>&nbsp; ${t("photoConsentAgree")}</div>
       </div>`
    : "";

  return `<section class="slip">
  <div class="top">
    <div class="brand">VitaHero</div>
    <div class="school">${esc(camp.school_name)}${camp.school_city ? `<br>${esc(camp.school_city)}` : ""}</div>
  </div>
  <h1>${pp("heading")}</h1>
  <p class="sub">${t("campConsentSub")}</p>
  <table class="facts">
    <tr><td class="k">${pp("child")}</td><td class="v">${esc(p.name)}</td></tr>
    ${klass ? `<tr><td class="k">${pp("className")}</td><td class="v">${esc(klass)}</td></tr>` : ""}
    ${p.student_ref ? `<tr><td class="k">${pp("studentRef")}</td><td class="v">${esc(p.student_ref)}</td></tr>` : ""}
    ${when ? `<tr><td class="k">${pp("when")}</td><td class="v">${esc(when)}</td></tr>` : ""}
    ${camp.venue ? `<tr><td class="k">${pp("where")}</td><td class="v">${esc(camp.venue)}</td></tr>` : ""}
  </table>

  <h2>${t("consentChecksTitle")}</h2>
  <p class="hint">${t("consentChecksHint")} ${pp("perCheck")}.</p>
  <table class="checks">
    <thead><tr><th></th><th class="tick">${pp("yes")}</th><th class="tick">${pp("no")}</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>

  ${photoBlock}

  <div class="decide">
    <strong>${pp("tickOne")}:</strong>
    <span class="opt"><span class="box"></span>&nbsp; ${t("consentGrant")}</span>
    <span class="opt"><span class="box"></span>&nbsp; ${t("campConsentDecline")}</span>
  </div>

  <table class="sign">
    <tr>
      <td>${pp("guardianName")}<br><span class="line"></span></td>
      <td>${pp("guardianPhone")}<br><span class="line"></span></td>
    </tr>
    <tr>
      <td>${pp("signature")}<br><span class="line"></span></td>
      <td>${pp("signedOn")}<br><span class="line"></span></td>
    </tr>
  </table>

  ${deadlineLine}
  <p class="foot">${t("consentChangeMind")}</p>
  <p class="foot">${pp("returnTo")} ${pp("alsoInApp")}</p>
  <div class="office">${pp("office")} — ${pp("recordedBy")}: <span class="line"></span></div>
</section>`;
}

/**
 * E1 — the printable consent form for a camp.
 *
 * Scoped to whoever may run the camp, not to whoever may read a finding: this
 * is a roster of children's names and their guardians' business, which is the
 * school office's job and nobody else's.
 *
 * `only` defaults to the children who have not answered yet, because the thing
 * a school actually wants is the stack for the ones still outstanding, not a
 * re-print for the whole class.
 */
export async function campConsentForm(
  sql: Sql,
  actor: Actor,
  campId: string,
  opts: { lang?: string; only?: string } = {},
): Promise<string> {
  const access = await assertCampAccess(sql, actor, campId);
  if (!access.canSchedule) {
    throw new ApiError(403, "You do not have permission to run this camp", "FORBIDDEN");
  }
  const camp = access.camp;
  const lang = CONSENT_COPY[String(opts.lang || "en")] ? String(opts.lang) : "en";
  const only = String(opts.only || "pending").toLowerCase();

  const checks: string[] = Array.isArray(camp.checks)
    ? (camp.checks as string[])
    : JSON.parse(String(camp.checks || "[]"));

  const pendingOnly = only !== "all";
  const rows = await sql`
    SELECT k.name, k.grade, k.section, k.student_ref
    FROM vita_hero.camp_participants p
    JOIN vita_hero.kids k ON k.id = p.kid_id
    WHERE p.camp_id = ${campId}
      AND (${!pendingOnly} OR p.consent_status = 'PENDING')
    ORDER BY k.grade, k.section, k.name
  `;

  const title = `${paper(lang, "heading")} — ${String(camp.title || "")}`;
  const body = rows.length === 0
    ? `<div class="none">Nobody on this roster is still waiting to answer. Ask for the whole roster instead if you need a fresh set of slips.</div>`
    : rows.map((p) => slip(lang, camp, checks, p)).join("\n");

  return `<!DOCTYPE html>
<html lang="${esc(lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>${STYLE}</style>
</head>
<body>
${body}
</body>
</html>`;
}
