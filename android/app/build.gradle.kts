plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
    alias(libs.plugins.ksp)
}

android {
    namespace = "com.rork.vitahero"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.rork.vitahero"
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "1.0"

        // Rork public env vars → BuildConfig (safe for client)
        buildConfigField("String", "TOOLKIT_URL", "\"${System.getenv("EXPO_PUBLIC_TOOLKIT_URL") ?: ""}\"")
        buildConfigField("String", "TOOLKIT_SECRET_KEY", "\"${System.getenv("EXPO_PUBLIC_RORK_TOOLKIT_SECRET_KEY") ?: ""}\"")
        buildConfigField("String", "PROJECT_ID", "\"${System.getenv("EXPO_PUBLIC_PROJECT_ID") ?: ""}\"")
        buildConfigField("String", "RORK_API_BASE_URL", "\"${System.getenv("EXPO_PUBLIC_RORK_API_BASE_URL") ?: ""}\"")
        buildConfigField("String", "RORK_AUTH_URL", "\"${System.getenv("EXPO_PUBLIC_RORK_AUTH_URL") ?: ""}\"")
        buildConfigField("String", "RORK_FUNCTIONS_URL", "\"${System.getenv("EXPO_PUBLIC_RORK_FUNCTIONS_URL") ?: ""}\"")
        buildConfigField("String", "TEAM_ID", "\"${System.getenv("EXPO_PUBLIC_TEAM_ID") ?: ""}\"")
        buildConfigField("String", "RORK_FUNCTIONS_URL", "\"${System.getenv("EXPO_PUBLIC_RORK_FUNCTIONS_URL") ?: ""}\"")
        buildConfigField("String", "GOOGLE_WEB_CLIENT_ID", "\"${System.getenv("EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID") ?: ""}\"")
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            signingConfig = signingConfigs.getByName("debug")
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
    implementation(libs.room.runtime)
    implementation(libs.room.ktx)
    ksp(libs.room.compiler)
    implementation(libs.androidx.security.crypto)
    implementation(libs.health.connect.client) {
        exclude(group = "com.google.guava", module = "guava")
        exclude(group = "com.google.guava", module = "failureaccess")
    }
    implementation(libs.guava.android)
    implementation(libs.androidx.credentials)
    implementation(libs.androidx.credentials.play.services.auth)
    implementation(libs.googleid)

    debugImplementation(libs.androidx.ui.tooling)
}
