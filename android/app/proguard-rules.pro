# ── Kotlin Serialization ──────────────────────────────────────
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.AnnotationsKt
-keepclassmembers class kotlinx.serialization.json.** { *** Companion; }
-keepclasseswithmembers class kotlinx.serialization.json.** {
    kotlinx.serialization.KSerializer serializer(...);
}
-keep,includedescriptorclasses class kallam.healthcare.**$$serializer { *; }
-keepclassmembers class kallam.healthcare.** {
    *** Companion;
}
-keepclasseswithmembers class kallam.healthcare.** {
    kotlinx.serialization.KSerializer serializer(...);
}

# ── Ktor ──────────────────────────────────────────────────────
-keep class io.ktor.** { *; }
-dontwarn io.ktor.**

# ── Coil ──────────────────────────────────────────────────────
-dontwarn coil3.**

# ── API DTOs (reflection-safe) ────────────────────────────────
-keep class kallam.healthcare.data.ProfileDto { *; }
-keep class kallam.healthcare.data.KidDto { *; }
-keep class kallam.healthcare.data.CampDto { *; }
-keep class kallam.healthcare.data.AppointmentDto { *; }
-keep class kallam.healthcare.data.MealItemDto { *; }
-keep class kallam.healthcare.data.GrowthPointDto { *; }
-keep class kallam.healthcare.data.StreakDto { *; }
-keep class kallam.healthcare.data.CoParentDto { *; }

# ── Models (used in serialization) ────────────────────────────
-keep class kallam.healthcare.data.ModelsKt { *; }

# ── Guava (Android variant) ────────────────────────────────────
-dontwarn com.google.common.**
-keep class com.google.common.** { *; }
-dontwarn com.google.errorprone.annotations.**
-dontwarn com.google.j2objc.annotations.**
-dontwarn javax.annotation.**
-dontwarn org.checkerframework.**

-keep class kallam.healthcare.data.SyncBatch { *; }
-keep class kallam.healthcare.data.SyncBatch$$serializer { *; }

# ── ML Kit ────────────────────────────────────────────────────
-keep class com.google.mlkit.** { *; }
-dontwarn com.google.mlkit.**

# ── General Kotlin ────────────────────────────────────────────
-keepattributes Signature
-keepattributes *Annotation*
-keep class kotlin.Metadata { *; }
-dontwarn kotlin.**
