// C10 — clinical photographs attached to a finding.
//
// This was left out of the first build for two reasons, and both are answered
// here rather than ignored.
//
// Consent. Agreeing to have your child measured is not agreeing to have them
// photographed. Photography is a separate permission, asked separately, and a
// guardian can allow the screening and refuse the camera. The server enforces
// it at upload, so a screener whose device somehow offers the control still
// cannot store the image.
//
// Storage. Images live in Postgres as bytea rather than object storage,
// because no bucket binding exists on this worker and adding an unconfigured
// dependency would mean the feature does not work on deploy. That is a
// deliberate trade with a ceiling: photos are opt-in per camp, capped per
// image and per camp, and meant for the few checks where a picture changes a
// clinical decision — a skin lesion, a squint, a caries pattern — not a
// portrait of every child. See MIGRATING below when volume outgrows it.
//
// MIGRATING to object storage: the bytes are touched in exactly two places —
// the decode() insert in uploadFindingPhoto and the encode() select in
// getFindingPhoto. Replace those with an R2 put/get keyed by the photo id and
// drop the bytea column. No caller changes.

import { Sql, isOpsRole, slugify } from "./common";
import { Actor, ApiError, assertSchoolAccess } from "./schools";
import { assertCampAccess } from "./camps";
import { isCheckType } from "./clinical";

/** A screening photo is evidence, not a portrait. Small is correct. */
export const MAX_PHOTO_BYTES = 220 * 1024;
export const MAX_PHOTOS_PER_CHILD = 4;
export const MAX_PHOTOS_PER_CAMP = 400;

const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"];

export async function ensureMediaSchema(sql: Sql): Promise<void> {
  // camp_participants.consent_photos is declared in ensureCampSchema, beside the
  // rest of the participant row, because recordConsent writes it on every
  // decision whether or not this module is in use.
  // school_camps.photos_enabled is declared in ensureCampSchema for the same
  // reason: the camp row carries it, and pendingConsents reads it to decide
  // whether the guardian is asked the photography question at all.

  await sql`
    CREATE TABLE IF NOT EXISTS vita_hero.finding_photos (
      id TEXT PRIMARY KEY,
      camp_id TEXT NOT NULL,
      kid_id TEXT NOT NULL,
      school_id TEXT NOT NULL,
      check_type TEXT NOT NULL,
      mime TEXT NOT NULL,
      bytes INT NOT NULL,
      data BYTEA NOT NULL,
      caption TEXT DEFAULT '',
      uploaded_by TEXT DEFAULT '',
      uploaded_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS finding_photos_kid ON vita_hero.finding_photos(camp_id, kid_id)`;

  // Every look at a child's photograph is recorded. This is the one artefact
  // where "who opened it" is a question someone will eventually ask.
  await sql`
    CREATE TABLE IF NOT EXISTS vita_hero.photo_access_log (
      id TEXT PRIMARY KEY,
      photo_id TEXT NOT NULL,
      actor_id TEXT NOT NULL,
      actor_role TEXT DEFAULT '',
      viewed_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS photo_access_photo ON vita_hero.photo_access_log(photo_id, viewed_at DESC)`;
}

