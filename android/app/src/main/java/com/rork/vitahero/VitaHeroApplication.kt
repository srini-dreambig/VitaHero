package com.rork.vitahero

import android.app.Application
import com.rork.vitahero.data.AppContainer

class VitaHeroApplication : Application() {
    lateinit var appContainer: AppContainer
        private set

    override fun onCreate() {
        super.onCreate()
        appContainer = AppContainer(this)
    }
}
