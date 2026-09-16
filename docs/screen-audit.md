# Screen audit

Every screen in the parent app, checked for two things: where its data comes
from, and whether it holds together on a small phone. Run
`python3 tools/kotlin-audit.py` to re-check the mechanical parts.

A note on what "real data" means here. It is not enough that a number came
from the server — the server has defaults, and a default rendered as a
measurement is worse than an empty screen, because a parent cannot tell the
difference. Several findings below are of that shape.

## Data

| Screen | Source | Notes |
|---|---|---|
| Splash | — | No data. |
| Consent (terms) | local | App terms, before sign-in. |
| Onboarding | static | Four slides; images are remote URLs. |
| Auth / OTP | `/api/auth/*` | Real. Phone OTP via Twilio. |
| Home | `/api/kids`, `/api/camps`, `/api/appointments` | **Fixed:** showed an unscreened child a health score of 80% and "doing well". Now a dash and "Not screened yet". |
| Kids | `/api/kids` (read only) | **Fixed:** height and weight rendered as "0 cm" / "0 kg" for an unmeasured child; now a dash. Labels were English-only. **Removed:** adding a child — see below. |
| Kid detail | `/api/kids` + camp results | **Removed:** the growth entry form. Height and weight are the camp's. |
| Growth charts | WHO/IAP tables + the child's measurement | **Fixed:** fed a zero height into the tables, which returns below the 3rd percentile, and plotted a severe stunting result for a child nobody had measured. Now says there are no measurements. |
| Diet | `/api/meals`, `/api/ai-diet-tip` | Falls back to on-device generic advice, labelled as such. **Fixed:** read NOT_MEASURED as "needs extra care" in one line and "keep up the great balance" in the next. |
| Food recognition | on-device ML Kit + a calorie dictionary | Honest: estimates, and it surfaces the label it actually detected. |
| Rewards | `/api/leaderboard`, meals, streaks | **Fixed:** four of six badges described water drunk, minutes played and "height on track 3 camps in a row", none of it recorded. The leaderboard invented a single entry scoring 1500 against nobody; now empty with an explanation. |
| Camps | `/api/camps` + school camps | Real. Shows a banner when a consent is waiting. |
| Camp detail | `/api/camps` | Real. Links to each child's released result. |
| Camp consent | `/api/camps/consents` | Real. Photography is a separate question, shown only where the camp asked. |
| Camp result | `/api/camps/result` | Real, and physician-approved. Says so while under review rather than showing an empty page. |
| Referrals | `/api/referrals` | Real. |
| Questions | `/api/me/questions` | Real. |
| Library | `/api/library` | Real, matched to this child's own released findings. |
| Everyday illness | `/api/me/symptoms` | Real. The one clinical thing a parent may write. |
| Your child's record | `/api/me/rights`, `/api/me/entitlements` | Real. Holds withdrawal and erasure. |
| Schools | `/api/schools` | Real. |
| Hospitals / Booking | `/api/booking-directory` | Real, city and location aware. |
| Notifications | `/api/notifications` | Real. |
| Family sharing | `/api/family-sharing/*` | Real. **Fixed:** an unparseable flag on a shared child defaulted to GOOD; now NOT_MEASURED. |
| Profile | local + `/api/profiles` | Real. |

**Deleted:** `KidHealthAssessment`, which derived nutrition from height and
weight and then hardcoded dental and eyesight to `GOOD` — so a parent adding a
child was told their teeth and vision were fine, having measured neither.

## Layout

- **Bottom bar clearance.** The navigation bar is about 70dp plus the system
  inset; all five tab screens ended their scroll with a flat 24dp, so the last
  child, camp and badge sat underneath the tabs on every device. One shared
  `bottomBarClearance()` now covers it.
- **Status bar.** Two screens guessed its height with a fixed spacer, which is
  wrong on any phone with a notch or punch-hole. Both use `StatusBarSpacer()`.
- **Text overflow.** 46 names, titles and subtitles in list rows had no line
  limit. A long Telugu name, or a school called "Sri Chaitanya Techno School,
  Kukatpally Branch", wrapped and shoved the row apart. Bounded with
  `maxLines` and an ellipsis. Body prose — a doctor's recommendation, an
  article, a message, a referral reason — is deliberately left to wrap, since
  clipping it would hide clinical advice.

## Translation

The bottom navigation bar was English-only on every device, along with six
labels and every badge title. All now use locale keys. Hindi covers 75% of the
app and Telugu 74%; the remainder falls back to English, which is legible but
not what a Telugu-speaking parent in Hyderabad should get. The audit reports
those figures rather than letting the fallback hide them.

## What a parent may enter

One thing: everyday illness. Fever, cough, loose motions, a fall — chosen from
a fixed list the server owns, with a date and a note. Free text is a note and
never the finding, so nobody can enter a diagnosis. It is history for the
physician at the next camp, labelled as the family's own account, and it never
becomes or changes a clinical flag. The school office cannot see it.

Everything else about a child's health is measured by someone trained and
approved by a physician. A parent who thinks a measurement is wrong asks for a
correction, which the school checks.

