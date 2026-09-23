plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
    alias(libs.plugins.google.services)
    alias(libs.plugins.play.publisher)
}

import java.net.URI
import java.util.Properties

val localProperties = Properties().apply {
    rootProject.file("local.properties").takeIf { it.exists() }?.inputStream()?.use { load(it) }
}

fun buildConfigProp(vararg keys: String): String {
    for (key in keys) {
        System.getenv(key)?.trim()?.takeIf { it.isNotEmpty() }?.let { return it }
        localProperties.getProperty(key)?.trim()?.takeIf { it.isNotEmpty() }?.let { return it }
        (project.findProperty(key) as? String)?.trim()?.takeIf { it.isNotEmpty() }?.let { return it }
    }
    return ""
}

android {
    namespace = "com.rork.vitahero"
    compileSdk = 36

    defaultConfig {
        applicationId = "kallam.healthcare"
        minSdk = 26
        targetSdk = 36
        versionCode = 3
        versionName = "1.0"

        // Backend URL + auth (client-safe). AI Toolkit secrets live on the Cloudflare Worker only.
        //
        // One source of truth for where the backend is. Two things need it and
        // they must agree: the code, through BuildConfig, and the App Link
        // intent filter in the manifest, which needs the bare host. They were
        // separate literals before, and separately wrong — the code pointed at
        // Rork's worker and the manifest at Rork's web domain, so a build
        // could be pointed at our own backend and still hand every invite link
        // to a browser, because the host it verifies against was somebody
        // else's.
        //
        // Override with RORK_FUNCTIONS_URL in local.properties, an environment
        // variable, or -PRORK_FUNCTIONS_URL to aim a build at staging.
        val backendUrl = buildConfigProp("RORK_FUNCTIONS_URL", "EXPO_PUBLIC_RORK_FUNCTIONS_URL")
            .ifEmpty { "https://vitahero.kallam.workers.dev" }
            .trimEnd('/')
        // URI, imported. Not java.net.URI written out: inside a Gradle Kotlin
        // DSL script `java` is the Java plugin's extension, so the fully
        // qualified name resolves to that and then fails on `.net`.
        val backendHost = URI(backendUrl).host
            ?: error("RORK_FUNCTIONS_URL is not a URL with a host: $backendUrl")
        buildConfigField("String", "RORK_FUNCTIONS_URL", "\"$backendUrl\"")
        manifestPlaceholders["inviteHost"] = backendHost
        buildConfigField("String", "RORK_API_BASE_URL", "\"${buildConfigProp("RORK_API_BASE_URL", "EXPO_PUBLIC_RORK_API_BASE_URL")}\"")
        buildConfigField("String", "RORK_AUTH_URL", "\"${buildConfigProp("RORK_AUTH_URL", "EXPO_PUBLIC_RORK_AUTH_URL")}\"")
        buildConfigField("String", "PROJECT_ID", "\"${buildConfigProp("PROJECT_ID", "EXPO_PUBLIC_PROJECT_ID")}\"")
        buildConfigField("String", "TEAM_ID", "\"${buildConfigProp("TEAM_ID", "EXPO_PUBLIC_TEAM_ID")}\"")
    }

    // Release signing.
    //
    // This used to be `signingConfig = signingConfigs.getByName("debug")`,
    // which produces a build Google Play refuses outright — "You uploaded an
    // APK that was signed in debug mode" — and which anyone can re-sign,
    // because the debug keystore ships with the Android SDK and its password
    // is public.
    //
    // Supply the four values as environment variables or in local.properties
    // (which is not committed). With none of them set the release build is
    // simply unsigned, which fails loudly at upload time instead of quietly
    // producing something that looks signed and is not.
    signingConfigs {
        val storePath = buildConfigProp("VITAHERO_KEYSTORE")
        if (storePath.isNotEmpty() && file(storePath).exists()) {
            create("release") {
                storeFile = file(storePath)
                storePassword = buildConfigProp("VITAHERO_KEYSTORE_PASSWORD")
                keyAlias = buildConfigProp("VITAHERO_KEY_ALIAS")
                keyPassword = buildConfigProp("VITAHERO_KEY_PASSWORD")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            signingConfig = signingConfigs.findByName("release")
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }
}

// ─── Publishing to Google Play ──────────────────────────────
//
// Gradle Play Publisher. `./gradlew :app:publishReleaseBundle` builds the
// signed bundle and uploads it; the credentials come from the environment, not
// from this file and not from the repository.
//
// The upload is deliberately awkward to do by accident:
//
//   * There is no default track. PLAY_TRACK must be set, so nobody reaches
//     production by running the command they used for a test build. The three
//     that matter are "internal", "beta" and "production".
//   * A release is a draft unless PLAY_RELEASE_STATUS says otherwise, so an
//     upload lands in the console for a human to look at and roll out.
//   * With no credentials the configuration still loads and every other task
//     — assemble, test, lint — works as before. Only the publish tasks fail,
//     and they fail saying which variable is missing rather than with a stack
//     trace about a null file.
//
// Set up, once:
//   1. Play Console → Users and permissions → invite a service account with
//      "Release apps to testing tracks" (and "Release to production" only if
//      you want that from here).
//   2. Google Cloud → that service account → Keys → create a JSON key.
//   3. Keep the JSON out of the repository. Locally, point
//      ANDROID_PUBLISHER_CREDENTIALS at the file; in CI, put its *contents* in
//      a secret and write it to a file in the job.
//
// The first upload of an app must still be made by hand in the Play Console:
// the API cannot create a listing, only add releases to one that exists.
val playCredentialsPath: String = buildConfigProp("ANDROID_PUBLISHER_CREDENTIALS")
val playTrack: String = buildConfigProp("PLAY_TRACK")
val playStatus: String = buildConfigProp("PLAY_RELEASE_STATUS")

play {
    enabled.set(playCredentialsPath.isNotEmpty())
    if (playCredentialsPath.isNotEmpty()) {
        serviceAccountCredentials.set(file(playCredentialsPath))
    }
    // "internal" is here so configuring the project works with nothing set,
    // not as a default anybody should rely on: the check below refuses to
    // publish at all unless PLAY_TRACK says which track was meant. A default
    // that quietly picks a track is how a test build reaches production.
    track.set(playTrack.ifEmpty { "internal" })
    releaseStatus.set(
        when (playStatus.lowercase()) {
            "completed" -> com.github.triplet.gradle.androidpublisher.ReleaseStatus.COMPLETED
            "inprogress", "in_progress" -> com.github.triplet.gradle.androidpublisher.ReleaseStatus.IN_PROGRESS
            "halted" -> com.github.triplet.gradle.androidpublisher.ReleaseStatus.HALTED
            else -> com.github.triplet.gradle.androidpublisher.ReleaseStatus.DRAFT
        }
    )
    // Play takes app bundles; an APK is for sideloading and testing.
    defaultToAppBundles.set(true)
    // What to do when the version code being uploaded is already on Play.
    // AUTO silently bumps it, which means the number in build.gradle.kts and
    // the number in the store stop agreeing and nobody finds out until they
    // try to match a crash report to a build. FAIL says so instead, and the
    // fix is to bump versionCode deliberately.
    resolutionStrategy.set(com.github.triplet.gradle.androidpublisher.ResolutionStrategy.FAIL)
}

/**
 * Refuse a publish that is missing what it needs, before Gradle builds a bundle
 * for twenty minutes and then cannot upload it.
 */
// Read here, at configuration time, and captured by value.
//
// The obvious version calls buildConfigProp() inside doFirst, which reaches
// through `project` while the task is running. That works today only because
// org.gradle.configuration-cache is false in gradle.properties; the day
// somebody turns it on, the build fails with a configuration-cache violation
// pointing at a publish guard rather than at anything to do with publishing.
val playKeystoreSet: Boolean = buildConfigProp("VITAHERO_KEYSTORE").isNotEmpty()

tasks.matching { it.name.startsWith("publish") && it.name.contains("Release") }.configureEach {
    doFirst {
        val missing = buildList {
            if (playCredentialsPath.isEmpty()) add("ANDROID_PUBLISHER_CREDENTIALS (path to the service account JSON)")
            if (playTrack.isEmpty()) add("PLAY_TRACK (internal, beta or production)")
            if (!playKeystoreSet) add("VITAHERO_KEYSTORE (the upload keystore)")
        }
        check(missing.isEmpty()) {
            "Cannot publish to Play. Set:\n  " + missing.joinToString("\n  ")
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_11)
    }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.activity.compose)
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.ui)
    implementation(libs.androidx.ui.graphics)
    implementation(libs.androidx.ui.tooling.preview)
    implementation(libs.androidx.material3)
    implementation(libs.androidx.material.icons.extended)
    implementation(libs.androidx.navigation.compose)
    implementation(libs.kotlinx.serialization.json)
    implementation(libs.ktor.client.core)
    implementation(libs.ktor.client.android)
    implementation(libs.ktor.client.content.negotiation)
    implementation(libs.ktor.serialization.json)
    implementation(libs.coil.compose)
    implementation(libs.coil.network.okhttp)
    implementation(libs.health.connect.client) {
        exclude(group = "com.google.guava", module = "guava")
        exclude(group = "com.google.guava", module = "failureaccess")
    }
    implementation(libs.androidx.security.crypto)
    implementation(libs.guava.android)
    implementation(libs.mlkit.image.labeling)
    implementation(libs.androidx.work.runtime.ktx)
    implementation(platform(libs.firebase.bom))
    implementation(libs.firebase.auth)

    debugImplementation(libs.androidx.ui.tooling)
}
