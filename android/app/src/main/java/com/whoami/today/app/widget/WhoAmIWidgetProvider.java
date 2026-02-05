package com.whoami.today.app.widget;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.widget.RemoteViews;

import com.whoami.today.app.MainActivity;
import com.whoami.today.app.R;

public class WhoAmIWidgetProvider extends AppWidgetProvider {
    private static final String PREFS_NAME = "WhoAmIWidgetPrefs";
    public static final String ACTION_REFRESH = "com.whoami.today.app.WIDGET_REFRESH";

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId);
        }
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
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String accessToken = prefs.getString("access_token", null);

        RemoteViews views;

        if (accessToken == null || accessToken.isEmpty()) {
            // Show login prompt
            views = new RemoteViews(context.getPackageName(), R.layout.widget_login_prompt);
            Intent loginIntent = new Intent(context, MainActivity.class);
            loginIntent.setData(Uri.parse("whoami://app/login"));
            loginIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            PendingIntent loginPending = PendingIntent.getActivity(
                context, 0, loginIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
            views.setOnClickPendingIntent(R.id.widget_login_container, loginPending);
        } else {
            // Show widget content with new large layout
            views = new RemoteViews(context.getPackageName(), R.layout.widget_large);

            // TODO(Gina): Set up click handlers for action buttons
            // I feel button
            setupActionButton(context, views, R.id.btn_i_feel, "whoami://app/i-feel", 1);
            // My Battery button
            setupActionButton(context, views, R.id.btn_my_battery, "whoami://app/my-battery", 2);
            // My Music button
            setupActionButton(context, views, R.id.btn_my_music, "whoami://app/my-music", 3);

            // TODO(Gina): Friend buttons - update deep links as needed
            setupActionButton(context, views, R.id.friend_1, "whoami://app/friends/1", 4);
            setupActionButton(context, views, R.id.friend_2, "whoami://app/friends/2", 5);

            // TODO(Gina): Playlist buttons - update deep links as needed
            setupActionButton(context, views, R.id.playlist_1, "whoami://app/playlists/1", 6);
            setupActionButton(context, views, R.id.playlist_2, "whoami://app/playlists/2", 7);
            setupActionButton(context, views, R.id.playlist_3, "whoami://app/playlists/3", 8);
            setupActionButton(context, views, R.id.playlist_4, "whoami://app/playlists/4", 9);
            setupActionButton(context, views, R.id.playlist_5, "whoami://app/playlists/5", 10);

            // Question card
            setupActionButton(context, views, R.id.question_card, "whoami://app/question", 11);

            // Set up widget container click to open app
            Intent appIntent = new Intent(context, MainActivity.class);
            appIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            PendingIntent appPending = PendingIntent.getActivity(
                context, 12, appIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
            views.setOnClickPendingIntent(R.id.widget_container, appPending);

            // TODO(Gina): Update friend names from cached data
            // views.setTextViewText(R.id.friend_1_name, "Matter123");
            // views.setTextViewText(R.id.friend_2_name, "Kipler2323");

            // TODO(Gina): Update question text from cached data
            // views.setTextViewText(R.id.question_text, "What was a funny thing that happened today?");
        }

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }

    private static void setupActionButton(Context context, RemoteViews views, int buttonId, String deepLink, int requestCode) {
        Intent intent = new Intent(context, MainActivity.class);
        intent.setData(Uri.parse(deepLink));
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pending = PendingIntent.getActivity(
            context, requestCode, intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(buttonId, pending);
    }

    @Override
    public void onEnabled(Context context) {
        super.onEnabled(context);
    }

    @Override
    public void onDisabled(Context context) {
        super.onDisabled(context);
    }
}
