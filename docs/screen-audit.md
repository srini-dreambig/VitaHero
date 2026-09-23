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
| Onboarding | static | Four slides. The images were remote URLs on a CDN belonging to a vendor no longer involved; they are dropped, and the slides draw as a tinted panel above the title. |
| Auth / OTP | `/api/auth/*` | Real. Phone OTP via Twilio. |
| Home | `/api/kids`, `/api/camps`, `/api/appointments` | **Fixed:** showed an unscreened child a health score of 80% and "doing well". Now a dash and "Not screened yet". |
| Kids | `/api/kids` (read only) | **Fixed:** height and weight rendered as "0 cm" / "0 kg" for an unmeasured child; now a dash. Labels were English-only. **Removed:** adding a child — see below. |
| Kid detail | `/api/kids` + camp results | **Removed:** the growth entry form. Height and weight are the camp's. |
| Growth charts | WHO/IAP tables + the child's measurement | **Fixed:** fed a zero height into the tables, which returns below the 3rd percentile, and plotted a severe stunting result for a child nobody had measured. Now says there are no measurements. |
| Diet | `/api/meals`, `/api/ai-diet-tip`, `/api/me/diet-plan` | Falls back to on-device generic advice, labelled as such. **Fixed:** read NOT_MEASURED as "needs extra care" in one line and "keep up the great balance" in the next. A dietician's plan, where one exists, sits above the generated tips with its author's name on it — the two should not read as equals. |
| Food recognition | on-device ML Kit, or `/api/food-recognition` with consent | Honest: estimates, and it surfaces the label it actually detected. The photograph leaves the handset only where the guardian said it may, per child; without that answer ML Kit does the work alone. |
| Rewards | `/api/badges`, `/api/leaderboard`, `/api/me/hero` | **Fixed:** four of six badges described water drunk, minutes played and "height on track 3 camps in a row", none of it recorded. The leaderboard invented a single entry scoring 1500 against nobody; now empty with an explanation. Badges are earned on the server now, so they survive a reinstall and mean the same thing for every child. Carries this month's VitaHero, who is named only where their guardian agreed. |
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

Landscape was the gap in that pass, and it was a real one. `MainActivity` had
no `screenOrientation`, so the app rotated into layouts nobody had designed.
Onboarding was the worst of them: its slide image is `fillMaxWidth()
.aspectRatio(0.78f)`, which derives height from width, so on an 800dp-wide
landscape screen it asked for 1025dp of height and ran off the bottom. It now
matches the height constraint first, which fits either way round. Onboarding
was also the one screen still guessing the status bar with a flat 36dp — the
other eighteen use the real inset — so its logo and Skip button sat under a
cutout.

The app is locked to portrait now. That is a product decision as much as a
technical one and it reverses in one line, which the manifest says: every
screen is laid out for a portrait phone and landscape has never been designed,
so claiming to support it was worse than not. Android 12L and later ignore the
lock on large screens, so foldables and tablets still rotate — which is why the
saved screen state matters regardless.

## Performance, measured

- **Every hot query read the whole table.** Built the real schema, filled it to
  40,000 guardians and 60,000 children, and asked the planner: sequential scan
  on all six of the app's busiest reads, including the authentication lookup
  that runs on every request. Thirteen indexes, chosen not generated — an
  index costs about 8µs per inserted row and a camp day is write-heavy, so
  only leading columns of genuinely hot queries get one. `planner.test.ts`
  asserts plan shape so it cannot drift back.
- **Opening the app was twenty sequential round trips.** Profile, then
  children, then a call per child, then seven more, then two more calls per
  child. There are two levels of real dependency in it; it is two round trips
  now, whatever the family size. About 2.9s to 0.3s at 150ms latency.
- **The PDF report ran on the main thread**, and its progress indicator was
  theatre: it showed for a fixed 800ms while nothing happened, hid itself, and
  only then did the work — so the freeze began exactly when the user was told
  it had finished.
- **EncryptedSharedPreferences was rebuilt on every access**, seven times a
  launch, each one a keystore round trip. Built once now.

Looked at and left alone, with reasons:

