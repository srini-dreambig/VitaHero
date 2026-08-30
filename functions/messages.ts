// F8 — a guardian asking the school health team a question.
//
// My objection to building this was never the code. It was that a message box
// is a permanent staffing commitment, and an unanswered channel is worse than
// no channel: a parent who asks about their child's health and hears nothing
// trusts you less than one who was never invited to ask.
//
// So the objection is built into the feature rather than used as a reason to
// skip it:
//
//   - an explicit emergency gate, because a message queue must never sit
//     between a frightened parent and a doctor
//   - a stated response window the guardian sees before they type
//   - a console queue ordered by how long a question has gone unanswered, so
//     a growing backlog is the first thing an administrator sees rather than
//     something buried behind a tab
//   - a school can close the channel, which is honest, instead of leaving it
//     open and silent

import { Sql, isOpsRole } from "./common";
import { Actor, ApiError, assertSchoolAccess } from "./schools";

export const THREAD_STATUSES = ["OPEN", "ANSWERED", "CLOSED"] as const;

/** What the guardian is told before they write. Shown, not buried in terms. */
export const RESPONSE_WINDOW_DAYS = 3;

export async function ensureMessageSchema(sql: Sql): Promise<void> {
  // A school that cannot staff this can turn it off rather than ignore it.
  await sql`ALTER TABLE vita_hero.schools ADD COLUMN IF NOT EXISTS questions_enabled BOOLEAN DEFAULT true`;

  await sql`
    CREATE TABLE IF NOT EXISTS vita_hero.question_threads (
      id TEXT PRIMARY KEY,
      school_id TEXT NOT NULL,
      profile_id TEXT NOT NULL,
      kid_id TEXT,
      camp_id TEXT,
      subject TEXT DEFAULT '',
      status TEXT DEFAULT 'OPEN',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      last_message_at TIMESTAMPTZ DEFAULT NOW(),
      answered_at TIMESTAMPTZ,
      closed_at TIMESTAMPTZ,
      awaiting TEXT DEFAULT 'SCHOOL'
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS qthreads_school ON vita_hero.question_threads(school_id, status, last_message_at)`;
  await sql`CREATE INDEX IF NOT EXISTS qthreads_profile ON vita_hero.question_threads(profile_id, last_message_at DESC)`;

  await sql`
    CREATE TABLE IF NOT EXISTS vita_hero.question_messages (
      id TEXT PRIMARY KEY,
      thread_id TEXT NOT NULL,
      author_id TEXT NOT NULL,
      author_side TEXT NOT NULL,
      author_name TEXT DEFAULT '',
      body TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS qmessages_thread ON vita_hero.question_messages(thread_id, created_at)`;
}

const MAX_BODY = 2000;

function clean(v: unknown, max = MAX_BODY): string {
  return String(v || "").trim().slice(0, max);
}

/** What the app shows above the compose box. */
export async function questionPolicy(sql: Sql, profileId: string) {
  const rows = await sql`
    SELECT DISTINCT s.id, s.name, s.questions_enabled
    FROM vita_hero.school_enrollments e
    JOIN vita_hero.schools s ON s.id = e.school_id
    WHERE e.profile_id = ${profileId} AND e.status = 'ACTIVE'
  `;
  const open = rows.filter((r) => r.questions_enabled !== false);
  return {
    available: open.length > 0,
    schools: open.map((r) => ({ id: r.id as string, name: r.name as string })),
    responseWindowDays: RESPONSE_WINDOW_DAYS,
    notice:
      "This is for questions about your child's school health check-up. " +
      "It is not monitored around the clock and must not be used for anything urgent. " +
      "If your child is unwell now, call your doctor or go to a hospital.",
  };
}

/**
 * Open a question.
 *
 * The emergency gate is a required acknowledgement rather than a paragraph
 * nobody reads: the caller has to say they understand this is not urgent care.
 */
