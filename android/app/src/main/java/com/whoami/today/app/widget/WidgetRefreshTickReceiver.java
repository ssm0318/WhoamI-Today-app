package com.whoami.today.app.widget;

import android.appwidget.AppWidgetManager;
import android.content.BroadcastReceiver;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

/**
 * Fires every {@code WidgetRefreshScheduler.INTERVAL_MS}; broadcasts a normal
 * APPWIDGET_UPDATE to each widget provider so their existing onUpdate path runs,
 * then reschedules itself.
 */
public class WidgetRefreshTickReceiver extends BroadcastReceiver {
    private static final String TAG = "WidgetRefreshTick";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (context == null || intent == null) return;
        if (!WidgetRefreshScheduler.ACTION_TICK.equals(intent.getAction())) return;

        Log.d(TAG, "Tick received, dispatching widget updates");
        dispatchUpdate(context, PhotoWidgetProvider.class);
        dispatchUpdate(context, AlbumCoverWidgetProvider.class);

        WidgetRefreshScheduler.scheduleNext(context);
    }

    private void dispatchUpdate(Context context, Class<?> providerClass) {
        try {
            AppWidgetManager mgr = AppWidgetManager.getInstance(context);
            ComponentName component = new ComponentName(context, providerClass);
            int[] ids = mgr.getAppWidgetIds(component);
            if (ids == null || ids.length == 0) return;

            Intent update = new Intent(context, providerClass);
            update.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
            update.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids);
            context.sendBroadcast(update);
        } catch (Exception e) {
            Log.e(TAG, "Failed to dispatch update for " + providerClass.getSimpleName(), e);
        }
    }
}