- **46 `collectAsState` rather than `collectAsStateWithLifecycle`.** Every one
  is over a `StateFlow`, which has no upstream to keep warm, and Compose pauses
  recomposition when the window is not visible. Converting them is best
  practice with little measurable gain here, and it is 46 sites nobody can
  compile in this environment.
- **The in-memory caches** (meals, streaks, tips, leaderboards, booking slots)
  are keyed by child or doctor and cleared on sign-out. Bounded, not leaks.
- **The onboarding flag is read from the keystore during construction**, on the
  main thread. It is one read, now against a cached instance, and moving it off
  the critical path risks showing a returning parent the onboarding screen for
  a frame. Not worth the trade without a device to check it on.

## The backend and the console, measured

The app pass above stopped at the phone. This one starts at the worker.

On Cloudflare every query is an outbound subrequest to Neon, so what a page
costs is not how many queries it runs but **how many times it waits**. Reads
issued together cost one network latency between them; reads issued one after
another cost one each. A page doing seven independent aggregates sequentially
pays seven round trips to a database that may be on another continent, and no
amount of index tuning touches that.

`functions/roundtrips.test.ts` measures it against a real school with 400
children on the roll, and holds each page to a ceiling. Before and after:

| Console page        | queries | waits before | waits after |
|---------------------|---------|--------------|-------------|
| Ops overview        | 6       | 6            | 1           |
| Ops analytics       | 7       | 7            | 1           |
| School roster (500) | 2       | 2            | 1           |
| Camp participants   | 2       | 2            | 2           |
| Camp pack (offline) | 3       | 3            | 2           |
| Review queue        | 2       | 2            | 2           |
| School report       | 6       | 6            | 3           |
| Programme report    | 5       | 5            | 1           |
| Referral dashboard  | 3       | 3            | 1           |

Off the console but on the same sweep: a guardian's data-rights export read ten
tables one after another and now waits twice — nine of the ten are keyed on the
guardian alone, and only the three keyed on the children have to wait for the
children's ids.

The ceilings above 1 are deliberate, and the test says so:

- **The access check stays sequential.** A caller who is not allowed near a
  camp should not cause that camp's rows to be read at all. Saving a hop is not
  worth reading a child's record first and deciding afterwards.
- **The school report's three is a real chain.** The school row names the
  academic year, the year selects the camps, the camps drive everything else.
- **`nudgeReferrals` is left alone on purpose.** Its first statement expires
  the overdue referrals and its second picks the ones still worth a nudge —
  issuing them together would text families about referrals that had just
  lapsed. There is a comment there saying so, because the sweep that found
  everything else would otherwise "fix" it.

A sweep of every function in `functions/` for a read that depends on nothing
before it now returns exactly one hit: that one.

### Payloads

Measured on the same 400-child school:

- Offline camp pack: **145 KiB**. This is the one a screener downloads on a
  school's wifi before walking into a hall with no signal, so the test fails if
  it passes 600 KiB.
- Roster page of 400: **116 KiB**.

Both are fine. The console shell is not: **259 KiB of HTML, 69 KiB gzipped**,
and it was served `Cache-Control: no-cache` with no validator — so every single
load transferred the whole thing again. `no-cache` means "check with me first",
not "do not store"; it now carries an ETag, so an unchanged console costs an
empty 304 and a deploy is still picked up on the very next load.

### The console itself

- **Typing the school name to confirm a deletion was impossible.** The field
  called `render()` on every keystroke, `render()` rebuilds the whole tree, and
  the rebuild threw away the element being typed into. The first character
  landed and the rest went nowhere. The field now toggles the button directly
  instead of re-rendering, and `render()` restores focus and caret to any
  element carrying an id, so the next control that re-renders itself does not
  reintroduce this.
  The smoke suite missed it because `fill()` sets a value in one shot; it now
  types the name a key at a time and checks the caret is still there. Reverting
  the fix makes that test fail.
- **The service worker cached whatever came back.** One 502 during a deploy
  would have become the console every screener saw until they next had signal.
  Only a good response replaces the shell now.
- **Three screens asked for independent things one after another** — the
  overview's counters, dashboard and school list; the school's administrators
  and clinical staff; a contract and its invoices. All three now leave
  together. The people tab in particular drew with half of itself missing and
  then jumped.