## Second pass — behaviour, not just data

The first pass asked where each screen's numbers came from. This one asked
what happens when a parent touches the screen and the network is slow, or the
phone rotates, or the server says no.

- **A booking was confirmed before the server agreed to it.** The appointment
  went on screen and the reminder alarm was set the instant the parent tapped;
  the write went off unwatched. A slot somebody else had taken came back 409 and
  that refusal went nowhere, so the parent kept an appointment that did not
  exist, was reminded of it three hours beforehand, and turned up for it.
- **Sync could not tell "not now" from "not ever."** Every failure was one
  undifferentiated exception, so a permanent refusal was retried forever, and
  `push` abandoned the rest of the batch at the first one — losing that batch's
  children, meals and growth points quietly, since the next local change
  overwrote the queue. Failures are now classified, every entity is attempted
  independently, and a refused record is named so it can be taken back off
  screen.
- **Typed input did not survive a rotation.** Nine screens, including the OTP
  code — which you have to leave the app to read. Twenty-nine pieces of state
  across thirteen screens are now `rememberSaveable`. Transient things (an
  expanded card, a request in flight) are deliberately still not.
- **Thirteen of seventeen primary actions had no in-flight state.** Nothing
  changed between the tap and the answer, so parents tap again — two children,
  two registrations. The four that were fine were the four backed by the one
  view model that had a busy flag.
- **Back buttons.** Five announced nothing to a screen reader; eight said
  "Back" in English to a parent reading Telugu. All thirteen localised.
- **The medical disclaimer was English-only**, on the consent screen a parent
  accepts before signing up. It is the one sentence that most needs to be
  understood.

Checked and found sound, so recorded rather than changed: no `!!`, no unguarded
indexing, ownership scoping on every guardian read, and icons that sit beside a
text label correctly leave `contentDescription` null.

## Children are the school's to add

The app had an Add child screen, reachable twice from the Kids tab, and the
empty state invited a parent to use it. That contradicts what this programme
is: a guardian is provisioned by a roster import and their children arrive with
it, matched on the mobile number the school holds. A child created in the app
had no student reference and no school, so it could not be put on a camp list,
consented for, or screened. It sat there looking real.

Removed: the screen, its route, both entry points, the view-model call, and the
kids half of the sync payload — nothing in the app writes a child now, so
`SyncEntity.KIDS` is gone rather than left dangling. Family sharing still
merges a co-parent's children for display, but no longer pushes them back as
its own; the server would refuse that anyway now, since the roster says whose
child is whose.

`POST /api/kids` answers 403 `ROSTER_MANAGED` rather than being deleted, so an
older build in the field is told why instead of getting a bare 404 — and a 403
is permanent, so it stops resending. Reading children is untouched, as is a
guardian's right to erase one.

The empty state no longer offers a button. It says the school adds children
using the mobile number they hold, and to ask the office if one is missing —
which is the only thing that can actually help.

## Layout across devices

The first pass fixed clearance under the bottom bar and the status bar. This
one looked at what varies between one phone and another: width, the keyboard,
the user's font-size setting, and dark mode.

- **The OTP screen could not reach its own button.** Nothing scrolled, and the
  content needs about 470dp. Portrait on a 360x800 phone, system bars take
  ~72dp and a numeric keypad ~280dp, leaving ~448dp — and the keypad opens by
  itself on arrival. Verify was clipped off the bottom, worse with an error
  showing or the font scale raised. It scrolls now, with a minimum height equal
  to the viewport so the button still sits at the bottom when there is room.
- **"Resend cod".** Three labels were cut to a fixed character count —
  `.take(10)`, `.take(25)` — which truncates English mid-word and Telugu inside
  a consonant cluster, where the pieces do not render as letters at all.
  Replaced with a line limit and an ellipsis, which is applied by the text
  layout and knows where a character ends.
- **"Didn't get the code?Resend in 30s"** — two strings laid against each other
  with nothing between them, in every language.
- **Digit boxes were a fixed 58dp holding a fixed 24sp digit.** `sp` follows
  the phone's font setting, so at 200% the digit was taller than its box.
- **Error panels were a hardcoded light red** on the OTP and sign-in screens: a
  bright pink panel in the middle of a dark screen in dark mode.
- **The main button was a fixed 56dp.** A translated label that needs two lines
  — and at a raised font scale the English ones do — lost the second line, so
  the button read as half a sentence. It has a minimum height now and the label
  wraps.

Not changed, and worth knowing: the app is portrait-only in practice and has
not been looked at in landscape or on a tablet.

## Still open

The Android app has never been compiled. `dl.google.com` is blocked by policy
in the environment this was built in, so no SDK or AndroidX artifact is
reachable. `tools/kotlin-audit.py` covers what it can — redeclarations,
unresolved imports, bracket balance, named arguments, exhaustive `when` over
the flag enum, missing translations, unused imports — and it has now caught
four real bugs. It is not a compiler. Run `./gradlew compileDebugKotlin`.
