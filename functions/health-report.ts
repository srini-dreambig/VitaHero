// The paper a family takes home at the end of a camp.
//
// The app shows a guardian their child's result, but the programme promised a
// printed health report too, and there was nothing to print: the console could
// list findings on screen and that was all. So a school or the programme team
// had to copy a doctor's results out by hand, which is how a flag gets lost.
//
// This prints one page per child, from the same rows the app reads: every
// finding with its flag, the reviewing doctor's own words where they wrote
// any, the recommendation, and who signed it off. Only children a doctor has
// signed off appear — a result nobody has reviewed is not a result yet.

import { Sql } from "./common";
import { Actor, ApiError } from "./schools";
import { assertCampAccess } from "./camps";
import { logRecordAccess } from "./oversight";

function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const FLAG_LABEL: Record<string, string> = {
  GOOD: "Normal",
  WATCH: "Keep an eye on it",
  ALERT: "Needs attention",
  NOT_MEASURED: "Not checked",
};

const URGENCY_LABEL: Record<string, string> = {
  URGENT: "See a doctor urgently",
  SOON: "See a doctor soon",
  ROUTINE: "Routine follow-up",
  NONE: "",
};

const STYLE = `
  @page { size: A4; margin: 14mm 12mm; }
  * { box-sizing: border-box; }
  body { font-family: "Noto Sans", -apple-system, "Segoe UI", Roboto, sans-serif;
         margin: 0; color: #111; font-size: 11pt; line-height: 1.45; background: #fff; }
  .page { page-break-after: always; padding: 0 0 6mm; }
  .page:last-child { page-break-after: auto; }
  h1 { font-size: 16pt; margin: 0 0 2mm; }
  .meta { color: #444; margin-bottom: 5mm; }
  .meta b { color: #111; }
  table { width: 100%; border-collapse: collapse; margin: 3mm 0 5mm; }
  th, td { text-align: left; vertical-align: top; border-bottom: 1px solid #ccc; padding: 2mm 2mm; }
  th { font-size: 9.5pt; text-transform: uppercase; letter-spacing: .04em; color: #555; }
  .flag { font-weight: 600; white-space: nowrap; }
  .ALERT { color: #a40000; } .WATCH { color: #8a5a00; } .GOOD { color: #1d6b2f; }
  .box { border: 1px solid #999; border-radius: 2mm; padding: 3mm 4mm; margin-bottom: 4mm; }
  .urgent { border-color: #a40000; }
  .sign { margin-top: 8mm; display: flex; justify-content: space-between; color: #444; }
  .none { padding: 10mm; text-align: center; color: #444; }
`;

/**
 * Printable health reports for a camp, one page per signed-off child.
 *
 * Gated on reading clinical results, not on running the camp: this is the
 * findings themselves. Each child printed is written to the access log, as
 * any other read of their record is.
 */
export async function campHealthReport(
  sql: Sql,
  actor: Actor,
  campId: string,
  opts: { kidId?: string } = {},
): Promise<string> {
  const access = await assertCampAccess(sql, actor, campId);
  if (!access.canViewClinical) {
    throw new ApiError(403, "You cannot see this camp's results", "FORBIDDEN");
  }
  const camp = access.camp;
  const kidId = String(opts.kidId || "");

  const kids = await sql`
    SELECT p.kid_id, p.urgency, p.recommendation, p.reviewed_at,
           k.name, k.grade, k.section, k.age, k.gender, k.student_ref,
           r.name AS reviewer
    FROM vita_hero.camp_participants p
    JOIN vita_hero.kids k ON k.id = p.kid_id
    LEFT JOIN vita_hero.profiles r ON r.id = p.reviewed_by
    WHERE p.camp_id = ${campId}
      AND p.status IN ('APPROVED', 'RELEASED')
      AND (${kidId} = '' OR p.kid_id = ${kidId})
    ORDER BY k.grade, k.section, k.name
  `;
  const findings = kids.length === 0 ? [] : await sql`
    SELECT kid_id, check_type, flag, value_text, rationale, review_note
    FROM vita_hero.camp_findings
    WHERE camp_id = ${campId} AND kid_id = ANY(${kids.map((k) => k.kid_id as string)})
    ORDER BY check_type
  `;
  const byKid = new Map<string, Record<string, unknown>[]>();
  for (const f of findings) {
    const list = byKid.get(f.kid_id as string) || [];
    list.push(f);
    byKid.set(f.kid_id as string, list);
  }

  await Promise.all(kids.map((k) => logRecordAccess(sql, actor, {
    kidId: k.kid_id as string,
    schoolId: camp.school_id as string,
    campId,
    surface: "HEALTH_REPORT",
  })));

  const body = kids.length === 0
    ? `<div class="none">No child at this camp has a result a doctor has signed off yet, so there is nothing to print.</div>`
    : kids.map((k) => page(camp, k, byKid.get(k.kid_id as string) || [])).join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Health reports — ${esc(camp.title)}</title>
<style>${STYLE}</style>
</head>
<body>
${body}
</body>
</html>`;
}

function page(
  camp: Record<string, unknown>,
  k: Record<string, unknown>,
  findings: Record<string, unknown>[],
): string {
  const cls = [k.grade, k.section].filter(Boolean).join(" ");
  const urgency = String(k.urgency || "NONE");
  const rows = findings.map((f) => {
    const flag = String(f.flag || "NOT_MEASURED");
    // The reviewing doctor's words win over the rule's, as they do in the app.
    const note = String(f.review_note || "").trim() || String(f.rationale || "");
    return `<tr>
      <td>${esc(f.check_type)}</td>
      <td>${esc(f.value_text)}</td>
      <td class="flag ${esc(flag)}">${esc(FLAG_LABEL[flag] || flag)}</td>
      <td>${esc(note)}</td>
    </tr>`;
  }).join("");
  const signed = k.reviewed_at ? new Date(k.reviewed_at as string).toISOString().slice(0, 10) : "";

  return `<section class="page">
  <h1>Health check-up report</h1>
  <div class="meta">
    <b>${esc(k.name)}</b>${cls ? ` · Class ${esc(cls)}` : ""}${k.age ? ` · Age ${esc(k.age)}` : ""}${k.student_ref ? ` · ${esc(k.student_ref)}` : ""}<br>
    ${esc(camp.school_name)} · ${esc(camp.title)} · ${esc(camp.date)}
  </div>
  <table>
    <thead><tr><th>Check</th><th>Result</th><th>Status</th><th>Doctor's note</th></tr></thead>
    <tbody>${rows || `<tr><td colspan="4">No checks were recorded.</td></tr>`}</tbody>
  </table>
  ${URGENCY_LABEL[urgency] ? `<div class="box${urgency === "URGENT" ? " urgent" : ""}"><b>${esc(URGENCY_LABEL[urgency])}</b></div>` : ""}
  <div class="box"><b>Recommendation</b><br>${esc(k.recommendation) || "No further action needed."}</div>
  <div class="sign">
    <span>Reviewed by: <b>${esc(k.reviewer || "—")}</b></span>
    <span>${signed ? `Signed off: ${esc(signed)}` : ""}</span>
  </div>
</section>`;
}
