package kallam.healthcare.data

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
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

    // ── the diet plan ──
    //
    // Keyed by child rather than held singly: a parent with two children
    // switches between them on the same screen, and a single slot would show
    // one child's plan under the other's name for as long as the second read
    // took.
    private val _dietPlans = MutableStateFlow<Map<String, DietPlanDto>>(emptyMap())
    val dietPlans: StateFlow<Map<String, DietPlanDto>> = _dietPlans.asStateFlow()

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

    /** What this family's children were referred for, for the booking screen. */
    private val _referralTargets = MutableStateFlow(ReferralSpecialtiesDto())
    val referralTargets: StateFlow<ReferralSpecialtiesDto> = _referralTargets.asStateFlow()

    private val _inFlight = MutableStateFlow(0)
    val busy: StateFlow<Boolean> = _inFlight
        .map { it > 0 }
        .stateIn(viewModelScope, SharingStarted.Eagerly, false)

    private fun say(message: String) { state.syncMessage.value = message }

    /**
     * Load a screen's data the first time it asks, and not on every rotation.
     *
     * A screen asks for what it shows when it appears, and Compose makes it
     * appear again on every configuration change — so turning the phone
     * re-fetched the referral list, the reading list and the question threads.
     * What a screen shows is this ViewModel's to own, not the composition's.
     *
     * A failed load does not count as loaded, so the next visit tries again,
     * and anything that genuinely needs fresh data passes `force`. The set is
     * touched only from viewModelScope, which is the main dispatcher, so it
     * needs no locking of its own.
     */
    private val loaded = mutableSetOf<String>()

    private fun once(key: String, force: Boolean = false, block: suspend () -> Unit) {
        if (force) loaded.remove(key)
        if (!loaded.add(key)) return
        viewModelScope.launch {
            try {
                block()
            } catch (e: Throwable) {
                loaded.remove(key)
                throw e
            }
        }
    }

    /**
     * Nothing from one family's session may outlive it.
     *
     * These flows are not part of AppStateHolder, so resetSession() never
     * reached them: signing out left the previous parent's referrals, threads
     * and consent requests sitting in memory. A reload used to paper over it;
     * now that a load happens once, it would not have.
     */
    private fun forgetSession() {
        loaded.clear()
        _pendingConsents.value = emptyList()
        _dietPlans.value = emptyMap()
        _result.value = null
        _photos.value = emptyList()
        _openPhoto.value = null
        _questionPolicy.value = QuestionPolicyDto()
        _threads.value = emptyList()
        _openThread.value = null
        _library.value = LibraryDto()
        _openArticle.value = null
        _referrals.value = emptyList()
        _symptomLog.value = SymptomLogDto()
        _symptomAdvice.value = ""
        _entitlements.value = EntitlementsDto()
        _dataRights.value = emptyList()
        _referralTargets.value = ReferralSpecialtiesDto()
    }

    init {
        viewModelScope.launch {
            container.auth.isLoggedIn.collect { if (!it) forgetSession() }
        }
    }


    /**
     * Run one thing the parent is waiting on, and count it.
     *
     * `busy` was a boolean set true at the top of each action and false at the
     * bottom. Two of these overlap easily — a question posted from one screen
     * while a data-rights erasure is still running from another — and the first
     * to finish cleared the flag for both, re-enabling a button whose request
     * was still in the air. That is how the same withdrawal gets sent twice.
     *
     * The count is released in a finally, so an action that throws on its way
     * out releases it too. Before, it did not, and the screen stayed busy for
     * the rest of the session.
     */
    private fun busyLaunch(block: suspend () -> Unit) {
        viewModelScope.launch {
            _inFlight.update { it + 1 }
            try {
                block()
            } finally {
                _inFlight.update { it - 1 }
            }
        }
    }

    /**
     * Everything the home screen needs to know there is something waiting: a
     * consent to answer, a referral to act on, a question that was answered.
     */
    fun refreshAll(force: Boolean = false) {
        // Four independent reads, and not forced by default: its one caller
        // fires on sign-in, and a fresh composition — every rotation — fires it
        // again. A sign-out clears what counts as loaded, so the next parent
        // gets their own. `force` is here for a pull-to-refresh that means it.
        loadPendingConsents(force)
        loadReferrals(force = force)
        loadQuestions(force)
        loadEntitlements(force)
    }

    // ─── The diet plan ──────────────────────────────────────

    /**
     * The plan for one child, if a dietician has written one.
     *
     * Keyed per child so two children never share a slot, and read once per
     * child per session — a plan changes when a dietician writes a new one,
     * which is weeks apart, not between two taps on the same screen.
     */
    fun loadDietPlan(kidId: String, force: Boolean = false) =
        once("dietplan:$kidId", force) {
            val plan = repo.dietPlan(kidId)
            // A missing plan leaves the map alone rather than writing null
            // into it: there is nothing to draw either way, and this keeps a
            // plan on screen through a failed refresh.
            if (plan != null) _dietPlans.update { it + (kidId to plan) }
        }

    // ─── Consent ────────────────────────────────────────────

    fun loadPendingConsents(force: Boolean = false) = once("consents", force) {
        _pendingConsents.value = repo.pendingConsents()
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
        busyLaunch {
            repo.recordConsent(campId, kidId, granted, checks, photos).fold(
                onSuccess = {
                    _pendingConsents.value = repo.pendingConsents()
                    say(tr(if (granted) S.consentRecordedYes else S.consentRecordedNo, locale))
                    onDone()
                },
                onFailure = { e -> say(e.message ?: tr(S.consentFailed, locale)) },
            )
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
        busyLaunch {
            _openPhoto.value = repo.photo(photoId)
        }
    }

    fun closePhoto() { _openPhoto.value = null }

    // ─── Questions ──────────────────────────────────────────

    fun loadQuestions(force: Boolean = false) = once("questions", force) {
        _questionPolicy.value = repo.questionPolicy()
        _threads.value = repo.threads()
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
        busyLaunch {
            repo.ask(schoolId, kidId, body, notUrgentAcknowledged).fold(
                onSuccess = { asked ->
                    _threads.value = repo.threads()
                    say(tr(S.questionSentMsg, locale).replace("%s", asked.expectedReplyWithinDays.toString()))
                    onDone()
                },
                onFailure = { e -> say(e.message ?: tr(S.questionFailed, locale)) },
            )
        }
    }

    // ─── Reading ────────────────────────────────────────────

    // Keyed by language: switching to Telugu is a different library, not a
    // stale one, so it loads again.
    fun loadLibrary(force: Boolean = false) = once("library:${locale.code}", force) {
        _library.value = repo.library(locale.code)
    }

    fun openArticle(slug: String) {
        viewModelScope.launch { _openArticle.value = repo.article(slug, locale.code) }
    }

    fun closeArticle() { _openArticle.value = null }

    // ─── Referrals ──────────────────────────────────────────

    fun loadReferrals(includeClosed: Boolean = false, force: Boolean = false) =
        once("referrals:$includeClosed", force) {
            _referrals.value = repo.referrals(includeClosed)
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
        busyLaunch {
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

    fun loadEntitlements(force: Boolean = false) = once("entitlements", force) {
        _entitlements.value = repo.entitlements()
    }

    /**
     * Write the family's whole record to a file the parent can keep or send on.
     *
     * The export itself is a data-rights action and the server logs it as one,
     * so this does not run on its own — only when a parent asks. [onReady] gets
     * the file; a null means the request did not come back, and the screen says
     * so rather than opening an empty share sheet.
     */
    fun exportMyData(cacheDir: java.io.File, onReady: (java.io.File?) -> Unit) {
        viewModelScope.launch {
            _inFlight.value++
            val json = repo.exportMyData()
            _inFlight.value--
            if (json.isNullOrBlank()) { onReady(null); return@launch }
            val f = java.io.File(cacheDir, "vitahero-my-data.json")
            onReady(runCatching { f.writeText(json); f }.getOrNull())
        }
    }

    fun loadReferralTargets(force: Boolean = false) = once("referralTargets", force) {
        _referralTargets.value = repo.referralSpecialties()
    }

    fun loadDataRights(force: Boolean = false) = once("dataRights", force) {
        _dataRights.value = repo.dataRights()
        _entitlements.value = repo.entitlements()
    }

    fun requestCorrection(kidId: String, field: String, value: String, note: String) {
        busyLaunch {
            repo.requestCorrection(kidId, field, value, note).fold(
                onSuccess = {
                    _dataRights.value = repo.dataRights()
                    say(tr(S.correctionSent, locale))
                },
                onFailure = { e -> say(e.message ?: tr(S.correctionFailed, locale)) },
            )
        }
    }

    /** The erasure right. Reachable only from the record screen. */
    fun eraseChild(kidId: String, onDone: () -> Unit = {}) {
        busyLaunch {
            repo.eraseChild(kidId).fold(
                onSuccess = {
                    _dataRights.value = repo.dataRights()
                    say(tr(S.childErased, locale))
                    onDone()
                },
                onFailure = { e -> say(e.message ?: tr(S.childEraseFailed, locale)) },
            )
        }
    }

    fun withdrawConsent(reason: String, onDone: () -> Unit = {}) {
        busyLaunch {
            repo.withdrawConsent(reason).fold(
                onSuccess = {
                    _dataRights.value = repo.dataRights()
                    say(tr(S.consentWithdrawn, locale))
                    onDone()
                },
                onFailure = { e -> say(e.message ?: tr(S.consentWithdrawFailed, locale)) },
            )
        }
    }
}
