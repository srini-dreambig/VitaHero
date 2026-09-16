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