- **Tab data is already memoised.** Switching between a school's tabs and back
  does not refetch, and there is no polling anywhere in the console. Left alone.

### Test harness

`pg`'s `Client` cannot carry two queries at once, so the moment production code
started issuing reads concurrently the local suite began warning about
overlapping queries — and from `pg@9` that becomes an error. `functions/pgserial.ts`
queues them at the harness, so the tests keep exercising the real concurrent
code path instead of the code being bent back into sequential awaits to suit
the harness.

## State management in the app

Same question as the backend pass, asked of the phone: not how much work the
app does, but how much of it is work nobody asked for.

### One object, thirty fields

`AppUiState` is a single data class holding the kids, the camps, the
appointments, the notifications, the wearable readings, the booking directory,
the language and the theme. Nine scopes collected it whole, and a scope that
collects it whole is invalidated by all thirty fields however few it reads:

| Scope | fields it reads |
|---|---|
| `MainActivity` — the root of the app | 2 of 30 |
| `AppNavigation` — the whole nav graph | 4 of 30 |
| `MainScaffold` | 8 of 30 |
| Notifications destination | 1 of 30 |
| Kid detail destination | 1 of 30 |
| Family sharing destination | 2 of 30 |

The root of the app needs the language and the theme. It was being invalidated
every time a meal was logged or a watch synced a step count.

`selectAsState` maps the flow down to the one value a scope uses and drops
repeats, so the scope wakes only when that value really changes. All nine sites
are converted — thirty narrowed reads — and a new audit rule fails the build if
a `uiState.collectAsState()` goes back in.

**The trap underneath it.** `val uiState get() = state.uiState.asStateFlow()`
allocates a *new* read-only wrapper on every read. Both `collectAsState` and
`selectAsState` key their collector on the flow's identity, so that getter was
tearing down the collector and starting another one every recomposition — and
would have defeated the narrowing entirely, silently. Assigned once now, with a
second audit rule to keep it that way.

### State that outlived its session, and state that did not survive one

- **The language and the theme lived only on the server.** So the app opened in
  English every launch and only became Telugu once the backend answered; stayed
  English for the whole session if it never did; and signing out dropped a
  Telugu-speaking parent onto an English sign-in screen. They are a property of
  this phone, so this phone remembers them now. The server copy is what carries
  the choice to a second device, not what defines it.
- **`resetSession()` left the sync message behind**, so a failure from the
  session that just ended could surface in the next one.
- **`onBackendLogin` cleared seven fields and three caches by hand** and had
  already drifted from `resetSession` — it left the previous family's
  leaderboards and booking slots in memory. Both go through one method now.
- **`GuardianViewModel`'s flows were never cleared at all.** They are not part
  of `AppStateHolder`, so `resetSession()` never reached them: the previous
  parent's referrals, question threads and consent requests stayed in memory
  after sign-out. A reload on the next screen visit papered over it — and the
  caching change below would have stopped papering.

### In-flight flags

- **Seven different actions shared one `busy` boolean** in `GuardianViewModel`,
  with no re-entrancy guard. A question posted from one screen while a
  data-rights erasure ran from another: the first to finish re-enabled the
  other's button while its request was still in the air. It is a count now,
  released in a `finally` — which also fixes the case where an action threw on
  its way out and left the screen busy for the rest of the session.
- **`bookAppointment` cleared its flag on the last line of the block**, not in a
  `finally`. Scheduling the reminder can throw on a phone that has refused the
  exact-alarm permission — the permission this app asks for at sign-in — and a
  parent who hit that could not book an appointment again for the rest of the
  session, with nothing on screen to say why.
- The other three flags (`CampsViewModel`, `ProfileViewModel`, `AuthManager`)
  have re-entrancy guards or `finally` blocks already. Left alone.

### Loads owned by the composition

`LaunchedEffect(Unit)` re-fires whenever the screen re-enters composition, and a
rotation does exactly that. Five guardian screens loaded their data that way, on
top of a `refreshAll()` fired from the nav host on sign-in — which also re-fires
on rotation.

