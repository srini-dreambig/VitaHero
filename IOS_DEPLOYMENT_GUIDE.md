# VitaHero iOS Deployment & App Store Publishing Guide

This guide details the current state of the iOS project, what is needed to generate the Xcode build, and the step-by-step process to publish VitaHero to the **Apple App Store**.

---

## 1. Current State of the iOS Codebase

| Component | Status | Description |
|---|---|---|
| **SwiftUI Codebase** | ✅ Ready | Complete modern SwiftUI app with ViewModels, Services, Models, and Views (Auth, Home Dashboard, Clinician Roster & Screening, Specialist Booking, Symptoms/Diet, Consent, Profile). |
| **App Version** | ✅ Updated | Configured to `1.1.5` (Build `1`) in `Info.plist`. |
| **App Store Icon** | ✅ Generated | Generated universal 1024×1024 asset at `ios/VitaHero/Assets.xcassets/AppIcon.appiconset/icon_1024.png`. |
| **XcodeGen Spec** | ✅ Added | `ios/project.yml` is configured to deterministically generate `VitaHero.xcodeproj` on any Mac. |
| **Permissions Configured** | ✅ Set in `Info.plist` | Camera (`NSCameraUsageDescription`), Photo Library (`NSPhotoLibraryUsageDescription`), Microphone (`NSMicrophoneUsageDescription`). |
| **Active Machine** | ⚠️ Windows | The current development machine runs Windows. **Building an iOS app (`.ipa`) requires a macOS environment with Xcode** (either a local Mac, Mac Mini, or cloud CI/CD such as GitHub Actions with a `macos-latest` runner). |

---

## 2. Generating the Xcode Project on a Mac

Because Git repositories avoid committing bulky, conflict-prone Xcode `.pbxproj` files directly, an **XcodeGen** specification (`ios/project.yml`) has been provided.

On a Mac:
```bash
# 1. Install XcodeGen (if not already installed)
brew install xcodegen

# 2. Navigate to the ios directory and generate the project
cd ios
xcodegen generate

# 3. Open the generated project in Xcode
open VitaHero.xcodeproj
```

---

## 3. Apple Developer Program Prerequisites

Before submitting to the App Store, ensure you have:
1. **Apple Developer Account**: Enrolled as an Organization or Individual at [developer.apple.com](https://developer.apple.com).
2. **App Identifier (App ID)**:
   - Go to **Certificates, Identifiers & Profiles → Identifiers**.
   - Create an App ID matching your bundle ID: `com.vitahero.health`.
   - Enable Capabilities: **Push Notifications** (if remote alerts are desired), **Associated Domains** (for App Links / universal links).
3. **App Store Connect Record**:
   - Go to [appstoreconnect.apple.com](https://appstoreconnect.apple.com) → **Apps** → **+ (New App)**.
   - Platform: **iOS**.
   - Name: **VitaHero**.
   - Primary Language: **English (US)**.
   - Bundle ID: Select `com.vitahero.health`.
   - SKU: `vitahero-ios-app`.

---

## 4. Code Signing in Xcode

1. Open `VitaHero.xcodeproj` in Xcode.
2. Select the top-level **VitaHero** project in the left navigator.
3. Select the **VitaHero** target → **Signing & Capabilities** tab.
4. Check **Automatically manage signing**.
5. Under **Team**, select your Apple Developer Account team.
6. Verify that Xcode downloads or creates the **Apple Development** and **Apple Distribution** signing certificates automatically.

---

## 5. Building & Archiving for TestFlight & App Store

1. In Xcode's top toolbar, set the run destination to:
   **Any iOS Device (arm64)** (Do not select a simulator).
2. From the top menu bar, select:
   **Product → Archive**.
3. Once the archive build completes, the **Organizer** window will appear.
4. Click **Validate App** to run Apple's automated pre-check.
5. Once validation passes, click **Distribute App**:
   - Select **App Store Connect**.
   - Select **Upload** (direct submission).
   - Keep options checked: *Upload your app's symbols* and *Manage Version and Build Number*.
   - Click **Upload**.

---

## 6. TestFlight Beta Testing

1. Once uploaded, the build will process in App Store Connect (typically takes 10–20 minutes).
2. Open [appstoreconnect.apple.com](https://appstoreconnect.apple.com) → **VitaHero** → **TestFlight**.
3. Under **Internal Testing**:
   - Add your team members/testers.
   - Testers receive an invite email to install the build via the **TestFlight** app on their iPhones.
4. Verify key features on a real iPhone:
   - Phone OTP sign-in / Clinician sign-in.
   - Camera food photo recognition.
   - Clinician Screening form (attendance absent flow, multi-select dropdowns).
   - Network reconnect & background synchronization.

---

## 7. App Store Submission Checklist

Once TestFlight testing is verified, complete the App Store listing in App Store Connect:

### 1. App Store Screenshots
Apple requires screenshots for at least:
- **6.7" Display** (iPhone 15 Pro Max / 16 Pro Max / 14 Pro Max): 1290 × 2796 px or 1284 × 2778 px.
- **6.5" Display** (iPhone 11 Pro Max / XS Max): 1242 × 2688 px.
*(Screenshots can be captured directly on the simulator in Xcode via `Cmd + S` or exported from design tools).*

### 2. App Metadata
- **Title**: `VitaHero - Pediatric Health`
- **Subtitle**: `School health & growth tracking`
- **Description**: Same approved copy used for Google Play (outlining school camp screenings, growth monitoring, dietary guidance, and doctor appointments).
- **Keywords**: `pediatric, health camp, school health, growth tracker, child nutrition, doctor checkup`
- **Support URL**: `https://vitahero.kallam.workers.dev`
- **Privacy Policy URL**: `https://vitahero.kallam.workers.dev/privacy`

### 3. App Review Information
Apple reviewers will test the app. Because VitaHero is a closed-access application:
- Provide **Sign-in Required**: Check Yes.
- Provide a demo/test phone number that generates a known verification code or a test clinician account.
- Add notes explaining the app's purpose: *"VitaHero is a pediatric school health screening platform used by parents and camp clinicians. Test credentials have been pre-provisioned for review."*

### 4. App Privacy (Nutrition Labels)
Under **App Privacy**, declare:
- **Contact Info**: Phone number (account authentication).
- **Health & Fitness**: Pediatric screening vitals (height, weight, vision, dental).
- **Photos or Videos**: Meal photos (optional nutrition analysis).
- **Identifiers**: User ID.

### 5. Submit for Review
- Click **Add for Review** → **Submit to App Review**.
- Typical review turnaround is **24 to 48 hours**.
