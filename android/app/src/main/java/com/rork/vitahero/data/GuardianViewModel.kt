package com.rork.vitahero.data

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/**
 * Everything the school pathway shows a parent: what they are being asked to
 * consent to, what came back, the photographs, the questions they have asked,
 * and the reading chosen from their own child's results.
 *
 * One ViewModel rather than five because these are one story to a parent, and
 * because they share a single rule worth keeping in one place: nothing clinical
 * is ever hidden behind a plan. `entitlements.care` is read; `plan` is not.
 */
class GuardianViewModel(
    application: Application,
    private val container: AppContainer,
) : AndroidViewModel(application) {

    private val repo = GuardianRepository()
    private val state get() = container.state

    private val locale: AppLocale get() = state.uiState.value.locale

    // ── consent ──
    private val _pendingConsents = MutableStateFlow<List<PendingConsentDto>>(emptyList())
    val pendingConsents: StateFlow<List<PendingConsentDto>> = _pendingConsents.asStateFlow()

    // ── results ──
    private val _result = MutableStateFlow<CampResultDto?>(null)
    val result: StateFlow<CampResultDto?> = _result.asStateFlow()

    // ── photographs ──
    private val _photos = MutableStateFlow<List<FindingPhotoDto>>(emptyList())
    val photos: StateFlow<List<FindingPhotoDto>> = _photos.asStateFlow()

    private val _openPhoto = MutableStateFlow<PhotoImageDto?>(null)
    val openPhoto: StateFlow<PhotoImageDto?> = _openPhoto.asStateFlow()

    // ── questions ──
    private val _questionPolicy = MutableStateFlow(QuestionPolicyDto())
    val questionPolicy: StateFlow<QuestionPolicyDto> = _questionPolicy.asStateFlow()

    private val _threads = MutableStateFlow<List<QuestionThreadDto>>(emptyList())
    val threads: StateFlow<List<QuestionThreadDto>> = _threads.asStateFlow()

    private val _openThread = MutableStateFlow<ThreadDetailDto?>(null)
    val openThread: StateFlow<ThreadDetailDto?> = _openThread.asStateFlow()

    // ── reading ──
    private val _library = MutableStateFlow(LibraryDto())
    val library: StateFlow<LibraryDto> = _library.asStateFlow()

    private val _openArticle = MutableStateFlow<ArticleDto?>(null)
    val openArticle: StateFlow<ArticleDto?> = _openArticle.asStateFlow()

    // ── referrals ──
    private val _referrals = MutableStateFlow<List<ReferralDto>>(emptyList())
    val referrals: StateFlow<List<ReferralDto>> = _referrals.asStateFlow()

    // ── everyday illness ──
    private val _symptomLog = MutableStateFlow(SymptomLogDto())
    val symptomLog: StateFlow<SymptomLogDto> = _symptomLog.asStateFlow()

    /** Set after a save when the complaint has a version that needs care today. */
    private val _symptomAdvice = MutableStateFlow("")
    val symptomAdvice: StateFlow<String> = _symptomAdvice.asStateFlow()

    // ── plan and rights ──
    private val _entitlements = MutableStateFlow(EntitlementsDto())
    val entitlements: StateFlow<EntitlementsDto> = _entitlements.asStateFlow()

    private val _dataRights = MutableStateFlow<List<DataRightDto>>(emptyList())
    val dataRights: StateFlow<List<DataRightDto>> = _dataRights.asStateFlow()

    private val _busy = MutableStateFlow(false)
    val busy: StateFlow<Boolean> = _busy.asStateFlow()

    private fun say(message: String) { state.syncMessage.value = message }

    /**
     * Everything the home screen needs to know there is something waiting: a
     * consent to answer, a referral to act on, a question that was answered.
     */
    fun refreshAll() {
        viewModelScope.launch {
            _pendingConsents.value = repo.pendingConsents()
            _referrals.value = repo.referrals()
            _threads.value = repo.threads()
            _entitlements.value = repo.entitlements()
        }
    }

    // ─── Consent ────────────────────────────────────────────

    fun loadPendingConsents() {
        viewModelScope.launch { _pendingConsents.value = repo.pendingConsents() }
    }

    /**
     * Answer one consent request.
     *
     * `photos` is only meaningful where the camp asked; the screen passes false
     * everywhere else, and declining the check-up clears it server-side anyway.
     */
    fun answerConsent(
        campId: String,
        kidId: String,
        granted: Boolean,
        checks: List<String>,
        photos: Boolean,
        onDone: () -> Unit = {},
    ) {
        viewModelScope.launch {
            _busy.value = true
            repo.recordConsent(campId, kidId, granted, checks, photos).fold(
                onSuccess = {
                    _pendingConsents.value = repo.pendingConsents()
                    say(tr(if (granted) S.consentRecordedYes else S.consentRecordedNo, locale))
                    onDone()
                },
                onFailure = { e -> say(e.message ?: tr(S.consentFailed, locale)) },
            )
            _busy.value = false
        }
    }

    // ─── Results and photographs ────────────────────────────

    fun loadResult(campId: String, kidId: String) {
        viewModelScope.launch {
            _result.value = repo.campResult(campId, kidId)
            _photos.value = repo.photos(kidId)
        }
    }

    fun openPhoto(photoId: String) {
        viewModelScope.launch {
            _busy.value = true
            _openPhoto.value = repo.photo(photoId)
            _busy.value = false
        }
    }

    fun closePhoto() { _openPhoto.value = null }

    // ─── Questions ──────────────────────────────────────────

    fun loadQuestions() {
        viewModelScope.launch {
            _questionPolicy.value = repo.questionPolicy()
            _threads.value = repo.threads()
        }
    }

    fun loadThread(threadId: String) {
        viewModelScope.launch { _openThread.value = repo.thread(threadId) }
    }

    fun closeThread() { _openThread.value = null }

    /**
     * Ask the school something.
     *
     * The acknowledgement is passed straight through rather than assumed: if a
     * screen ever forgets to collect it, the server refuses, which is the
     * behaviour we want.
     */
    fun ask(
        schoolId: String,
        kidId: String?,
        body: String,
        notUrgentAcknowledged: Boolean,
        onDone: () -> Unit = {},
    ) {
        viewModelScope.launch {
            _busy.value = true
            repo.ask(schoolId, kidId, body, notUrgentAcknowledged).fold(
                onSuccess = { asked ->
                    _threads.value = repo.threads()
                    say(tr(S.questionSentMsg, locale).replace("%s", asked.expectedReplyWithinDays.toString()))
                    onDone()
                },
                onFailure = { e -> say(e.message ?: tr(S.questionFailed, locale)) },
            )
            _busy.value = false
        }
    }

    // ─── Reading ────────────────────────────────────────────

    fun loadLibrary() {
        viewModelScope.launch { _library.value = repo.library(locale.code) }
    }

    fun openArticle(slug: String) {
        viewModelScope.launch { _openArticle.value = repo.article(slug, locale.code) }
    }

    fun closeArticle() { _openArticle.value = null }

    // ─── Referrals ──────────────────────────────────────────

    fun loadReferrals(includeClosed: Boolean = false) {
        viewModelScope.launch { _referrals.value = repo.referrals(includeClosed) }
    }

    fun markReferralBooked(referralId: String) {
        viewModelScope.launch {
            repo.markReferralBooked(referralId).fold(
                onSuccess = { _referrals.value = repo.referrals() },
                onFailure = { e -> say(e.message ?: tr(S.referralUpdateFailed, locale)) },
            )
        }
    }

    fun markReferralAttended(referralId: String, note: String) {
        viewModelScope.launch {
            repo.markReferralAttended(referralId, note).fold(
                onSuccess = { _referrals.value = repo.referrals() },
                onFailure = { e -> say(e.message ?: tr(S.referralUpdateFailed, locale)) },
            )
        }
    }

    fun declineReferral(referralId: String, reason: String) {
        viewModelScope.launch {
            repo.declineReferral(referralId, reason).fold(
                onSuccess = { _referrals.value = repo.referrals() },
                onFailure = { e -> say(e.message ?: tr(S.referralUpdateFailed, locale)) },
            )
        }
    }

    // ─── Everyday illness ───────────────────────────────────

    fun loadSymptoms(kidId: String) {
        viewModelScope.launch { _symptomLog.value = repo.symptomLog(kidId) }
    }

    fun recordSymptom(
        kidId: String,
        symptom: String,
        severity: String,
        startedOn: String,
        endedOn: String?,
        note: String,
        sawDoctor: Boolean,
        missedSchool: Boolean,
        onDone: () -> Unit = {},
    ) {
        viewModelScope.launch {
            _busy.value = true
            repo.recordSymptom(
                SymptomBody(
                    kidId = kidId, symptom = symptom, severity = severity,
                    startedOn = startedOn, endedOn = endedOn?.takeIf { it.isNotBlank() },
                    note = note, sawDoctor = sawDoctor, missedSchool = missedSchool,
                )
            ).fold(
                onSuccess = { saved ->
                    _symptomLog.value = repo.symptomLog(kidId)
                    // Kept whether or not there is advice: the record is saved
                    // either way, and the advice is shown on top of it.
                    _symptomAdvice.value = saved.advice
                    if (saved.advice.isBlank()) say(tr(S.symptomSaved, locale))
                    onDone()
                },
                onFailure = { e -> say(e.message ?: tr(S.symptomFailed, locale)) },
            )
            _busy.value = false
        }
    }

    fun clearSymptomAdvice() { _symptomAdvice.value = "" }

    fun deleteSymptom(kidId: String, eventId: String) {
        viewModelScope.launch {
            repo.deleteSymptom(eventId).fold(
                onSuccess = { _symptomLog.value = repo.symptomLog(kidId) },
                onFailure = { e -> say(e.message ?: tr(S.symptomFailed, locale)) },
            )
        }
    }

    // ─── Plan and rights ────────────────────────────────────

    fun loadEntitlements() {
        viewModelScope.launch { _entitlements.value = repo.entitlements() }
    }

    fun loadDataRights() {
        viewModelScope.launch {
            _dataRights.value = repo.dataRights()
            _entitlements.value = repo.entitlements()
        }
    }

    fun requestCorrection(kidId: String, field: String, value: String, note: String) {
        viewModelScope.launch {
            _busy.value = true
            repo.requestCorrection(kidId, field, value, note).fold(
                onSuccess = {
                    _dataRights.value = repo.dataRights()
                    say(tr(S.correctionSent, locale))
                },
                onFailure = { e -> say(e.message ?: tr(S.correctionFailed, locale)) },
            )
            _busy.value = false
        }
    }

    /** The erasure right. Reachable only from the record screen. */
    fun eraseChild(kidId: String, onDone: () -> Unit = {}) {
        viewModelScope.launch {
            _busy.value = true
            repo.eraseChild(kidId).fold(
                onSuccess = {
                    _dataRights.value = repo.dataRights()
                    say(tr(S.childErased, locale))
                    onDone()
                },
                onFailure = { e -> say(e.message ?: tr(S.childEraseFailed, locale)) },
            )
            _busy.value = false
        }
    }

    fun withdrawConsent(reason: String, onDone: () -> Unit = {}) {
        viewModelScope.launch {
            _busy.value = true
            repo.withdrawConsent(reason).fold(
                onSuccess = {
                    _dataRights.value = repo.dataRights()
                    say(tr(S.consentWithdrawn, locale))
                    onDone()
                },
                onFailure = { e -> say(e.message ?: tr(S.consentWithdrawFailed, locale)) },
            )
            _busy.value = false
        }
    }
}
