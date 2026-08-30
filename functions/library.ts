// H8 — the education library.
//
// I called this "content, not code", which was half right and half an excuse.
// The content is not code; the targeting is, and the targeting is the whole
// value. A generic library nobody opens is a shelf. A library that hands a
// guardian the anaemia article precisely because their child's haemoglobin was
// flagged is part of the pathway.
//
// So articles are tagged by check type, flag and age band, and the guardian
// endpoint returns only what applies to that child's own released findings.
// The same targeting feeds the nudges in reports.ts.
//
// Content lives in the database and is editable in the console, so adding an
// article does not need a deploy — which is the actual reason to build this
// before the content exists.

import { Sql, isOpsRole } from "./common";
import { Actor, ApiError } from "./schools";
import { CHECK_TYPES, isCheckType } from "./clinical";

export const LOCALES = ["en", "hi", "te"] as const;

export async function ensureLibrarySchema(sql: Sql): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS vita_hero.library_articles (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL,
      locale TEXT NOT NULL DEFAULT 'en',
      title TEXT NOT NULL,
      summary TEXT DEFAULT '',
      body TEXT NOT NULL,
      check_types JSONB DEFAULT '[]'::jsonb,
      flags JSONB DEFAULT '[]'::jsonb,
      min_age INT DEFAULT 0,
      max_age INT DEFAULT 99,
      published BOOLEAN DEFAULT true,
      created_by TEXT DEFAULT '',
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (slug, locale)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS library_locale ON vita_hero.library_articles(locale, published)`;

}

/**
 * Seed the shelf, once, on a database that has none.
 *
 * Kept out of ensureLibrarySchema so that function is pure DDL: schema
 * statements can then be recorded and shipped to Postgres in one batch, while
 * anything that has to read a result stays on its own path.
 */
export async function seedLibraryIfEmpty(sql: Sql): Promise<void> {
  const count = await sql`SELECT COUNT(*)::int AS n FROM vita_hero.library_articles`;
  if (((count[0]?.n as number) || 0) === 0) await seedLibrary(sql);
}

/**
 * A small, deliberately cautious starting set.
 *
 * Every article says the same thing in different words: here is what the
 * finding means, here is what helps, and none of this replaces seeing a
 * doctor. Nothing here diagnoses or prescribes.
 */
async function seedLibrary(sql: Sql): Promise<void> {
  const seeds: Array<{
    slug: string;
    checks: string[];
    flags: string[];
    minAge: number;
    maxAge: number;
    t: Record<string, { title: string; summary: string; body: string }>;
  }> = [
    {
      slug: "iron-rich-foods",
      checks: ["Haemoglobin"],
      flags: ["WATCH", "ALERT"],
      minAge: 2, maxAge: 18,
      t: {
        en: {
          title: "Everyday foods that build iron",
          summary: "What to add to ordinary meals when a child's haemoglobin is low.",
          body: "Low haemoglobin is common in school-age children and usually improves with what is already on an Indian plate.\n\nAdd more often: green leafy vegetables, dal, rajma and chana, jaggery instead of sugar, dates, ragi, and eggs or meat if your family eats them.\n\nOne easy habit: a squeeze of lemon over dal or vegetables. Vitamin C helps the body absorb several times more iron from the same meal.\n\nGive tea and coffee at a different time from meals, not with them, as both make iron harder to absorb.\n\nThis is general advice about food. It does not replace the doctor your child was referred to, and iron supplements should only be given if a doctor prescribes them.",
        },
        hi: {
          title: "रोज़मर्रा के लोहे से भरपूर खाद्य",
          summary: "हीमोग्लोबिन कम होने पर खाने में क्या जोड़ें।",
          body: "स्कूल जाने वाले बच्चों में हीमोग्लोबिन कम होना आम है।\n\nअधिक दें: हरी पत्तेदार सब्जियाँ, दाल, राजमा, चना, गुड़, खजूर और रागी।\n\nएक आसान आदत: दाल पर नींबू निचोड़ें। विटामिन सी लोहे को कई गुना बेहतर सोखने में मदद करता है।\n\nयह सामान्य सलाह है। डॉक्टर की जाँच का विकल्प नहीं।",
        },
      },
    },
    {
      slug: "vision-at-school",
      checks: ["Vision"],
      flags: ["WATCH", "ALERT"],
      minAge: 4, maxAge: 18,
      t: {
        en: {
          title: "When a child cannot see the board",
          summary: "What a vision flag means, and what to watch for at home.",
          body: "A vision result below 6/6 does not mean anything is wrong permanently. Most children who need glasses simply need glasses, and the earlier they get them the better they do at school.\n\nSigns worth noticing at home: sitting very close to the television, holding books unusually near, squinting, rubbing the eyes often, headaches after school, or losing their place while reading.\n\nDo not buy glasses from a shop without a proper eye test. The wrong lenses are worse than none.\n\nIf your child has been referred, book the eye appointment. It is usually a short visit.",
        },
      },
    },
    {
      slug: "brushing-that-works",
      checks: ["Dental"],
      flags: ["WATCH", "ALERT"],
      minAge: 2, maxAge: 18,
      t: {
        en: {
          title: "Brushing that actually prevents cavities",
          summary: "Two minutes, twice a day, and the one habit that matters most at night.",
          body: "Cavities are the most common thing found at school health camps, and almost all of it is preventable.\n\nTwice a day, two minutes, with a fluoride toothpaste. A pea-sized amount is enough for a child.\n\nThe night brush matters most. Saliva, which protects teeth, slows down during sleep, so anything left on the teeth at bedtime has all night to do damage. After brushing at night, only water.\n\nSugar frequency matters more than sugar quantity. One sweet after a meal is gentler on teeth than the same sweet spread across the afternoon.\n\nIf your child has been referred for a dental check, go. A small cavity is a simple filling; a late one is not.",
        },
      },
    },
    {
      slug: "growing-well",
      checks: ["Height & weight"],
      flags: ["WATCH", "ALERT"],
      minAge: 2, maxAge: 18,
      t: {
        en: {
          title: "What the growth chart is really saying",
          summary: "Percentiles explained, and why one measurement is never the whole story.",
          body: "A percentile compares your child to other children of the same age and sex. A child on the 25th percentile is smaller than 75 out of 100 children — and completely healthy. Children are supposed to be different sizes.\n\nWhat matters more than any single number is the direction over time. A child who has always been on the 25th percentile and stays there is growing normally. A child who drops from the 50th to the 15th between two camps is worth a doctor's look, even though both numbers are inside the normal range.\n\nThis is why the second camp matters more than the first.\n\nIf a flag was raised, it means one measurement fell outside the usual band. It is a reason to check, not a diagnosis.",
        },
      },
    },
    {
      slug: "after-the-camp",
      checks: [],
      flags: [],
      minAge: 0, maxAge: 99,
      t: {
        en: {
          title: "What happens after a school health camp",
          summary: "Who saw your child, who checked the results, and what to do next.",
          body: "At the camp, a trained screening team measured your child and recorded what they found. A doctor then reviewed every result before any of it reached you — nothing in this app is shown to a parent without that review.\n\nA green result means nothing needed following up at this camp. An amber result means something is worth keeping an eye on. A red result means please see a doctor, and you will find a follow-up in the app with the kind of doctor to see.\n\nIf a check says \"not measured\", it was not done at this camp. It does not mean it was normal.\n\nScreening is not diagnosis. It is a way of catching things early enough to be easy to fix.",
        },
      },
    },
  ];

  for (const s of seeds) {
    for (const locale of Object.keys(s.t)) {
      const c = s.t[locale];
      await sql`
        INSERT INTO vita_hero.library_articles
          (id, slug, locale, title, summary, body, check_types, flags, min_age, max_age, published, created_by)
        VALUES (${`lib_${s.slug}_${locale}`}, ${s.slug}, ${locale}, ${c.title}, ${c.summary}, ${c.body},
                ${JSON.stringify(s.checks)}::jsonb, ${JSON.stringify(s.flags)}::jsonb,
                ${s.minAge}, ${s.maxAge}, true, 'seed')
        ON CONFLICT (slug, locale) DO NOTHING
      `;
    }
  }
}

function mapArticle(r: Record<string, unknown>) {
  const arr = (v: unknown): string[] =>
    Array.isArray(v) ? (v as string[]) : JSON.parse(String(v || "[]"));
  return {
    id: r.id as string,
    slug: r.slug as string,
    locale: r.locale as string,
    title: r.title as string,
    summary: (r.summary as string) || "",
    body: (r.body as string) || "",
    checkTypes: arr(r.check_types),
    flags: arr(r.flags),
    minAge: (r.min_age as number) ?? 0,
    maxAge: (r.max_age as number) ?? 99,
    published: r.published !== false,
    updatedAt: r.updated_at ? String(r.updated_at) : "",
  };
}

/**
 * What this family should read, chosen from their children's own findings.
 *
 * Articles with no check tags are general and shown to everyone; the rest
 * appear only when a child actually has that flag, at that age.
 */
export async function libraryForGuardian(sql: Sql, profileId: string, locale: string) {
  const loc = LOCALES.includes(locale as (typeof LOCALES)[number]) ? locale : "en";

  const findings = await sql`
    SELECT DISTINCT f.check_type, f.flag, k.age, k.id AS kid_id, k.name AS kid_name
    FROM vita_hero.camp_findings f
    JOIN vita_hero.kids k ON k.id = f.kid_id
    JOIN vita_hero.camp_participants p ON p.camp_id = f.camp_id AND p.kid_id = f.kid_id
    WHERE k.profile_id = ${profileId} AND p.status = 'RELEASED'
      AND f.flag IN ('WATCH','ALERT')
  `;

  const rows = await sql`
    SELECT * FROM vita_hero.library_articles
    WHERE published = true AND (locale = ${loc} OR locale = 'en')
  `;

  // Prefer the requested language, fall back to English per slug.
  const bySlug = new Map<string, Record<string, unknown>>();
  for (const r of rows) {
    const slug = r.slug as string;
    const have = bySlug.get(slug);
    if (!have || (r.locale as string) === loc) bySlug.set(slug, r);
  }

  const articles = [...bySlug.values()].map(mapArticle);
  const forYou: Array<Record<string, unknown>> = [];
  const general: Array<Record<string, unknown>> = [];

  for (const a of articles) {
    if (a.checkTypes.length === 0) {
      general.push(a);
      continue;
    }
    const match = findings.find((f) => {
      const ct = f.check_type as string;
      const fl = f.flag as string;
      const age = (f.age as number) ?? 0;
      return a.checkTypes.includes(ct)
        && (a.flags.length === 0 || a.flags.includes(fl))
        && age >= a.minAge && age <= a.maxAge;
    });
    if (match) {
      forYou.push({ ...a, because: { kidName: match.kid_name as string, checkType: match.check_type as string } });
    }
  }

  return { locale: loc, forYou, general };
}

export async function getArticle(sql: Sql, slug: string, locale: string) {
  const loc = LOCALES.includes(locale as (typeof LOCALES)[number]) ? locale : "en";
  const rows = await sql`
    SELECT * FROM vita_hero.library_articles
    WHERE slug = ${slug} AND published = true AND (locale = ${loc} OR locale = 'en')
    ORDER BY CASE WHEN locale = ${loc} THEN 0 ELSE 1 END LIMIT 1
  `;
  if (rows.length === 0) throw new ApiError(404, "Article not found", "NOT_FOUND");
  return { article: mapArticle(rows[0]) };
}

// ─── Console editing ────────────────────────────────────────

export async function listArticles(sql: Sql, actor: Actor) {
  if (!isOpsRole(actor.role)) {
    throw new ApiError(403, "The library is edited by VitaHero operations", "OPS_REQUIRED");
  }
  const rows = await sql`
    SELECT * FROM vita_hero.library_articles ORDER BY slug, locale
  `;
  return { articles: rows.map(mapArticle), checkTypes: [...CHECK_TYPES], locales: [...LOCALES] };
}

export async function upsertArticle(sql: Sql, actor: Actor, body: Record<string, unknown>) {
  if (!isOpsRole(actor.role)) {
    throw new ApiError(403, "The library is edited by VitaHero operations", "OPS_REQUIRED");
  }
  const slug = String(body.slug || "").trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "");
  if (slug.length < 3) throw new ApiError(400, "A short url-safe slug is required", "BAD_SLUG");
  const locale = String(body.locale || "en");
  if (!LOCALES.includes(locale as (typeof LOCALES)[number])) {
    throw new ApiError(400, `Locale must be one of ${LOCALES.join(", ")}`, "BAD_LOCALE");
  }
  const title = String(body.title || "").trim();
  const text = String(body.body || "").trim();
  if (!title || text.length < 40) {
    throw new ApiError(400, "An article needs a title and a few sentences", "TOO_SHORT");
  }

  const checks = (Array.isArray(body.checkTypes) ? (body.checkTypes as unknown[]) : [])
    .map(String).filter(isCheckType);
  const flags = (Array.isArray(body.flags) ? (body.flags as unknown[]) : [])
    .map((f) => String(f).toUpperCase())
    .filter((f) => ["GOOD", "WATCH", "ALERT", "NOT_MEASURED"].includes(f));

  const minAge = Math.max(0, Number(body.minAge) || 0);
  const maxAge = Math.min(99, Number(body.maxAge) || 99);
  if (minAge > maxAge) throw new ApiError(400, "The age range is back to front", "BAD_AGE_RANGE");

  await sql`
    INSERT INTO vita_hero.library_articles
      (id, slug, locale, title, summary, body, check_types, flags, min_age, max_age, published, created_by, updated_at)
    VALUES (${`lib_${slug}_${locale}`}, ${slug}, ${locale}, ${title}, ${String(body.summary || "")}, ${text},
            ${JSON.stringify(checks)}::jsonb, ${JSON.stringify(flags)}::jsonb,
            ${minAge}, ${maxAge}, ${body.published !== false}, ${actor.profileId}, NOW())
    ON CONFLICT (slug, locale) DO UPDATE SET
      title = EXCLUDED.title, summary = EXCLUDED.summary, body = EXCLUDED.body,
      check_types = EXCLUDED.check_types, flags = EXCLUDED.flags,
      min_age = EXCLUDED.min_age, max_age = EXCLUDED.max_age,
      published = EXCLUDED.published, updated_at = NOW()
  `;
  return { slug, locale };
}

export async function deleteArticle(sql: Sql, actor: Actor, slug: string, locale: string) {
  if (!isOpsRole(actor.role)) {
    throw new ApiError(403, "The library is edited by VitaHero operations", "OPS_REQUIRED");
  }
  await sql`DELETE FROM vita_hero.library_articles WHERE slug = ${slug} AND locale = ${locale}`;
  return { deleted: `${slug}/${locale}` };
}
