# Product decisions — camps, results, family, booking

Calls made as product owner on branch `feature/hospital-booking-specialty`.
"Done" means implemented and tested on this branch (not deployed).

| # | Question | Decision | State |
|---|----------|----------|-------|
| 1 | How does the Play reviewer sign in? | No code backdoor. A Firebase test phone number, provisioned by an admin with sample data. | Needs owner — steps below |
| 2 | Deploy schema v13 and ship a build? | Only with explicit approval. | Needs owner |
| 3 | Bookings made before the double-booking guard | Run the read-only check below before deploying; resolve any duplicates by hand. | Needs owner |
| 4 | Booking text sent to the hospital | Keeps the parent's name and phone: the hospital calls back to confirm. | Decided, no change |
| 5 | Hospital search radius | Stays 50 km. A "nearest hospital" fallback beyond it is optional, later. | Decided, no change |
| 6 | Can parents edit camp results or growth? | No. Camp results and growth measurements are the clinicians' record. The server refuses a parent's write (403 `CLINICIAN_RECORD`), answers an unchanged echo from an older app with 200, and the app no longer sends either. Parents still add illnesses (symptoms), meals and bookings. | Done |
| 7 | Can a family code alone open a family? | No. Joining is a request (`PENDING`) the owner approves or declines on the Family screen. Until approved the requester sees no children and their profile is unchanged; a settings save cannot write another family's code; a declined request cannot re-ask. | Done |
| 8 | A fifth bottom tab? | No. | Decided, no change |
| 9 | Camp findings in the app's PDF | The printed report comes from the clinician console. Adding findings to the app's own PDF is optional, later. | Later |
| 10 | Hindi and Telugu strings | Machine-written; need a native speaker's review (four new family-request strings included). | Needs review |
| 11 | `D:\tmp_probe.ts` | Stray local file outside the repo. | Owner deletes |

## Play reviewer sign-in (decision 1)

1. Firebase console → Authentication → Sign-in method → Phone → *Phone numbers for testing*:
   add a number that is not a real subscriber (e.g. `+91 99999 0XXXX`) with a fixed 6-digit code.
2. In the admin console, add that number as a guardian on a demo school's roster,
   with one or two sample children and a released demo camp.
3. In Play Console → App content → App access, give the reviewer the number and code.
4. Never reuse the number for a real family; remove it after review if preferred.

## Before deploying schema v13 (decisions 2 and 3)

Schema v13 adds `vita_hero.co_parents.status`. Existing rows read as `APPROVED`,
so families already sharing keep working.

Read-only duplicate-booking check, run against production before the deploy:

```sql
SELECT doctor_id, date, time, count(*)
FROM vita_hero.appointments
WHERE doctor_id IS NOT NULL
GROUP BY 1, 2, 3
HAVING count(*) > 1;
```

No rows: safe. Any rows: decide with the hospital which booking stands before deploying.

If the deploy goes out with duplicates still there, it does not fail: schema v13
is applied, but the one-booking-per-slot index is skipped and is not retried on
a later start. After resolving the duplicates, create it once by hand:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS appointments_slot_once
  ON vita_hero.appointments (doctor_id, date, time) WHERE doctor_id IS NOT NULL;
```

Upgrade from the current production schema (v11) to v13 was tested against a
real Postgres with existing families, a co-parent, bookings and meals: existing
co-parents stay approved, and the parent endpoints answer as before.

Older app builds keep working: a join from an old build creates a pending request
(the old app then shows no shared children until approval), and an old build's
camp/growth echo is answered without being written.
