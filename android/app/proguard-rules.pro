# ── Kotlin Serialization ──────────────────────────────────────
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.AnnotationsKt
-keepclassmembers class kotlinx.serialization.json.** { *** Companion; }
-keepclasseswithmembers class kotlinx.serialization.json.** {
    kotlinx.serialization.KSerializer serializer(...);
}
-keep,includedescriptorclasses class com.rork.vitahero.**$$serializer { *; }
-keepclassmembers class com.rork.vitahero.** {
    *** Companion;
}
-keepclasseswithmembers class com.rork.vitahero.** {
    kotlinx.serialization.KSerializer serializer(...);
}

# ── Ktor ──────────────────────────────────────────────────────
-keep class io.ktor.** { *; }
-dontwarn io.ktor.**

# ── Coil ──────────────────────────────────────────────────────
-dontwarn coil3.**

# ── API DTOs (reflection-safe) ────────────────────────────────
-keep class com.rork.vitahero.data.ProfileDto { *; }
-keep class com.rork.vitahero.data.KidDto { *; }
-keep class com.rork.vitahero.data.CampDto { *; }
-keep class com.rork.vitahero.data.AppointmentDto { *; }
-keep class com.rork.vitahero.data.MealItemDto { *; }
-keep class com.rork.vitahero.data.GrowthPointDto { *; }
-keep class com.rork.vitahero.data.StreakDto { *; }
-keep class com.rork.vitahero.data.CoParentDto { *; }

# ── Models (used in serialization) ────────────────────────────
-keep class com.rork.vitahero.data.ModelsKt { *; }

# ── Guava (Android variant) ────────────────────────────────────
-dontwarn com.google.common.**
-keep class com.google.common.** { *; }
-dontwarn com.google.errorprone.annotations.**
-dontwarn com.google.j2objc.annotations.**
-dontwarn javax.annotation.**
-dontwarn org.checkerframework.**

-keep class com.rork.vitahero.data.SyncBatch { *; }
-keep class com.rork.vitahero.data.SyncBatch$$serializer { *; }

# ── ML Kit ────────────────────────────────────────────────────
-keep class com.google.mlkit.** { *; }
-dontwarn com.google.mlkit.**

# ── General Kotlin ────────────────────────────────────────────
-keepattributes Signature
-keepattributes *Annotation*
-keep class kotlin.Metadata { *; }
-dontwarn kotlin.**
