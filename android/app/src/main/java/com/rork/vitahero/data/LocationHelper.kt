package com.rork.vitahero.data

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Build
import android.os.Bundle
import android.os.CancellationSignal
import android.os.Looper
import androidx.core.content.ContextCompat
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import kotlin.coroutines.resume

object LocationHelper {

    private const val FRESH_LOCATION_TIMEOUT_MS = 10_000L

    fun hasLocationPermission(context: Context): Boolean =
        ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) ==
            PackageManager.PERMISSION_GRANTED ||
            ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) ==
            PackageManager.PERMISSION_GRANTED

    /** True if at least one usable location provider (GPS/network) is turned on. */
    fun isLocationEnabled(context: Context): Boolean {
        val lm = context.getSystemService(Context.LOCATION_SERVICE) as? LocationManager ?: return false
        return runCatching { lm.isProviderEnabled(LocationManager.GPS_PROVIDER) }.getOrDefault(false) ||
            runCatching { lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER) }.getOrDefault(false)
    }

    /**
     * Best-effort current location.
     * 1) Returns the most recent cached fix if available (instant).
     * 2) Otherwise actively requests a single fresh fix with a timeout — this is what
     *    makes "Use my location" work on emulators / freshly-booted devices where
     *    getLastKnownLocation() is null.
     */
    @SuppressLint("MissingPermission")
    suspend fun getCurrentLocation(context: Context): Pair<Double, Double>? = withContext(Dispatchers.IO) {
        if (!hasLocationPermission(context)) return@withContext null
        val lm = context.getSystemService(Context.LOCATION_SERVICE) as? LocationManager
            ?: return@withContext null
        val providers = enabledProviders(lm)
        if (providers.isEmpty()) return@withContext null

        lastKnown(lm, providers)?.let { return@withContext it }

        withTimeoutOrNull(FRESH_LOCATION_TIMEOUT_MS) {
            requestFresh(context, lm, providers.first())
        }
    }

    private fun enabledProviders(lm: LocationManager): List<String> {
        val candidates = buildList {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) add(LocationManager.FUSED_PROVIDER)
            add(LocationManager.GPS_PROVIDER)
            add(LocationManager.NETWORK_PROVIDER)
        }
        return candidates.distinct().filter {
            runCatching { lm.isProviderEnabled(it) }.getOrDefault(false)
        }
    }

    @SuppressLint("MissingPermission")
    private fun lastKnown(lm: LocationManager, providers: List<String>): Pair<Double, Double>? {
        var best: Location? = null
        for (p in providers) {
            val loc = runCatching { lm.getLastKnownLocation(p) }.getOrNull() ?: continue
            if (loc.latitude == 0.0 && loc.longitude == 0.0) continue
            if (best == null || loc.time > best.time) best = loc
        }
        return best?.let { it.latitude to it.longitude }
    }

    @SuppressLint("MissingPermission")
    private suspend fun requestFresh(
        context: Context,
        lm: LocationManager,
        provider: String,
    ): Pair<Double, Double>? = suspendCancellableCoroutine { cont ->
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            val signal = CancellationSignal()
            cont.invokeOnCancellation { runCatching { signal.cancel() } }
            runCatching {
                lm.getCurrentLocation(
                    provider,
                    signal,
                    ContextCompat.getMainExecutor(context),
                ) { loc ->
                    if (cont.isActive) cont.resume(loc?.let { it.latitude to it.longitude })
                }
            }.onFailure { if (cont.isActive) cont.resume(null) }
        } else {
            val listener = object : LocationListener {
                override fun onLocationChanged(loc: Location) {
                    if (cont.isActive) cont.resume(loc.latitude to loc.longitude)
                    runCatching { lm.removeUpdates(this) }
                }

                @Deprecated("Deprecated in Java")
                override fun onStatusChanged(p: String?, status: Int, extras: Bundle?) {}
                override fun onProviderEnabled(p: String) {}
                override fun onProviderDisabled(p: String) {}
            }
            cont.invokeOnCancellation { runCatching { lm.removeUpdates(listener) } }
            runCatching {
                @Suppress("DEPRECATION")
                lm.requestSingleUpdate(provider, listener, Looper.getMainLooper())
            }.onFailure { if (cont.isActive) cont.resume(null) }
        }
    }
}
