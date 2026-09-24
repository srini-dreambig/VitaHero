# VitaHero Production Deployment Guide

## Live URLs

- **Cloudflare backend + admin portal:** `https://vitahero.kallam.workers.dev`
- **Admin panel:** `https://vitahero.kallam.workers.dev/admin`
- **Privacy policy:** `https://vitahero.kallam.workers.dev/privacy`
- **Data deletion:** `https://vitahero.kallam.workers.dev/data-deletion`
- **Package name:** `kallam.healthcare`
- **Upload signing SHA-256:** `DE:00:14:9D:0C:F3:6F:5C:9E:53:85:0E:60:90:7B:1C:61:71:1F:AD:FA:C8:26:65:E5:7D:70:91:74:36:90:A1`

---

## Current status (updated 27 Jul 2026)

| Task | Status |
|------|--------|
| Google Play developer account | ✅ Done |
| Android app source + local build | ✅ Updated with the real VitaHero logo; `runChecks` passed |
| Play Store icon, banner, screenshots | ✅ Regenerated with the real VitaHero logo and real app UI colours/layout |
| Play Store listing text (en-US) | ✅ Verified correct (title, short + full description) |
| New Play Store AAB with updated launcher icon | ✅ Published to internal testing — version code `1785160584`, submission `2649460e-14c3-4ca7-9804-e91ce4162fcb` |
| Upload icon, banner, screenshots to Play Console | 🛑 Must be done manually in Play Console (see exact steps below) |
| Play Console initial setup + policy forms | 🛑 Must be completed manually (see checklist below) |
| Promote to closed testing / production | 🛑 Blocked until Play Console setup is complete and closed-test criteria are met |

---

## What you must do manually in Play Console

### 1. Upload the new store listing images

The ready files are in `play-store-assets/`. The Play Store API cannot upload arbitrary local files; these exact-size files must be dropped into Play Console manually.

