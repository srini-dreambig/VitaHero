package com.rork.vitahero.data

import android.app.AlarmManager
import android.app.Application
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.content.ContextCompat

/** Schedules and cancels local reminder alarms from current app state. */
object NotificationCoordinator {

    fun scheduleAll(app: Application, ui: AppUiState) {
        if (!hasNotificationPermission(app)) return
        val locale = ui.locale
        if (ui.notificationsEnabled) {
            if (ui.campRemindersEnabled) {
                ui.camps.filter { it.status.isUpcoming }.forEach { camp ->
                    NotificationScheduler.scheduleCampReminder(
                        app, camp.id, camp.title, camp.date, locale,
                    )
                }
            }
            ui.appointments.forEach { appt ->
                NotificationScheduler.scheduleCheckupReminder(
                    app, appt.id, appt.doctorName, appt.kidName, appt.date, appt.time, locale,
                )
            }
        }
        ui.kids.forEach { kid ->
            NotificationScheduler.scheduleDietReminder(app, kid.name, kid.id, locale)
        }
        SessionStore.setNeedsNotificationReschedule(app, false)
    }

    /**
     * Take every reminder off this device.
     *
     * Called when the parent turns notifications off, and on sign-out — an
     * alarm outlives the session that set it, so the next person to use the
     * phone would have been reminded about another family's camp, by name, on
     * their lock screen. It has to run before the state is cleared, because the
     * state is the only record of what was scheduled.
     */
    fun cancelAll(app: Application, ui: AppUiState) {
        val alarmManager = app.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        // Not filtered by status: a camp that has since been marked done still
        // has a reminder set from when it was not.
        ui.camps.forEach { camp ->
            cancelAlarm(app, alarmManager, NotificationScheduler.campReminderId(camp.id))
        }
        ui.appointments.forEach { appt ->
            cancelAlarm(app, alarmManager, NotificationScheduler.checkupReminderId(appt.id))
        }
        ui.kids.forEach { kid ->
            cancelAlarm(app, alarmManager, NotificationScheduler.dietReminderId(kid.id))
        }
    }

    fun cancelCampReminders(app: Application, ui: AppUiState) {
        val alarmManager = app.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        ui.camps.forEach { camp ->
            cancelAlarm(app, alarmManager, NotificationScheduler.campReminderId(camp.id))
        }
    }

    private fun cancelAlarm(context: Context, alarmManager: AlarmManager, requestCode: Int) {
        val intent = Intent(context, NotificationReceiver::class.java)
        val pending = PendingIntent.getBroadcast(
            context, requestCode, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        alarmManager.cancel(pending)
    }

    private fun hasNotificationPermission(context: Context): Boolean =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            ContextCompat.checkSelfPermission(context, android.Manifest.permission.POST_NOTIFICATIONS) ==
                android.content.pm.PackageManager.PERMISSION_GRANTED
        } else {
            true
        }
}
