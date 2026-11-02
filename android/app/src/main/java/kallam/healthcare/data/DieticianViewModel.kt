package kallam.healthcare.data

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/**
 * A dietician's work, held for the three screens that show it.
 *
 * Schools → the children at one of them → one child's record and the plan.
 * Nothing here decides who may be seen: the server scopes every answer to the
 * schools this person was assigned, and refuses a child outside them with the
 * same message it gives for a child that does not exist.
 */
class DieticianViewModel(
    application: Application,
    private val container: AppContainer,
) : AndroidViewModel(application) {

    private val repo = DieticianRepository()

    private val _me = MutableStateFlow(DieticianMeDto())
    val me: StateFlow<DieticianMeDto> = _me.asStateFlow()

    private val _schools = MutableStateFlow<List<DieticianSchoolDto>>(emptyList())
    val schools: StateFlow<List<DieticianSchoolDto>> = _schools.asStateFlow()

    private val _children = MutableStateFlow<List<DieticianChildDto>>(emptyList())
    val children: StateFlow<List<DieticianChildDto>> = _children.asStateFlow()

    private val _record = MutableStateFlow<DieticianChildRecordDto?>(null)
    val record: StateFlow<DieticianChildRecordDto?> = _record.asStateFlow()

    private val _busy = MutableStateFlow(false)
    val busy: StateFlow<Boolean> = _busy.asStateFlow()

    /**
     * Why the last thing failed, or "".
     *
     * Shown as the server wrote it. "Your dietician account is not active"
     * and "that child is not at one of your schools" are both things the
     * person holding the phone can act on; "something went wrong" is not.
     */
    private val _message = MutableStateFlow("")
    val message: StateFlow<String> = _message.asStateFlow()

    /** Set when a plan has been saved, so the screen can say so and step back. */
    private val _saved = MutableStateFlow(false)
    val saved: StateFlow<Boolean> = _saved.asStateFlow()

    /** C4 — the articles this dietician has written for the reading list. */
    private val _articles = MutableStateFlow<List<LibraryArticleDto>>(emptyList())
    val articles: StateFlow<List<LibraryArticleDto>> = _articles.asStateFlow()

    /** One school's children in groups, for planning many at once. */
    private val _cohorts = MutableStateFlow<DieticianCohortsDto?>(null)
    val cohorts: StateFlow<DieticianCohortsDto?> = _cohorts.asStateFlow()

    /** The draft for the group being planned, as last asked for. */
    private val _cohortDraft = MutableStateFlow<CohortDraftDto?>(null)
    val cohortDraft: StateFlow<CohortDraftDto?> = _cohortDraft.asStateFlow()

    /** How many children the last group plan went to, or 0. */
    private val _cohortSaved = MutableStateFlow(0)
    val cohortSaved: StateFlow<Int> = _cohortSaved.asStateFlow()

    fun clearMessage() { _message.value = "" }
    fun clearSaved() { _saved.value = false }

    fun loadSchools() {
        viewModelScope.launch {
            _busy.value = true
            val r = repo.schools()
            _busy.value = false
            if (r == null) {
                _message.value = "Your schools could not be loaded. Check the connection and try again."
                return@launch
            }
            _me.value = r.me
            _schools.value = r.schools
        }
    }

    fun loadChildren(schoolId: String, query: String = "") {
        viewModelScope.launch {
            _busy.value = true
            val r = repo.children(schoolId, query)
            _busy.value = false
            // An empty list is a real answer — a school with no children on
            // the roster yet — so it replaces what was there. A failure does
            // not, because it is not an answer about this school at all.
            if (r == null) {
                _message.value = "That list could not be loaded. Check the connection and try again."
                return@launch
            }
            _children.value = r.children
        }
    }

    fun openChild(kidId: String) {
        viewModelScope.launch {
            _busy.value = true
            _record.value = null
            val r = repo.child(kidId)
            _busy.value = false
            if (r == null) {
                _message.value = "That record could not be opened. Check the connection and try again."
                return@launch
            }
            _record.value = r
        }
    }

    fun closeChild() {
        _record.value = null
        _saved.value = false
    }

    fun loadArticles() {
        viewModelScope.launch {
            _busy.value = true
            val r = repo.articles()
            _busy.value = false
            if (r == null) {
                _message.value = "Your articles could not be loaded. Check the connection."
                return@launch
            }
            _articles.value = r.articles
        }
    }

    /**
     * Publish an article, or update one of their own.
     *
     * The slug is derived from the title here so a dietician never has to
     * think about url-safe text; the server normalises it again and refuses
     * anything too short, so a title of two characters is caught there rather
     * than producing a page nobody can link to.
     */
    fun saveArticle(title: String, summary: String, body: String, locale: String) {
        viewModelScope.launch {
            _busy.value = true
            val slug = title.trim().lowercase()
                .replace(Regex("[^a-z0-9]+"), "-")
                .trim('-')
            val r = repo.saveArticle(
                ArticleBody(
                    slug = slug,
                    locale = locale,
                    title = title.trim(),
                    summary = summary.trim(),
                    body = body.trim(),
                    // Nutrition is the reason a dietician is writing, so the
                    // article is offered to families whose child was flagged
                    // on one of the two checks this role reads.
                    checkTypes = listOf("Height & weight", "Haemoglobin"),
                    flags = listOf("WATCH", "ALERT"),
                ),
            )
            _busy.value = false
            r.fold(
                onSuccess = {
                    _saved.value = true
                    loadArticles()
                },
                onFailure = { e -> _message.value = e.message ?: "The article was not saved." },
            )
        }
    }

    fun savePlan(
        kidId: String,
        title: String,
        focus: String,
        startsOn: String,
        guidance: String,
        targets: List<DietTargetDto>,
    ) {
        viewModelScope.launch {
            _busy.value = true
            val r = repo.savePlan(
                DietPlanBody(
                    kidId = kidId,
                    title = title,
                    focus = focus,
                    startsOn = startsOn,
                    guidance = guidance,
                    targets = targets,
                ),
            )
            _busy.value = false
            r.fold(
                onSuccess = {
                    _saved.value = true
                    // Re-read rather than patching the held copy: saving ends
                    // whatever plan was running, and the list of past plans is
                    // the server's to state.
                    openChild(kidId)
                },
                onFailure = { e -> _message.value = e.message ?: "The plan was not saved." },
            )
        }
    }

    private val _templates = MutableStateFlow<DietTemplatesDto?>(null)
    val templates: StateFlow<DietTemplatesDto?> = _templates.asStateFlow()

    /** The key of the pre-camp plan just saved, for the screen to say so. */
    private val _templateSaved = MutableStateFlow("")
    val templateSaved: StateFlow<String> = _templateSaved.asStateFlow()

    fun loadTemplates() {
        viewModelScope.launch {
            _busy.value = true
            val r = repo.templates()
            _busy.value = false
            if (r == null) {
                _message.value = "The pre-camp plans could not be loaded. Check the connection and try again."
                return@launch
            }
            _templates.value = r
        }
    }

    fun clearTemplateSaved() {
        _templateSaved.value = ""
    }

    fun saveTemplate(key: String, title: String, guidance: String, targets: List<DietTargetDto>) {
        viewModelScope.launch {
            _busy.value = true
            _message.value = ""
            val r = repo.saveTemplate(DietTemplateBody(key, title, guidance, targets))
            _busy.value = false
            r.fold(
                onSuccess = {
                    _templates.value = it
                    _templateSaved.value = key
                },
                onFailure = { e -> _message.value = e.message ?: "The plan was not saved." },
            )
        }
    }

    fun loadCohorts(schoolId: String, grade: String = "") {
        viewModelScope.launch {
            _busy.value = true
            val r = repo.cohorts(schoolId, grade)
            _busy.value = false
            if (r == null) {
                _message.value = "The groups could not be loaded. Check the connection and try again."
                return@launch
            }
            _cohorts.value = r
        }
    }

    fun clearCohortDraft() {
        _cohortDraft.value = null
        _cohortSaved.value = 0
    }

    fun draftCohort(schoolId: String, key: String, grade: String) {
        viewModelScope.launch {
            _busy.value = true
            val r = repo.cohortDraft(CohortDraftBody(schoolId, key, grade))
            _busy.value = false
            r.fold(
                onSuccess = { _cohortDraft.value = it },
                onFailure = { e -> _message.value = e.message ?: "No draft came back." },
            )
        }
    }

    fun saveCohortPlan(
        schoolId: String,
        grade: String,
        kidIds: List<String>,
        title: String,
        focus: String,
        guidance: String,
        targets: List<DietTargetDto>,
    ) {
        viewModelScope.launch {
            _busy.value = true
            _message.value = ""
            val r = repo.saveCohortPlan(CohortPlanBody(kidIds, title, focus, guidance, targets))
            _busy.value = false
            r.fold(
                onSuccess = { n ->
                    _cohortSaved.value = n
                    // Re-read: who is on a plan is the server's to say.
                    loadCohorts(schoolId, grade)
                },
                onFailure = { e -> _message.value = e.message ?: "The plan was not saved." },
            )
        }
    }
}