A rotation on the questions screen cost **seven HTTP requests**. It now costs
none: what a screen shows is the ViewModel's to own, the first ask loads it,
later asks are free, a failed load does not count as loaded, and a sign-out
forgets everything so the next parent gets their own.

### The booking selection

The doctor and the slot were deliberately left transient by an earlier pass, on
the grounds that they are "a selection two taps away". They are not: reaching a
slot means filtering by specialty, expanding a hospital, choosing a doctor and
waiting for that doctor's slots over the network. A rotation at the confirm step
threw all of it away and did not ask for the slots again.

The id and the label are saved instead, which restores without needing either
type to be Parcelable. The selected slot is now *derived* from the slots the
current doctor offers rather than stored — which also fixes a real one: one of
the three paths into the doctor list changed the doctor without clearing the
slot, so a booking could be confirmed at an hour that doctor never offered.

### The safety net had a hole in it

`kotlin-parse.sh` prints "no syntax errors, no redeclarations". It was matching
the compiler's `conflicting overloads` but not `conflicting declarations` —
which is what the compiler says for two locals of the same name in one scope,
and exactly what a nine-site automated rename can introduce. It said "no
redeclarations" over a file with one in it. Fixed, and checked in both
directions: the collision now fails the run, and the real tree passes it.

### Looked at and left alone

- **`AppStateHolder` exposes its `MutableStateFlow`s.** Every writer is in
  `data/` — no screen writes app state — so this is a deliberate shared holder,
  not an accident. Sealing it would be churn without a defect behind it.
- **`collectAsState` rather than `collectAsStateWithLifecycle`,** still. These
  are `StateFlow`s with no upstream to keep warm, and Compose pauses
  recomposition when the window is not visible.
- **The food-recognition result is transient by design.** Restoring "analysing…"
  across process death would show a spinner with no work behind it, and half a
  result is worse than re-photographing the plate.

## State management in the console

The console is one long-lived page behind one state object, `S`. So the only
question that really matters is what clears it, and it was being answered in
three places that had to agree and did not.

### Four keys out of fifty

`signOut()` cleared `auth`, `view`, `school` and `camp`. `openSchool()` cleared
nineteen more by hand, `openCamp()` five. Everything else — and **thirteen
fields that were never in the state object at all**, because `set()` creates a
key on first use and nothing can clear what it does not know about — simply
stayed. Among the thirteen: the access trail for a named child, the screening
capture in progress, the reviewer's draft, a child's symptom history.

`openCamp()`'s list had already drifted furthest. It did not clear the review
data, the photographs, the open photograph, the screening capture or the
reviewer's draft — so a physician who reviewed a child at one camp and opened
another still had the first child's review and photograph in hand until the new
fetch landed.

There is one shape now, `freshState()`, and one list per scope taken from it.
Signing out rebuilds the object rather than naming fields, so it cannot miss
one, and `functions/portal-state.test.ts` fails the build if a field used as
`S.<name>` is not in the shape or if `signOut` goes back to naming fields.

### A school's children, left on the device

The offline camp pack is written to `localStorage` when a screener packs a camp
for a hall with no signal. `packStore(id, null)` — the call that removes one —
**was never made anywhere**: not after a sync, not when the camp closed, not
when the screener signed out.

That is about 150 KiB per camp of named children with their dates of birth and
their guardians' names, in plain text, accumulating on a tablet that a school
shares, with no way to get rid of it but clearing the browser. It is also why
saving a capture already had a "this device has run out of storage" path to fall
down: abandoned packs from finished camps fill the origin quota.

Signing out clears the packs now. The unsynced queue is deliberately treated
differently — those are measurements nobody else has, and losing a morning's
screening is worse than leaving it on the device — so sign-out says how many are
unsent and lets the screener decide, and keeps them if they go ahead.

### Five hundred children under the wrong school's name

Nothing said which request still counted. Open a school on a slow line, change
your mind, open another: the first school's roster could arrive second, be
written into the state, and be drawn under the second school's heading.

Every load now carries the navigation it was asked for, and an answer for a
school or camp nobody is on is dropped. Signing out bumps it too, so a request
made by the person who just left cannot land in the fresh state behind the
sign-in screen. `state.mjs` drives the race with a deliberately slow school and
fails without the guard.

