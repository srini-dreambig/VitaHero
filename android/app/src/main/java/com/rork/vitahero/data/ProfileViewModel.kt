package com.rork.vitahero.data

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/**
 * Profile settings, notifications preferences, in-app notifications, and family sharing.
 * Uses FirestoreRepository for Firestore operations.
 */
class ProfileViewModel(
    application: Application,
    private val container: AppContainer,
) : AndroidViewModel(application) {

    private val state get() = container.state
    private val auth get() = container.auth
    private val repo get() = container.repo

    fun scheduleAllNotifications() {
        NotificationCoordinator.scheduleAll(getApplication(), state.uiState.value)
    }

    fun toggleNotificationsEnabled() {
        state.uiState.update { it.copy(notificationsEnabled = !it.notificationsEnabled) }
        if (!state.uiState.value.notificationsEnabled) {
            NotificationCoordinator.cancelAll(getApplication(), state.uiState.value)
        } else {
            scheduleAllNotifications()
        }
        container.persist(SyncEntity.PROFILE)
    }

    fun toggleCampReminders() {
        state.uiState.update { it.copy(campRemindersEnabled = !it.campRemindersEnabled) }
        if (!state.uiState.value.campRemindersEnabled) {
            NotificationCoordinator.cancelCampReminders(getApplication(), state.uiState.value)
        } else {
            scheduleAllNotifications()
        }
        container.persist(SyncEntity.PROFILE)
    }

    fun toggleDarkTheme() {
        state.uiState.update { it.copy(darkTheme = !it.darkTheme) }
        container.persist(SyncEntity.PROFILE)
    }

    fun setLocale(locale: AppLocale) {
        state.uiState.update { it.copy(locale = locale) }
        container.persist(SyncEntity.PROFILE)
    }

    fun markAllNotificationsRead() {
        val ids = state.uiState.value.notifications.map { it.id }
        state.uiState.update { ui ->
            ui.copy(notifications = ui.notifications.map { it.copy(unread = false) })
        }
        if (ids.isNotEmpty() && auth.isLoggedIn.value) {
            viewModelScope.launch {
                try { repo.markNotificationsRead(ids) } catch (_: Exception) { }
            }
        }
    }

    fun generateFamilyCode() {
        state.uiState.update { it.copy(familyCode = randomFamilyCode()) }
        container.persist(SyncEntity.PROFILE)
    }

    /** Used during consent flow before profile VM may be wired in UI. */
    fun generateFamilyCodeIfNeeded(): String {
        val current = state.uiState.value.familyCode
        if (current.isNotBlank()) return current
        val code = randomFamilyCode()
        state.uiState.update { it.copy(familyCode = code) }
        return code
    }

    fun joinFamily(code: String, kidsViewModel: KidsViewModel) {
        viewModelScope.launch {
            val locale = state.uiState.value.locale
            repo.validateFamilyCode(code).let { validation ->
                if (!validation.valid) {
                    state.syncMessage.value = validation.error ?: tr(S.familyInvalid, locale)
                    return@launch
                }
                repo.joinFamily(
                    code = code,
                    coParentName = state.uiState.value.parentName,
                    relation = tr(S.coParentRelation, locale),
                ).let { result ->
                    if (result.success) {
                        container.fetchAndApplyBackendData(viewModelScope)
                        fetchSharedKids(kidsViewModel)
                    } else {
                        state.syncMessage.value = result.error ?: tr(S.familyInvalid, locale)
                    }
                }
            }
        }
    }

    fun fetchSharedKids(kidsViewModel: KidsViewModel) {
        val code = state.uiState.value.familyCode
        if (code.isBlank()) return
        viewModelScope.launch {
            repo.fetchSharedKids(code).let { resp ->
                if (resp.kids.isNotEmpty() && !resp.isOwner) {
                    val sharedKids = resp.kids.filter { !it.isOwnerKid }.map { dto ->
                        Kid(
                            id = dto.id, name = dto.name, age = dto.age,
                            gender = dto.gender, school = dto.school, grade = dto.grade,
                            heightCm = dto.heightCm.toFloat(), weightKg = dto.weightKg.toFloat(),
                            avatarColor = (dto.name.hashCode() and 0xFFFFFF).toLong() or 0xFF000000,
                            overallScore = dto.overallScore,
                            growth = emptyList(),
                            dental = runCatching { HealthFlag.valueOf(dto.dental) }.getOrDefault(HealthFlag.GOOD),
                            eyesight = runCatching { HealthFlag.valueOf(dto.eyesight) }.getOrDefault(HealthFlag.GOOD),
                            nutrition = runCatching { HealthFlag.valueOf(dto.nutrition) }.getOrDefault(HealthFlag.GOOD),
                            lastCheckup = dto.lastCheckup,
                        )
                    }
                    kidsViewModel.mergeSharedKids(sharedKids)
                }
            }
        }
    }

    private fun randomFamilyCode(): String {
        val chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
        return (1..6).map { chars.random() }.joinToString("")
    }
}
