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

    /**
     * Reminders live in one request-code space, so the key has to say which
     * kind it is as well as which record.
     *
     * A camp used to be keyed on its title, so two schools both running an
     * "Annual Camp" had one reminder between them and the second silently
     * replaced the first. An appointment was keyed on the doctor and the day,
     * so two children seen by the same doctor on the same morning had one
     * reminder between them. And nothing kept a camp's hash out of a child's:
     * three kinds shared one space and a collision replaced rather than added.
     */
    private const val KIND_CAMP = "camp"
    private const val KIND_CHECKUP = "checkup"
    private const val KIND_DIET = "diet"

    private fun reminderId(kind: String, key: String): Int = (kind + "|" + key).hashCode()

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

    /**
     * A date in either of the two shapes this product actually uses.
     *
     * Appointment slots come from the booking directory as "01 Nov 2026". A
     * camp's date comes from the school's own record, where the server refuses
     * anything that is not YYYY-MM-DD. Only the first was understood, and the
     * failure was a null swallowed by a catch — so camp reminders never fired,
     * on any device, ever, while the toggle for them sat in the settings screen
     * and the channel was created at every launch.
     */
    fun parseReminderDate(date: String): LocalDate? {
        val clean = date.trim()
        if (clean.isEmpty()) return null
        return runCatching { LocalDate.parse(clean) }.getOrNull()
            ?: runCatching { LocalDate.parse(clean, dateFormatter) }.getOrNull()
    }

    /** Parse date + time into epoch millis. Returns null if format is invalid. */
    fun parseAppointmentTime(date: String, time: String): Long? {
        return try {
            val cleanTime = time.split(Regex("[–\\-]")).firstOrNull()?.trim() ?: time.trim()
            val day = parseReminderDate(date) ?: return null
            val dt = LocalDateTime.of(day, LocalTime.parse(cleanTime, timeFormatter))
            dt.atZone(java.time.ZoneId.systemDefault()).toInstant().toEpochMilli()
        } catch (_: Exception) {
            null
        }
    }

    /**
     * Two mornings before the camp, at nine.
     *
     * The camp's own time is not needed and is no longer asked for: this used
     * to parse it only to overwrite the hour and minute a line later, so a camp
     * whose school had not filled the time in — which is most of them, the
     * column defaults to empty — got no reminder at all.
     */
    fun scheduleCampReminder(
        context: Context,
        campId: String,
        campTitle: String,
        campDate: String,
        locale: AppLocale = AppLocale.ENGLISH,
    ) {
        val day = parseReminderDate(campDate) ?: return
        val calendar = Calendar.getInstance().apply {
            set(day.year, day.monthValue - 1, day.dayOfMonth, 9, 0, 0)
            set(Calendar.MILLISECOND, 0)
            add(Calendar.DAY_OF_YEAR, -2)
        }
        if (calendar.timeInMillis <= System.currentTimeMillis()) return

        val title = resolveLocale(locale, "notif_camp_title", "Camp Coming Up!")
        val body = resolveLocale(locale, "notif_camp_body", "$campTitle is in 2 days. Get the kids ready!")
            .replace("{camp}", campTitle)

        scheduleAlarm(context, campReminderId(campId), title, body, CHANNEL_CAMP, calendar.timeInMillis)
    }

    fun campReminderId(campId: String): Int = reminderId(KIND_CAMP, campId)
    fun checkupReminderId(appointmentId: String): Int = reminderId(KIND_CHECKUP, appointmentId)
    fun dietReminderId(kidId: String): Int = reminderId(KIND_DIET, kidId)

    fun scheduleCheckupReminder(
        context: Context,
        appointmentId: String,
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

        scheduleAlarm(context, checkupReminderId(appointmentId), title, body, CHANNEL_CHECKUP, calendar.timeInMillis)
    }

    /**
     * Take back a checkup reminder for an appointment that did not happen.
     *
     * Booking scheduled this the moment the parent tapped, before the server
     * had agreed to anything. When the server then refused the slot, the alarm
     * stayed set and would have reminded them, on the day, of an appointment
     * that never existed. Same request code as [scheduleCheckupReminder], which
     * is what identifies the alarm to cancel — the appointment's own id, so
     * cancelling one child's booking cannot take a sibling's with it.
     */
    fun cancelCheckupReminder(context: Context, appointmentId: String) {
        val requestCode = checkupReminderId(appointmentId)
        val intent = Intent(context, NotificationReceiver::class.java)
        val pending = PendingIntent.getBroadcast(
            context, requestCode, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        (context.getSystemService(Context.ALARM_SERVICE) as AlarmManager).cancel(pending)
        pending.cancel()
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
            putExtra("notifId", dietReminderId(kidId))
            // Carried so the alarm can set tomorrow's when it fires. This is a
            // daily reminder that was scheduled exactly once: after it went off
            // there was nothing to set the next one, so a parent who did not
            // reopen the app got one reminder and then silence.
            putExtra("dietKidId", kidId)
            putExtra("dietKidName", kidName)
            putExtra("localeCode", locale.code)
        }
        val pending = PendingIntent.getBroadcast(
            context, dietReminderId(kidId), intent,
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
        // The id the alarm was scheduled with, so a reminder that is delivered
        // twice replaces itself in the shade rather than stacking.
        val notifId = intent.getIntExtra("notifId", System.currentTimeMillis().toInt())
        NotificationScheduler.showImmediateNotification(context, channel, title, body, notifId)

        // A daily reminder sets the next one as it goes off. Without this the
        // only thing that ever re-armed it was the app being opened.
        val kidId = intent.getStringExtra("dietKidId")
        val kidName = intent.getStringExtra("dietKidName")
        if (channel == NotificationScheduler.CHANNEL_DIET && !kidId.isNullOrBlank() && kidName != null) {
            val code = intent.getStringExtra("localeCode")
            val locale = AppLocale.entries.firstOrNull { it.code == code } ?: AppLocale.ENGLISH
            NotificationScheduler.scheduleDietReminder(context, kidName, kidId, locale)
        }
    }
}
