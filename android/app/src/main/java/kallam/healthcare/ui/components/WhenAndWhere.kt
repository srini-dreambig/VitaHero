package kallam.healthcare.ui.components

import kallam.healthcare.data.NotificationScheduler
import java.time.format.DateTimeFormatter
import java.util.Locale

private val readable = DateTimeFormatter.ofPattern("dd MMM yyyy", Locale.US)

/**
 * A camp's date and time as one line a parent can read.
 *
 * Both screens printed "${camp.date} · ${camp.time}" straight out of the
 * record. A camp's date is stored as the school entered it — the server refuses
 * anything but YYYY-MM-DD — and its time is optional and usually blank, so what
 * a parent actually saw was "2026-09-18 · " with the separator hanging off the
 * end and nothing after it.
 */
fun campWhen(date: String, time: String): String {
    val day = NotificationScheduler.parseReminderDate(date)
    val shown = day?.format(readable) ?: date.trim()
    val at = time.trim()
    return if (at.isEmpty()) shown else "$shown · $at"
}
