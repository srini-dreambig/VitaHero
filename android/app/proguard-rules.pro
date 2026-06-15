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

# ── Room ──────────────────────────────────────────────────────
-keep class * extends androidx.room.RoomDatabase
-dontwarn androidx.room.paging.**

# ── Ktor ──────────────────────────────────────────────────────
-keep class io.ktor.** { *; }
-dontwarn io.ktor.**

# ── Coil ──────────────────────────────────────────────────────
-dontwarn coil3.**

# ── Supabase DTOs (reflection-safe) ───────────────────────────
-keep class com.rork.vitahero.data.SupabaseDtosKt { *; }
-keep class com.rork.vitahero.data.ProfileDto { *; }
-keep class com.rork.vitahero.data.KidDto { *; }
-keep class com.rork.vitahero.data.CampDto { *; }
-keep class com.rork.vitahero.data.AppointmentDto { *; }
-keep class com.rork.vitahero.data.MealItemDto { *; }
-keep class com.rork.vitahero.data.GrowthPointDto { *; }
-keep class com.rork.vitahero.data.StreakDto { *; }
-keep class com.rork.vitahero.data.CoParentDto { *; }

# ── PersistentState & serializables ───────────────────────────
-keep class com.rork.vitahero.data.PersistentState { *; }
-keep class com.rork.vitahero.data.SerializableKid { *; }
-keep class com.rork.vitahero.data.SerializableGrowthPoint { *; }
-keep class com.rork.vitahero.data.SerializableAppointment { *; }
-keep class com.rork.vitahero.data.SerializableMealItem { *; }
-keep class com.rork.vitahero.data.SerializableStreakInfo { *; }
-keep class com.rork.vitahero.data.SerializableCoParent { *; }
-keep class com.rork.vitahero.data.SerializableWearableData { *; }
-keep class com.rork.vitahero.data.SerializableCamp { *; }

# ── Supabase Auth response models ─────────────────────────────
-keep class com.rork.vitahero.data.SupabaseAuth$AuthResponse { *; }
-keep class com.rork.vitahero.data.SupabaseAuth$AuthUser { *; }
-keep class com.rork.vitahero.data.SupabaseAuth$EdgeFnVerifyResponse { *; }
-keep class com.rork.vitahero.data.SupabaseAuth$EdgeFnUser { *; }

# ── Models (used in serialization) ────────────────────────────
-keep class com.rork.vitahero.data.ModelsKt { *; }

# ── Tink (security-crypto dependency) ─────────────────────────
-dontwarn com.google.errorprone.annotations.**
-dontwarn com.google.crypto.tink.**
-keep class com.google.crypto.tink.** { *; }

# ── Guava (Android variant) ────────────────────────────────────
-dontwarn com.google.common.**
-keep class com.google.common.** { *; }
-dontwarn com.google.errorprone.annotations.**
-dontwarn com.google.j2objc.annotations.**
-dontwarn javax.annotation.**
-dontwarn org.checkerframework.**

# ── General Kotlin ────────────────────────────────────────────
-keepattributes Signature
-keepattributes *Annotation*
-keep class kotlin.Metadata { *; }
-dontwarn kotlin.**
