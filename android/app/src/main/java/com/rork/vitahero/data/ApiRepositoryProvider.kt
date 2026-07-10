package com.rork.vitahero.data

import com.google.firebase.auth.FirebaseAuth

/**
 * Shared API access — provides FirestoreRepository for ViewModels and services.
 * ApiRepository is kept for backward compatibility with screens that call it directly.
 */
object ApiRepositoryProvider {
    /** Firestore repository — the primary data layer. */
    @Volatile
    var firestoreRepo: FirestoreRepository? = null

    /** Legacy API repository — still used by screens that call Worker endpoints directly. */
    val repository: ApiRepository by lazy { ApiRepository() }

    /** Initialize FirestoreRepository with the Application context. */
    fun init(app: android.app.Application) {
        if (firestoreRepo == null) {
            firestoreRepo = FirestoreRepository(app)
        }
    }
}