### One form slot, seven forms

`S.form` was shared by seven forms of four different shapes. Three checked a
marker field before adopting whatever was there; four did not, and switching
tabs never cleared it.

So: open a school's **Classes** tab, leave without saving, open **Staff → Add
someone**. The staff form adopted `{ year, grades, sections }` — no `kind` on
it. A `<select>` with nothing selected shows its first option, so the operator
read "School administrator" while the branch behind the button took the other
road and created a clinician **with no role**. The smoke test drives exactly
that and checks the role the form shows is the role the console sends.

Each form owns its slot now, with the owner kept beside the form rather than on
it — the form object is posted to the server as it stands.

### One busy flag for every action

Same shape as the app's, and fixed the same way: `busy` was a boolean set true
on the way in and false on the way out, so two overlapping requests meant the
first to finish re-enabled the button for the second while its request was still
in the air. It is a count now.

### Looked at and left alone

- **Tab data is memoised** and there is no polling anywhere in the console.
  Already right.
- **`refreshCamp()` keeps its narrow clear list.** It re-reads the camp that is
  already open rather than moving to another one, and its callers manage the
  review pane around it — a reviewer's unsaved draft is not the server's to
  discard. It is scoped like the rest, so a refresh landing after the operator
  has left is still dropped.

## Offline sync and the queue

A screener works in a school hall with no signal. Captures go into a local
queue; when signal returns the whole queue is posted in one request. That
request is the most important write in the product — it is a morning's
screening for a whole school — and it is the one nobody had measured.

### A camp day could not be synced at all

`saveScreeningBulk` looped over the entries and, for each child, called the
same functions the online one-child form calls. Each of those re-checked the
caller's access to the camp, re-read the participant, and wrote one statement
per finding.

**200 children cost 2,338 statements.** Cloudflare allows 1,000 outbound
subrequests on the paid plan and 50 on the free one, so the request was cut off
partway through: some children were written, the console was told the sync had
failed, and pressing the button again produced the same result forever. A demo
with six children went through fine.

The rules a camp day is judged by are now a pure function — consent, what the
camp offers, the flag the measurement proposes, a screener's override of it —
shared by the one-child form and the queue so the two cannot drift. What
survives that is written together: one insert for the findings, at most three
updates for attendance, one for status, one for the camp.

**200 children now cost 13 statements**, and `functions/sync.test.ts` fails if
that passes 60. It also checks that sending the same queue twice changes
nothing, because a sync that times out after the server applied it is retried
by hand.

### Three ways a measurement could disappear

- **Recorded while the sync was in the air.** `syncQueue` read the queue, posted
  it, and on the way back wrote `queue = whatever the server refused`. A
  screener does not stop working during those seconds — the sync fires the
  moment signal returns, with children still in the line — and every capture
  taken in the meantime was in the queue that got written over. A morning's
  measurements, gone, under a green "synced" message. The queue is re-read when
  the answer comes back now, and a child is only removed if the entry still
  there is the one that was sent, unchanged.
- **A device with no room left.** `queuePush` answered with the length the queue
  already had when the write failed, which the caller read as success: the
  console said "Saved on this device", cleared the form, and the child's
  measurements were gone — the form it had just thrown away was the only copy.
  It answers −1 now, the form stays open, and the screener is told.
- **An entry that said nothing.** An entry with no findings and no attendance
  was neither applied nor rejected by the server, and the console keeps only
  what was refused — so it was deleted from the queue having never been written
  anywhere. It is refused explicitly now.

Two more from the same read: the `online` event can fire more than once and the
sync button is still there, so two syncs of the same queue could each write the
other's result away — there is a guard now. And a refusal is named to the
screener with the child's name rather than counted, because those entries do
come off the queue for good: every refusal the server can return here is a
decision about the record — no consent, already released, not on this camp —
and the same bytes will be refused forever. A capture that cannot be saved is
something a person has to deal with, not a badge that never clears.

### The app's queue held one batch, and a save replaced it

`SyncQueueStore` kept exactly one `SyncBatch`. A batch that failed to send was
therefore dropped by the next unrelated change: meals that failed to reach the
server were replaced in the store by a profile-only batch, were not in it to be
retried, and were then overwritten in memory by the server's copy, which never
had them. A parent's logging, gone, with nothing on screen to say so.

