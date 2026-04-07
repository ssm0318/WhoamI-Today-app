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

public class CheckinWidgetProvider extends AppWidgetProvider {
    private static final String TAG = "CheckinWidget";
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
                new android.content.ComponentName(context, CheckinWidgetProvider.class));
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
            return;
        }

        if (isDefaultVersion) {
            views = new RemoteViews(context.getPackageName(), R.layout.widget_checkin_4x1);
            views.setViewVisibility(R.id.btn_i_feel, View.INVISIBLE);
            views.setViewVisibility(R.id.btn_my_battery, View.INVISIBLE);
            views.setViewVisibility(R.id.btn_my_music, View.INVISIBLE);
            views.setViewVisibility(R.id.btn_add, View.INVISIBLE);
            Intent refreshIntent = new Intent(context, CheckinWidgetProvider.class);
            refreshIntent.setAction("com.whoami.today.app.WIDGET_UPDATE");
            PendingIntent refreshPendingIntent = PendingIntent.getBroadcast(
                context, 0, refreshIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            views.setOnClickPendingIntent(R.id.btn_refresh, refreshPendingIntent);
            appWidgetManager.updateAppWidget(appWidgetId, views);
            return;
        }

        String widgetDataJson = prefs.getString("widget_data", "{}");
        String mood = null;
        String socialBattery = null;
        String albumImageUrl = null;
        String trackIdForOEmbed = null;

        try {
            JSONObject widgetData = new JSONObject(widgetDataJson);
            if (widgetData.has("my_check_in")) {
                JSONObject myCheckIn = widgetData.getJSONObject("my_check_in");
                if (myCheckIn.has("mood") && !myCheckIn.isNull("mood")) {
                    mood = myCheckIn.getString("mood");
                }
                if (myCheckIn.has("social_battery") && !myCheckIn.isNull("social_battery")) {
                    socialBattery = myCheckIn.getString("social_battery");
                }
                // Prefer album_image_url; fallback to alternate keys (album_cover_url, photo_url)
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

        views = new RemoteViews(context.getPackageName(), R.layout.widget_checkin_4x1);

        Intent checkInIntent = new Intent(Intent.ACTION_VIEW, Uri.parse("whoami://app/check-in/edit"));
        PendingIntent checkInPendingIntent = PendingIntent.getActivity(
            context, 0, checkInIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        
        Intent refreshIntent = new Intent(context, CheckinWidgetProvider.class);
        refreshIntent.setAction("com.whoami.today.app.WIDGET_UPDATE");
        PendingIntent refreshPendingIntent = PendingIntent.getBroadcast(
            context, 0, refreshIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.btn_refresh, refreshPendingIntent);
        views.setOnClickPendingIntent(R.id.btn_i_feel, checkInPendingIntent);
        views.setOnClickPendingIntent(R.id.btn_my_battery, checkInPendingIntent);
        views.setOnClickPendingIntent(R.id.btn_my_music, checkInPendingIntent);
        views.setOnClickPendingIntent(R.id.btn_add, checkInPendingIntent);

        if (mood != null && !mood.isEmpty()) {
            views.setTextViewText(R.id.i_feel_emoji, getMoodEmoji(mood));
        } else {
            views.setTextViewText(R.id.i_feel_emoji, "+");
        }

        if (socialBattery != null && !socialBattery.isEmpty()) {
            views.setTextViewText(R.id.my_battery_emoji, getBatteryEmoji(socialBattery));
        } else {
            views.setTextViewText(R.id.my_battery_emoji, "+");
        }

        final boolean hasAlbumUrl = albumImageUrl != null && !albumImageUrl.isEmpty();
        if (hasAlbumUrl || trackIdForOEmbed != null) {
            views.setViewVisibility(R.id.my_music_icon, View.GONE);
            views.setViewVisibility(R.id.my_music_album, View.VISIBLE);
            appWidgetManager.updateAppWidget(appWidgetId, views);

            final String imageUrl = albumImageUrl;
            final String trackId = trackIdForOEmbed;
            final String finalMood = mood;
            final String finalSocialBattery = socialBattery;
            executor.execute(() -> {
                String urlToLoad = imageUrl;
                if (urlToLoad == null && trackId != null) {
                    urlToLoad = fetchAlbumImageUrlFromSpotifyOEmbed(trackId);
                }
                if (urlToLoad == null) {
                    mainHandler.post(() -> {
                        RemoteViews fallbackViews = new RemoteViews(context.getPackageName(), R.layout.widget_checkin_4x1);
                        fallbackViews.setOnClickPendingIntent(R.id.btn_refresh, refreshPendingIntent);
                        fallbackViews.setOnClickPendingIntent(R.id.btn_i_feel, checkInPendingIntent);
                        fallbackViews.setOnClickPendingIntent(R.id.btn_my_battery, checkInPendingIntent);
                        fallbackViews.setOnClickPendingIntent(R.id.btn_my_music, checkInPendingIntent);
                        fallbackViews.setOnClickPendingIntent(R.id.btn_add, checkInPendingIntent);
                        fallbackViews.setTextViewText(R.id.i_feel_emoji, finalMood != null && !finalMood.isEmpty() ? getMoodEmoji(finalMood) : "+");
                        fallbackViews.setTextViewText(R.id.my_battery_emoji, finalSocialBattery != null && !finalSocialBattery.isEmpty() ? getBatteryEmoji(finalSocialBattery) : "+");
                        fallbackViews.setViewVisibility(R.id.my_music_album, View.GONE);
                        fallbackViews.setViewVisibility(R.id.my_music_icon, View.VISIBLE);
                        fallbackViews.setTextViewText(R.id.my_music_icon, "🎵");
                        appWidgetManager.updateAppWidget(appWidgetId, fallbackViews);
                    });
                    return;
                }
                final String finalUrl = urlToLoad;
                Bitmap bitmap = loadBitmapFromUrl(finalUrl);
                mainHandler.post(() -> {
                    RemoteViews updatedViews = new RemoteViews(context.getPackageName(), R.layout.widget_checkin_4x1);
                    
                    updatedViews.setOnClickPendingIntent(R.id.btn_refresh, refreshPendingIntent);
                    updatedViews.setOnClickPendingIntent(R.id.btn_i_feel, checkInPendingIntent);
                    updatedViews.setOnClickPendingIntent(R.id.btn_my_battery, checkInPendingIntent);
                    updatedViews.setOnClickPendingIntent(R.id.btn_my_music, checkInPendingIntent);
                    updatedViews.setOnClickPendingIntent(R.id.btn_add, checkInPendingIntent);
                    
                    updatedViews.setTextViewText(R.id.i_feel_emoji, finalMood != null && !finalMood.isEmpty() ? getMoodEmoji(finalMood) : "+");
                    updatedViews.setTextViewText(R.id.my_battery_emoji, finalSocialBattery != null && !finalSocialBattery.isEmpty() ? getBatteryEmoji(finalSocialBattery) : "+");

                    if (bitmap != null) {
                        updatedViews.setImageViewBitmap(R.id.my_music_album, bitmap);
                        updatedViews.setViewVisibility(R.id.my_music_album, View.VISIBLE);
                        updatedViews.setViewVisibility(R.id.my_music_icon, View.GONE);
                    } else {
                        updatedViews.setViewVisibility(R.id.my_music_album, View.GONE);
                        updatedViews.setViewVisibility(R.id.my_music_icon, View.VISIBLE);
                        updatedViews.setTextViewText(R.id.my_music_icon, "🎵");
                    }
                    appWidgetManager.updateAppWidget(appWidgetId, updatedViews);
                });
            });
        } else {
            views.setViewVisibility(R.id.my_music_album, View.GONE);
            views.setViewVisibility(R.id.my_music_icon, View.VISIBLE);
            views.setTextViewText(R.id.my_music_icon, "+");
            appWidgetManager.updateAppWidget(appWidgetId, views);
        }
    }

    private static String getMoodEmoji(String mood) {
        if (mood == null || mood.isEmpty()) return "+";
        switch (mood.toLowerCase()) {
            case "happy": return "😊";
            case "sad": return "😢";
            case "angry": return "😠";
            case "anxious": return "😰";
            case "excited": return "🤩";
            case "tired": return "😴";
            case "calm": return "😌";
            case "confused": return "😕";
            default: return mood;
        }
    }

    private static String getBatteryEmoji(String battery) {
        if (battery == null || battery.isEmpty()) return "+";
        switch (battery.toLowerCase()) {
            case "super_social": return "🔋";
            case "fully_charged": return "🔋";
            case "moderately_social": return "🔋";
            case "needs_recharge": return "🪫";
            case "low": return "🪫";
            case "completely_drained": return "🪫";
            default: return battery;
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
