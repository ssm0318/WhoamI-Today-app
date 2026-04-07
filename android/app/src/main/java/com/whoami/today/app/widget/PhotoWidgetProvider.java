package com.whoami.today.app.widget;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.View;
import android.widget.RemoteViews;

import com.whoami.today.app.MainActivity;
import com.whoami.today.app.R;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class PhotoWidgetProvider extends AppWidgetProvider {
    private static final String TAG = "PhotoWidget";
    private static final String PREFS_NAME = "WhoAmIWidgetPrefs";
    private static final String VERSION_TYPE_DEFAULT = "default";
    private static final String PICSUM_PLACEHOLDER_URL = "https://picsum.photos/400/400";
    private static final ExecutorService executor = Executors.newSingleThreadExecutor();
    private static final Handler mainHandler = new Handler(Looper.getMainLooper());

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            try {
                updateAppWidget(context, appWidgetManager, appWidgetId);
            } catch (Exception e) {
                Log.e(TAG, "Failed to update widget " + appWidgetId, e);
                try {
                    RemoteViews fallback = new RemoteViews(context.getPackageName(), R.layout.widget_signin);
                    Intent loginIntent = new Intent(Intent.ACTION_VIEW, Uri.parse("whoami://app/login"));
                    PendingIntent pendingIntent = PendingIntent.getActivity(
                        context, 0, loginIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
                    fallback.setOnClickPendingIntent(R.id.signin_button, pendingIntent);
                    appWidgetManager.updateAppWidget(appWidgetId, fallback);
                } catch (Exception e2) {
                    Log.e(TAG, "Fallback update failed", e2);
                }
            }
        }
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        String action = intent.getAction();
        if ("com.whoami.today.app.WIDGET_UPDATE".equals(action)) {
            AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
            int[] appWidgetIds = appWidgetManager.getAppWidgetIds(
                new android.content.ComponentName(context, PhotoWidgetProvider.class));
            onUpdate(context, appWidgetManager, appWidgetIds);
        }
    }

    static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String accessToken = prefs.getString("access_token", "");
        String versionType = prefs.getString("user_version_type", VERSION_TYPE_DEFAULT);
        boolean isAuthenticated = accessToken != null && !accessToken.isEmpty();
        boolean isDefaultVersion = VERSION_TYPE_DEFAULT.equals(versionType);

        RemoteViews views;

        if (!isAuthenticated) {
            views = new RemoteViews(context.getPackageName(), R.layout.widget_signin);
            Intent loginIntent = new Intent(Intent.ACTION_VIEW, Uri.parse("whoami://app/login"));
            PendingIntent pendingIntent = PendingIntent.getActivity(
                context, 0, loginIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            views.setOnClickPendingIntent(R.id.signin_button, pendingIntent);
        } else if (isDefaultVersion) {
            views = new RemoteViews(context.getPackageName(), R.layout.widget_photo_2x2);
            views.setViewVisibility(R.id.photo_image, View.GONE);
            views.setViewVisibility(R.id.photo_placeholder, View.GONE);
        } else {
            views = new RemoteViews(context.getPackageName(), R.layout.widget_photo_2x2);
            views.setViewVisibility(R.id.photo_image, View.GONE);
            views.setViewVisibility(R.id.photo_placeholder, View.VISIBLE);

            Intent openAppIntent = new Intent(context, MainActivity.class);
            openAppIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            PendingIntent pendingIntent = PendingIntent.getActivity(
                context, 0, openAppIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            views.setOnClickPendingIntent(R.id.widget_photo_container, pendingIntent);

            appWidgetManager.updateAppWidget(appWidgetId, views);

            // Load Picsum placeholder image in background (matches iOS behavior)
            executor.execute(() -> {
                Bitmap bitmap = loadBitmapFromUrl(PICSUM_PLACEHOLDER_URL);
                mainHandler.post(() -> {
                    RemoteViews updatedViews = new RemoteViews(context.getPackageName(), R.layout.widget_photo_2x2);
                    updatedViews.setOnClickPendingIntent(R.id.widget_photo_container, pendingIntent);
                    if (bitmap != null) {
                        updatedViews.setImageViewBitmap(R.id.photo_image, bitmap);
                        updatedViews.setViewVisibility(R.id.photo_image, View.VISIBLE);
                        updatedViews.setViewVisibility(R.id.photo_placeholder, View.GONE);
                    } else {
                        updatedViews.setViewVisibility(R.id.photo_image, View.GONE);
                        updatedViews.setViewVisibility(R.id.photo_placeholder, View.VISIBLE);
                    }
                    appWidgetManager.updateAppWidget(appWidgetId, updatedViews);
                });
            });
            return;
        }

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }

    private static Bitmap loadBitmapFromUrl(String urlString) {
        try {
            URL url = new URL(urlString);
            HttpURLConnection connection = (HttpURLConnection) url.openConnection();
            connection.setDoInput(true);
            connection.setConnectTimeout(5000);
            connection.setReadTimeout(5000);
            connection.connect();
            InputStream input = connection.getInputStream();
            return BitmapFactory.decodeStream(input);
        } catch (Exception e) {
            Log.e(TAG, "Error loading placeholder image", e);
            return null;
        }
    }
}
