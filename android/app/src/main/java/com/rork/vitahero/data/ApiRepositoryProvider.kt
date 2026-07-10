package com.rork.vitahero.data

/**
 * Shared API access — one instance for ViewModel, AuthManager, and services.
 */
object ApiRepositoryProvider {
    val repository: ApiRepository by lazy { ApiRepository() }
}
