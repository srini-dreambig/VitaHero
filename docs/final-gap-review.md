# Final gap review — requirements vs live code

Branch `feature/hospital-booking-specialty` at `0991d48`. Checked against the code, not memory.
G1, G2 and G4 were fixed afterwards on the same branch (see *Fixed* below).

## Requirement by requirement

| Requirement | Live code | Verdict |
|---|---|---|
| Medical camps in schools with doctors | Console creates camps, builds the roster from classes, assigns physicians/screeners (`camps.ts`, `assignCampStaff`), consent requests by SMS/paper | Met |
| Results stored, parents view in app | Clinicians record findings → physician review → release; app reads `guardianCampResult`, notifications feed carries RESULT/REFERRAL | Met |
| Parents can only add illness | Server refuses parents adding children, enrolling, camp registration, camp results, growth (403). Parents can write: symptoms/illness, meal ticks, bookings, family sharing, own settings, and data-rights actions (export, delete child — legal right) | Met (with the intended extras the other requirements need) |
| Printed health report at camp end | Console "Print health reports" → one page per signed-off child, access-logged (`health-report.ts`) | Met — English only |
| Dietician plan, parents record, badges | Dietician console writes plan → app shows it and turns targets into today's ticks → streak recomputed server-side → badges | Met — G1 fixed |
| Ill kid books a partner hospital doctor by geolocation | GPS → hospitals within 50 km / same city → doctor slots → booking; double-booking blocked; SMS to doctor + hospital | Met, except G3 (your decision) — G2 fixed |

## Gaps found

- **G1 — Badges are not tied strictly to the dietician's plan.** The day's checklist mixes the dietician's targets with an auto-generated menu and meals the parent adds; ticking any of them earns streaks/badges. *Fix:* when a child has a plan, show only plan targets and count only those for badges; keep the generated menu only for children with no plan.
- **G2 — Cancelling a booking tells nobody.** Booking texts the doctor and hospital; cancelling (`DELETE /api/appointments/:id`) just deletes the row, so the hospital keeps the slot as a no-show. *Fix:* send a cancellation SMS to the same numbers.
- **G3 — Hospitals have no list of their bookings.** They only learn by SMS. If the SMS provider is not configured in production, they never hear. *Decide:* add a bookings view to the console for hospital staff, or accept SMS-only and verify the SMS secret in production.
- **G4 — No notification when a dietician writes or changes a plan.** The feed has CAMP, CONSENT, RESULT, REFERRAL, REWARD, CHECKUP — no plan event. *Fix:* add a PLAN notification.
- **G5 — Printed report is English only.** Parents use Hindi/Telugu in the app. *Decide:* acceptable for print, or add a language choice like the consent slip has.
- **G6 — The iOS app is a stale prototype.** `ios/` has not changed since 2026-10-05, uses none of the current endpoints (results, symptoms, diet plan, badges, hospitals, family approval), and has mock telehealth links. *Decide:* launch Android only, or plan an iOS rebuild.

## Final to-do

### Code — fixed on this branch
1. G1 — Fixed. On a day a dietician's plan covers, only the plan's targets count toward streaks and badges (`badges.ts`). The server stores anything else sent under the plan slot as an ordinary item (`POST /api/meals`). With a plan, the app's checklist shows the plan's targets plus photographed snacks as a log, and its progress counts only the targets (`DietScreen.kt`). Children with no plan keep the generated menu as before.
2. G2 — Fixed. Cancelling texts the doctor and the hospital desk, the same numbers that were told about the booking. Moving a booking to another slot also tells them the old slot is free (`booking.ts`, `cancelAppointment`).
3. G4 — Fixed. The notifications feed has a diet-plan item: "New diet plan" or "Diet plan updated", naming the dietician and the child. It is sent as type `DIET`, which every shipped app build already shows with a meal icon.

Tests: `gaps.test.ts` (cancellation, reschedule, plan-only streak) and `diet-plan-feed.test.ts` (plan-slot guard, notification).

### Decisions (owner, 2026-10-28)
4. G3 — **SMS only.** Hospitals hear about bookings and cancellations by text; no console bookings view. This makes the SMS secret (item 8) a launch blocker.
5. G5 — **English only** for the printed report.
6. G6 — **Both Android and iOS.** The iOS app has to be rebuilt against the live API before it can ship; the current `ios/` code is mock data only (it calls no endpoint), so deploying the server cannot break it, but it is not releasable as it stands.

### Your actions before release
7. Run the duplicate-booking check (in `docs/product-decisions.md`) against production.
8. Confirm the SMS provider secret (`TEXTBEE_API_KEY` or the `TWILIO_*` trio) is set on the production Worker.
9. Make sure every partner hospital has latitude/longitude in the console, or it only appears by city match.
10. Play reviewer: Firebase test number + provisioned demo family (steps in `docs/product-decisions.md`).
11. Native review of Hindi and Telugu strings.
12. Approve deploy of schema v13 and a new Android build; then validate on device (two accounts for family sharing).
13. Delete `D:\tmp_probe.ts`.
