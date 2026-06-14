package com.rork.vitahero.data

import android.content.Context
import android.content.Intent
import android.net.Uri

/**
 * Health Connect integration for syncing step count and activity data.
 *
 * In production, this would use the Health Connect API (androidx.health.connect).
 * For the demo, we provide a realistic placeholder that a) shows the Health Connect
 * intent to the user, b) provides sample wearable data, and c) surfaces the correct
 * permissions flow.
 */
object HealthConnectService {

    const val HC_PACKAGE = "com.google.android.apps.healthdata"
    const val HC_INSTALL_URL = "market://details?id=$HC_PACKAGE"

    data class WearableData(
        val stepsToday: Int = 0,
        val activeMinutes: Int = 0,
        val caloriesBurned: Int = 0,
        val lastSyncTime: String = "",
        val sourceDevice: String = "",
        val isConnected: Boolean = false
    )

    fun isHealthConnectAvailable(context: Context): Boolean {
        return try {
            context.packageManager.getPackageInfo(HC_PACKAGE, 0)
            true
        } catch (_: Exception) {
            false
        }
    }

    fun openHealthConnectInstall(context: Context) {
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(HC_INSTALL_URL))
        context.startActivity(intent)
    }

    fun openHealthConnect(context: Context) {
        val intent = context.packageManager.getLaunchIntentForPackage(HC_PACKAGE)
        if (intent != null) {
            context.startActivity(intent)
        } else {
            openHealthConnectInstall(context)
        }
    }

    /** Returns demo wearable data for a kid. In production, fetched from Health Connect API. */
    fun getDemoData(kidName: String): WearableData {
        val nameHash = kidName.hashCode()
        val steps = 5000 + (nameHash % 7000).coerceAtLeast(0)
        val minutes = 30 + (nameHash % 60)
        return WearableData(
            stepsToday = steps,
            activeMinutes = minutes,
            caloriesBurned = steps / 20,
            lastSyncTime = "2 hours ago",
            sourceDevice = if (nameHash % 2 == 0) "Fitbit Ace 3" else "Samsung Galaxy Fit",
            isConnected = true
        )
    }
}
