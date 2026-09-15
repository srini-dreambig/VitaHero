package com.rork.vitahero.data

import io.ktor.client.statement.HttpResponse
import io.ktor.http.HttpStatusCode
import io.ktor.http.isSuccess
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * What actually happened to a request, as opposed to what it returned.
 *
 * Every read in this app used to collapse three very different outcomes into
 * one value:
 *
 *   the server said no records  -> empty list
 *   the server rejected us      -> empty list
 *   the server was unreachable  -> empty list
 *
 * So a phone whose session had ended drew a complete, confident, empty app:
 * no children, no camps, no results, no error. It looked like the app had
 * loaded and the family simply had nothing — which is the worst possible thing
 * for a screening programme to say to a parent whose child was screened last
 * week. It is also what "it loads with fallback options, not real data" is.
 *
 * Reads still fall back to empty rather than throwing, because a half-drawn
 * screen helps nobody. What changes is that the fallback is now *reported*:
 * [SessionSignals] hears about every rejection and every unreachable server,
 * and the app says which one it was.
 */
object SessionSignals {

    enum class Reach {
        /** The last call reached the server and it answered. */
        OK,

        /** The last call did not reach the server at all. Data on screen may be stale or missing. */
        UNREACHABLE,
    }

    private val _reach = MutableStateFlow(Reach.OK)
    val reach: StateFlow<Reach> = _reach.asStateFlow()

    /** Set when the server rejected our token. The app signs out and says so. */
    private val _sessionEnded = MutableStateFlow(false)
    val sessionEnded: StateFlow<Boolean> = _sessionEnded.asStateFlow()

    /**
     * Called by [AuthManager] so a rejected token ends the session once,
     * centrally, rather than each screen inventing its own handling.
     */
    @Volatile
    var onSessionEnded: (() -> Unit)? = null

    fun noteReached() {
        _reach.value = Reach.OK
    }

    fun noteUnreachable() {
        _reach.value = Reach.UNREACHABLE
    }

    /**
     * The server rejected the token we sent.
     *
     * Only meaningful when we actually sent one: a 401 on a call made while
     * signed out is the expected answer, not the end of a session.
     */
    fun noteUnauthorized() {
        if (ApiService.sessionToken == null) return
        if (_sessionEnded.value) return
        _sessionEnded.value = true
        onSessionEnded?.invoke()
    }

    /** Cleared once the parent has signed in again, or dismissed the notice. */
    fun clearSessionEnded() {
        _sessionEnded.value = false
    }

    fun reset() {
        _sessionEnded.value = false
        _reach.value = Reach.OK
    }
}

/**
 * Classify one response, then hand back whether the body is worth reading.
 *
 * Every repository read routes through this, so there is one place that knows
 * a 401 is not the same as an empty table.
 */
fun HttpResponse.observed(): Boolean {
    SessionSignals.noteReached()
    if (status == HttpStatusCode.Unauthorized && !isCredentialCheck()) {
        SessionSignals.noteUnauthorized()
        return false
    }
    return status.isSuccess()
}

/**
 * Is this the call where a 401 means "wrong credentials" rather than "your
 * session has ended"?
 *
 * Only the endpoints that take credentials. `/api/auth/me` is deliberately not
 * one of them: it carries a session token like any other read, and a 401 there
 * is exactly the thing this file exists to notice. Ending the session on a
 * rejected password, by contrast, would sign a parent out of the screen they
 * are trying to sign in on.
 */
private fun HttpResponse.isCredentialCheck(): Boolean {
    val path = call.request.url.encodedPath
    return path == "/api/auth/google" ||
        path == "/api/auth/signup" ||
        path == "/api/auth/signin" ||
        path.startsWith("/api/auth/phone/") ||
        path.startsWith("/api/auth/firebase")
}

/** A transport failure — no response at all. Distinct from a rejection. */
fun noteTransportFailure(e: Throwable) {
    // A cancellation is the app moving on, not the network failing.
    if (e is kotlinx.coroutines.CancellationException) return
    SessionSignals.noteUnreachable()
}

/**
 * What happened when the app tried to pick up a stored session on launch.
 *
 * Three outcomes, because the app has three different things to do about them:
 * carry on, ask the parent to sign in, or keep the token and say the server is
 * unreachable. Collapsing the last two is what made a single launch with no
 * signal throw away a session that was perfectly good.
 */
sealed interface RestoreOutcome {
    data class Ok(val profile: ProfileDto) : RestoreOutcome

    /** The server said this token is not valid. The session really has ended. */
    data object Rejected : RestoreOutcome

    /** No answer. Keep the token — it is very probably still good. */
    data object Unreachable : RestoreOutcome
}
