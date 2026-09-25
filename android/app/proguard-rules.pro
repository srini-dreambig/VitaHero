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
-dontwarn io.ktor.**
-keepclassmembers class io.ktor.** {
    *** Companion;
}

# ── Coil ──────────────────────────────────────────────────────
-dontwarn coil3.**

# ── Application, Activities, ViewModels & Screens ────────────────
-keep class kallam.healthcare.** { *; }
-keepclassmembers class kallam.healthcare.** { *; }

# ── ML Kit ────────────────────────────────────────────────────
-dontwarn com.google.mlkit.**

# ── General Kotlin ────────────────────────────────────────────
-keepattributes Signature
-keepattributes *Annotation*
-keep class kotlin.Metadata { *; }
-dontwarn kotlin.**
