// Static pages the Play Console requires at stable public URLs:
//
//   /privacy        — the privacy policy linked from the store listing and the
//                     Data safety form. Google's reviewers open this link and
//                     check it names the app, the data actually collected, and
//                     how to have it deleted.
//   /data-deletion  — the "delete account" URL shown on the store listing. It
//                     must prominently feature the deletion steps and say what
//                     is deleted and what is kept.
//
// These are served straight from the worker with no database dependency, so
// they answer even when the schema or Neon is unhappy.

const STYLE = `
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
    margin: 0; padding: 24px 16px 64px; background: #f6f4ef; color: #1c2430;
    line-height: 1.65; -webkit-text-size-adjust: 100%;
  }
  main { max-width: 720px; margin: 0 auto; }
  h1 { font-size: 1.6rem; margin: 0 0 4px; }
  h2 { font-size: 1.15rem; margin: 28px 0 8px; }
  .brand { display: inline-flex; align-items: center; gap: 8px; font-weight: 700; }
  .shield { width: 28px; height: 28px; border-radius: 8px; background: #0e7a5f;
            color: #fff; display: inline-flex; align-items: center; justify-content: center;
            font-size: 15px; }
  .updated { color: #6b7280; font-size: 0.85rem; margin-bottom: 24px; }
  .card { background: #fff; border: 1px solid #e5e1d8; border-radius: 14px;
          padding: 18px 20px; margin: 14px 0; }
  .callout { background: #eef6f2; border: 1px solid #cfe6dc; border-radius: 14px;
             padding: 18px 20px; margin: 18px 0; }
  .callout ol { margin: 10px 0 0; padding-left: 22px; }
  .callout li { margin: 8px 0; }
  ul { padding-left: 22px; }
  li { margin: 5px 0; }
  a { color: #0e7a5f; }
  .muted { color: #6b7280; font-size: 0.9rem; }
`;

function page(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} — VitaHero</title>
<style>${STYLE}</style>
</head>
<body>
<main>
  <div class="brand"><span class="shield">✓</span> VitaHero</div>
  ${body}
