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
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale

object NotificationScheduler {

    const val CHANNEL_CAMP = "vitahero_camp"
    const val CHANNEL_CHECKUP = "vitahero_checkup"
    const val CHANNEL_DIET = "vitahero_diet"
    const val CHANNEL_REWARD = "vitahero_reward"

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

    /** Resolve a locale-aware string for notifications. */
    private fun resolveLocale(context: Context, key: String, fallback: String): String {
        return try {
            val storage = StorageService(context)
            val state = storage.load()
            val locale = AppLocale.entries.firstOrNull { it.code == state.localeCode } ?: AppLocale.ENGLISH
            LocaleStrings.get(locale, key, fallback)
        } catch (_: Exception) {
            fallback
        }
    }

    fun scheduleCampReminder(context: Context, campTitle: String, campDate: String, campTime: String) {
        val calendar: Calendar = try {
            val sdf = SimpleDateFormat("dd MMM yyyy hh:mm a", Locale.US)
            val parsed = sdf.parse("$campDate $campTime") ?: return
            Calendar.getInstance().apply {
                this.timeInMillis = parsed.time
                add(Calendar.DAY_OF_YEAR, -2)
                set(Calendar.HOUR_OF_DAY, 9)
                set(Calendar.MINUTE, 0)
            }
        } catch (_: Exception) { return }

        if (calendar.timeInMillis <= System.currentTimeMillis()) return

        val title = resolveLocale(context, "notif_camp_title", "Camp Coming Up!")
        val body = resolveLocale(context, "notif_camp_body", "$campTitle is in 2 days. Get the kids ready!")
            .replace("{camp}", campTitle)

        val intent = Intent(context, NotificationReceiver::class.java).apply {
            putExtra("title", title)
            putExtra("body", body)
            putExtra("channelId", CHANNEL_CAMP)
            putExtra("notifId", campTitle.hashCode())
        }
        val pending = PendingIntent.getBroadcast(
            context, campTitle.hashCode(), intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val alarm = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        alarm.set(AlarmManager.RTC_WAKEUP, calendar.timeInMillis, pending)
    }

    fun scheduleCheckupReminder(context: Context, doctorName: String, kidName: String, date: String, time: String) {
        val calendar: Calendar = try {
            val sdf = SimpleDateFormat("dd MMM yyyy hh:mm a", Locale.US)
            val parsed = sdf.parse("$date $time") ?: return
            Calendar.getInstance().apply {
                this.timeInMillis = parsed.time
                add(Calendar.HOUR_OF_DAY, -3)
            }
        } catch (_: Exception) { return }

        if (calendar.timeInMillis <= System.currentTimeMillis()) return

        val title = resolveLocale(context, "notif_checkup_title", "Upcoming Appointment")
        val body = resolveLocale(context, "notif_checkup_body", "{kid} has a checkup with {doctor} today at {time}")
            .replace("{kid}", kidName).replace("{doctor}", doctorName).replace("{time}", time)

        val intent = Intent(context, NotificationReceiver::class.java).apply {
            putExtra("title", title)
            putExtra("body", body)
            putExtra("channelId", CHANNEL_CHECKUP)
            putExtra("notifId", (doctorName + date).hashCode())
        }
        val pending = PendingIntent.getBroadcast(
            context, (doctorName + date).hashCode(), intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val alarm = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        alarm.set(AlarmManager.RTC_WAKEUP, calendar.timeInMillis, pending)
    }

    fun scheduleDietReminder(context: Context, kidName: String, kidId: String) {
        val calendar = Calendar.getInstance().apply {
            set(Calendar.HOUR_OF_DAY, 19)
            set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0)
            if (before(Calendar.getInstance())) add(Calendar.DAY_OF_YEAR, 1)
        }

        val title = resolveLocale(context, "notif_diet_title", "Log {kid}'s Meals")
            .replace("{kid}", kidName)
        val body = resolveLocale(context, "notif_diet_body", "Don't forget to mark today's meals for {kid}. Keep the streak going!")
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
        alarm.setRepeating(
            AlarmManager.RTC_WAKEUP, calendar.timeInMillis,
            AlarmManager.INTERVAL_DAY, pending
        )
    }

    fun sendImmediateNotification(context: Context, title: String, body: String, channel: String) {
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val notif = NotificationCompat.Builder(context, channel)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(title)
            .setContentText(body)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setAutoCancel(true)
            .build()
        nm.notify(System.currentTimeMillis().toInt(), notif)
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
