plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
    alias(libs.plugins.google.services)
}

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
        versionCode = 2
        versionName = "1.0"

        // Backend URL + auth (client-safe). AI Toolkit secrets live on the Cloudflare Worker only.
        buildConfigField("String", "RORK_FUNCTIONS_URL", "\"${buildConfigProp("RORK_FUNCTIONS_URL", "EXPO_PUBLIC_RORK_FUNCTIONS_URL")}\"")
        buildConfigField("String", "RORK_API_BASE_URL", "\"${buildConfigProp("RORK_API_BASE_URL", "EXPO_PUBLIC_RORK_API_BASE_URL")}\"")
        buildConfigField("String", "RORK_AUTH_URL", "\"${buildConfigProp("RORK_AUTH_URL", "EXPO_PUBLIC_RORK_AUTH_URL")}\"")
        buildConfigField("String", "PROJECT_ID", "\"${buildConfigProp("PROJECT_ID", "EXPO_PUBLIC_PROJECT_ID")}\"")
        buildConfigField("String", "TEAM_ID", "\"${buildConfigProp("TEAM_ID", "EXPO_PUBLIC_TEAM_ID")}\"")
        buildConfigField("String", "GOOGLE_WEB_CLIENT_ID", "\"${buildConfigProp("GOOGLE_WEB_CLIENT_ID", "EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID")}\"")
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
    implementation(libs.androidx.credentials)
    implementation(libs.androidx.credentials.play.services.auth)
    implementation(libs.googleid)
    implementation(libs.mlkit.image.labeling)
    implementation(libs.androidx.work.runtime.ktx)
    implementation(platform(libs.firebase.bom))
    implementation(libs.firebase.auth)

    debugImplementation(libs.androidx.ui.tooling)
}
