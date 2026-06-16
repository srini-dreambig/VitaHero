package com.rork.vitahero.data

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.LocationManager
import androidx.core.content.ContextCompat
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

object LocationHelper {

    fun hasLocationPermission(context: Context): Boolean =
        ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) ==
            PackageManager.PERMISSION_GRANTED

    suspend fun getLastKnownLocation(context: Context): Pair<Double, Double>? = withContext(Dispatchers.IO) {
        if (!hasLocationPermission(context)) return@withContext null
        val lm = context.getSystemService(Context.LOCATION_SERVICE) as LocationManager
        val providers = listOf(
            LocationManager.NETWORK_PROVIDER,
            LocationManager.GPS_PROVIDER,
        )
        for (provider in providers) {
            if (!lm.isProviderEnabled(provider)) continue
            try {
                val loc = lm.getLastKnownLocation(provider) ?: continue
                if (loc.latitude != 0.0 || loc.longitude != 0.0) {
                    return@withContext loc.latitude to loc.longitude
                }
            } catch (_: SecurityException) {
            }
        }
        null
    }
}
