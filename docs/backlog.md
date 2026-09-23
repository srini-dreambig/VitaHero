# Backlog

What is deliberately not built, and why that is safe.

## The four remaining checks

ENT, Skin, Spine and the immunisation review are named in
`PLANNED_CHECKS` in `functions/clinical.ts`. They are not in
`DESIGNED_CHECKS`, which is the list a school can actually be offered
today, and the split is load-bearing rather than documentation:

- A camp cannot be scheduled with one of them. `screeningChecksFor` only
  ever returns designed checks, so a planned check has no form for a
  clinician to fill and no column for a result to land in.
- `isDesignedCheck` is what the scheduling and recording paths ask. Moving
  a name from one list to the other is the whole switch — and the tests in
  `functions/app-surface.test.ts` fail the moment it moves without a screen
  behind it, which is the point. A check that is offered but cannot be
  recorded is worse than one that is not offered, because a school plans
  around it.

So each of the four needs, before it moves: a recording screen for the
clinician, a result row a parent can read, and the library articles that
match its findings. None of them needs a schema change — `camp_findings`
is already keyed by check type.

## Not started

- **Onboarding art.** The four slides carry no image since the vendor CDN
  was dropped. `OnboardingScreen` draws that case as a tinted panel above
  the title, so it reads as a design rather than a failure. Bundling art
  later is a list of drawables and nothing else.
- **A release build has never run here.** CI compiles debug only, so the
  ProGuard keeps for kotlinx's generated `$$serializer` classes — repointed
  at `kallam.healthcare` — are unproven. R8 strips by package name, and a
  wrong keep produces a build that passes every debug gate and crashes on
  its first JSON parse. One `./gradlew bundleRelease` settles it.
