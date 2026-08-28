// Firestore REST API client for Cloudflare Workers.
// Authenticates via a Firebase service account JSON and provides
// typed helpers for document CRUD, queries, and batch writes.

interface ServiceAccount {
  type: string;
  project_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
}

type Op = "EQUAL" | "NOT_EQUAL" | "GREATER_THAN" | "GREATER_THAN_OR_EQUAL"
  | "LESS_THAN" | "LESS_THAN_OR_EQUAL" | "ARRAY_CONTAINS" | "IN" | "ARRAY_CONTAINS_ANY";

type Filter =
  | { field: string; op: Op; value: unknown }
  | { compositeFilter: { op: "AND" | "OR"; filters: Filter[] } };

type Order = { field: string; direction: "ASCENDING" | "DESCENDING" };

interface Write {
  update?: { name: string; fields: Record<string, unknown> };
  delete?: string;
}

let cachedToken: { token: string; expiresAt: number } | null = null;
let cachedSA: ServiceAccount | null = null;

function getServiceAccount(envKey: string): ServiceAccount {
  if (cachedSA) return cachedSA;
  if (!envKey) throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY not configured");
  cachedSA = JSON.parse(envKey) as ServiceAccount;
  return cachedSA;
}

// ── Encoding helpers ──────────────────────────────────────────

function base64urlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const contents = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");
  const der = base64ToBuffer(contents);
  return crypto.subtle.importKey(
    "pkcs8", der,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false, ["sign"],
  );
}

// ── OAuth2 access token ───────────────────────────────────────

async function getAccessToken(sa: ServiceAccount): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.token;
  }
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/datastore",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };
  const enc = new TextEncoder();
  const headerB64 = base64urlEncode(enc.encode(JSON.stringify(header)));
  const payloadB64 = base64urlEncode(enc.encode(JSON.stringify(payload)));
  const signingInput = `${headerB64}.${payloadB64}`;

  const key = await importPrivateKey(sa.private_key);
  const sig = await crypto.subtle.sign(
    { name: "RSASSA-PKCS1-v1_5" }, key, enc.encode(signingInput),
  );
  const sigB64 = base64urlEncode(new Uint8Array(sig));
  const jwt = `${headerB64}.${payloadB64}.${sigB64}`;

  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`OAuth token exchange failed: ${resp.status} ${text}`);
  }
  const data = await resp.json() as { access_token: string; expires_in: number };
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };
  return cachedToken.token;
}

// ── Firestore value conversion ────────────────────────────────

function toFirestoreValue(value: unknown): Record<string, unknown> {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") {
    if (Number.isInteger(value)) return { integerValue: String(value) };
    return { doubleValue: value };
  }
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(toFirestoreValue) } };
  }
  if (value instanceof Date) {
    return { timestampValue: value.toISOString() };
  }
  if (typeof value === "object") {
    const fields: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      fields[k] = toFirestoreValue(v);
    }
    return { mapValue: { fields } };
  }
  return { nullValue: null };
}

function fromFirestoreValue(v: Record<string, unknown>): unknown {
  if (v.nullValue !== undefined) return null;
  if (v.stringValue !== undefined) return v.stringValue;
  if (v.booleanValue !== undefined) return v.booleanValue;
  if (v.integerValue !== undefined) return parseInt(v.integerValue as string, 10);
  if (v.doubleValue !== undefined) return v.doubleValue;
  if (v.timestampValue !== undefined) return v.timestampValue;
  if (v.arrayValue !== undefined) {
    const arr = (v.arrayValue as { values: Record<string, unknown>[] }).values;
    return arr ? arr.map(fromFirestoreValue) : [];
  }
  if (v.mapValue !== undefined) {
    const fields = (v.mapValue as { fields: Record<string, unknown> }).fields;
    if (!fields) return {};
    const obj: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(fields)) {
      obj[k] = fromFirestoreValue(val as Record<string, unknown>);
    }
    return obj;
  }
  return null;
}

function toFirestoreFields(obj: Record<string, unknown>): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) fields[k] = toFirestoreValue(v);
  }
  return fields;
}

function fromFirestoreFields(fields: Record<string, unknown>): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) {
    obj[k] = fromFirestoreValue(v as Record<string, unknown>);
  }
  return obj;
}

// ── Firestore client ──────────────────────────────────────────

export class FirestoreClient {
  private sa: ServiceAccount;
  private projectId: string;
  private baseUrl: string;

