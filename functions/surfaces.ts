// Which door a person is standing at, and whether it is theirs.
//
// There are two products behind one sign-in endpoint. The Android app is for
// families: a parent's own children, their consent, their results, their
// referrals. The web console is for the people running the programme: school
// administrators, screening teams, supervising physicians and VitaHero
// operations. Different jobs, different screens, and almost no overlap.
//
// The endpoint could not tell them apart. It asked one question — "is this
// number provisioned?" — and let anyone who passed into whichever surface they
// had happened to open. That was survivable only while the answer was "parents
// only"; the moment a doctor could be provisioned, a doctor could sign in to
// the family app, where the code has no notion of a role and would greet them
// as "Parent" with an empty list of children.
//
// So the door asks who is knocking and where. A doctor at the family app is
// not an error on their part — they are a real person with a real sign-in who
// opened the wrong thing — and the answer says which one is theirs.

/** The two products. Anything unrecognised is the app: that is what is in the wild. */
export type Surface = "app" | "console";

/**
 * Who the app admits.
 *
 * Parents, and the clinicians who screen their children at a camp. The app was
 * parents-only and turned a doctor away at the door, on the reasoning that a
 * doctor's work belongs in the console. That was the wrong call for the people
 * doing it: a dentist at a school camp has a phone in their pocket, not a
 * laptop on the desk, and the console is not what they will open in a school
 * hall.
 *
 * What a clinician sees in the app is not a parent's screen with different
 * data on it — it is their assigned camps, the children on those camps, and
 * the screening forms their own specialty covers. A parent sees their own
 * children and nothing else. Same door, different building behind it.
 *
 * A dietician is the same argument again. Their work is continuous rather than
 * camp-shaped — a plan runs for weeks and the food log fills in every day —
 * and the console is no more use to them than it is to a dentist in a school
 * hall. They see the children at the schools they are assigned to, and of
 * those children only what bears on diet.
 */
export const APP_ROLES = ["PARENT", "PHYSICIAN", "SCREENER", "DIETICIAN"];
/**
 * Who the console admits: the people who run the programme, and nobody else.
 *
 * It used to admit clinicians too, from when the console was the only place
 * screening could happen. That has not been true since the clinical work moved
 * to the app, and leaving the door open meant a doctor could sign in to the
 * admin panel and wander a programme they have no business in — a school's
 * whole roster, its billing, its staff — while every button that mattered to
 * them refused. Asked for directly: only admin has anything to do here.
 *
 * SCHOOL_ADMIN stays. A school's own office does the work this product is for:
 * building rosters, chasing consent, reading the report.
 */
export const CONSOLE_ROLES = [
  "SCHOOL_ADMIN", "ADMIN", "SUPERADMIN",
];

/**
 * What the client said it is.
 *
 * Absent means the family app. Every installed copy of the app predates this
 * field, and the console is served by this same worker on every load, so it is
 * always current and always says so. Getting the default the other way round
 * would lock every existing parent out on the day this shipped.
 */
export function surfaceOf(value: unknown): Surface {
  return String(value || "").toLowerCase() === "console" ? "console" : "app";
}

const HUMAN: Record<string, string> = {
  PARENT: "a parent",
  SCHOOL_ADMIN: "a school administrator",
  SCREENER: "a member of a screening team",
  PHYSICIAN: "a doctor",
  DIETICIAN: "a dietician",
  ADMIN: "VitaHero operations",
  SUPERADMIN: "VitaHero operations",
};

/**
 * May this role open this surface? If not, where should they go instead?
 *
 * Returns null when the door is theirs. The message matters as much as the
 * refusal: "this number isn't registered" told a doctor to go and argue with
 * their camp organizer about a number that was registered perfectly well.
 */