export async function askQuestion(
  sql: Sql,
  profileId: string,
  guardianName: string,
  body: Record<string, unknown>
) {
  if (body.notUrgentAcknowledged !== true) {
    throw new ApiError(
      400,
      "Please confirm this is not an emergency. If your child needs help now, call your doctor.",
      "URGENCY_ACK_REQUIRED"
    );
  }

  const text = clean(body.body);
  if (text.length < 5) throw new ApiError(400, "Tell us a little more", "TOO_SHORT");

  const schoolId = clean(body.schoolId, 120);
  const enrolled = await sql`
    SELECT s.id, s.questions_enabled FROM vita_hero.school_enrollments e
    JOIN vita_hero.schools s ON s.id = e.school_id
    WHERE e.profile_id = ${profileId} AND e.status = 'ACTIVE'
      AND (${schoolId === ""} OR s.id = ${schoolId})
    LIMIT 1
  `;
  if (enrolled.length === 0) {
    throw new ApiError(403, "You are not enrolled with that school", "NOT_ENROLLED");
  }
  if (enrolled[0].questions_enabled === false) {
    throw new ApiError(
      409,
      "This school is not taking questions through the app at the moment. Please contact the school directly.",
      "QUESTIONS_CLOSED"
    );
  }
  const school = enrolled[0].id as string;

  const kidId = clean(body.kidId, 120) || null;
  if (kidId) {
    const owns = await sql`
      SELECT id FROM vita_hero.kids WHERE id = ${kidId} AND profile_id = ${profileId} LIMIT 1
    `;
    if (owns.length === 0) throw new ApiError(403, "That is not your child", "NOT_YOUR_CHILD");
  }

  // One open thread per family per school. A queue of duplicates from an
  // anxious parent helps nobody, least of all them.
  const existing = await sql`
    SELECT id FROM vita_hero.question_threads
    WHERE profile_id = ${profileId} AND school_id = ${school} AND status = 'OPEN' LIMIT 1
  `;
  const threadId = existing.length > 0
    ? (existing[0].id as string)
    : `qt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

  if (existing.length === 0) {
    await sql`
      INSERT INTO vita_hero.question_threads
        (id, school_id, profile_id, kid_id, camp_id, subject, status, awaiting)
      VALUES (${threadId}, ${school}, ${profileId}, ${kidId}, ${clean(body.campId, 120) || null},
              ${clean(body.subject, 140) || text.slice(0, 60)}, 'OPEN', 'SCHOOL')
    `;
  } else {
    await sql`
      UPDATE vita_hero.question_threads
      SET last_message_at = NOW(), awaiting = 'SCHOOL', status = 'OPEN'
      WHERE id = ${threadId}
    `;
  }

  await sql`
    INSERT INTO vita_hero.question_messages (id, thread_id, author_id, author_side, author_name, body)
    VALUES (${"qm_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)},
            ${threadId}, ${profileId}, 'GUARDIAN', ${guardianName}, ${text})
  `;

  return {
    threadId,
    status: "OPEN",
    expectedReplyWithinDays: RESPONSE_WINDOW_DAYS,
  };
}

export async function guardianThreads(sql: Sql, profileId: string) {
  const rows = await sql`
    SELECT t.*, s.name AS school_name, k.name AS kid_name,
      (SELECT COUNT(*)::int FROM vita_hero.question_messages m WHERE m.thread_id = t.id) AS message_count
    FROM vita_hero.question_threads t
    LEFT JOIN vita_hero.schools s ON s.id = t.school_id
    LEFT JOIN vita_hero.kids k ON k.id = t.kid_id
    WHERE t.profile_id = ${profileId}
    ORDER BY t.last_message_at DESC LIMIT 50
  `;
  return {
    threads: rows.map((r) => ({
      id: r.id as string,
      schoolName: (r.school_name as string) || "",
      kidName: (r.kid_name as string) || "",
      subject: (r.subject as string) || "",
      status: (r.status as string) || "OPEN",
      awaiting: (r.awaiting as string) || "SCHOOL",
      messages: (r.message_count as number) || 0,
      lastAt: r.last_message_at ? String(r.last_message_at) : "",
    })),
  };
}

export async function threadMessages(
  sql: Sql,
  who: { profileId?: string; actor?: Actor },
  threadId: string
) {
  const rows = await sql`
    SELECT t.*, s.name AS school_name, k.name AS kid_name
    FROM vita_hero.question_threads t
    LEFT JOIN vita_hero.schools s ON s.id = t.school_id
    LEFT JOIN vita_hero.kids k ON k.id = t.kid_id
    WHERE t.id = ${threadId} LIMIT 1
  `;
  if (rows.length === 0) throw new ApiError(404, "Question not found", "NOT_FOUND");
  const t = rows[0];

  if (who.profileId) {
    if ((t.profile_id as string) !== who.profileId) {
      throw new ApiError(403, "That is not your question", "NOT_YOURS");
    }
  } else if (who.actor) {
    if (!isOpsRole(who.actor.role)) assertSchoolAccess(who.actor, t.school_id as string);
  } else {
    throw new ApiError(401, "Sign-in required", "UNAUTHORIZED");
  }

  const msgs = await sql`
    SELECT id, author_side, author_name, body, created_at
    FROM vita_hero.question_messages WHERE thread_id = ${threadId} ORDER BY created_at
  `;
  return {
    thread: {
      id: threadId,
      schoolName: (t.school_name as string) || "",
      kidName: (t.kid_name as string) || "",
      subject: (t.subject as string) || "",
      status: (t.status as string) || "OPEN",
      awaiting: (t.awaiting as string) || "SCHOOL",
      openedAt: t.created_at ? String(t.created_at) : "",
    },
    messages: msgs.map((m) => ({
      id: m.id as string,
      side: m.author_side as string,
      name: (m.author_name as string) || "",
      body: m.body as string,
      at: m.created_at ? String(m.created_at) : "",
    })),
  };
}

/** The school answers. */
export async function replyToThread(
  sql: Sql,
  actor: Actor,
  threadId: string,
  body: Record<string, unknown>
) {
  const rows = await sql`SELECT * FROM vita_hero.question_threads WHERE id = ${threadId} LIMIT 1`;
  if (rows.length === 0) throw new ApiError(404, "Question not found", "NOT_FOUND");
  if (!isOpsRole(actor.role)) assertSchoolAccess(actor, rows[0].school_id as string);

  const text = clean(body.body);
  if (text.length < 2) throw new ApiError(400, "Write a reply", "TOO_SHORT");

  await sql`
    INSERT INTO vita_hero.question_messages (id, thread_id, author_id, author_side, author_name, body)
    VALUES (${"qm_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)},
            ${threadId}, ${actor.profileId}, 'SCHOOL', ${actor.name}, ${text})
  `;
  const close = body.close === true;
  await sql`
    UPDATE vita_hero.question_threads
    SET status = ${close ? "CLOSED" : "ANSWERED"},
        awaiting = ${close ? "NOBODY" : "GUARDIAN"},
        answered_at = COALESCE(answered_at, NOW()),
        closed_at = ${close ? new Date().toISOString() : null},
        last_message_at = NOW()
    WHERE id = ${threadId}
  `;
  return { threadId, status: close ? "CLOSED" : "ANSWERED" };
}

/**
 * The console's queue, oldest unanswered first.
 *
 * `waitingDays` is the number that matters: it makes a backlog impossible to
 * miss, and it is what tells a school honestly that they should switch the
 * channel off rather than keep failing to answer it.
 */
export async function schoolThreads(sql: Sql, actor: Actor, schoolId: string, status: string) {
  assertSchoolAccess(actor, schoolId);
  const rows = await sql`
    SELECT t.*, p.name AS guardian_name, p.phone, k.name AS kid_name,
      EXTRACT(EPOCH FROM (NOW() - t.last_message_at)) / 86400 AS waiting_days,
      (SELECT body FROM vita_hero.question_messages m
        WHERE m.thread_id = t.id ORDER BY m.created_at DESC LIMIT 1) AS last_body
    FROM vita_hero.question_threads t
    LEFT JOIN vita_hero.profiles p ON p.id = t.profile_id
    LEFT JOIN vita_hero.kids k ON k.id = t.kid_id
    WHERE t.school_id = ${schoolId}
      AND (${!status} OR t.status = ${status || ""})
    ORDER BY
      CASE t.awaiting WHEN 'SCHOOL' THEN 0 ELSE 1 END,
      t.last_message_at
    LIMIT 200
  `;
  const counts = await sql`
    SELECT
      COUNT(*) FILTER (WHERE awaiting = 'SCHOOL')::int AS waiting_on_us,
      COUNT(*) FILTER (WHERE awaiting = 'SCHOOL'
        AND last_message_at < NOW() - (${RESPONSE_WINDOW_DAYS} || ' days')::interval)::int AS overdue,
      COUNT(*) FILTER (WHERE status = 'CLOSED')::int AS closed
    FROM vita_hero.question_threads WHERE school_id = ${schoolId}
  `;
  const schoolRow = await sql`SELECT questions_enabled FROM vita_hero.schools WHERE id = ${schoolId} LIMIT 1`;

  return {
    enabled: schoolRow[0]?.questions_enabled !== false,
    responseWindowDays: RESPONSE_WINDOW_DAYS,
    counts: counts[0],
    threads: rows.map((r) => ({
      id: r.id as string,
      guardianName: (r.guardian_name as string) || "",
      guardianPhone: (r.phone as string) || "",
      kidName: (r.kid_name as string) || "",
      subject: (r.subject as string) || "",
      status: (r.status as string) || "OPEN",
      awaiting: (r.awaiting as string) || "SCHOOL",
      waitingDays: Math.floor(Number(r.waiting_days) || 0),
      lastMessage: (r.last_body as string) || "",
      lastAt: r.last_message_at ? String(r.last_message_at) : "",
    })),
  };
}

/**
 * Turn the channel off. Refused while questions are unanswered — closing the
 * door on people already waiting is the exact failure this feature was
 * designed to avoid.
 */
export async function setQuestionsEnabled(
  sql: Sql,
  actor: Actor,
  schoolId: string,
  enabled: boolean
) {
  assertSchoolAccess(actor, schoolId);
  if (!enabled) {
    const open = await sql`
      SELECT COUNT(*)::int AS n FROM vita_hero.question_threads
      WHERE school_id = ${schoolId} AND awaiting = 'SCHOOL'
    `;
    const n = (open[0]?.n as number) || 0;
    if (n > 0) {
      throw new ApiError(
        409,
        `${n} question${n === 1 ? "" : "s"} still waiting on you. Answer or close them before switching this off.`,
        "UNANSWERED"
      );
    }
  }
  await sql`UPDATE vita_hero.schools SET questions_enabled = ${enabled} WHERE id = ${schoolId}`;
  return { schoolId, questionsEnabled: enabled };
}