function decodeBase64(b64: string): Uint8Array {
  const clean = b64.includes(",") ? b64.slice(b64.indexOf(",") + 1) : b64;
  const bin = atob(clean);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function encodeBase64(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

/**
 * Attach a photograph to one finding.
 *
 * Refused unless: the camp has photography switched on, the guardian gave
 * photography consent specifically, and the check is one this camp performs.
 */
export async function uploadFindingPhoto(
  sql: Sql,
  actor: Actor,
  campId: string,
  kidId: string,
  body: Record<string, unknown>
) {
  const access = await assertCampAccess(sql, actor, campId);
  if (!access.canScreen) {
    throw new ApiError(403, "You cannot record findings at this camp", "FORBIDDEN");
  }
  if (access.camp.photos_enabled !== true) {
    throw new ApiError(
      403,
      "Photographs are switched off for this camp. An administrator must enable them, and guardians must be asked again.",
      "PHOTOS_DISABLED"
    );
  }

  const checkType = String(body.checkType || "");
  if (!isCheckType(checkType)) throw new ApiError(400, "Unknown check", "BAD_CHECK");

  const pRows = await sql`
    SELECT consent_status, consent_photos, status FROM vita_hero.camp_participants
    WHERE camp_id = ${campId} AND kid_id = ${kidId} LIMIT 1
  `;
  if (pRows.length === 0) throw new ApiError(404, "That child is not on this camp's list", "NOT_ON_CAMP");
  const consent = (pRows[0].consent_status as string) || "PENDING";
  if (consent !== "GRANTED" && consent !== "PAPER") {
    throw new ApiError(403, "No consent on file for this child", "NO_CONSENT");
  }
  if (pRows[0].consent_photos !== true) {
    throw new ApiError(
      403,
      "This guardian consented to the check-up but not to photographs.",
      "NO_PHOTO_CONSENT"
    );
  }
  if ((pRows[0].status as string) === "RELEASED") {
    throw new ApiError(409, "This child's results have already been released", "RELEASED");
  }

  const mime = String(body.mime || "image/jpeg").toLowerCase();
  if (!ALLOWED_MIME.includes(mime)) {
    throw new ApiError(400, `Photos must be one of: ${ALLOWED_MIME.join(", ")}`, "BAD_MIME");
  }

  let bytes: Uint8Array;
  try {
    bytes = decodeBase64(String(body.data || ""));
  } catch {
    throw new ApiError(400, "That image could not be read", "BAD_IMAGE");
  }
  if (bytes.length === 0) throw new ApiError(400, "Empty image", "BAD_IMAGE");
  if (bytes.length > MAX_PHOTO_BYTES) {
    throw new ApiError(
      413,
      `That photo is ${Math.round(bytes.length / 1024)} KB. Shrink it below ${Math.round(MAX_PHOTO_BYTES / 1024)} KB before uploading.`,
      "TOO_LARGE"
    );
  }

  const perChild = await sql`
    SELECT COUNT(*)::int AS n FROM vita_hero.finding_photos
    WHERE camp_id = ${campId} AND kid_id = ${kidId}
  `;
  if (((perChild[0]?.n as number) || 0) >= MAX_PHOTOS_PER_CHILD) {
    throw new ApiError(409, `A child can have at most ${MAX_PHOTOS_PER_CHILD} photos per camp`, "TOO_MANY");
  }
  const perCamp = await sql`
    SELECT COUNT(*)::int AS n FROM vita_hero.finding_photos WHERE camp_id = ${campId}
  `;
  if (((perCamp[0]?.n as number) || 0) >= MAX_PHOTOS_PER_CAMP) {
    throw new ApiError(
      409,
      `This camp has reached its photo limit of ${MAX_PHOTOS_PER_CAMP}. Photos are for the few cases where a picture changes the decision.`,
      "CAMP_LIMIT"
    );
  }

  const id = `ph_${campId.slice(-8)}_${slugify(kidId).slice(0, 14)}_${Date.now().toString(36)}`;
  // Postgres does the base64 decode, so this works the same on the Workers
  // driver and on node-postgres without either needing a Buffer.
  await sql.query(
    `INSERT INTO vita_hero.finding_photos
       (id, camp_id, kid_id, school_id, check_type, mime, bytes, data, caption, uploaded_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, decode($8, 'base64'), $9, $10)`,
    [id, campId, kidId, access.camp.school_id as string, checkType, mime, bytes.length,
     encodeBase64(bytes), String(body.caption || ""), actor.profileId]
  );

  return { id, bytes: bytes.length, checkType };
}

export async function listFindingPhotos(sql: Sql, actor: Actor, campId: string, kidId: string) {
  const access = await assertCampAccess(sql, actor, campId);
  if (!access.canScreen && !access.canReview) {
    throw new ApiError(403, "You cannot view findings at this camp", "FORBIDDEN");
  }
  const rows = await sql`
    SELECT p.id, p.check_type, p.mime, p.bytes, p.caption, p.uploaded_at, pr.name AS uploaded_by_name
    FROM vita_hero.finding_photos p
    LEFT JOIN vita_hero.profiles pr ON pr.id = p.uploaded_by
    WHERE p.camp_id = ${campId} AND p.kid_id = ${kidId}
    ORDER BY p.uploaded_at
  `;
  return {
    photos: rows.map((r) => ({
      id: r.id as string,
      checkType: r.check_type as string,
      mime: r.mime as string,
      bytes: (r.bytes as number) || 0,
      caption: (r.caption as string) || "",
      uploadedAt: r.uploaded_at ? String(r.uploaded_at) : "",
      uploadedBy: (r.uploaded_by_name as string) || "",
    })),
  };
}

/**
 * Fetch the image itself.
 *
 * Reachable by the camp's clinical staff and by the child's own guardian —
 * nobody else, including a school administrator, who has no clinical reason to
 * look at a photograph of a child. Every fetch is logged.
 */
export async function getFindingPhoto(
  sql: Sql,
  who: { actor?: Actor; guardianProfileId?: string },
  photoId: string
) {
  const rows = await sql.query(
    `SELECT p.*, encode(p.data, 'base64') AS b64, cp.profile_id
     FROM vita_hero.finding_photos p
     LEFT JOIN vita_hero.camp_participants cp
       ON cp.camp_id = p.camp_id AND cp.kid_id = p.kid_id
     WHERE p.id = $1 LIMIT 1`,
    [photoId]
  );
  if (rows.length === 0) throw new ApiError(404, "Photo not found", "NOT_FOUND");
  const p = rows[0];

  let viewerId = "";
  let viewerRole = "";

  if (who.guardianProfileId) {
    if ((p.profile_id as string) !== who.guardianProfileId) {
      throw new ApiError(403, "That is not your child", "NOT_YOUR_CHILD");
    }
    viewerId = who.guardianProfileId;
    viewerRole = "GUARDIAN";
  } else if (who.actor) {
    const actor = who.actor;
    if (isOpsRole(actor.role)) {
      viewerId = actor.profileId;
      viewerRole = actor.role;
    } else {
      // Clinical staff on that camp only. A school administrator manages the
      // roster; they do not need to see a photograph of a child's body.
      const access = await assertCampAccess(sql, actor, p.camp_id as string);
      if (!access.canScreen && !access.canReview) {
        throw new ApiError(403, "You cannot view photos from this camp", "FORBIDDEN");
      }
      if (actor.role === "SCHOOL_ADMIN") {
        throw new ApiError(
          403,
          "Photographs are visible to the clinical team and the child's guardian only.",
          "CLINICAL_ONLY"
        );
      }
      viewerId = actor.profileId;
      viewerRole = actor.role;
    }
  } else {
    throw new ApiError(401, "Sign-in required", "UNAUTHORIZED");
  }

  await sql`
    INSERT INTO vita_hero.photo_access_log (id, photo_id, actor_id, actor_role)
    VALUES (${"pal_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)},
            ${photoId}, ${viewerId}, ${viewerRole})
  `;

  return {
    id: photoId,
    mime: p.mime as string,
    base64: p.b64 as string,
    checkType: p.check_type as string,
    caption: (p.caption as string) || "",
  };
}

export async function deleteFindingPhoto(sql: Sql, actor: Actor, photoId: string) {
  const rows = await sql`SELECT camp_id, kid_id FROM vita_hero.finding_photos WHERE id = ${photoId} LIMIT 1`;
  if (rows.length === 0) throw new ApiError(404, "Photo not found", "NOT_FOUND");
  const access = await assertCampAccess(sql, actor, rows[0].camp_id as string);
  if (!access.canScreen && !access.canReview) {
    throw new ApiError(403, "You cannot change findings at this camp", "FORBIDDEN");
  }
  await sql`DELETE FROM vita_hero.finding_photos WHERE id = ${photoId}`;
  return { deleted: photoId };
}

/** Who has opened this child's photographs. */
export async function photoAccessTrail(sql: Sql, actor: Actor, campId: string, kidId: string) {
  const access = await assertCampAccess(sql, actor, campId);
  if (!access.canReview && !isOpsRole(actor.role)) {
    throw new ApiError(403, "Only a physician or operations can read the access trail", "FORBIDDEN");
  }
  const rows = await sql`
    SELECT l.viewed_at, l.actor_role, p.name AS actor_name, l.photo_id
    FROM vita_hero.photo_access_log l
    JOIN vita_hero.finding_photos f ON f.id = l.photo_id
    LEFT JOIN vita_hero.profiles p ON p.id = l.actor_id
    WHERE f.camp_id = ${campId} AND f.kid_id = ${kidId}
    ORDER BY l.viewed_at DESC LIMIT 200
  `;
  return {
    views: rows.map((r) => ({
      at: r.viewed_at ? String(r.viewed_at) : "",
      role: (r.actor_role as string) || "",
      name: (r.actor_name as string) || "",
      photoId: r.photo_id as string,
    })),
  };
}

/** Turn photography on or off for a camp. Off is the default and the norm. */
export async function setCampPhotos(sql: Sql, actor: Actor, campId: string, enabled: boolean) {
  const access = await assertCampAccess(sql, actor, campId);
  if (!access.canSchedule) throw new ApiError(403, "You cannot change this camp", "FORBIDDEN");
  if (!enabled) {
    const existing = await sql`
      SELECT COUNT(*)::int AS n FROM vita_hero.finding_photos WHERE camp_id = ${campId}
    `;
    if (((existing[0]?.n as number) || 0) > 0) {
      throw new ApiError(
        409,
        "Photos have already been taken at this camp. Delete them first if they should not have been.",
        "PHOTOS_EXIST"
      );
    }
  }
  await sql`UPDATE vita_hero.school_camps SET photos_enabled = ${enabled} WHERE id = ${campId}`;
  return { campId, photosEnabled: enabled };
}

/** Guardian-facing: the photographs taken of their own child. */
export async function guardianPhotos(sql: Sql, profileId: string, kidId: string) {
  const rows = await sql`
    SELECT f.id, f.check_type, f.mime, f.caption, f.uploaded_at, sc.title, sc.date
    FROM vita_hero.finding_photos f
    JOIN vita_hero.camp_participants cp ON cp.camp_id = f.camp_id AND cp.kid_id = f.kid_id
    LEFT JOIN vita_hero.school_camps sc ON sc.id = f.camp_id
    WHERE f.kid_id = ${kidId} AND cp.profile_id = ${profileId} AND cp.status = 'RELEASED'
    ORDER BY f.uploaded_at DESC
  `;
  return {
    photos: rows.map((r) => ({
      id: r.id as string,
      checkType: r.check_type as string,
      mime: r.mime as string,
      caption: (r.caption as string) || "",
      campTitle: (r.title as string) || "",
      campDate: (r.date as string) || "",
      at: r.uploaded_at ? String(r.uploaded_at) : "",
    })),
  };
}
