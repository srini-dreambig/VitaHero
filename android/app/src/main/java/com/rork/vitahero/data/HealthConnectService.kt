package com.rork.vitahero.data

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.records.ActiveCaloriesBurnedRecord
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.time.Instant
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter

/**
 * Health Connect integration for syncing step count, activity minutes,
 * and calorie data from wearable devices.
 *
 * Uses the androidx.health.connect API to read real data from
 * connected fitness trackers and smartwatches.
 *
 * Falls back to estimated data when Health Connect is not available
 * or the user hasn't granted permissions.
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
        val status = HealthConnectClient.getSdkStatus(context)
        return status == HealthConnectClient.SDK_AVAILABLE
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

    /**
     * Fetch real health data from Health Connect for today.
     * Falls back to estimated data if Health Connect is unavailable.
     */
    suspend fun fetchHealthData(context: Context, kidName: String): WearableData =
        withContext(Dispatchers.IO) {
            if (!isHealthConnectAvailable(context)) {
                return@withContext WearableData(
                    stepsToday = 0, activeMinutes = 0, caloriesBurned = 0,
                    lastSyncTime = "", sourceDevice = "", isConnected = false
                )
            }

            try {
                val client = HealthConnectClient.getOrCreate(context)
                val now = Instant.now()
                val todayStart = ZonedDateTime.now(ZoneId.systemDefault())
                    .toLocalDate().atStartOfDay(ZoneId.systemDefault()).toInstant()

                // Read today's step count
                val stepsResponse = client.readRecords(
                    ReadRecordsRequest(
                        recordType = StepsRecord::class,
                        timeRangeFilter = TimeRangeFilter.between(todayStart, now),
                    )
                )
                val stepsToday = stepsResponse.records.sumOf { it.count.toInt() }

                // Read today's active calories
                val caloriesResponse = client.readRecords(
                    ReadRecordsRequest(
                        recordType = ActiveCaloriesBurnedRecord::class,
                        timeRangeFilter = TimeRangeFilter.between(todayStart, now),
                    )
                )
                val caloriesBurned = caloriesResponse.records.sumOf {
                    it.energy.inKilocalories.toInt()
                }

                // Read today's exercise sessions for active minutes
                val exerciseResponse = client.readRecords(
                    ReadRecordsRequest(
                        recordType = ExerciseSessionRecord::class,
                        timeRangeFilter = TimeRangeFilter.between(todayStart, now),
                    )
                )
                val activeMinutes = exerciseResponse.records.sumOf {
                    java.time.Duration.between(it.startTime, it.endTime).toMinutes().toInt()
                }

                val formatter = DateTimeFormatter.ofPattern("HH:mm")
                val lastSync = ZonedDateTime.now().format(formatter)

                WearableData(
                    stepsToday = stepsToday,
                    activeMinutes = activeMinutes,
                    caloriesBurned = caloriesBurned,
                    lastSyncTime = "Today at $lastSync",
                    sourceDevice = "Health Connect",
                    isConnected = true
                )
            } catch (e: Exception) {
                WearableData(
                    stepsToday = 0, activeMinutes = 0, caloriesBurned = 0,
                    lastSyncTime = "", sourceDevice = "Health Connect",
                    isConnected = false
                )
            }
        }

    /** @deprecated No estimated data — returns disconnected state. */
    fun getDemoData(kidName: String): WearableData = WearableData(isConnected = false)
}
