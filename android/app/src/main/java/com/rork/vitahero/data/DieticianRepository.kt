package com.rork.vitahero.data

import io.ktor.client.call.body
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.http.ContentType
import io.ktor.http.contentType
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * A dietician's work, from the app.
 *
 * The same bargain the clinician side keeps: every rule lives on the server
 * and none of it is re-implemented here. /api/dietician/children returns the
 * children at schools this person is assigned to; /api/dietician/child returns
 * growth, haemoglobin and the food log and nothing else, because the query
 * filters rather than the screen hiding. A stale build cannot widen any of it.
 */
class DieticianRepository {

    private val http get() = ApiService.http
    private val base get() = ApiService.baseUrl
    private val configured: Boolean get() = ApiService.isConfigured

    private fun headers(): Map<String, String> {
        val h = mutableMapOf<String, String>()
        ApiService.sessionToken?.let { h["Authorization"] = "Bearer $it" }
        return h
    }

    private suspend fun <T> io(block: suspend () -> T): T = withContext(Dispatchers.IO) { block() }

    /** The schools this dietician was assigned, and who they are. */
    suspend fun schools(): DieticianSchoolsDto? = io {
        if (!configured) return@io null
        try {
            val resp = http.get("$base/api/dietician/schools") {
                headers().forEach { (k, v) -> header(k, v) }
            }
            if (resp.observed()) resp.body<DieticianSchoolsDto>() else null
        } catch (e: Exception) {
            noteTransportFailure(e)
            null
        }
    }

    suspend fun children(schoolId: String, query: String = ""): DieticianChildrenDto? = io {
        if (!configured) return@io null
        try {
            val resp = http.get("$base/api/dietician/children") {
                headers().forEach { (k, v) -> header(k, v) }
                url {
                    parameters.append("school_id", schoolId)
                    if (query.isNotBlank()) parameters.append("q", query)
                }
            }
            if (resp.observed()) resp.body<DieticianChildrenDto>() else null
        } catch (e: Exception) {
            noteTransportFailure(e)
            null
        }
    }

    /**
     * One child's record, as a dietician may see it.
     *
     * Null means the request did not come back, which the screen says out
     * loud. Opening it is written to the access trail on the server — a
     * dietician reading a child's readings is a thing a parent can ask about.
     */
    suspend fun child(kidId: String): DieticianChildRecordDto? = io {
        if (!configured) return@io null
        try {
            val resp = http.get("$base/api/dietician/child") {
                headers().forEach { (k, v) -> header(k, v) }
                url { parameters.append("kid_id", kidId) }
            }
            if (resp.observed()) resp.body<DieticianChildRecordDto>() else null
        } catch (e: Exception) {
            noteTransportFailure(e)
            null
        }
    }

    /** The articles this dietician has written for the family reading list. */
    suspend fun articles(): MyArticlesDto? = io {
        if (!configured) return@io null
        try {
            val resp = http.get("$base/api/dietician/articles") {
                headers().forEach { (k, v) -> header(k, v) }
            }
            if (resp.observed()) resp.body<MyArticlesDto>() else null
        } catch (e: Exception) {
            noteTransportFailure(e)
            null
        }
    }

    /**
     * Publish or update one of their own articles.
     *
     * The server refuses an article somebody else wrote, so a slug that
     * collides with the programme team's comes back as a refusal to read
     * rather than a silent overwrite.
     */
    suspend fun saveArticle(body: ArticleBody): Result<Unit> = io {
        if (!configured) return@io Result.failure(IllegalStateException("No backend configured"))
        try {
            val resp = http.post("$base/api/dietician/articles") {
                headers().forEach { (k, v) -> header(k, v) }
                contentType(ContentType.Application.Json)
                setBody(body)
            }
            if (resp.observed()) {
                Result.success(Unit)
            } else {
                val err = try { resp.body<ErrorBody>() } catch (_: Exception) { null }
                Result.failure(Exception(err?.error ?: "The article was not saved"))
            }
        } catch (e: Exception) {
            noteTransportFailure(e)
            Result.failure(e)
        }
    }

    /**
     * Write a plan. The server ends whatever was running before it.
     *
     * Returns the server's own message on failure rather than a generic one:
     * "a plan needs something a family can act on" is a sentence a dietician
     * can do something about, and "Save failed" is not.
     */
    suspend fun savePlan(body: DietPlanBody): Result<DietPlanDto> = io {
        if (!configured) return@io Result.failure(IllegalStateException("No backend configured"))
        try {
            val resp = http.post("$base/api/dietician/plan") {
                headers().forEach { (k, v) -> header(k, v) }
                contentType(ContentType.Application.Json)
                setBody(body)
            }
            if (!resp.observed()) {
                val err = try { resp.body<ErrorBody>() } catch (_: Exception) { null }
                return@io Result.failure(Exception(err?.error ?: "The plan was not saved"))
            }
            val saved = resp.body<DietPlanSavedDto>().plan
            if (saved == null) Result.failure(Exception("The plan did not come back"))
            else Result.success(saved)
        } catch (e: Exception) {
            noteTransportFailure(e)
            Result.failure(e)
        }
    }
}
