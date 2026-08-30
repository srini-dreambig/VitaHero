// Sending a text, and being honest about why one did not go.
//
// The console reported "Sent to 0 of 2. Could not reach: …" and that was the
// whole story it had. It could not distinguish a wrong mobile number from a
// worker with no SMS credentials configured at all — and the second was what
// was actually happening, silently, on every send. An operator staring at that
// screen has no way to tell a data problem from a deployment problem, so they
// re-check the numbers, which are fine.
//
// Two things follow. Every send returns a reason, and the reason travels all
// the way to the screen. And the provider is a choice rather than a hard-coded
// assumption, because which gateway a programme uses is an operational
// decision — Twilio needs DLT registration to deliver to Indian numbers at
// all, which is why a school programme in Hyderabad may well be using
// something else.

export type SmsResult = { ok: boolean; reason: string };
export type SmsSender = (to: string, body: string) => Promise<SmsResult>;

export interface SmsEnv {
  SMS_PROVIDER?: string;
  TWILIO_ACCOUNT_SID?: string;
  TWILIO_AUTH_TOKEN?: string;
  /**
   * The number texts are sent from, or a Messaging Service SID (starts MG).
   *
   * This was hard-coded to a US number with a comment claiming Twilio would
   * override it. Twilio does not: `From` must be a number the account owns or
   * a Messaging Service it has, and anything else is rejected outright. So
   * even a correctly credentialed worker sent nothing.
   */
  TWILIO_FROM?: string;
  TEXTBEE_API_KEY?: string;
  TEXTBEE_DEVICE_ID?: string;
  /** Overridable so a self-hosted gateway works without a code change. */
  TEXTBEE_BASE_URL?: string;
}

const TWILIO_API = "https://api.twilio.com/2010-04-01";
const TEXTBEE_DEFAULT = "https://api.textbee.dev/api/v1";

export type ProviderName = "twilio" | "textbee" | "none";

/**
 * Which gateway this deployment is set up to use, and whether it can send.
 *
 * Named explicitly by SMS_PROVIDER, otherwise inferred from whichever
 * credentials are present. Inference is a convenience, never a guess about
 * intent: if neither is configured this returns "none" and says so, rather
 * than picking one and failing at the first send.
 */
export function smsProvider(env: SmsEnv): {
  provider: ProviderName;
  configured: boolean;
  missing: string[];
  detail: string;
} {
  const named = String(env.SMS_PROVIDER || "").trim().toLowerCase();
  const hasTwilio = !!(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN);
  const hasTextbee = !!(env.TEXTBEE_API_KEY && env.TEXTBEE_DEVICE_ID);

  const provider: ProviderName =
    named === "twilio" || named === "textbee"
      ? (named as ProviderName)
      : hasTextbee
        ? "textbee"
        : hasTwilio
          ? "twilio"
          : "none";

  if (provider === "twilio") {
    const missing: string[] = [];
    if (!env.TWILIO_ACCOUNT_SID) missing.push("TWILIO_ACCOUNT_SID");
    if (!env.TWILIO_AUTH_TOKEN) missing.push("TWILIO_AUTH_TOKEN");
    if (!env.TWILIO_FROM) missing.push("TWILIO_FROM");
    return {
      provider,
      configured: missing.length === 0,
      missing,
      detail: missing.length
        ? `Twilio is selected but ${missing.join(", ")} ${missing.length === 1 ? "is" : "are"} not set.`
        : `Twilio, sending from ${env.TWILIO_FROM}.`,
    };
  }

  if (provider === "textbee") {
    const missing: string[] = [];
    if (!env.TEXTBEE_API_KEY) missing.push("TEXTBEE_API_KEY");
    if (!env.TEXTBEE_DEVICE_ID) missing.push("TEXTBEE_DEVICE_ID");
    return {
      provider,
      configured: missing.length === 0,
      missing,
      detail: missing.length
        ? `TextBee is selected but ${missing.join(", ")} ${missing.length === 1 ? "is" : "are"} not set.`
        : `TextBee, device ${env.TEXTBEE_DEVICE_ID}.`,
    };
  }

  return {
    provider: "none",
    configured: false,
    missing: ["SMS_PROVIDER"],
    detail:
      "No SMS gateway is configured, so nothing can be texted: no consent " +
      "requests, no invitations, no urgent-result alerts. Set TEXTBEE_API_KEY " +
      "and TEXTBEE_DEVICE_ID, or TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and " +
      "TWILIO_FROM.",
  };
}

/** Keep a provider's own words, but not a whole error page. */
function trim(body: string): string {
  const one = body.replace(/\s+/g, " ").trim();
  return one.length > 200 ? one.slice(0, 197) + "…" : one;
}

async function sendTwilio(env: SmsEnv, to: string, body: string): Promise<SmsResult> {
  const sid = env.TWILIO_ACCOUNT_SID as string;
  const from = String(env.TWILIO_FROM || "");
  const params = new URLSearchParams({ To: to, Body: body });
  // A Messaging Service SID goes in a different field from a phone number.
  if (from.startsWith("MG")) params.set("MessagingServiceSid", from);
  else params.set("From", from);

  try {
    const resp = await fetch(`${TWILIO_API}/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: "Basic " + btoa(`${sid}:${env.TWILIO_AUTH_TOKEN}`),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    });
    if (resp.ok) return { ok: true, reason: "" };
    return { ok: false, reason: `Twilio ${resp.status}: ${trim(await resp.text())}` };
  } catch (e) {
    return { ok: false, reason: `Twilio unreachable: ${(e as Error).message}` };
  }
}

/**
 * TextBee, written against its published gateway API.
 *
 * The exact request shape has not been exercised against a live account from
 * here, so the provider's own status and response body are reported verbatim
 * on failure. If this is wrong for your device it will say so on the first
 * send rather than failing quietly, which is the whole point of the change.
 */
async function sendTextbee(env: SmsEnv, to: string, body: string): Promise<SmsResult> {
  const base = String(env.TEXTBEE_BASE_URL || TEXTBEE_DEFAULT).replace(/\/+$/, "");
  const url = `${base}/gateway/devices/${env.TEXTBEE_DEVICE_ID}/send-sms`;
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "x-api-key": String(env.TEXTBEE_API_KEY),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ recipients: [to], message: body }),
    });
    if (resp.ok) return { ok: true, reason: "" };
    return { ok: false, reason: `TextBee ${resp.status}: ${trim(await resp.text())}` };
  } catch (e) {
    return { ok: false, reason: `TextBee unreachable: ${(e as Error).message}` };
  }
}

/**
 * The sender the rest of the worker uses.
 *
 * When nothing is configured this refuses immediately and says which settings
 * are missing, rather than reporting the guardian as unreachable — that
 * wording blamed the family's phone number for a deployment gap.
 */
export function makeSender(env: SmsEnv): SmsSender {
  const status = smsProvider(env);
  return async (to: string, body: string): Promise<SmsResult> => {
    if (!status.configured) return { ok: false, reason: status.detail };
    return status.provider === "textbee"
      ? sendTextbee(env, to, body)
      : sendTwilio(env, to, body);
  };
}
