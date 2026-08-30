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
                        app, camp.title, camp.date, camp.time, locale,
                    )
                }
            }
            ui.appointments.forEach { appt ->
                NotificationScheduler.scheduleCheckupReminder(
                    app, appt.doctorName, appt.kidName, appt.date, appt.time, locale,
                )
            }
        }
        ui.kids.forEach { kid ->
            NotificationScheduler.scheduleDietReminder(app, kid.name, kid.id, locale)
        }
        SessionStore.setNeedsNotificationReschedule(app, false)
    }

    fun cancelAll(app: Application, ui: AppUiState) {
        val alarmManager = app.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        ui.camps.filter { it.status.isUpcoming }.forEach { camp ->
            cancelAlarm(app, alarmManager, camp.title.hashCode())
        }
        ui.appointments.forEach { appt ->
            cancelAlarm(app, alarmManager, (appt.doctorName + appt.date).hashCode())
        }
        ui.kids.forEach { kid -> cancelAlarm(app, alarmManager, kid.id.hashCode()) }
    }

    fun cancelCampReminders(app: Application, ui: AppUiState) {
        val alarmManager = app.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        ui.camps.filter { it.status.isUpcoming }.forEach { camp ->
            cancelAlarm(app, alarmManager, camp.title.hashCode())
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