The comment in `BackendSyncEngine.push` already described this — "the next
local change overwrote the batch, so they were not retried either. They were
simply lost, quietly" — as something that *had been* fixed. The abandonment
inside a batch was fixed. The overwrite one level up was still there. A batch is
now folded into what is waiting rather than put in its place.

And a refusal cleared the whole queue. A batch where one record was refused and
another merely failed to reach the server lost both — and the retry it then
scheduled found nothing left to send, which the code's own comment said was
"still worth another try". `push` now reports which entities are finished with
(taken, or refused for good) and only those come off the queue.

### Looked at and left alone

- **Replays are safe.** Every write the sync makes is an upsert keyed on the
  camp, the child and the check, so a retry after a timeout is a no-op. There
  is a test for it.
- **A failed sync does not retry itself in the console.** The queue is kept, the
  count is on screen and the button is there. Silent retries against a server
  that is refusing would be worse than a screener deciding.
- **An unsynced queue survives sign-out on purpose.** Those are measurements
  nobody else has; losing a morning's screening is worse than leaving it on the
  device. Sign-out says how many are unsent and lets the screener decide.

## Notifications and reminders

### Camp reminders had never fired

`parseAppointmentTime` accepted one date format: `01 Nov 2026`, the shape the
booking directory builds for appointment slots. A camp's date is the school's
own record, and `createCamp` **refuses anything that is not YYYY-MM-DD**. The
two ends had never agreed.

The parse failure was a `null` swallowed by `catch (_: Exception)`, and
`scheduleCampReminder` returns quietly on null — so nothing threw, nothing
logged, and no camp reminder was ever set on any device. The toggle for them sat
in the settings screen, the channel was created at every launch, and
`cancelCampReminders` carefully took back alarms that did not exist.

A second reason the same feature could not work: the function parsed the camp's
*time* and then overwrote the hour and minute a line later, because the reminder
is two mornings before at nine. The time column is optional and usually blank,
so even a correctly-formatted date got no reminder unless the school had filled
in a field the reminder does not use. It is not asked for now.

`functions/reminders.test.ts` pins both formats from the side that can be run,
and fails if the parser stops accepting either.

### Three kinds of reminder in one request-code space

A `PendingIntent` whose request code is already taken replaces what was there.
The codes were:

- camp: `campTitle.hashCode()` — two schools both running an "Annual Camp" had
  one reminder between them.
- appointment: `(doctorName + date).hashCode()` — two children seen by the same
  doctor on the same morning had one reminder between them, and cancelling one
  sibling's booking took the other's with it.
- diet: `kidId.hashCode()` — and nothing kept a camp's hash out of a child's.

Each kind names itself in the key now, and the record is identified by its own
id rather than by text a person typed. A new audit rule fails the build if a
bare `hashCode()` goes back in as a request code.

### Reminders outlived the session that set them

Signing out did not cancel anything. `cancelAll` existed but was only wired to
the notifications toggle — so the next person to pick up that phone would have
been reminded about another family's camp, naming their child, on a lock screen.
It runs on sign-out now, and before the state is cleared, because the state is
the only record of what was scheduled.

### A daily reminder that fired once

`scheduleDietReminder` set a single alarm for 19:00 and nothing re-armed it.
The only thing that ever set the next one was the app being opened — so a
parent who did not open the app got one reminder and then silence, from a
feature whose whole purpose is the days they do not open it. The alarm sets
tomorrow's as it goes off.

### On screen: `2026-09-18 · `

Both camp screens printed `"${camp.date} · ${camp.time}"` straight out of the
record — an ISO date a parent does not read, and a separator hanging off the end
with nothing after it, because the time is usually blank.

### Texts that were never sent, counted as sent

Every sender in this codebase returns `{ ok, reason }`. The consent reminder and
the referral nudge both tested it with `if (ok)` — an object, always truthy. So:

- a school whose texts were all failing was told it had reminded everybody;
- each family's three nudges were spent without one of them arriving.

There is a test for it now, and it fails if the truthiness check comes back.

### One text at a time, and one write each

