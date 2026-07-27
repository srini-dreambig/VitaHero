# VitaHero Production Deployment Guide

## Live URLs

- **Cloudflare backend + admin portal:** `https://kidhero-health-sync-backend.rork.app`
- **Admin panel:** `https://kidhero-health-sync-backend.rork.app/admin`
- **Privacy policy:** `https://kidhero-health-sync-backend.rork.app/privacy`
- **Data deletion:** `https://kidhero-health-sync-backend.rork.app/data-deletion`
- **Package name:** `kallam.healthcare`
- **Upload signing SHA-256:** `DE:00:14:9D:0C:F3:6F:5C:9E:53:85:0E:60:90:7B:1C:61:71:1F:AD:FA:C8:26:65:E5:7D:70:91:74:36:90:A1`

---

## What you must do manually (Google Play / Rork)

### 1. Connect Google Play in Rork
- Open the **Rork Publish** dialog for this project.
- Connect your Google Play developer account under the **Android / Google Play** section.
- Without this, the automated publish flow cannot run. **Do this first.**

### 2. Play Console app setup (if not already complete)
- Sign in to [Google Play Console](https://play.google.com/console).
- Select the app with package `kallam.healthcare` (or create it if missing).
- Go to **Release → Setup → App integrity** and opt in to **Google Play App Signing**.
- Upload the Play Console app's SHA-256 fingerprint to the worker secret `ANDROID_CERT_SHA256` (Rork can help once connected).
- Set the Play Store URL as `APP_PLAY_URL` in worker secrets (e.g. `https://play.google.com/store/apps/details?id=kallam.healthcare`).

### 3. Required Play Console policy declarations
Because this is a health app, complete these before requesting production:

- **Data Safety** (`Policy → Data safety`)
  - Data collected: phone number, health info, approximate location, photos/videos, app interactions, diagnostics.
  - Data shared: phone number (SMS), health info (with school/hospital), crash data.
  - Data processed ephemerally: OTP codes.
  - Required encryption in transit: **Yes**.
  - Account deletion mechanism provided: **Yes** (link to `/data-deletion`).
- **Content rating** (`Grow → Store presence → Content ratings`)
- **Target audience** (`Policy → App content → Target audience`). Default is **13+ / parents**; not a children-only app.
- **Ads declaration** (`Policy → Ads`): **No ads**.
- **Privacy policy URL:** paste `https://kidhero-health-sync-backend.rork.app/privacy`
- **Support email:** set to `support@vitahero.app` (or create a Gmail alias you control).
- **App category:** **Health & Fitness** (or **Medical** if you prefer).
- **Countries / distribution:** set the regions you want to launch in.

### 4. Upload listing graphics in Play Console
Generated assets are in the Rork project asset library. I also created exact-size Play Store-ready files in the `play-store-assets/` folder:

| Slot | Exact-size file | Project asset ID (for automated upload) | Size / note |
|------|-----------------|----------------------------------------|-------------|
| App icon | `play-store-assets/icon_512.png` | `2c7640fe-d9b5-415d-8599-735216b699de` | 512 x 512 px, 309 KB, PNG with alpha |
| Feature graphic | `play-store-assets/banner_1024x500.png` | `58beac76-5783-49f2-beba-d4906449130f` | 1024 x 500 px, 557 KB |
| Phone screenshot 1 | `play-store-assets/screenshot_home.png` | `5be98bfd-1297-4a8a-a0a7-6693eb700d07` | 1024 x 1536 px, home dashboard |
| Phone screenshot 2 | `play-store-assets/screenshot_report.png` | `720f69cc-8eda-4ed4-94ab-80dbab6c33bf` | 1024 x 1536 px, health report |
| Phone screenshot 3 | `play-store-assets/screenshot_diet.png` | `1c0509b4-fd7f-43ba-856a-542859c2582f` | 1024 x 1536 px, diet & AI tips |
| Phone screenshot 4 | `play-store-assets/screenshot_growth.png` | `4fd80c53-f490-446d-8285-022d3df2f64f` | 1024 x 1536 px, growth chart |

- **App icon:** 512 x 512 px 32-bit PNG with alpha (must be ≤ 1 MB) — ready file is in `play-store-assets/icon_512.png`.
- **Feature graphic:** 1024 x 500 px JPEG or 24-bit PNG — ready file is in `play-store-assets/banner_1024x500.png`.
- **Phone screenshots:** 2–8 images, 320–3840 px per side, longest side ≤ 2x shortest side — ready files are in `play-store-assets/screenshot_*.png`.

> If the automated Play Store image upload rejects the source asset IDs due to size mismatch, use the exact-size files in `play-store-assets/` and upload them manually in Play Console.

### 5. Production readiness checklist
- [ ] Google Play connected in Rork
- [ ] Play Console app created and app signing opted in
- [ ] Data Safety form completed
- [ ] Content rating completed
- [ ] Privacy policy + data deletion URLs set
- [ ] Support email set
- [ ] Listing icon, feature graphic, and screenshots uploaded
- [ ] Target audience and ads declarations completed
- [ ] Countries / distribution selected
- [ ] You have a rollout plan (e.g. staged 20% → 100%)

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

The admin portal is already live as part of the Cloudflare worker. It is a single-page HTML app served by the same backend, not a separate Vercel deployment. This keeps it simple and avoids splitting the backend and admin UI.

### Access the admin panel
```
https://kidhero-health-sync-backend.rork.app/admin
```

### Set the admin key
1. In the Rork project environment settings (or Cloudflare worker secrets), set `ADMIN_API_KEY` to a long, random string. This same key is used to log in to the admin panel.
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

## Automated publish flow (what I will run once you connect Google Play)

After you connect Google Play in Rork, I will execute:

1. `setupGooglePlay` — verify the connection.
2. `ensurePlayAppRecord({ packageName: "kallam.healthcare", appName: "VitaHero" })` — confirm Play Console API access.
3. `generatePlayAab` — build a signed App Bundle for the current source.
4. `publishInternalBuild` with `validateOnly: true` first, then commit to internal testing.
5. `promotePlayRelease` with `targetTrack: "production"` (or staged rollout if you prefer).
6. `updatePlayListing` — apply the metadata above.
7. `replacePlayListingImages` — apply the generated icon, feature graphic, and screenshots. If Play Console rejects the source asset sizes, fall back to the exact-size files in `play-store-assets/` and upload them manually.

---

## Next action

Connect Google Play in Rork's Publish dialog, then tell me to continue. I will run the full automated flow and report the submission ID, track, and version code.
