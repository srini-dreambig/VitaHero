package com.rork.vitahero

import android.app.Application
import android.util.Log
import com.rork.vitahero.data.AppContainer

class VitaHeroApplication : Application() {
    lateinit var appContainer: AppContainer
        private set

    override fun onCreate() {
        super.onCreate()
        // Every uncaught crash is logged with its full stack before the
        // process dies, so a device-side failure can be diagnosed from the
        // runtime logs instead of only from a user's "it crashed".
        val platform = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { thread, e ->
            Log.e("VitaHero", "Uncaught exception on ${thread.name}", e)
            platform?.uncaughtException(thread, e)
        }
        appContainer = AppContainer(this)
    }
}
