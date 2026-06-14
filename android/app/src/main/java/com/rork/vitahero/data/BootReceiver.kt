package com.rork.vitahero.data

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * Re-schedules VitaHero notifications after device reboot so reminders
 * continue to fire even if the user hasn't opened the app yet.
 */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED) return

        val storage = StorageService(context)
        val state = try {
            storage.load()
        } catch (_: Exception) { return }

        if (!state.isLoggedIn) return

        // Re-schedule checkup reminders for all persisted appointments
        state.appointments.forEach { appt ->
            NotificationScheduler.scheduleCheckupReminder(
                context, appt.doctorName, appt.kidName, appt.date, appt.time
            )
        }

        // Re-schedule daily diet reminders for each persisted kid
        state.kids.forEach { kid ->
            NotificationScheduler.scheduleDietReminder(context, kid.name, kid.id)
        }

        // Re-schedule camp reminders from persisted camp data (if available)
        state.camps.filter { it.status == "UPCOMING" }.forEach { camp ->
            NotificationScheduler.scheduleCampReminder(context, camp.title, camp.date, camp.time)
        }
    }
}