  constructor(envKey: string) {
    this.sa = getServiceAccount(envKey);
    this.projectId = this.sa.project_id;
    this.baseUrl = `https://firestore.googleapis.com/v1/projects/${this.projectId}/databases/(default)/documents`;
  }

  /** Returns the Firebase project ID (used for token verification). */
  getProjectId(): string {
    return this.projectId;
  }

  private async headers(): Promise<Record<string, string>> {
    const token = await getAccessToken(this.sa);
    return { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" };
  }

  private docPath(collection: string, id: string): string {
    return `${this.baseUrl}/${collection}/${id}`;
  }

  /** Get a single document. Returns null if not found. */
  async getDoc(collection: string, id: string): Promise<Record<string, unknown> | null> {
    const resp = await fetch(this.docPath(collection, id), {
      headers: await this.headers(),
    });
    if (resp.status === 404) return null;
    if (!resp.ok) throw new Error(`Firestore getDoc ${collection}/${id} failed: ${resp.status}`);
    const data = await resp.json() as { fields?: Record<string, unknown> };
    if (!data.fields) return null;
    return fromFirestoreFields(data.fields);
  }

  /** Get a document at a full path (e.g. "provisioned_parents/123/kids/kid1"). */
  async getDocByPath(path: string): Promise<Record<string, unknown> | null> {
    const resp = await fetch(`${this.baseUrl}/${path}`, {
      headers: await this.headers(),
    });
    if (resp.status === 404) return null;
    if (!resp.ok) throw new Error(`Firestore getDocByPath ${path} failed: ${resp.status}`);
    const data = await resp.json() as { fields?: Record<string, unknown> };
    if (!data.fields) return null;
    return fromFirestoreFields(data.fields);
  }

  /** Set a document at a full path (e.g. "provisioned_parents/123/kids/kid1"). */
  async setDocByPath(path: string, fields: Record<string, unknown>): Promise<void> {
    const body = JSON.stringify({ fields: toFirestoreFields(fields) });
    const resp = await fetch(`${this.baseUrl}/${path}`, {
      method: "PATCH",
      headers: await this.headers(),
      body,
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Firestore setDocByPath ${path} failed: ${resp.status} ${text}`);
    }
  }

  /** Merge-update a document at a full path. */
  async mergeDocByPath(path: string, fields: Record<string, unknown>): Promise<void> {
    const mask = Object.keys(fields).map(f => `updateMask.fieldPaths=${encodeURIComponent(f)}`).join("&");
    const body = JSON.stringify({ fields: toFirestoreFields(fields) });
    const resp = await fetch(`${this.baseUrl}/${path}?${mask}`, {
      method: "PATCH",
      headers: await this.headers(),
      body,
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Firestore mergeDocByPath ${path} failed: ${resp.status} ${text}`);
    }
  }

  /** List all documents in a collection or subcollection path. Returns array of {id, ...fields}. */
  async listDocs(collectionOrPath: string): Promise<Array<Record<string, unknown>>> {
    const resp = await fetch(`${this.baseUrl}/${collectionOrPath}?pageSize=1000`, {
      headers: await this.headers(),
    });
    if (!resp.ok) {
      if (resp.status === 404) return [];
      const text = await resp.text();
      throw new Error(`Firestore listDocs ${collectionOrPath} failed: ${resp.status} ${text}`);
    }
    const data = await resp.json() as { documents?: Array<{ name: string; fields: Record<string, unknown> }> };
    if (!data.documents) return [];
    return data.documents.map(doc => {
      const id = doc.name.split("/").pop() || "";
      return { id, ...fromFirestoreFields(doc.fields) };
    });
  }

  /** Create or replace a document. */
  async setDoc(collection: string, id: string, fields: Record<string, unknown>): Promise<void> {
    const body = JSON.stringify({ fields: toFirestoreFields(fields) });
    const resp = await fetch(this.docPath(collection, id), {
      method: "PATCH",
      headers: await this.headers(),
      body,
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Firestore setDoc ${collection}/${id} failed: ${resp.status} ${text}`);
    }
  }

  /** Merge-update a document (only specified fields). */
  async mergeDoc(collection: string, id: string, fields: Record<string, unknown>): Promise<void> {
    const mask = Object.keys(fields).map(f => `updateMask.fieldPaths=${encodeURIComponent(f)}`).join("&");
    const body = JSON.stringify({ fields: toFirestoreFields(fields) });
    const resp = await fetch(`${this.docPath(collection, id)}?${mask}`, {
      method: "PATCH",
      headers: await this.headers(),
      body,
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Firestore mergeDoc ${collection}/${id} failed: ${resp.status} ${text}`);
    }
  }

  /** Delete a document at an explicit path (e.g. "profiles/{uid}/kids/{kidId}"). */
  async deleteDocByPath(path: string): Promise<void> {
    const resp = await fetch(`${this.baseUrl}/${path}`, {
      method: "DELETE",
      headers: await this.headers(),
    });
    if (!resp.ok && resp.status !== 404) {
      throw new Error(`Firestore deleteDocByPath ${path} failed: ${resp.status}`);
    }
  }

  /** Delete a document. */
  async deleteDoc(collection: string, id: string): Promise<void> {
    const resp = await fetch(this.docPath(collection, id), {
      method: "DELETE",
      headers: await this.headers(),
    });
    if (!resp.ok && resp.status !== 404) {
      throw new Error(`Firestore deleteDoc ${collection}/${id} failed: ${resp.status}`);
    }
  }

  /** Run a structured query on a top-level collection. Returns array of {id, ...fields}. */
  async query(
    collection: string,
    filters?: Filter[],
    orderBy?: Order[],
    limit?: number,
  ): Promise<Array<Record<string, unknown>>> {
    return this.runQuery(collection, filters, orderBy, limit, false);
  }

  /** Run a collection group query (allDescendants). */
  async collectionGroup(
    collectionId: string,
    filters?: Filter[],
    orderBy?: Order[],
    limit?: number,
  ): Promise<Array<Record<string, unknown>>> {
    return this.runQuery(collectionId, filters, orderBy, limit, true);
  }

  private async runQuery(
    collectionId: string,
    filters?: Filter[],
    orderBy?: Order[],
    limit?: number,
    allDescendants?: boolean,
  ): Promise<Array<Record<string, unknown>>> {
    const sq: Record<string, unknown> = {
      from: [{ collectionId, allDescendants: !!allDescendants }],
    };
    if (filters && filters.length > 0) {
      sq.where = this.buildFilter(filters.length === 1 ? filters[0] : { compositeFilter: { op: "AND", filters } });
    }
    if (orderBy && orderBy.length > 0) {
      sq.orderBy = orderBy.map(o => ({
        field: { fieldPath: o.field },
        direction: o.direction,
      }));
    }
    if (limit) sq.limit = limit;

    const resp = await fetch(`${this.baseUrl}:runQuery`, {
      method: "POST",
      headers: await this.headers(),
      body: JSON.stringify({ structuredQuery: sq }),
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Firestore query ${collectionId} failed: ${resp.status} ${text}`);
    }
    const results = await resp.json() as Array<{ document?: { name: string; fields: Record<string, unknown> } }>;
    const docs: Array<Record<string, unknown>> = [];
    for (const r of results) {
      if (r.document) {
        const id = r.document.name.split("/").pop() || "";
        const fields = fromFirestoreFields(r.document.fields);
        docs.push({ id, ...fields });
      }
    }
    return docs;
  }

  private buildFilter(f: Filter): Record<string, unknown> {
    if ("compositeFilter" in f) {
      return {
        compositeFilter: {
          op: f.compositeFilter.op,
          filters: f.compositeFilter.filters.map(ff => this.buildFilter(ff)),
        },
      };
    }
    return {
      fieldFilter: {
        field: { fieldPath: f.field },
        op: f.op,
        value: toFirestoreValue(f.value),
      },
    };
  }

  /** Batch write (up to 500 writes). */
  async batchWrite(writes: Write[]): Promise<void> {
    if (writes.length === 0) return;
    const body = {
      writes: writes.map(w => {
        if (w.update) {
          return { update: { name: w.update.name, fields: toFirestoreFields(w.update.fields) } };
        }
        if (w.delete) {
          return { delete: w.delete };
        }
        return {};
      }),
    };
    const resp = await fetch(`${this.baseUrl}:batchWrite`, {
      method: "POST",
      headers: await this.headers(),
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Firestore batchWrite failed: ${resp.status} ${text}`);
    }
  }

  /** Build a document path for batch writes. */
  docName(collection: string, id: string): string {
    return `projects/${this.projectId}/databases/(default)/documents/${collection}/${id}`;
  }

  /** Count documents in a collection (with optional filters). */
  async count(collection: string, filters?: Filter[]): Promise<number> {
    // Use runQuery and count results — avoids aggregation query format issues
    const docs = await this.query(collection, filters, undefined, 1000);
    return docs.length;
  }

  /** Check if a subcollection path exists and has documents. */
  async subcollectionExists(parentPath: string): Promise<boolean> {
    const resp = await fetch(`${this.baseUrl}/${parentPath}?pageSize=1`, {
      headers: await this.headers(),
    });
    if (!resp.ok) return false;
    const data = await resp.json() as { documents?: unknown[] };
    return !!(data.documents && data.documents.length > 0);
  }
}

// ── Firebase ID token verification (JWKS signature check) ─────────────────
//
// Verifies the RS256 signature of a Firebase Auth ID token against Google's
// public JWKS endpoint, then validates standard claims (iss, aud, exp).
// Falls back to decode-only in DEV_MODE for local testing.

interface DecodedToken {
  uid: string;
  phone?: string;
  email?: string;
}

interface JwtHeader {
  kid: string;
  alg: string;
  typ: string;
}

interface JwtPayload {
  iss: string;
  aud: string;
  exp: number;
  iat: number;
  sub: string;
  user_id?: string;
  phone_number?: string;
  email?: string;
}

// Cache JWKS keys (refresh every 1 hour)
let jwksCache: { keys: Record<string, JsonWebKey>; fetchedAt: number } | null = null;
const JWKS_CACHE_TTL = 3600_000; // 1 hour
const FIREBASE_JWKS_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";

async function fetchJwks(): Promise<Record<string, JsonWebKey>> {
  if (jwksCache && Date.now() - jwksCache.fetchedAt < JWKS_CACHE_TTL) {
    return jwksCache.keys;
  }
  const resp = await fetch(FIREBASE_JWKS_URL);
  if (!resp.ok) throw new Error(`JWKS fetch failed: ${resp.status}`);
  // The endpoint returns a JWK Set: { keys: [ ... ] }. Build a kid→JWK map,
  // since verifyFirebaseToken() looks keys up by the token header's kid.
  const data = await resp.json() as { keys?: Array<JsonWebKey & { kid?: string }> };
  const map: Record<string, JsonWebKey> = {};
  for (const k of data.keys || []) {
    if (k.kid) map[k.kid] = k;
  }
  jwksCache = { keys: map, fetchedAt: Date.now() };
  return map;
}

function base64urlDecode(str: string): string {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  return atob(padded + pad);
}

function base64urlToBuffer(str: string): ArrayBuffer {
  const binary = base64urlDecode(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

/**
 * Verify a Firebase ID token's RS256 signature and standard claims.
 * Returns the decoded payload on success, or null on failure.
 */
export async function verifyFirebaseToken(
  token: string,
  projectId: string,
): Promise<DecodedToken | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const headerB64 = parts[0];
    const payloadB64 = parts[1];
    const signatureB64 = parts[2];

    const header = JSON.parse(base64urlDecode(headerB64)) as JwtHeader;
    if (header.alg !== "RS256") return null;

    const payload = JSON.parse(base64urlDecode(payloadB64)) as JwtPayload;

    // Validate issuer
    const expectedIss = `https://securetoken.google.com/${projectId}`;
    if (payload.iss !== expectedIss) return null;

    // Validate audience (aud is the Firebase project ID)
    if (payload.aud !== projectId) return null;

    // Validate expiry
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) return null;

    // Fetch JWKS and find the key by kid
    const jwks = await fetchJwks();
    const jwk = jwks[header.kid];
    if (!jwk) return null;

    // Import the public key for signature verification
    const cryptoKey = await crypto.subtle.importKey(
      "jwk", jwk,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false, ["verify"],
    );

    // Verify the signature
    const signingInput = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
    const signature = base64urlToBuffer(signatureB64);
    const valid = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5", cryptoKey, signature, signingInput,
    );
    if (!valid) return null;

    return {
      uid: payload.user_id || payload.sub || "",
      phone: payload.phone_number,
      email: payload.email,
    };
  } catch {
    return null;
  }
}

/**
 * Decode-only fallback (no signature verification) — used in DEV_MODE only.
 * In production, use verifyFirebaseToken() instead.
 */
export function decodeFirebaseToken(token: string): DecodedToken | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(base64urlDecode(parts[1])) as JwtPayload;
    return {
      uid: payload.user_id || payload.sub || "",
      phone: payload.phone_number,
      email: payload.email,
    };
  } catch {
    return null;
  }
}
