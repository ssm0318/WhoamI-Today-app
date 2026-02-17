package com.whoami.today.app.widget;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.util.Log;

import java.util.Calendar;

/**
 * Schedules a one-shot alarm at the start of the next day (midnight, local timezone).
 * When the alarm fires, WidgetMidnightReceiver runs and refreshes the widget, then reschedules.
 */
public class WidgetMidnightScheduler {
    private static final String TAG = "WidgetMidnightScheduler";

    public static void scheduleNextMidnight(Context context) {
        if (context == null) return;
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarmManager == null) {
            Log.w(TAG, "AlarmManager not available");
            return;
        }

        Calendar nextMidnight = getNextMidnight();
        long triggerAt = nextMidnight.getTimeInMillis();

        Intent intent = new Intent(context, WidgetMidnightReceiver.class);
        intent.setAction(WidgetMidnightReceiver.ACTION_MIDNIGHT_REFRESH);
        PendingIntent pending = PendingIntent.getBroadcast(
                context,
                0,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pending);
            } else {
                alarmManager.set(AlarmManager.RTC_WAKEUP, triggerAt, pending);
            }
            Log.d(TAG, "Scheduled next midnight refresh at " + nextMidnight.getTime());
        } catch (Exception e) {
            Log.e(TAG, "Failed to schedule midnight refresh", e);
        }
    }

    /** Returns calendar set to 00:00:00 of the next day in the default (local) timezone. */
    private static Calendar getNextMidnight() {
        Calendar cal = Calendar.getInstance();
        cal.add(Calendar.DAY_OF_MONTH, 1);
        cal.set(Calendar.HOUR_OF_DAY, 0);
        cal.set(Calendar.MINUTE, 0);
        cal.set(Calendar.SECOND, 0);
        cal.set(Calendar.MILLISECOND, 0);
        return cal;
    }
}