Every reminder was a `for` loop with an `await` inside it. Texting a school's
two hundred waiting guardians was two hundred sequential round trips to the
provider, plus a database write per person — in a worker with a budget for
neither, and the same shape as the camp-day sync that could not finish.

Sends now go out in small groups and the bookkeeping is one statement, so the
statement count no longer grows with the size of the school. The group is
deliberately small: every send is an outbound subrequest and the platform counts
them, so what this buys is wall time, not volume.

### Nobody remembered having asked

`nudgeReferrals` had the restraint — a seven-day gap, three nudges, both
recorded per referral. `remindConsent` had none: nothing recorded that a
guardian had been asked, so an operator clicking "remind everyone" twice texted
the whole school twice, immediately. It now keeps the same kind of record, with
a two-day gap and a cap of three. Reminding one named guardian still goes
straight out — that is a deliberate act by someone who has just spoken to them.

### Looked at and left alone

- **Reboot does not restore alarms**, and cannot: what was scheduled lives in
  the session, which is in memory. `BootReceiver` recreates the channels and
  marks that a reschedule is owed, and the next launch does it. The class says
  so in its own documentation.
- **A pending reminder keeps the language it was scheduled in.** Changing the
  app's language reschedules everything on the next `scheduleAll`, which is the
  same launch, so the window is small.

## What the survey turned up

Having found the same families of bug four times over, I went looking for them
rather than guessing. Four of the nine patterns were still live.

### Erasure did not reach the photographs

`deleteChild` deleted twelve tables keyed on a child. Building the real schema
and asking Postgres, **fifteen tables hold a `kid_id`**. The three it missed:

- **`finding_photos`** — the image bytes of a child's clinical findings. A
  guardian asked for their child's data to be erased and the pictures stayed.
- **`question_threads`** — everything the parent wrote to the school about that
  child, and every answer.
- `record_access` — the log of who looked at the record. This one *should*
  survive: erasing it destroys the trail rather than the data. Nothing said so;
  now something does.

The comment directly above that function describes a bug fixed for findings —
*"a child's clinical findings survived, attached to nothing"* — while the photos
had exactly that problem.

`functions/erasure.test.ts` does not check the list. It builds the schema, asks
which tables hold a child or a guardian, and fails naming any erasure does not
reach. A table added next year is covered without anyone remembering the file
exists, and a table kept on purpose has to carry a written reason.

That test immediately found a fifth thing nobody was looking for. A guardian who
changes their mobile number has every row repointed to a new profile id, from a
hand-kept list — and `camp_staff` was not on it. The function copies the role
across, so a screener or physician comes through it too, and an assignment to a
running camp is what lets clinical staff sign in at all. **Changing their number
locked them out of every camp.** The repoint loop also threw on a table a
deployment had not created, half way through, leaving records pointed at an
identity about to be deleted.

### A meal plan that only ever grew

`meal_items` had no date column, nothing ever deleted a row, and the read had no
filter and no limit. Two consequences, and the second is worse than the first:

- A family two years in downloaded thousands of rows on every launch and
  uploaded them again on every sync.
- Every custom snack a parent ever added stayed in the set, so **last month's
  snacks came back as part of today's plan, still ticked**.

Meals are dated now, server-side, so the app needed no change: what it sends is
logged for the day it arrives, and what it reads is that day. The date is
deliberately not updated on conflict — the app re-sends its whole set on every
sync, and re-dating yesterday's plan to today would put the growth straight
back. What is already stored becomes today's rather than vanishing.

### Three more loops that cost a subrequest per person

- **Inviting a roster**: four subrequests a number — read the cooldown, send,
  log, mark. Two hundred families is eight hundred, past what the platform
  allows, so an import that reported success stopped sending partway through.
  It also marked every number as invited whether the text went out or not, so a
  school whose provider was misconfigured had its whole roster put behind the
  resend cooldown without one message arriving.
- **A child's health history**: one read per camp, on the screen a guardian
  opens to see it.
- **The home screen's nudges**: two reads per child, on every open.
- **Saving a school's classes**: two statements per class — a secondary school
  with twelve grades and four sections is ninety-six on an ordinary save.

### Left alone, and why

