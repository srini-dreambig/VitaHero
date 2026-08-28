package com.rork.vitahero

import android.app.Application
import com.google.firebase.FirebaseApp
import com.google.firebase.appcheck.FirebaseAppCheck
import com.google.firebase.appcheck.playintegrity.PlayIntegrityAppCheckProviderFactory
import com.rork.vitahero.data.ApiRepositoryProvider
import com.rork.vitahero.data.AppContainer

class VitaHeroApplication : Application() {
    lateinit var appContainer: AppContainer
        private set

    override fun onCreate() {
        super.onCreate()
        // Firebase is normally auto-initialized by FirebaseInitProvider; this is
        // idempotent and guarantees FirebaseApp exists before App Check setup.
        FirebaseApp.initializeApp(this)
        // Attach Play Integrity attestation so every Firebase request (including
        // phone-auth OTP) carries an App Check token. Without this, Firebase marks
        // all requests "Unverified: outdated client" and rejects them when
        // App Check enforcement is enabled in the Firebase console.
        FirebaseAppCheck.getInstance()
            .installAppCheckProviderFactory(PlayIntegrityAppCheckProviderFactory.getInstance())
        appContainer = AppContainer(this)
        ApiRepositoryProvider.init(this)
    }
}
