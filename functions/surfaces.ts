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
 */
export const APP_ROLES = ["PARENT", "PHYSICIAN", "SCREENER"];
export const CONSOLE_ROLES = [
  "SCHOOL_ADMIN", "SCREENER", "PHYSICIAN", "ADMIN", "SUPERADMIN",
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
  return {
    error:
      "This number is registered as a parent. The console is for school staff and screening teams — " +
      "open the VitaHero app on your phone to see your child's results.",
    code: "WRONG_SURFACE_CONSOLE",
  };
}