The sweep found twenty-nine loops that await per item. Most are already bounded:
chunked at a hundred rows, or over a fixed list of tables, or over seed data. The
ones named above were the ones whose size is a school's size. `if (ok)` in the
console is a callback, not a result.

## A pass over what had not been looked at

Six dimensions this review had never swept. Two came back clean, four did not.

### Clean: authorisation

Every one of the 132 routes has a check in an enclosing scope. Fourteen queries
key on an id from the request without naming the caller in the same statement,
and every one has a `kidOwnedByProfile`, an enrolment check or an admin guard
on the line above. No IDOR found.

### The day turned over at half past five in the morning

Everything that means "today" to a person — which day a meal belongs to,
whether a referral is overdue, which academic year it is, when a referral is
due — was computed in UTC, because that is what `toISOString()` gives you. The
schools are in India.

The visible consequence was in meals, and it is one I introduced the day
before. The app stamps its streak with the device's own `LocalDate`; the server
filed the meal under UTC's. A parent logging something after midnight had the
streak move to the new day while the meal went into the old one, and then
vanish from today's plan at 05:30. The two ends were keeping different
calendars.

`programmeToday()` in `common.ts` names the zone once and is overridable, so a
programme that runs somewhere else sets `PROGRAMME_TZ` rather than discovering
this the same way.

### A child whose sex was not recorded was measured as a girl

A growth percentile only means anything against a reference for the child's
sex. Both implementations asked `isBoy()` — a boolean — so a child recorded as
"Other", or not recorded at all, was measured against the girls' table and
shown a percentile as though it were the right one. At fourteen the two medians
are four centimetres and two and a half kilograms apart, which is the
difference between a flag and no flag.

Both sides now return the percentile from **whichever reference reads lower**,
and the screener's rationale says the sex was not recorded. Guessing the other
way means telling a family a child is fine when the other table would have
flagged them.

### The clinical reference exists twice and nothing made it agree

`clinical.ts` decides what a screener is told and what the physician reviews.
`GrowthStandards.kt` draws the chart a parent sees and labels their child on
it. Same WHO medians, same spreads, same band edges — kept in step by hand.

They do agree today. `functions/growth.test.ts` reads both and compares them, so
a number changed in one and not the other fails rather than telling a family
their child is fine on a chart while the record says otherwise. Changing one
digit in the Kotlin table fails that test.

### A 500 handed the caller the database's own words

Eleven routes returned the raw exception on a server error. A Postgres error
names the table, the column and the constraint, and often echoes the value that
tripped it — so any signed-in parent could read a piece of the schema back. The
detail goes to the log now and the caller gets a sentence and a code.

`/api/admin/schema` still returns the raw error and the table list. That is the
point of it, it is behind the ops key, and it says so.

Writing that fix broke something the test caught: a blanket 500 swallowed
`ApiError`, so a 413 for "too much" and a 403 for "not yours" both became
"something went wrong". The handler passes those through.

### Two request lists could be made to cost a thousand messages

`body.phones` on the invite route and `body.entries` on the camp-day sync had
no cap, and each element costs a text or a statement. They are refused now
rather than truncated: truncating a sync would come back reporting success
having written half a camp.

## Still open

The Android app has never been compiled. `dl.google.com` is blocked by policy
in the environment this was built in, so no SDK or AndroidX artifact is
reachable — `maven.google.com` looks reachable but redirects straight to it.

Two things run in its place, and between them they cover more than they used to:

- `tools/kotlin-parse.sh` runs the **real Kotlin compiler front end**. Maven
  Central is reachable even though Google's Maven is not, so the compiler
  itself can be fetched. It cannot type-check without AndroidX, so unresolved
  references are filtered; what it does prove is that every file parses. That
  matters because a dangling comma left by an automated edit reads as balanced
  to a bracket counter, and slipped through twice in one week.
- `tools/kotlin-audit.py` covers what regular expressions can — missing
  translations, duplicate locale keys, unused imports, named arguments,
  exhaustive `when` over the flag enum. It has caught five real bugs.

Neither is a build. Run `./gradlew compileDebugKotlin` before shipping, and
look at the OTP screen at 200% font scale on a real phone.
