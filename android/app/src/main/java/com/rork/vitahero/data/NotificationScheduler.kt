package com.rork.vitahero.data

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.format.DateTimeFormatter
import java.util.Calendar
import java.util.Locale

object NotificationScheduler {

    const val CHANNEL_CAMP = "vitahero_camp"
    const val CHANNEL_CHECKUP = "vitahero_checkup"
    const val CHANNEL_DIET = "vitahero_diet"
    const val CHANNEL_REWARD = "vitahero_reward"

    private val dateFormatter = DateTimeFormatter.ofPattern("dd MMM yyyy", Locale.US)
    private val timeFormatter = DateTimeFormatter.ofPattern("hh:mm a", Locale.US)

    fun createChannels(context: Context) {
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        listOf(
            NotificationChannel(CHANNEL_CAMP, "Camp Reminders", NotificationManager.IMPORTANCE_HIGH).apply {
                description = "Notifications about upcoming school health camps"
            },
            NotificationChannel(CHANNEL_CHECKUP, "Checkup Reminders", NotificationManager.IMPORTANCE_DEFAULT).apply {
                description = "Doctor appointment reminders"
            },
            NotificationChannel(CHANNEL_DIET, "Diet Reminders", NotificationManager.IMPORTANCE_DEFAULT).apply {
                description = "Meal logging reminders"
            },
            NotificationChannel(CHANNEL_REWARD, "Rewards & Badges", NotificationManager.IMPORTANCE_LOW).apply {
                description = "Badge and streak updates"
            }
        ).forEach { nm.createNotificationChannel(it) }
    }

    private fun resolveLocale(locale: AppLocale, key: String, fallback: String): String {
        return LocaleStrings.get(locale, key, fallback)
    }

    /** Parse date + time into epoch millis. Returns null if format is invalid. */
    fun parseAppointmentTime(date: String, time: String): Long? {
        return try {
            val cleanTime = time.split(Regex("[–\\-]")).firstOrNull()?.trim() ?: time.trim()
            val cleanDate = date.trim()
            val dt = LocalDateTime.of(
                LocalDate.parse(cleanDate, dateFormatter),
                LocalTime.parse(cleanTime, timeFormatter)
            )
            dt.atZone(java.time.ZoneId.systemDefault()).toInstant().toEpochMilli()
        } catch (_: Exception) {
            null
        }
    }

    fun scheduleCampReminder(
        context: Context,
        campTitle: String,
        campDate: String,
        campTime: String,
        locale: AppLocale = AppLocale.ENGLISH,
    ) {
        val cleanTime = campTime.split(Regex("[–\\-]")).firstOrNull()?.trim() ?: campTime.trim()
        val eventMs = parseAppointmentTime(campDate, cleanTime) ?: return
        val calendar = Calendar.getInstance().apply {
            timeInMillis = eventMs
            add(Calendar.DAY_OF_YEAR, -2)
            set(Calendar.HOUR_OF_DAY, 9)
            set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0)
        }
        if (calendar.timeInMillis <= System.currentTimeMillis()) return

        val title = resolveLocale(locale, "notif_camp_title", "Camp Coming Up!")
        val body = resolveLocale(locale, "notif_camp_body", "$campTitle is in 2 days. Get the kids ready!")
            .replace("{camp}", campTitle)

        scheduleAlarm(context, campTitle.hashCode(), title, body, CHANNEL_CAMP, calendar.timeInMillis)
    }

    fun scheduleCheckupReminder(
        context: Context,
        doctorName: String,
        kidName: String,
        date: String,
        time: String,
        locale: AppLocale = AppLocale.ENGLISH,
    ) {
        val eventMs = parseAppointmentTime(date, time) ?: return
        val calendar = Calendar.getInstance().apply {
            timeInMillis = eventMs
            add(Calendar.HOUR_OF_DAY, -3)
        }
        if (calendar.timeInMillis <= System.currentTimeMillis()) return

        val title = resolveLocale(locale, "notif_checkup_title", "Upcoming Appointment")
        val body = resolveLocale(locale, "notif_checkup_body", "$kidName has a checkup with $doctorName today at $time")
            .replace("{kid}", kidName).replace("{doctor}", doctorName).replace("{time}", time)

        scheduleAlarm(context, (doctorName + date).hashCode(), title, body, CHANNEL_CHECKUP, calendar.timeInMillis)
    }

    fun scheduleDietReminder(
        context: Context,
        kidName: String,
        kidId: String,
        locale: AppLocale = AppLocale.ENGLISH,
    ) {
        val calendar = Calendar.getInstance().apply {
            set(Calendar.HOUR_OF_DAY, 19)
            set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0)
            if (before(Calendar.getInstance())) add(Calendar.DAY_OF_YEAR, 1)
        }

        val title = resolveLocale(locale, "notif_diet_title", "Log $kidName's Meals")
            .replace("{kid}", kidName)
        val body = resolveLocale(locale, "notif_diet_body", "Don't forget to mark today's meals for $kidName.")
            .replace("{kid}", kidName)

        val intent = Intent(context, NotificationReceiver::class.java).apply {
            putExtra("title", title)
            putExtra("body", body)
            putExtra("channelId", CHANNEL_DIET)
            putExtra("notifId", kidId.hashCode())
        }
        val pending = PendingIntent.getBroadcast(
            context, kidId.hashCode(), intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val alarm = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            if (alarm.canScheduleExactAlarms()) {
                alarm.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, calendar.timeInMillis, pending)
            } else {
                alarm.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, calendar.timeInMillis, pending)
            }
        } else {
            alarm.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, calendar.timeInMillis, pending)
        }
    }

    private fun scheduleAlarm(
        context: Context,
        requestCode: Int,
        title: String,
        body: String,
        channel: String,
        timeMs: Long,
    ) {
        val intent = Intent(context, NotificationReceiver::class.java).apply {
            putExtra("title", title)
            putExtra("body", body)
            putExtra("channelId", channel)
            putExtra("notifId", requestCode)
        }
        val pending = PendingIntent.getBroadcast(
            context, requestCode, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val alarm = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            if (alarm.canScheduleExactAlarms()) {
                alarm.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, timeMs, pending)
            } else {
                alarm.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, timeMs, pending)
            }
        } else {
            alarm.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, timeMs, pending)
        }
    }

    fun sendImmediateNotification(context: Context, title: String, body: String, channel: String) {
        showImmediateNotification(context, channel, title, body, System.currentTimeMillis().toInt())
    }

    fun showImmediateNotification(
        context: Context,
        channelId: String,
        title: String,
        body: String,
        notificationId: Int,
    ) {
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val notif = NotificationCompat.Builder(context, channelId)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(title)
            .setContentText(body)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .build()
        nm.notify(notificationId, notif)
    }
}

class NotificationReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val title = intent.getStringExtra("title") ?: "VitaHero"
        val body = intent.getStringExtra("body") ?: ""
        val channel = intent.getStringExtra("channelId") ?: NotificationScheduler.CHANNEL_CAMP
        NotificationScheduler.sendImmediateNotification(context, title, body, channel)
    }
}
