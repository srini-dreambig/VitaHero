package com.rork.vitahero.data

/**
 * Family Sharing — now handled by FirestoreRepository.
 * This object is kept for backward compatibility with ProfileViewModel.
 * The actual Firestore logic is in FirestoreRepository.validateFamilyCode(),
 * joinFamily(), and fetchSharedKids().
 */
object FamilySharingService {

    // All methods are now handled directly by FirestoreRepository.
    // This object remains as a reference point but delegates to the repository.
    // ProfileViewModel calls FirestoreRepository directly.
}
