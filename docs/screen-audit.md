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
| Kids | `/api/kids` | **Fixed:** height and weight rendered as "0 cm" / "0 kg" for an unmeasured child; now a dash. Labels were English-only. |
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

## Still open

The Android app has never been compiled. `dl.google.com` is blocked by policy
in the environment this was built in, so no SDK or AndroidX artifact is
reachable. `tools/kotlin-audit.py` covers what it can — redeclarations,
unresolved imports, bracket balance, named arguments, exhaustive `when` over
the flag enum, missing translations, unused imports — and it has now caught
four real bugs. It is not a compiler. Run `./gradlew compileDebugKotlin`.
