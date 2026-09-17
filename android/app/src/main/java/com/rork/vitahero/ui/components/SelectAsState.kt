package com.rork.vitahero.ui.components

import androidx.compose.runtime.Composable
import androidx.compose.runtime.State
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.remember
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.map

/**
 * Read one field of a shared state object without recomposing on the rest.
 *
 * `AppUiState` is a single object with thirty fields — the kids, the camps, the
 * appointments, the notifications, the wearable readings, the language, the
 * theme. Collecting it whole ties the reading scope to all thirty: the root of
 * the app reads the language and the theme, and used to be invalidated every
 * time a meal was logged or a watch synced a step count.
 *
 * This maps the flow down to the one value the scope actually uses and drops
 * repeats, so the scope is invalidated only when that value really changes.
 *
 * The selector is captured once, when the scope first composes. That is what
 * makes it cheap, and it is why a selector must be a plain projection of the
 * state — `{ it.kids }` — and must not close over anything that changes.
 */
@Composable
fun <T, R> StateFlow<T>.selectAsState(selector: (T) -> R): State<R> {
    val narrowed = remember(this) { map(selector).distinctUntilChanged() }
    return narrowed.collectAsState(initial = selector(value))
}
