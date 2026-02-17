package com.whoami.today.app.widget;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

/**
 * Receives the "next midnight" alarm. Triggers widget refresh (WidgetUpdateService)
 * then reschedules the next midnight alarm so the widget refreshes when the date changes.
 */
public class WidgetMidnightReceiver extends BroadcastReceiver {
    private static final String TAG = "WidgetMidnightReceiver";
    public static final String ACTION_MIDNIGHT_REFRESH = "com.whoami.today.app.WIDGET_MIDNIGHT_REFRESH";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (context == null || intent == null) return;
        if (!ACTION_MIDNIGHT_REFRESH.equals(intent.getAction())) return;

        Log.d(TAG, "Midnight refresh: triggering widget update");
        // Trigger widget update (same as manual refresh: start WidgetUpdateService)
        Intent serviceIntent = new Intent(context, WidgetUpdateService.class);
        context.startService(serviceIntent);
        // Reschedule next midnight so we refresh again when the date changes
        WidgetMidnightScheduler.scheduleNextMidnight(context);
    }
}