</main>
</body>
</html>`;
}

/** GET /privacy — the store-listing privacy policy. */
export function servePrivacyPage(): Response {
  const html = page(
    "Privacy Policy",
    `
    <h1>Privacy Policy</h1>
    <p class="updated">Last updated: August 30, 2026</p>

    <p>VitaHero is a parent-facing app that keeps a record of a child's growth
    and school health check-ups. This policy explains what personal data the
    app collects, why, who can see it, and how to have it deleted. It applies
    to the VitaHero Android app and the web service behind it, operated by
    Kallam Healthcare ("we", "us").</p>

    <h2>1. Who uses the app and whose data it holds</h2>
    <p>VitaHero accounts belong to parents and guardians. The data stored is
    about the guardian's own child, entered by the guardian or recorded by the
    child's school at a school health camp. We do not offer the app to children;
    users are adults.</p>

    <h2>2. Data we collect</h2>
    <ul>
      <li><strong>Guardian account:</strong> your name and mobile number, used to
      sign you in. Sign-in uses a one-time code delivered by Firebase (Google);
      we never sell or reuse your number.</li>
      <li><strong>Child profile:</strong> your child's name, age and class, and
      the school they attend.</li>
      <li><strong>Growth and screening records:</strong> height, weight, vision
      and dental findings measured at your child's school health camp, and
      growth charts computed from them.</li>
      <li><strong>Everyday notes you add:</strong> meal and diet logs, and a
      simple illness history (for example "fever, mild, three days") that you
      may record for your child's next check-up.</li>
      <li><strong>Photos of meals:</strong> a photo you choose to log may be
      processed to identify the food item. Photos are used for that purpose
      only and are never used for advertising.</li>
      <li><strong>Device activity data (optional):</strong> if you connect
      Google Health Connect, the app can read today's steps, active minutes and
      calories <em>on your device only</em>, to show them on your child's
      activity card. This data is never uploaded, shared or transmitted off the
      device, and the app works fully without this permission.</li>
    </ul>

    <h2>3. What we do <em>not</em> do</h2>
    <ul>
      <li>We do not sell personal data or share it with advertisers.</li>
      <li>We do not provide medical diagnosis, treatment or telehealth
      services. Content in the app is a record and general guidance (such as
      "see a doctor today"), not medical advice.</li>
      <li>We do not track your location.</li>
    </ul>

    <h2>4. Who can see a child's record</h2>
    <p>Only you (and family members you sign in with) and the clinical team at
    your child's school health camp can view your child's record. The school
    office cannot see the illness history you record. Staff access exists to
    run the health camp and follow-up referral you consented to.</p>

    <h2>5. Storage and security</h2>
    <p>Data is transmitted over encrypted connections (HTTPS/TLS) and stored on
    a managed, access-controlled cloud database. Sign-in tokens are handled by
    Firebase Authentication.</p>

    <h2>6. Your rights and how to delete data</h2>
    <p>You can withdraw consent, correct or erase your child's data, or delete
    your account at any time:</p>
    <ul>
      <li>In the app: open <strong>Profile → Privacy</strong> to erase an
      individual child's record.</li>
      <li>Full account deletion: visit our
      <a href="/data-deletion">account deletion page</a> for the steps.</li>
    </ul>
    <p>When your account is deleted, your profile, your children's records,
    measurements, illness history and meal logs are erased. Copies in encrypted
    backups are removed within 30 days. Records that cannot identify a child
    may be kept in de-identified form for public-health statistics.</p>

    <h2>7. Law</h2>
    <p>We process personal data on the basis of your consent, consistent with
    India's Digital Personal Data Protection Act, 2023. You may withdraw
    consent at any time using the steps above.</p>

    <h2>8. Contact</h2>
    <p>Questions or deletion requests:
    <a href="mailto:srinivasdwh2012@gmail.com">srinivasdwh2012@gmail.com</a></p>
    `
  );
  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=3600" },
  });
}

/**
 * GET /data-deletion — the "delete account" URL shown on the Play listing.
 * Google requires this page to name the app, feature the deletion steps
 * prominently, and state what is deleted, what is kept, and for how long.
 */
export function serveDataDeletionPage(): Response {
  const html = page(
    "Delete account & data",
    `
    <h1>Delete your VitaHero account &amp; data</h1>
    <p>You can delete your VitaHero account and all personal data connected to
    it at any time. There is no charge, and you do not need to give a reason.</p>

    <div class="callout">
      <strong>How to delete your account</strong>
      <ol>
        <li><strong>Erase one child's record in the app:</strong> open VitaHero,
        go to <strong>Profile → Privacy</strong>, and tap <strong>Erase</strong>
        next to the child. This removes that child's measurements, illness
        history and meal logs immediately.</li>
        <li><strong>Delete your whole account:</strong> email
        <a href="mailto:srinivasdwh2012@gmail.com?subject=Delete%20my%20VitaHero%20account">srinivasdwh2012@gmail.com</a>
        with the subject <strong>"Delete my VitaHero account"</strong> from, or
        mentioning, the mobile number you sign in with. We verify the request
        against that number and confirm by reply.</li>
      </ol>
    </div>

    <h2>What gets deleted</h2>
    <ul>
      <li>Your guardian profile and sign-in record (mobile number, name)</li>
      <li>Your children's profiles and school linkage</li>
      <li>Growth measurements, vision and dental findings, and growth charts</li>
      <li>Illness history and meal logs, including meal photos</li>
      <li>Appointments, camp follow-ups and notifications tied to your account</li>
    </ul>

    <h2>What is kept, and for how long</h2>
    <ul>
      <li>Copies inside encrypted backups are automatically removed within
      <strong>30 days</strong> of deletion.</li>
      <li>Statistics that cannot identify you or your child (for example,
      "how many children were screened at a camp") may be retained
      indefinitely, because they contain no personal data.</li>
    </ul>

    <h2>Questions</h2>
    <p class="muted">If your request is not confirmed within 7 days, or you
    cannot access the email above, write to
    <a href="mailto:srinivasdwh2012@gmail.com">srinivasdwh2012@gmail.com</a>.</p>
    `
  );
  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=3600" },
  });
}
