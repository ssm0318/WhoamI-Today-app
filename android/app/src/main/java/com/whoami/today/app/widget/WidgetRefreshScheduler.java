package com.whoami.today.app.widget;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.SystemClock;
import android.util.Log;

/**
 * AppWidget XML's {@code updatePeriodMillis} is clamped to 30 minutes by the
 * system, which is too long for the friend update / shared playlist widgets.
 * This scheduler registers a self-rearming alarm so the widgets re-fetch and
 * re-render roughly every 10 minutes even while the host app is closed.
 */
public class WidgetRefreshScheduler {
    private static final String TAG = "WidgetRefreshScheduler";
    private static final long INTERVAL_MS = 10L * 60L * 1000L;
    static final String ACTION_TICK = "com.whoami.today.app.WIDGET_REFRESH_TICK";
    private static final int REQUEST_CODE = 4711;

    public static void scheduleNext(Context context) {
        if (context == null) return;
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarmManager == null) {
            Log.w(TAG, "AlarmManager not available");
            return;
        }

        long triggerAt = SystemClock.elapsedRealtime() + INTERVAL_MS;
        PendingIntent pending = buildPendingIntent(context);
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                alarmManager.setAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, triggerAt, pending);
            } else {
                alarmManager.set(AlarmManager.ELAPSED_REALTIME_WAKEUP, triggerAt, pending);
            }
            Log.d(TAG, "Scheduled next widget refresh in " + (INTERVAL_MS / 1000) + "s");
        } catch (Exception e) {
            Log.e(TAG, "Failed to schedule widget refresh", e);
        }
    }

    private static PendingIntent buildPendingIntent(Context context) {
        Intent intent = new Intent(context, WidgetRefreshTickReceiver.class);
        intent.setAction(ACTION_TICK);
        return PendingIntent.getBroadcast(
                context.getApplicationContext(),
                REQUEST_CODE,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }
}
