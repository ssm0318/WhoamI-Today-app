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

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class AlbumCoverWidgetProvider extends AppWidgetProvider {
    private static final String TAG = "AlbumCoverWidget";
    private static final String PREFS_NAME = "WhoAmIWidgetPrefs";
    private static final String VERSION_TYPE_DEFAULT = "default";
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
                new android.content.ComponentName(context, AlbumCoverWidgetProvider.class));
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
            appWidgetManager.updateAppWidget(appWidgetId, views);
        } else if (isDefaultVersion) {
            views = new RemoteViews(context.getPackageName(), R.layout.widget_album_2x2);
            views.setViewVisibility(R.id.album_image, View.GONE);
            views.setViewVisibility(R.id.album_placeholder, View.GONE);
            appWidgetManager.updateAppWidget(appWidgetId, views);
        } else {
            String widgetDataJson = prefs.getString("widget_data", "{}");
            String albumImageUrl = null;
            String trackIdForOEmbed = null;
            try {
                JSONObject widgetData = new JSONObject(widgetDataJson);
                if (widgetData.has("my_check_in")) {
                    JSONObject myCheckIn = widgetData.getJSONObject("my_check_in");
                    for (String key : new String[]{"album_image_url", "album_cover_url", "photo_url"}) {
                        if (myCheckIn.has(key) && !myCheckIn.isNull(key)) {
                            String url = myCheckIn.optString(key, null);
                            if (url != null && !url.isEmpty()) {
                                albumImageUrl = url;
                                break;
                            }
                        }
                    }
                    if (albumImageUrl == null) {
                        String tid = myCheckIn.optString("track_id", null);
                        if (tid != null && !tid.trim().isEmpty()) trackIdForOEmbed = tid.trim();
                    }
                }
            } catch (Exception e) {
                Log.e(TAG, "Error parsing widget data", e);
            }

            views = new RemoteViews(context.getPackageName(), R.layout.widget_album_2x2);
            Intent checkInIntent = new Intent(Intent.ACTION_VIEW, Uri.parse("whoami://app/check-in/edit"));
            PendingIntent pendingIntent = PendingIntent.getActivity(
                context, 0, checkInIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            views.setOnClickPendingIntent(R.id.widget_album_container, pendingIntent);

            final boolean hasUrl = albumImageUrl != null && !albumImageUrl.isEmpty();
            if (hasUrl || trackIdForOEmbed != null) {
                views.setViewVisibility(R.id.album_image, View.GONE);
                views.setViewVisibility(R.id.album_placeholder, View.VISIBLE);
                appWidgetManager.updateAppWidget(appWidgetId, views);

                final String imageUrl = albumImageUrl;
                final String trackId = trackIdForOEmbed;
                executor.execute(() -> {
                    String urlToLoad = imageUrl;
                    if (urlToLoad == null && trackId != null) {
                        urlToLoad = fetchAlbumImageUrlFromSpotifyOEmbed(trackId);
                    }
                    if (urlToLoad == null) {
                        mainHandler.post(() -> {
                            RemoteViews fallbackViews = new RemoteViews(context.getPackageName(), R.layout.widget_album_2x2);
                            fallbackViews.setOnClickPendingIntent(R.id.widget_album_container, pendingIntent);
                            fallbackViews.setViewVisibility(R.id.album_image, View.GONE);
                            fallbackViews.setViewVisibility(R.id.album_placeholder, View.VISIBLE);
                            appWidgetManager.updateAppWidget(appWidgetId, fallbackViews);
                        });
                        return;
                    }
                    Bitmap bitmap = loadBitmapFromUrl(urlToLoad);
                    mainHandler.post(() -> {
                        RemoteViews updatedViews = new RemoteViews(context.getPackageName(), R.layout.widget_album_2x2);
                        updatedViews.setOnClickPendingIntent(R.id.widget_album_container, pendingIntent);
                        if (bitmap != null) {
                            updatedViews.setImageViewBitmap(R.id.album_image, bitmap);
                            updatedViews.setViewVisibility(R.id.album_image, View.VISIBLE);
                            updatedViews.setViewVisibility(R.id.album_placeholder, View.GONE);
                        } else {
                            updatedViews.setViewVisibility(R.id.album_image, View.GONE);
                            updatedViews.setViewVisibility(R.id.album_placeholder, View.VISIBLE);
                        }
                        appWidgetManager.updateAppWidget(appWidgetId, updatedViews);
                    });
                });
            } else {
                views.setViewVisibility(R.id.album_image, View.GONE);
                views.setViewVisibility(R.id.album_placeholder, View.VISIBLE);
                appWidgetManager.updateAppWidget(appWidgetId, views);
            }
        }
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
            Log.e(TAG, "Error loading bitmap from URL", e);
            return null;
        }
    }

    /** Fetch album/thumbnail URL from Spotify oEmbed (no auth). Used when widget_data has track_id but no album_image_url. */
    private static String fetchAlbumImageUrlFromSpotifyOEmbed(String trackId) {
        try {
            String trackUrl = "https://open.spotify.com/track/" + Uri.encode(trackId);
            URL url = new URL("https://open.spotify.com/oembed?url=" + Uri.encode(trackUrl));
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setConnectTimeout(5000);
            conn.setReadTimeout(5000);
            conn.connect();
            if (conn.getResponseCode() != 200) return null;
            StringBuilder sb = new StringBuilder();
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8))) {
                String line;
                while ((line = reader.readLine()) != null) sb.append(line);
            }
            JSONObject json = new JSONObject(sb.toString());
            if (json.has("thumbnail_url") && !json.isNull("thumbnail_url")) {
                return json.getString("thumbnail_url");
            }
        } catch (Exception e) {
            Log.w(TAG, "Spotify oEmbed fetch failed for track_id=" + trackId, e);
        }
        return null;
    }
}
