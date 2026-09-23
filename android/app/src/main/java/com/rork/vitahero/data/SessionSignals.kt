package com.rork.vitahero.data

import io.ktor.client.statement.HttpResponse
import io.ktor.http.HttpStatusCode
import io.ktor.http.isSuccess
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.util.concurrent.atomic.AtomicInteger

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

    /**
     * How many calls have failed to reach the server, ever.
     *
     * [reach] only says how the *last* call went, which is no use to a refresh
     * that makes a dozen of them: half can fail and the last one succeed. Read
     * this before and after a batch of reads, and if it moved, some of what
     * came back is missing rather than absent.
     */
    private val failures = AtomicInteger(0)
    val transportFailures: Int get() = failures.get()

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
        failures.incrementAndGet()
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
 * The app signs in one way: it takes a Firebase phone token to
 * `/api/auth/phone/firebase-verify`. That is the only call that carries a
 * credential, so it is the only one where a 401 means the credential was
 * wrong. `/api/auth/me` is deliberately not one of them: it carries a session
 * token like any other read, and a 401 there is exactly the thing this file
 * exists to notice. Ending the session on a rejected code, by contrast, would
 * sign a parent out of the screen they are trying to sign in on.
 */
private fun HttpResponse.isCredentialCheck(): Boolean =
    call.request.url.encodedPath.startsWith("/api/auth/phone/")

/** A transport failure — no response at all. Distinct from a rejection. */
fun noteTransportFailure(e: Throwable) {
    // A cancellation is the app moving on, not the network failing.
    if (e is kotlinx.coroutines.CancellationException) return
    SessionSignals.noteUnreachable()
}

/**
 * The server refused this write, and will refuse it again.
 *
 * Sync treated every failure as the network being down: it retried forever and
 * kept the record on screen. But "this appointment slot has already gone" and
 * "the train is in a tunnel" need opposite responses. Retrying the first one
 * cannot ever succeed, and while it is retried the record sits in the parent's
 * app looking real.
 *
 * Carries the server's own wording, which is written for guardians.
 */
class PermanentRejection(
    val status: Int,
    override val message: String,
) : Exception(message)

/**
 * Should this failure be retried?
 *
 * Anything the server refused outright is permanent — with two exceptions that
 * are explicitly "come back later": 408 and 429. A timeout, a dropped
 * connection or a 5xx is the server's or the network's problem, not the
 * request's, so those keep their retry.
 */
fun isRetryable(e: Throwable): Boolean = e !is PermanentRejection

/** True for a status the server will keep refusing however often it is sent. */
fun isPermanentStatus(status: Int): Boolean =
    status in 400..499 && status != 408 && status != 429

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
