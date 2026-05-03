// =============================================================================
// DEPRECATED - This widget provider has been deprecated as of Feb 2026.
// Kept for reference. New widgets use PhotoWidgetProvider, AlbumCoverWidgetProvider,
// and CheckinWidgetProvider.
// =============================================================================

package com.whoami.today.app.widget;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.util.Log;
import android.view.View;
import android.widget.RemoteViews;

import com.whoami.today.app.MainActivity;
import com.whoami.today.app.R;

public class WhoAmIWidgetProvider_DEPRECATED extends AppWidgetProvider {
    private static final String TAG = "WhoAmIWidget_DEPRECATED";
    private static final String PREFS_NAME = "WhoAmIWidgetPrefs";
    public static final String ACTION_REFRESH = "com.whoami.today.app.WIDGET_REFRESH";

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId);
        }

        // Start service to load album images (foreground on API 26+ so it can run when app is in background)
        Intent serviceIntent = new Intent(context, WidgetUpdateService_DEPRECATED.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(serviceIntent);
        } else {
            context.startService(serviceIntent);
        }

        // Schedule next midnight refresh so widget updates when the date changes
        WidgetMidnightScheduler_DEPRECATED.scheduleNextMidnight(context);
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);

        if (ACTION_REFRESH.equals(intent.getAction()) ||
            "com.whoami.today.app.WIDGET_UPDATE".equals(intent.getAction())) {
            AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
            int[] appWidgetIds = appWidgetManager.getAppWidgetIds(
                new android.content.ComponentName(context, WhoAmIWidgetProvider.class)
            );
            onUpdate(context, appWidgetManager, appWidgetIds);
        }
    }

    static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        RemoteViews views;
        try {
            views = buildRemoteViews(context);
        } catch (Exception e) {
            Log.e(TAG, "updateAppWidget failed", e);
            views = new RemoteViews(context.getPackageName(), R.layout.widget_large_deprecated);
            views.setTextViewText(R.id.question_text, "Tap to open app");
            try {
                Intent appIntent = new Intent(context, MainActivity.class);
                appIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                PendingIntent appPending = PendingIntent.getActivity(
                    context, 0, appIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
                );
                views.setOnClickPendingIntent(R.id.widget_container, appPending);
            } catch (Exception e2) {
                Log.e(TAG, "Fallback click handler failed", e2);
            }
            appWidgetManager.updateAppWidget(appWidgetId, views);
            return;
        }
        appWidgetManager.updateAppWidget(appWidgetId, views);
    }

    private static RemoteViews buildRemoteViews(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String accessToken = prefs.getString("access_token", null);
        boolean isLoggedIn = accessToken != null && !accessToken.isEmpty();
        Log.d(TAG, "updateAppWidget: accessToken present=" + isLoggedIn + " (prefs=" + PREFS_NAME + ")");

        RemoteViews views;

        // Use same large layout for both authenticated and unauthenticated; question area shows "Please Sign in" when not logged in
        views = new RemoteViews(context.getPackageName(), R.layout.widget_large_deprecated);

        // Refresh button - triggers ACTION_REFRESH so onReceive runs onUpdate and WidgetUpdateService fetches fresh data
        Intent refreshIntent = new Intent(context, WhoAmIWidgetProvider.class);
        refreshIntent.setAction(ACTION_REFRESH);
        PendingIntent refreshPending = PendingIntent.getBroadcast(
            context, 0, refreshIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_refresh_button, refreshPending);

        // Check-in buttons - all go to same deep link (aligned with iOS)
        String checkInUrl = "whoami://app/check-in/edit";
        setupActionButton(context, views, R.id.btn_i_feel, checkInUrl, 1);
        setupActionButton(context, views, R.id.btn_my_battery, checkInUrl, 2);
        setupActionButton(context, views, R.id.btn_my_music, checkInUrl, 3);

        // Friend slots: show cached friends if we have widget_data (avoids flash-disappear on refresh); else hide to avoid "Friend1"/"Friend2" placeholder
        setupActionButton(context, views, R.id.friend_1, "whoami://app/users", 4);
        setupActionButton(context, views, R.id.friend_2, "whoami://app/users", 5);
        if (isLoggedIn) {
            WidgetData_DEPRECATED cached = readCachedWidgetData(context);
            boolean hasFriends = cached != null && cached.friendsWithUpdates != null && !cached.friendsWithUpdates.isEmpty();
            boolean hasPlaylists = cached != null && cached.sharedPlaylists != null && !cached.sharedPlaylists.isEmpty();
            if (hasFriends) {
                views.setViewVisibility(R.id.friend_1, View.VISIBLE);
                views.setViewVisibility(R.id.friend_2, View.VISIBLE);
                views.setTextViewText(R.id.friend_1_name, cached.friendsWithUpdates.get(0).username);
                if (cached.friendsWithUpdates.size() > 1) {
                    views.setTextViewText(R.id.friend_2_name, cached.friendsWithUpdates.get(1).username);
                } else {
                    views.setViewVisibility(R.id.friend_2, View.GONE);
                }
            } else {
                views.setViewVisibility(R.id.friend_1, View.GONE);
                views.setViewVisibility(R.id.friend_2, View.GONE);
            }
            if (hasPlaylists) {
                views.setViewVisibility(R.id.playlist_row, View.VISIBLE);
                views.setViewVisibility(R.id.playlist_empty_text, View.GONE);
            } else {
                views.setViewVisibility(R.id.playlist_row, View.GONE);
                views.setViewVisibility(R.id.playlist_empty_text, View.VISIBLE);
            }
        }

        // TODO(Gina): Playlist buttons - update deep links as needed
        setupActionButton(context, views, R.id.playlist_1_container, "whoami://app/playlists/1", 6);
        setupActionButton(context, views, R.id.playlist_2_container, "whoami://app/playlists/2", 7);
        setupActionButton(context, views, R.id.playlist_3_container, "whoami://app/playlists/3", 8);
        setupActionButton(context, views, R.id.playlist_4_container, "whoami://app/playlists/4", 9);
        setupActionButton(context, views, R.id.playlist_5_container, "whoami://app/playlists/5", 10);

        if (accessToken == null || accessToken.isEmpty()) {
            // Not logged in: show "Please Sign in" in question card area, tap opens login
            Log.d(TAG, "updateAppWidget: setting question card to 'Please Sign in' + login intent");
            views.setTextViewText(R.id.question_text, "Please Sign in");
            setupActionButton(context, views, R.id.question_card, "whoami://app/login", 11);
        } else {
            // Question card - will be updated by WidgetUpdateService with actual question ID (same format as iOS)
            Log.d(TAG, "updateAppWidget: setting question card to default (will be updated by WidgetUpdateService)");
            setupActionButton(context, views, R.id.question_card, "whoami://app/questions/1/new", 11);
        }

        // Set up widget container click to open app
        Intent appIntent = new Intent(context, MainActivity.class);
        appIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent appPending = PendingIntent.getActivity(
            context, 12, appIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_container, appPending);

        // Ensure loading spinner is hidden when provider builds (e.g. on refresh tap)
        views.setViewVisibility(R.id.widget_loading_progress, View.GONE);
        views.setViewVisibility(R.id.widget_refresh_button, View.VISIBLE);

        return views;
    }

    private static WidgetData_DEPRECATED readCachedWidgetData(Context context) {
        String json = SharedPrefsHelper_DEPRECATED.getWidgetData(context);
        if (json == null || json.isEmpty()) return null;
        return WidgetData_DEPRECATED.fromJson(json);
    }

    public static void setupActionButton(Context context, RemoteViews views, int buttonId, String deepLink, int requestCode) {
        Intent intent = new Intent(context, MainActivity.class);
        intent.setAction(Intent.ACTION_VIEW);
        intent.setData(Uri.parse(deepLink));
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pending = PendingIntent.getActivity(
            context, requestCode, intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(buttonId, pending);
    }

    public static void setupClickHandlers(Context context, RemoteViews views) {
        // Refresh button - reload widget with latest check-in and data (same as iOS)
        Intent refreshIntent = new Intent(context, WhoAmIWidgetProvider.class);
        refreshIntent.setAction(ACTION_REFRESH);
        PendingIntent refreshPending = PendingIntent.getBroadcast(
            context, 0, refreshIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_refresh_button, refreshPending);

        // I feel button
        String checkInUrl = "whoami://app/check-in/edit";
        setupActionButton(context, views, R.id.btn_i_feel, checkInUrl, 1);
        setupActionButton(context, views, R.id.btn_my_battery, checkInUrl, 2);
        setupActionButton(context, views, R.id.btn_my_music, checkInUrl, 3);

        // Friend buttons - will be updated by WidgetUpdateService with whoami://app/users/{username} (same as iOS)
        setupActionButton(context, views, R.id.friend_1, "whoami://app/users", 4);
        setupActionButton(context, views, R.id.friend_2, "whoami://app/users", 5);

        // Question card - will be updated by WidgetUpdateService with actual question ID
        setupActionButton(context, views, R.id.question_card, "whoami://app/questions/1/new", 11);

        // Set up widget container click to open app
        Intent appIntent = new Intent(context, MainActivity.class);
        appIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent appPending = PendingIntent.getActivity(
            context, 12, appIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_container, appPending);
    }

    @Override
    public void onEnabled(Context context) {
        super.onEnabled(context);
        // Schedule midnight refresh when the first widget instance is added
        WidgetMidnightScheduler_DEPRECATED.scheduleNextMidnight(context);
    }

    @Override
    public void onDisabled(Context context) {
        super.onDisabled(context);
    }
}