1. Sign in to [Google Play Console](https://play.google.com/console) and select **VitaHero** (`kallam.healthcare`).
2. Go to **Grow → Store presence → Main store listing**.
3. Upload each file to the correct slot:

| Slot | File to upload | Exact size | Format |
|------|----------------|------------|--------|
| App icon | `play-store-assets/icon_512.png` | 512 x 512 px | 32-bit PNG with alpha (≤ 1 MB) |
| Feature graphic | `play-store-assets/banner_1024x500.png` | 1024 x 500 px | PNG/JPEG |
| Phone screenshot 1 | `play-store-assets/screenshot_home.png` | 1080 x 2400 px | PNG/JPEG |
| Phone screenshot 2 | `play-store-assets/screenshot_diet.png` | 1080 x 2400 px | PNG/JPEG |
| Phone screenshot 3 | `play-store-assets/screenshot_growth.png` | 1080 x 2400 px | PNG/JPEG |
| Phone screenshot 4 | `play-store-assets/screenshot_report.png` | 1080 x 2400 px | PNG/JPEG |

> **Why these are correct now:** the icon uses the real `vitahero_logo.png` from the app; the banner uses the same logo and brand orange; the screenshots reproduce the actual app screens (Home, Diet Plan, Growth Charts, Health Checkup Report) using the real Host Grotesk fonts, HeroOrange (#F47B20), HeroBlue (#1FA2DD), and Material 3-style layout from the source code.

### 2. Finish the Play Console app setup checklist

Google will not let you apply for production until every item below is completed. Work through the left-hand menu in Play Console for the `kallam.healthcare` app.

#### Internal testing (optional, but quickest for your own QA)

- **Select testers**
  - Go to **Testing → Internal testing → Testers**.
  - Add your Google account email and any trusted QA emails as internal testers.
- **Create and roll out a release**
  - Go to **Testing → Internal testing**.
  - Click **Create release**.
  - Upload the App Bundle built by `.github/workflows/android-publish.yml`, or
    one built locally with `./gradlew bundleRelease`.
  - Add release notes:
    ```
    First release of VitaHero. View school health camp reports, track growth, get diet tips, scan meals, and book doctor appointments — all in one secure app for parents.
    ```
  - Click **Review release** and then **Start rollout to Internal testing**.

#### Finish setting up your app (required for every release)

- **Provide app information and create your store listing**
  - **App category and contact details:** Go to **Grow → Store presence → Store listing** → scroll to **Categorization**. Set **App category** to **Health & Fitness** (or **Medical**). Set **Contact email** to `support@vitahero.app` (or a Gmail alias you control). Optionally add a **Contact phone** and **Website**.
  - **Store listing:** Confirm the title, short description, and full description are already set. If not, use the copy in the **Proposed Play Store listing copy** section below.
  - **Upload listing images:** as described in step 1 above.

- **Let us know about the content of your app**
  - **Privacy policy:** Go to **Policy → App content → Privacy policy**. Enter `https://vitahero.kallam.workers.dev/privacy`.
  - **Sign in details:** Go to **Policy → App content → App access**. If any feature requires login, provide test credentials. VitaHero uses phone-OTP login, so you can provide a test phone number and note that OTP is sent via SMS.
  - **Ads:** Go to **Policy → App content → Ads**. Select **No, this app does not contain ads**.
  - **Content rating:** Go to **Grow → Store presence → Content ratings**. Fill the questionnaire. For a health app for parents, the rating is typically **PEGI 3 / ESRB Everyone** with the **Health** category selected. This is quick and takes about 5 minutes.
  - **Target audience:** Go to **Policy → App content → Target audience**. Select **13+ / Parents**. Do **not** mark the app as primarily for children under 13, because parents are the actual users even though the data is about children.
  - **Data safety:** Go to **Policy → Data safety**. Complete every section. Because VitaHero is a health app, be precise and honest. Use the answers below:

    **Data collection:**
    - Phone number (required for Firebase Phone Auth and SMS invites)
    - Health info (height, weight, BMI, vision, dental, general checkup notes)
    - Approximate location (used for nearby hospital/doctor search)
    - Photos/videos (only when the parent chooses to scan a meal)
    - App interactions (analytics, crash diagnostics)
    - Diagnostics (Firebase crash logs, ANR logs)

    **Data sharing:**
    - Phone number shared with SMS provider (Plivo/Twilio) to send invites and OTP.
    - Health info shared with the authorised school/hospital/camp administrator and the doctor who performed the check-up.
    - Crash data shared with Firebase Crashlytics.

    **Data processing:**
    - OTP codes are processed ephemerally and not stored.
    - Required encryption in transit: **Yes**.
    - Account deletion mechanism: **Yes**, via `https://vitahero.kallam.workers.dev/data-deletion`.

  - **Government apps:** Not applicable — leave as **No**.
  - **Financial features:** Not applicable — leave as **No**.
  - **Health:** Go to **Policy → App content → Health**. This app provides health-related information and services but is not a medical device. It connects parents with school health camps and partner doctors. Do not make diagnosis/treatment claims.

- **Countries and distribution**
  - Go to **Grow → Store presence → Pricing & distribution**.
  - Select the countries/regions where you want the app to be available. For an India-first launch, select **India**; you can add more later.

#### Closed testing (required before production)

You **must** run a closed test before Google Play allows production access.

- **Set up your closed test track**
  - Go to **Testing → Closed testing**.
  - Create a closed test track (or use the default **Alpha** track).
- **Select countries and regions**
  - Pick the same countries as your planned production launch (e.g., India).
- **Select testers**
  - Build a list of at least **20 testers** to be safe (Google requires at least 12 opted-in for 14 days, but some drop off). Common sources:
    - School parents from your pilot school
    - Hospital/camp staff and their family members
    - Friends and colleagues with Android devices
  - Add their Google account emails or create a Google Group / Google Workspace group and link it.
- **Create and roll out a release**
  - Promote the internal build to the closed test track, or upload the same AAB directly.
  - Use the same release notes as above.
  - Click **Review release** and **Start rollout to Closed testing**.
- **Send the release to Google for review**
  - Play Console will send the closed test for review automatically. Wait for the review to complete (usually a few hours to a few days).
- **Meet the production criteria**
  - Have at least **12 testers opted-in** to the closed test.
  - Run the closed test for at least **14 days**.
  - Monitor the **Pre-launch report** and **User feedback** for crashes or policy issues.

#### Production

- **Apply for access to production**
  - After the closed test has run for 14 days with 12+ testers, go to **Production → Create release** (or **Production → Apply for production** if prompted).
  - Answer Google's questions about your closed test honestly.
  - Google Play will then review the production release.

- **Staged rollout (recommended)**
  - Start with **20% rollout** for the first 24–48 hours.
  - Watch the **Android vitals** and **user reviews** in Play Console.
  - Increase to 50%, then 100% if no issues.

### 3. Register your signing certificates with Firebase

**Sign-in does not work without this, on any build Google Play serves.** It is
not optional and it is not covered by anything above.

The app signs people in with Firebase Phone Auth: `FirebaseOtp.requestCode`
asks Firebase to send the SMS, and the ID token that comes back is exchanged
for a VitaHero session. Before Firebase will send that SMS it verifies the app
is really yours, using Play Integrity — and that check matches the signing
certificate of the installed app against the fingerprints registered on the
Firebase Android app. No fingerprint, no SMS.

`android/app/google-services.json` currently has an empty `oauth_client` array,
which is what a Firebase app with no registered fingerprint looks like. Check
before assuming: Firebase Console → Project settings → Your apps → the
`kallam.healthcare` Android app → **SHA certificate fingerprints**.

**The fingerprint that matters is not the upload key.** With Play App Signing,
Google strips your upload signature and re-signs the bundle with the app
signing key, so the certificate on a real user's phone is Google's, not the one
in `docs/upload-key.md`. Register all three:

| Key | Where to find its SHA-1 and SHA-256 | Needed for |
|---|---|---|
| App signing key | Play Console → Test and release → Setup → **App signing** | Every build from Play, internal testing included |
| Upload key | `keytool -list -v -keystore <upload>.jks -alias vitahero` | An AAB or APK you install directly |
| Debug key | `keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android` | Running from Android Studio |

Add SHA-1 **and** SHA-256 for each — Play Integrity uses SHA-256, and some
older paths still read SHA-1. Then re-download `google-services.json` from
Firebase and commit it: `oauth_client` should no longer be empty.

Symptoms of getting this wrong, none of which name the real cause: the OTP
never arrives, a reCAPTCHA web page appears instead of an SMS, or sign-in
fails with "This app is not authorized to use Firebase Authentication."

Do this **before** the closed test below. Twelve testers who cannot sign in
are twelve testers who do not count.

---

---

## Proposed Play Store listing copy (en-US)

### Title
`VitaHero` (8 characters / max 30)

### Short description (max 80 characters)
```
Your child's health reports, growth tracking, diet tips and doctor bookings in one app.
```
(79 characters)

### Full description (max 4000 characters)
```
VitaHero helps parents stay on top of their child's health, all from one simple app. It connects you with school health camps run by partner hospitals and doctors, so you never miss a check-up report again.

WHAT YOU CAN DO

• View health reports from school camps — vision, dental, BMI, and general paediatric notes in one place.
• Track growth over time with easy-to-read height and weight charts.
• Get AI-powered diet tips and meal suggestions tailored to your child.
• Scan food with the camera to log meals and build healthier habits.
• Book follow-up appointments with trusted doctors and hospitals near you.
• Share reports with family members or caregivers instantly.
• Receive notifications when new camp reports are ready.

HOW IT WORKS

1. Your school or hospital imports your details into the secure VitaHero system.
2. You get an SMS invitation with a link to install the app.
3. Sign in with your mobile number via a one-time SMS code.
4. View your child's reports as soon as the doctor completes the check-up.

BUILT FOR TRUST

• Health data is stored securely in Firebase and only accessible to you and the authorised doctor or camp administrator.
• Optional Android Health Connect integration lets you add activity data privately on your device.
• Camera access is used only when you choose to scan a meal.
• Clear privacy policy and account deletion options are available at any time.

VitaHero makes school health camps simple, transparent, and useful for every parent.
```
(1,176 characters)

### Release notes (first production build)
```
First release of VitaHero. View school health camp reports, track growth, get diet tips, scan meals, and book doctor appointments — all in one secure app for parents.
```

---

## Admin portal setup

### How the backend gets deployed

Cloudflare Workers Builds is connected to the GitHub repository and deploys on
every push to `main`. Its configuration lives in the Cloudflare dashboard, and
these three settings are the whole of it:

| Setting | Value |
|---|---|
| Root directory | `functions` |
| Build command | `bun install` |
| Deploy command | `npx wrangler deploy` |

**The root directory is the one that matters.** Pointed at the repository root
instead, Workers Builds finds no `wrangler.toml` — it lives in `functions/` —
falls back to publishing static assets. What you get is a Worker with no script
at all: the console and every `/api` route return 404, and the dashboard says
*"Metrics is unavailable for Workers with only static assets"*. If you ever see
that line, this is why.

This is not fixed by having fewer files at the repository root. It used to
serve `presentation/index.html`, a partner deck that has since been removed;
with nothing there to serve it publishes an empty site instead, which is the
same outage wearing a blanker face. Only the root directory setting fixes it.

To recover: **Workers & Pages → vitahero → Deployments**, find the last version
that was the real worker, and roll back. Then fix the root directory.

GitHub Actions does **not** deploy. `worker-checks.yml` runs the test suites
against a real Postgres and stops there; two things deploying one Worker is how
a bad deploy goes unnoticed. `production-health.yml` checks every half hour
that the hostname is still serving the worker rather than something else, and
the sharpest of its three assertions is that an unauthenticated `/api/me/rights`
answers **401** — only running code can refuse you; a static-assets deployment
can only 404.

The admin portal is already live as part of the Cloudflare worker. It is a single-page HTML app served by the same backend, not a separate Vercel deployment.

### Access the admin panel
```
https://vitahero.kallam.workers.dev/admin
```

### Set the admin key
1. In the Cloudflare worker's secrets, set `ADMIN_API_KEY` to a long, random string. This same key is used to log in to the admin panel.
2. If you want invite links to work, also set `INVITE_SIGNING_KEY` to a different random string.
3. Set `ANDROID_CERT_SHA256` to the Play Console upload certificate SHA-256 so Android App Links auto-verify.
4. Set `APP_PLAY_URL` to the Play Store URL once the app is published.

### Admin panel features
- Import parents and students from CSV.
- Send SMS invitations via Plivo or Twilio.
- Create and manage school health camps.
- Generate and revoke doctor credentials per camp.
- View parent activation and invite statistics.

---

## Publishing from the command line

Gradle Play Publisher is wired into the Android build, so a release goes up
with one command instead of a browser. It changes nothing about how the app is
built; it adds tasks that upload what the build produces.

### Once, to set it up

1. **Play Console → Users and permissions → Invite new user.** Invite a Google
   Cloud service account, and give it *Release apps to testing tracks*. Add
   *Release to production* only if you intend to publish to production from a
   terminal.
2. **Google Cloud Console → that service account → Keys → Add key → JSON.**
   Download it.
3. **Keep it out of the repository.** `.gitignore` covers the usual filenames,
   but the safe place is outside the checkout entirely.

The very first release of an app still has to be uploaded by hand. The Play API
can add a release to a listing that exists; it cannot create the listing.

### Every release after that

```bash
cd android
export VITAHERO_KEYSTORE=/path/to/vitahero-upload-key.jks
export VITAHERO_KEYSTORE_PASSWORD=...
export VITAHERO_KEY_ALIAS=vitahero
export VITAHERO_KEY_PASSWORD=...
export ANDROID_PUBLISHER_CREDENTIALS=/path/to/play-service-account.json
export PLAY_TRACK=internal          # internal | beta | production
./gradlew :app:publishReleaseBundle
```

It builds the signed bundle and uploads it. Some deliberate awkwardness:

- **`PLAY_TRACK` has no working default.** The publish refuses to run without
  it, so nobody reaches production by repeating the command they used for a
  test build.
- **A release is a draft** unless you set `PLAY_RELEASE_STATUS=completed`. The
  upload lands in the console for a person to look at and roll out.
- **A version code already on Play is an error**, not a silent bump. Bump
  `versionCode` in `android/app/build.gradle.kts` deliberately instead.
- **Nothing publishes without credentials.** With `ANDROID_PUBLISHER_CREDENTIALS`
  unset, every other task — assemble, test, lint — behaves exactly as before,
  and only the publish tasks stop, naming what is missing.

The store listing, screenshots and description stay in the Play Console. This
uploads builds, not marketing copy.

### Promoting and rolling out

```bash
./gradlew :app:promoteArtifact --from-track internal --promote-track production
```

Staged rollout is `--release-status inProgress --user-fraction 0.2`, raised as
you go.

## What I can automate next

1. A GitHub Actions workflow so a tagged commit builds and uploads on its own.
   That runs on GitHub's runners, which have the Android SDK and unrestricted
   network — this environment has neither, which is why the build itself cannot
   be produced here.
2. Promotion between tracks and staged-rollout bumps as part of that workflow.

---

## Asset files (ready in the project)

- `play-store-assets/icon_512.png` — Play Store app icon (real VitaHero logo)
- `play-store-assets/banner_1024x500.png` — Play Store feature graphic
- `play-store-assets/screenshot_home.png` — Home dashboard
- `play-store-assets/screenshot_diet.png` — Diet plan + AI coach
- `play-store-assets/screenshot_growth.png` — Growth charts
- `play-store-assets/screenshot_report.png` — Health checkup report
- `android/app/src/main/res/drawable-xxxhdpi/ic_launcher_foreground.png` — Android adaptive-icon foreground (real VitaHero logo)
- `android/app/src/main/res/values/ic_launcher_background.xml` — Android adaptive-icon background (HeroOrange #F47B20)