export function surfaceRefusal(
  surface: Surface,
  role: string,
  consoleUrl: string
): { error: string; code: string } | null {
  const allowed = surface === "console" ? CONSOLE_ROLES : APP_ROLES;
  if (allowed.indexOf(role) >= 0) return null;

  const who = HUMAN[role] || "staff";
  if (surface === "app") {
    return {
      // Deliberately not "you cannot sign in". They can — the family app is
      // simply not the thing they run. A doctor reviews camp findings; a
      // parent reads their own child's results. Neither screen is any use to
      // the other.
      error:
        `This number is registered as ${who}, not as a parent. The VitaHero app is for families. ` +
        `Sign in to the console at ${consoleUrl} to see your camps and review findings.`,
      code: "WRONG_SURFACE_APP",
    };
  }
  const clinical = role === "PHYSICIAN" || role === "SCREENER";
  if (role === "DIETICIAN") {
    return {
      error: "Your schools, the children on them and the plans you write are in the " +
        "VitaHero app. There is nothing for a dietician to do in the console.",
      code: "WRONG_SURFACE_CONSOLE",
    };
  }
  return {
    error: clinical
      ? "Screening, approval and release happen in the VitaHero app, on the phone you " +
        "screen with. There is nothing for a clinician to do in the console."
      : "This number is registered as a parent. The console is for the people running " +
        "the programme — open the VitaHero app on your phone to see your child's results.",
    code: "WRONG_SURFACE_CONSOLE",
  };
}

/**
 * Clinical work happens on the phone, and only on the phone.
 *
 * Asked for directly: "I don't want it from Admin panel, it must be only from
 * app for now." Recording a measurement, approving a child's findings and
 * releasing a camp are now refused unless the session making the request was
 * minted at the app's door.
 *
 * Checked against the session rather than a header, because a header is a
 * claim the caller makes about itself and a session is a fact about how they
 * signed in. The console's own sign-in is Neon Auth (email, password, social);
 * the app's is a phone OTP. A console user cannot obtain an app session
 * without a provisioned mobile and the code sent to it.
 *
 * "" is a token minted before sessions recorded this, and is refused: the only
 * clients holding one are console users, since the app's clinical screens have
 * never shipped. One sign-in fixes it.
 *
 * The bootstrap ADMIN_API_KEY has no session at all, so it is refused here
 * too. It exists to stand a programme up, not to record a child's eyesight.
 */
export function clinicalSurfaceRefusal(
  surface: string | undefined
): { error: string; code: string } | null {
  if (surface === "app") return null;
  return {
    error:
      "Screening, approval and release happen in the VitaHero app, on the phone the " +
      "clinician is holding at the camp. The console cannot record them.",
    code: "APP_ONLY",
  };
}

/**
 * The same rule for a dietician, with the sentence that fits their job.
 *
 * Same gate, same code, different words. Telling a dietician that "screening,
 * approval and release happen in the app" is telling them about somebody
 * else's work, and the point of a refusal is that the person reading it knows
 * what to do next.
 */
export function dieticianSurfaceRefusal(
  surface: string | undefined
): { error: string; code: string } | null {
  if (surface === "app") return null;
  return {
    error:
      "Your schools, the children on them and the plans you write are in the VitaHero " +
      "app. Sign in there on your phone.",
    code: "APP_ONLY",
  };
}

/**
 * Which sign-in a surface is allowed to use.
 *
 * The app signs in with Firebase phone OTP and nothing else. The console has
 * its own SMS OTP, sent by this worker through the school's gateway, because
 * an administrator at a desk is not running the Android app.
 *
 * Both endpoints accept a declared surface, and the SMS one would happily
 * accept "app" — so a client that asked could take an SMS code and mint a
 * full app session, clinical writes included, having never touched Firebase.
 * Nothing shipped does that; the app has only ever used Firebase. But "no
 * client currently does this" is not the same as "this cannot be done", and
 * the rule is meant to be one door per person.
 */
export function wrongSignInForSurface(
  surface: Surface,
  method: "sms" | "firebase"
): { error: string; code: string } | null {
  if (surface === "app" && method === "sms") {
    return {
      error:
        "The VitaHero app signs in with the code Google sends to your phone. " +
        "Open the app and enter your mobile number there.",
      code: "USE_FIREBASE_OTP",
    };
  }
  if (surface === "console" && method === "firebase") {
    return {
      error: "The console signs in with the code texted to your registered mobile number.",
      code: "USE_SMS_OTP",
    };
  }
  return null;
}

