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
    private static final String VERSION_TYPE_Q = "version_q";
    private static final ExecutorService executor = Executors.newSingleThreadExecutor();
    private static final Handler mainHandler = new Handler(Looper.getMainLooper());

    // Per-editor deep links (must match iOS CheckinWidget.swift)
    private static final String DEEP_LINK_MOOD    = "whoami://app/update?editor=mood";
    private static final String DEEP_LINK_BATTERY = "whoami://app/update?editor=battery";
    private static final String DEEP_LINK_SONG    = "whoami://app/update?editor=song";
    private static final String DEEP_LINK_THOUGHT = "whoami://app/update?editor=thought";

    // Distinct requestCodes so PendingIntent.getActivity does not dedupe across buttons
    private static final int REQ_MOOD    = 1;
    private static final int REQ_BATTERY = 2;
    private static final int REQ_SONG    = 3;
    private static final int REQ_THOUGHT = 4;

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            try {
                updateAppWidget(context, appWidgetManager, appWidgetId);
            } catch (Exception e) {
                Log.e(TAG, "Failed to update widget " + appWidgetId, e);
                try {
                    RemoteViews fallback = new RemoteViews(context.getPackageName(), R.layout.widget_signin_horizontal);
                    Intent loginIntent = new Intent(Intent.ACTION_VIEW, Uri.parse("whoami://app/login"));
                    PendingIntent pendingIntent = PendingIntent.getActivity(
                        context, 0, loginIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
                    fallback.setOnClickPendingIntent(R.id.signin_button, pendingIntent);
                    fallback.setTextViewText(R.id.signin_description, "Sign in to view your check-in status");
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
        Log.d(TAG, "[onReceive] Received broadcast: " + action);
        if ("com.whoami.today.app.WIDGET_UPDATE".equals(action)) {
            Log.d(TAG, "[onReceive] WIDGET_UPDATE broadcast received, triggering widget update");
            AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
            int[] appWidgetIds = appWidgetManager.getAppWidgetIds(
                new android.content.ComponentName(context, CheckinWidgetProvider.class));
            Log.d(TAG, "[onReceive] Found " + appWidgetIds.length + " widget(s) to update");
            onUpdate(context, appWidgetManager, appWidgetIds);
        }
    }

    static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        long startTime = System.currentTimeMillis();
        Log.d(TAG, "[updateAppWidget] START - Widget ID: " + appWidgetId);
        
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String accessToken = prefs.getString("access_token", "");
        String versionType = prefs.getString("user_version_type", VERSION_TYPE_DEFAULT);
        boolean isAuthenticated = accessToken != null && !accessToken.isEmpty();
        boolean isDefaultVersion = VERSION_TYPE_DEFAULT.equals(versionType);
        boolean isVersionQ = VERSION_TYPE_Q.equals(versionType);

        Log.d(TAG, "[updateAppWidget] Auth state - isAuthenticated: " + isAuthenticated +
                   ", accessTokenLen: " + (accessToken != null ? accessToken.length() : 0) +
                   ", versionType: " + versionType +
                   ", isDefaultVersion: " + isDefaultVersion +
                   ", isVersionQ: " + isVersionQ);

        RemoteViews views;

        if (!isAuthenticated) {
            views = new RemoteViews(context.getPackageName(), R.layout.widget_signin_horizontal);
            Intent loginIntent = new Intent(Intent.ACTION_VIEW, Uri.parse("whoami://app/login"));
            PendingIntent pendingIntent = PendingIntent.getActivity(
                context, 0, loginIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            views.setOnClickPendingIntent(R.id.signin_button, pendingIntent);
            views.setTextViewText(R.id.signin_description, "Sign in to view your check-in status");
            appWidgetManager.updateAppWidget(appWidgetId, views);
            return;
        }

        if (isDefaultVersion) {
            views = new RemoteViews(context.getPackageName(), R.layout.widget_checkin_4x1);
            views.setViewVisibility(R.id.btn_i_feel, View.INVISIBLE);
            views.setViewVisibility(R.id.btn_my_battery, View.INVISIBLE);
            views.setViewVisibility(R.id.btn_my_music, View.INVISIBLE);
            views.setViewVisibility(R.id.btn_my_thought, View.INVISIBLE);
            appWidgetManager.updateAppWidget(appWidgetId, views);
            return;
        }

        if (isVersionQ) {
            views = new RemoteViews(context.getPackageName(), R.layout.widget_checkin_4x1);
            views.setViewVisibility(R.id.btn_i_feel, View.INVISIBLE);
            views.setViewVisibility(R.id.btn_my_battery, View.INVISIBLE);
            views.setViewVisibility(R.id.btn_my_music, View.INVISIBLE);
            views.setViewVisibility(R.id.btn_my_thought, View.INVISIBLE);
            views.setOnClickPendingIntent(R.id.widget_checkin_container, buildAppLauncherPendingIntent(context));
            appWidgetManager.updateAppWidget(appWidgetId, views);
            return;
        }

        String widgetDataJson = prefs.getString("widget_data", "{}");
        Log.d(TAG, "[updateAppWidget] Raw widget_data from prefs: " + widgetDataJson);
        
        String mood = null;
        String socialBattery = null;
        String description = null;
        String albumImageUrl = null;
        String trackIdForOEmbed = null;

        try {
            JSONObject widgetData = new JSONObject(widgetDataJson);
            Log.d(TAG, "[updateAppWidget] Parsed widget_data JSON, has my_check_in: " + widgetData.has("my_check_in"));
            
            if (widgetData.has("my_check_in")) {
                JSONObject myCheckIn = widgetData.getJSONObject("my_check_in");
                Log.d(TAG, "[updateAppWidget] my_check_in object: " + myCheckIn.toString());
                
                if (myCheckIn.has("mood") && !myCheckIn.isNull("mood")) {
                    mood = myCheckIn.getString("mood");
                    Log.d(TAG, "[updateAppWidget] Extracted mood: " + mood);
                }
                if (myCheckIn.has("social_battery") && !myCheckIn.isNull("social_battery")) {
                    socialBattery = myCheckIn.getString("social_battery");
                    Log.d(TAG, "[updateAppWidget] Extracted social_battery: " + socialBattery);
                }
                if (myCheckIn.has("description") && !myCheckIn.isNull("description")) {
                    description = myCheckIn.getString("description");
                    Log.d(TAG, "[updateAppWidget] Extracted description length: " + (description != null ? description.length() : 0));
                }
                // Prefer album_image_url; fallback to alternate keys (album_cover_url, photo_url)
                for (String key : new String[]{"album_image_url", "album_cover_url", "photo_url"}) {
                    if (myCheckIn.has(key) && !myCheckIn.isNull(key)) {
                        String url = myCheckIn.optString(key, null);
                        if (url != null && !url.isEmpty()) {
                            albumImageUrl = url;
                            Log.d(TAG, "[updateAppWidget] Found album image URL from key '" + key + "': " + url);
                            break;
                        }
                    }
                }
                if (albumImageUrl == null) {
                    String tid = myCheckIn.optString("track_id", null);
                    if (tid != null && !tid.trim().isEmpty()) {
                        trackIdForOEmbed = tid.trim();
                        Log.d(TAG, "[updateAppWidget] No album URL, will use oEmbed for track_id: " + trackIdForOEmbed);
                    }
                }
            } else {
                Log.w(TAG, "[updateAppWidget] No my_check_in in widget_data - will try API fetch");
                fetchCheckInFromApi(context, appWidgetManager, appWidgetId, prefs);
            }
        } catch (Exception e) {
            Log.e(TAG, "[updateAppWidget] Error parsing widget data", e);
        }

        views = new RemoteViews(context.getPackageName(), R.layout.widget_checkin_4x1);

        // Refresh: keep local broadcast (avoids cold-start splash)
        // 4 per-editor deep links (matches iOS)
        applyCheckinClickIntents(context, views);

        if (mood != null && !mood.isEmpty()) {
            views.setTextViewText(R.id.i_feel_emoji, mood);
        } else {
            views.setTextViewText(R.id.i_feel_emoji, "+");
        }

        if (socialBattery != null && !socialBattery.isEmpty()) {
            views.setTextViewText(R.id.my_battery_emoji, getBatteryEmoji(socialBattery));
        } else {
            views.setTextViewText(R.id.my_battery_emoji, "+");
        }

        applyThoughtContent(views, description);

        final boolean hasAlbumUrl = albumImageUrl != null && !albumImageUrl.isEmpty();
        if (hasAlbumUrl || trackIdForOEmbed != null) {
            views.setViewVisibility(R.id.my_music_icon, View.GONE);
            views.setViewVisibility(R.id.my_music_album, View.VISIBLE);
            appWidgetManager.updateAppWidget(appWidgetId, views);

            final String imageUrl = albumImageUrl;
            final String trackId = trackIdForOEmbed;
            final String finalMood = mood;
            final String finalSocialBattery = socialBattery;
            final String finalDescription = description;
            executor.execute(() -> {
                String urlToLoad = imageUrl;
                if (urlToLoad == null && trackId != null) {
                    urlToLoad = fetchAlbumImageUrlFromSpotifyOEmbed(trackId);
                }
                if (urlToLoad == null) {
                    mainHandler.post(() -> {
                        RemoteViews fallbackViews = new RemoteViews(context.getPackageName(), R.layout.widget_checkin_4x1);
                        applyCheckinClickIntents(context, fallbackViews);
                        fallbackViews.setTextViewText(R.id.i_feel_emoji, finalMood != null && !finalMood.isEmpty() ? finalMood : "+");
                        fallbackViews.setTextViewText(R.id.my_battery_emoji, finalSocialBattery != null && !finalSocialBattery.isEmpty() ? getBatteryEmoji(finalSocialBattery) : "+");
                        applyThoughtContent(fallbackViews, finalDescription);
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

                    applyCheckinClickIntents(context, updatedViews);

                    updatedViews.setTextViewText(R.id.i_feel_emoji, finalMood != null && !finalMood.isEmpty() ? finalMood : "+");
                    updatedViews.setTextViewText(R.id.my_battery_emoji, finalSocialBattery != null && !finalSocialBattery.isEmpty() ? getBatteryEmoji(finalSocialBattery) : "+");
                    applyThoughtContent(updatedViews, finalDescription);

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
            
            long elapsed = System.currentTimeMillis() - startTime;
            Log.d(TAG, "[updateAppWidget] COMPLETE (no album) - Widget ID: " + appWidgetId + ", Elapsed: " + elapsed + "ms");
        }
    }

    /**
     * When widget has no check-in data, fetch directly from API in background
     * and update the widget once data arrives.
     */
    private static void fetchCheckInFromApi(Context context, AppWidgetManager appWidgetManager,
            int appWidgetId, SharedPreferences prefs) {
        String apiBaseUrl = prefs.getString("api_base_url", "https://whoami-test-group.gina-park.site/api/");
        String accessToken = prefs.getString("access_token", "");
        String csrftoken = prefs.getString("csrftoken", "");

        if (apiBaseUrl.isEmpty() || accessToken.isEmpty()) {
            Log.w(TAG, "[fetchCheckInFromApi] Missing api_base_url or access_token, skipping");
            return;
        }

        executor.execute(() -> {
            try {
                String endpoint = apiBaseUrl + "user/me/profile";
                Log.d(TAG, "[fetchCheckInFromApi] Fetching: " + endpoint);

                URL url = new URL(endpoint);
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("GET");
                conn.setConnectTimeout(5000);
                conn.setReadTimeout(5000);
                conn.setRequestProperty("Cookie",
                        "csrftoken=" + csrftoken + "; access_token=" + accessToken);
                conn.setRequestProperty("X-CSRFToken", csrftoken);
                conn.connect();

                int responseCode = conn.getResponseCode();
                if (responseCode != 200) {
                    Log.w(TAG, "[fetchCheckInFromApi] API returned " + responseCode);
                    return;
                }

                StringBuilder sb = new StringBuilder();
                try (BufferedReader reader = new BufferedReader(
                        new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8))) {
                    String line;
                    while ((line = reader.readLine()) != null) sb.append(line);
                }

                JSONObject profile = new JSONObject(sb.toString());
                if (!profile.has("check_in") || profile.isNull("check_in")) {
                    Log.w(TAG, "[fetchCheckInFromApi] No check_in in profile response");
                    return;
                }

                JSONObject apiCheckIn = profile.getJSONObject("check_in");
                JSONObject myCheckIn = new JSONObject();

                if (apiCheckIn.has("id")) myCheckIn.put("id", apiCheckIn.getInt("id"));
                if (apiCheckIn.has("is_active")) myCheckIn.put("is_active", apiCheckIn.getBoolean("is_active"));
                if (apiCheckIn.has("created_at")) myCheckIn.put("created_at", apiCheckIn.getString("created_at"));

                // mood: API returns array of up to 5 emoji strings — pick one at random
                if (apiCheckIn.has("mood") && !apiCheckIn.isNull("mood")) {
                    Object moodObj = apiCheckIn.get("mood");
                    if (moodObj instanceof org.json.JSONArray) {
                        org.json.JSONArray arr = (org.json.JSONArray) moodObj;
                        if (arr.length() > 0) {
                            int idx = (int) (Math.random() * arr.length());
                            myCheckIn.put("mood", arr.getString(idx));
                        } else {
                            myCheckIn.put("mood", "");
                        }
                    } else {
                        myCheckIn.put("mood", moodObj.toString());
                    }
                }

                // social_battery: nullable
                if (apiCheckIn.has("social_battery") && !apiCheckIn.isNull("social_battery")) {
                    myCheckIn.put("social_battery", apiCheckIn.getString("social_battery"));
                } else {
                    myCheckIn.put("social_battery", JSONObject.NULL);
                }

                // API returns "thought", widget expects "description"
                if (apiCheckIn.has("thought") && !apiCheckIn.isNull("thought")) {
                    myCheckIn.put("description", apiCheckIn.getString("thought"));
                } else if (apiCheckIn.has("description") && !apiCheckIn.isNull("description")) {
                    myCheckIn.put("description", apiCheckIn.getString("description"));
                }

                // Fetch active song from check_in/song/ endpoint
                try {
                    String songEndpoint = apiBaseUrl + "check_in/song/";
                    Log.d(TAG, "[fetchCheckInFromApi] Fetching songs: " + songEndpoint);
                    URL songUrl = new URL(songEndpoint);
                    HttpURLConnection songConn = (HttpURLConnection) songUrl.openConnection();
                    songConn.setRequestMethod("GET");
                    songConn.setConnectTimeout(5000);
                    songConn.setReadTimeout(5000);
                    songConn.setRequestProperty("Cookie",
                            "csrftoken=" + csrftoken + "; access_token=" + accessToken);
                    songConn.setRequestProperty("X-CSRFToken", csrftoken);
                    songConn.connect();
                    if (songConn.getResponseCode() == 200) {
                        StringBuilder songSb = new StringBuilder();
                        try (BufferedReader r = new BufferedReader(
                                new InputStreamReader(songConn.getInputStream(), StandardCharsets.UTF_8))) {
                            String l; while ((l = r.readLine()) != null) songSb.append(l);
                        }
                        // Response: {results: [...]} or bare array
                        String songBody = songSb.toString().trim();
                        org.json.JSONArray songs;
                        if (songBody.startsWith("{")) {
                            JSONObject songObj = new JSONObject(songBody);
                            songs = songObj.optJSONArray("results");
                            if (songs == null) songs = new org.json.JSONArray();
                        } else {
                            songs = new org.json.JSONArray(songBody);
                        }
                        for (int i = 0; i < songs.length(); i++) {
                            JSONObject song = songs.getJSONObject(i);
                            if (song.optBoolean("is_active", false)) {
                                String trackId = song.optString("track_id", "");
                                if (!trackId.isEmpty()) {
                                    myCheckIn.put("track_id", trackId);
                                    String albumUrl = fetchAlbumImageUrlFromSpotifyOEmbed(trackId);
                                    if (albumUrl != null) {
                                        myCheckIn.put("album_image_url", albumUrl);
                                    }
                                    Log.d(TAG, "[fetchCheckInFromApi] Active song: " + trackId);
                                }
                                break;
                            }
                        }
                    }
                } catch (Exception songErr) {
                    Log.w(TAG, "[fetchCheckInFromApi] Song fetch failed (non-fatal)", songErr);
                }

                // Save to SharedPreferences
                String existingJson = prefs.getString("widget_data", "{}");
                JSONObject root = new JSONObject(existingJson);
                root.put("my_check_in", myCheckIn);
                prefs.edit().putString("widget_data", root.toString()).commit();

                Log.d(TAG, "[fetchCheckInFromApi] Saved check-in from API: " + myCheckIn.toString());

                // Update widget on main thread
                mainHandler.post(() -> updateAppWidget(context, appWidgetManager, appWidgetId));

            } catch (Exception e) {
                Log.e(TAG, "[fetchCheckInFromApi] Failed", e);
            }
        });
    }

    /** Build a PendingIntent that launches the app with no deep link (for version_q). */
    private static PendingIntent buildAppLauncherPendingIntent(Context context) {
        Intent launcher = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        if (launcher == null) {
            launcher = new Intent(context, MainActivity.class);
            launcher.setAction(Intent.ACTION_MAIN);
            launcher.addCategory(Intent.CATEGORY_LAUNCHER);
        }
        launcher.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(
            context,
            0,
            launcher,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /** Build a PendingIntent that opens the app via a deep link with a unique requestCode. */
    private static PendingIntent buildDeepLinkPendingIntent(Context context, String uri, int requestCode) {
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(uri));
        return PendingIntent.getActivity(
            context,
            requestCode,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /** Apply per-editor deep link PendingIntents to all 4 check-in buttons. */
    private static void applyCheckinClickIntents(Context context, RemoteViews views) {
        views.setOnClickPendingIntent(R.id.btn_i_feel,
            buildDeepLinkPendingIntent(context, DEEP_LINK_MOOD, REQ_MOOD));
        views.setOnClickPendingIntent(R.id.btn_my_battery,
            buildDeepLinkPendingIntent(context, DEEP_LINK_BATTERY, REQ_BATTERY));
        views.setOnClickPendingIntent(R.id.btn_my_music,
            buildDeepLinkPendingIntent(context, DEEP_LINK_SONG, REQ_SONG));
        views.setOnClickPendingIntent(R.id.btn_my_thought,
            buildDeepLinkPendingIntent(context, DEEP_LINK_THOUGHT, REQ_THOUGHT));
    }

    /** Show description text in My Thought slot if non-empty, otherwise show "+". */
    private static void applyThoughtContent(RemoteViews views, String description) {
        String trimmed = description == null ? "" : description.trim();
        if (!trimmed.isEmpty()) {
            views.setTextViewText(R.id.my_thought_description, trimmed);
            views.setViewVisibility(R.id.my_thought_description, View.VISIBLE);
            views.setViewVisibility(R.id.my_thought_plus, View.GONE);
        } else {
            views.setViewVisibility(R.id.my_thought_description, View.GONE);
            views.setViewVisibility(R.id.my_thought_plus, View.VISIBLE);
        }
    }

    private static String getBatteryEmoji(String battery) {
        if (battery == null || battery.isEmpty()) return "+";
        switch (battery.toLowerCase()) {
            case "super_social": return "🔋";
            case "fully_charged": return "🔋";
            case "moderately_social": return "🔋";
            // Use widely supported glyph for Android widget text rendering.
            // The low-battery emoji (🪫) can render as tofu/x on some devices.
            case "needs_recharge": return "🔋";
            case "low": return "🔋";
            case "completely_drained": return "🔋";
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
            Bitmap bitmap = BitmapFactory.decodeStream(input);
            if (bitmap != null) {
                return getRoundedCornerBitmap(bitmap, 16);
            }
            return null;
        } catch (Exception e) {
            Log.e(TAG, "Error loading bitmap from URL", e);
            return null;
        }
    }

    private static Bitmap getRoundedCornerBitmap(Bitmap bitmap, float cornerRadius) {
        Bitmap output = Bitmap.createBitmap(bitmap.getWidth(), bitmap.getHeight(), Bitmap.Config.ARGB_8888);
        android.graphics.Canvas canvas = new android.graphics.Canvas(output);

        final android.graphics.Paint paint = new android.graphics.Paint();
        final android.graphics.Rect rect = new android.graphics.Rect(0, 0, bitmap.getWidth(), bitmap.getHeight());
        final android.graphics.RectF rectF = new android.graphics.RectF(rect);

        paint.setAntiAlias(true);
        canvas.drawARGB(0, 0, 0, 0);
        canvas.drawRoundRect(rectF, cornerRadius, cornerRadius, paint);

        paint.setXfermode(new android.graphics.PorterDuffXfermode(android.graphics.PorterDuff.Mode.SRC_IN));
        canvas.drawBitmap(bitmap, rect, rect, paint);

        return output;
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
