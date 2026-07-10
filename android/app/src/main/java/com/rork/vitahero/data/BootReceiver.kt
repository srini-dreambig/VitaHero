package com.rork.vitahero.data

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * Notifications are scheduled while the app is running (in-memory session).
 * After reboot, open the app once while logged in to re-schedule reminders.
 */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED) return
        NotificationScheduler.createChannels(context)
        SessionStore.setNeedsNotificationReschedule(context, true)
        if (SyncQueueStore.hasPending(context)) {
            SyncRetryScheduler.schedule(context)
        }
    }
}
