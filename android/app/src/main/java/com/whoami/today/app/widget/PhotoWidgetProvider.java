package com.whoami.today.app.widget;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.PorterDuff;
import android.graphics.PorterDuffXfermode;
import android.graphics.Rect;
import android.graphics.RectF;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.util.Base64;
import android.util.Log;
import android.view.View;
import android.widget.RemoteViews;

import com.whoami.today.app.MainActivity;
import com.whoami.today.app.R;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class PhotoWidgetProvider extends AppWidgetProvider {
    private static final String TAG = "FriendUpdateWidget";
    private static final String PREFS_NAME = "WhoAmIWidgetPrefs";
    private static final String VERSION_TYPE_DEFAULT = "default";
    private static final String VERSION_TYPE_Q = "version_q";
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
                    RemoteViews fallback = new RemoteViews(context.getPackageName(), R.layout.widget_signin_vertical);
                    Intent loginIntent = new Intent(Intent.ACTION_VIEW, Uri.parse("whoami://app/login"));
                    PendingIntent pendingIntent = PendingIntent.getActivity(
                        context, 0, loginIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
                    fallback.setOnClickPendingIntent(R.id.signin_button, pendingIntent);
                    fallback.setTextViewText(R.id.signin_description, "Sign in to see the latest updates from your friends");
                    appWidgetManager.updateAppWidget(appWidgetId, fallback);
                } catch (Exception e2) {
                    Log.e(TAG, "Fallback update failed", e2);
                }
            }
        }

        // Active fetch on the system's natural update cycle so the widget can
        // surface a friend's update without the user having to open the app.
        // updateAppWidget already renders the cached entry above; the fetch
        // overwrites the cache and re-runs updateAppWidget on completion.
        // RN's own WIDGET_UPDATE broadcast path skips this — see onReceive —
        // because the RN sync just wrote fresh data itself.
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String accessToken = prefs.getString("access_token", "");
        String versionType = prefs.getString("user_version_type", VERSION_TYPE_DEFAULT);
        if (accessToken != null && !accessToken.isEmpty()
                && !VERSION_TYPE_DEFAULT.equals(versionType)
                && !VERSION_TYPE_Q.equals(versionType)) {
            for (int appWidgetId : appWidgetIds) {
                fetchFriendUpdateFromApi(context, appWidgetManager, appWidgetId, prefs);
            }
        }
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        String action = intent.getAction();
        Log.d(TAG, "[onReceive] Received broadcast: " + action);
        if ("com.whoami.today.app.WIDGET_UPDATE".equals(action)) {
            // RN sync just wrote fresh data — only re-render, do NOT trigger
            // another fetch (would race with RN's writes and waste a request).
            AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
            int[] appWidgetIds = appWidgetManager.getAppWidgetIds(
                new android.content.ComponentName(context, PhotoWidgetProvider.class));
            for (int appWidgetId : appWidgetIds) {
                try {
                    updateAppWidget(context, appWidgetManager, appWidgetId);
                } catch (Exception e) {
                    Log.e(TAG, "Failed to update widget " + appWidgetId + " from broadcast", e);
                }
            }
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

        if (!isAuthenticated) {
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_signin_vertical);
            Intent loginIntent = new Intent(Intent.ACTION_VIEW, Uri.parse("whoami://app/login"));
            PendingIntent pendingIntent = PendingIntent.getActivity(
                context, 0, loginIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            views.setOnClickPendingIntent(R.id.signin_button, pendingIntent);
            views.setTextViewText(R.id.signin_description, "Sign in to see the latest updates from your friends");
            appWidgetManager.updateAppWidget(appWidgetId, views);
            return;
        }

        if (isDefaultVersion) {
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_photo_2x2);
            hideAllContent(views);
            appWidgetManager.updateAppWidget(appWidgetId, views);
            return;
        }

        if (isVersionQ) {
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_photo_2x2);
            hideAllContent(views);
            views.setOnClickPendingIntent(R.id.widget_friend_post_container, buildAppLauncherPendingIntent(context));
            appWidgetManager.updateAppWidget(appWidgetId, views);
            return;
        }

        String widgetDataJson = prefs.getString("widget_data", "{}");
        JSONObject friendUpdate = null;
        try {
            JSONObject widgetData = new JSONObject(widgetDataJson);
            if (widgetData.has("friend_update")) {
                friendUpdate = widgetData.getJSONObject("friend_update");
            }
        } catch (Exception e) {
            Log.e(TAG, "[updateAppWidget] Failed to parse widget_data", e);
        }

        if (friendUpdate == null) {
            Log.w(TAG, "[updateAppWidget] No friend_update cached — trying API fetch");
            fetchFriendUpdateFromApi(context, appWidgetManager, appWidgetId, prefs);
            // Render empty while fetching
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_photo_2x2);
            hideAllContent(views);
            views.setViewVisibility(R.id.friend_post_empty, View.VISIBLE);
            appWidgetManager.updateAppWidget(appWidgetId, views);
            return;
        }

        String contentImageBase64 = prefs.getString("widget_friend_update_content_image", "");
        String profileImageBase64 = prefs.getString("widget_friend_update_profile_image", "");

        renderFriendUpdate(context, appWidgetManager, appWidgetId, friendUpdate,
                contentImageBase64, profileImageBase64, startTime);
    }

    private static void hideAllContent(RemoteViews views) {
        views.setViewVisibility(R.id.friend_post_image, View.GONE);
        views.setViewVisibility(R.id.friend_post_text_container, View.GONE);
        views.setViewVisibility(R.id.friend_post_empty, View.GONE);
        views.setViewVisibility(R.id.friend_post_author_image, View.GONE);
        views.setViewVisibility(R.id.checkin_single_emoji, View.GONE);
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

    private static void renderFriendUpdate(Context context, AppWidgetManager appWidgetManager,
            int appWidgetId, JSONObject friendUpdate, String contentImageBase64,
            String profileImageBase64, long startTime) {
        String kind = friendUpdate.optString("kind", "");
        Intent friendsIntent = new Intent(Intent.ACTION_VIEW, Uri.parse("whoami://app/friends"));
        PendingIntent pendingIntent = PendingIntent.getActivity(
            context, 0, friendsIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        // Decode images off the main thread
        final String finalContentImageBase64 = contentImageBase64 != null ? contentImageBase64 : "";
        final String finalProfileImageBase64 = profileImageBase64 != null ? profileImageBase64 : "";
        final JSONObject finalFriendUpdate = friendUpdate;
        final String finalKind = kind;

        executor.execute(() -> {
            Bitmap contentBitmap = null;
            if (!finalContentImageBase64.isEmpty()) {
                try {
                    byte[] bytes = Base64.decode(finalContentImageBase64, Base64.DEFAULT);
                    Bitmap raw = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
                    if (raw != null) {
                        int w = raw.getWidth();
                        int h = raw.getHeight();
                        int side = Math.min(w, h);
                        int x = (w - side) / 2;
                        int y = (h - side) / 2;
                        Bitmap square = Bitmap.createBitmap(raw, x, y, side, side);
                        contentBitmap = getRoundedCornerBitmap(square, 32);
                    }
                } catch (Exception e) {
                    Log.e(TAG, "[renderFriendUpdate] content image decode failed", e);
                }
            }

            Bitmap profileBitmap = null;
            if (!finalProfileImageBase64.isEmpty()) {
                try {
                    byte[] bytes = Base64.decode(finalProfileImageBase64, Base64.DEFAULT);
                    Bitmap raw = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
                    if (raw != null) {
                        profileBitmap = getCircularBitmap(raw);
                    }
                } catch (Exception e) {
                    Log.e(TAG, "[renderFriendUpdate] profile image decode failed", e);
                }
            }

            final Bitmap finalContentBitmap = contentBitmap;
            final Bitmap finalProfileBitmap = profileBitmap;

            mainHandler.post(() -> {
                RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_photo_2x2);
                views.setOnClickPendingIntent(R.id.widget_friend_post_container, pendingIntent);
                hideAllContent(views);

                if ("post".equals(finalKind)) {
                    JSONObject post = finalFriendUpdate.optJSONObject("post");
                    boolean hasImage = post != null && post.optBoolean("has_image", false) && finalContentBitmap != null;
                    if (hasImage) {
                        views.setInt(R.id.widget_friend_post_container, "setBackgroundResource", 0);
                        views.setImageViewBitmap(R.id.friend_post_image, finalContentBitmap);
                        views.setViewVisibility(R.id.friend_post_image, View.VISIBLE);
                    } else {
                        String content = post != null ? post.optString("content", "") : "";
                        views.setTextViewText(R.id.friend_post_content, content);
                        views.setViewVisibility(R.id.friend_post_text_container, View.VISIBLE);
                    }
                } else if ("checkin".equals(finalKind)) {
                    JSONObject checkin = finalFriendUpdate.optJSONObject("checkin");
                    String variation = checkin != null ? checkin.optString("variation", "") : "";
                    switch (variation) {
                        case "album":
                            if (finalContentBitmap != null) {
                                views.setInt(R.id.widget_friend_post_container, "setBackgroundResource", 0);
                                views.setImageViewBitmap(R.id.friend_post_image, finalContentBitmap);
                                views.setViewVisibility(R.id.friend_post_image, View.VISIBLE);
                            } else {
                                // No album art → show music emoji
                                views.setTextViewText(R.id.checkin_single_emoji, "\uD83C\uDFB5");
                                views.setViewVisibility(R.id.checkin_single_emoji, View.VISIBLE);
                            }
                            break;
                        case "mood": {
                            String mood = checkin.optString("mood", "");
                            views.setTextViewText(R.id.checkin_single_emoji, mood);
                            views.setViewVisibility(R.id.checkin_single_emoji, View.VISIBLE);
                            break;
                        }
                        case "social_battery": {
                            String battery = checkin.optString("social_battery", "");
                            views.setTextViewText(R.id.checkin_single_emoji, getBatteryEmoji(battery));
                            views.setViewVisibility(R.id.checkin_single_emoji, View.VISIBLE);
                            break;
                        }
                        case "thought": {
                            String description = checkin.optString("description", "");
                            views.setTextViewText(R.id.friend_post_content, description);
                            views.setViewVisibility(R.id.friend_post_text_container, View.VISIBLE);
                            break;
                        }
                        default:
                            views.setViewVisibility(R.id.friend_post_empty, View.VISIBLE);
                            break;
                    }
                } else {
                    views.setViewVisibility(R.id.friend_post_empty, View.VISIBLE);
                }

                if (finalProfileBitmap != null) {
                    views.setImageViewBitmap(R.id.friend_post_author_image, finalProfileBitmap);
                } else {
                    views.setImageViewBitmap(
                            R.id.friend_post_author_image,
                            getCircularBitmap(BitmapFactory.decodeResource(context.getResources(), R.drawable.ic_default_profile))
                    );
                }
                views.setViewVisibility(R.id.friend_post_author_image, View.VISIBLE);

                appWidgetManager.updateAppWidget(appWidgetId, views);
                long elapsed = System.currentTimeMillis() - startTime;
                Log.d(TAG, "[renderFriendUpdate] COMPLETE kind=" + finalKind + " elapsed=" + elapsed + "ms");
            });
        });
    }

    /** When widget has no cached friend_update, fetch from /user/friends/. */
    private static void fetchFriendUpdateFromApi(Context context, AppWidgetManager appWidgetManager,
            int appWidgetId, SharedPreferences prefs) {
        String apiBaseUrl = prefs.getString("api_base_url", "https://whoami-test-group.gina-park.site/api/");
        String accessToken = prefs.getString("access_token", "");
        String csrftoken = prefs.getString("csrftoken", "");

        if (apiBaseUrl.isEmpty() || accessToken.isEmpty()) {
            Log.w(TAG, "[fetchFriendUpdate] Missing api_base_url or access_token, skipping");
            return;
        }

        executor.execute(() -> {
            try {
                String endpoint = apiBaseUrl + "user/friends/?type=all";
                URL url = new URL(endpoint);
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("GET");
                conn.setConnectTimeout(5000);
                conn.setReadTimeout(5000);
                conn.setRequestProperty("Cookie",
                        "csrftoken=" + csrftoken + "; access_token=" + accessToken);
                conn.setRequestProperty("X-CSRFToken", csrftoken);
                conn.connect();

                if (conn.getResponseCode() != 200) {
                    Log.w(TAG, "[fetchFriendUpdate] API returned " + conn.getResponseCode());
                    return;
                }

                StringBuilder sb = new StringBuilder();
                try (BufferedReader reader = new BufferedReader(
                        new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8))) {
                    String line;
                    while ((line = reader.readLine()) != null) sb.append(line);
                }

                JSONObject response = new JSONObject(sb.toString());
                JSONArray results = response.optJSONArray("results");
                if (results == null || results.length() == 0) {
                    Log.w(TAG, "[fetchFriendUpdate] No friends in response");
                    return;
                }

                // Collect candidates: any friend with a visible recent update
                java.util.List<JSONObject> candidates = new java.util.ArrayList<>();
                for (int i = 0; i < results.length(); i++) {
                    JSONObject friend = results.getJSONObject(i);
                    String ts = friend.optString("last_updated_at", "");
                    if (!ts.isEmpty()) {
                        candidates.add(friend);
                    }
                }

                if (candidates.isEmpty()) {
                    Log.d(TAG, "[fetchFriendUpdate] No candidate friends");
                    return;
                }

                // Sort by last_updated_at desc (ISO 8601 lex order = chronological)
                candidates.sort((a, b) -> b.optString("last_updated_at", "")
                                          .compareTo(a.optString("last_updated_at", "")));
                JSONObject picked = candidates.get(0);
                String username = picked.optString("username", "");
                String profileImageUrl = picked.optString("profile_image", "");

                boolean preferPost = "post".equals(picked.optString("last_updated_kind", ""));

                JSONObject friendUpdate = new JSONObject();
                JSONObject friendJson = new JSONObject();
                friendJson.put("username", username);
                friendUpdate.put("friend", friendJson);

                String contentImageBase64 = "";

                JSONArray recentPosts = picked.optJSONArray("recent_posts");
                JSONObject recentPost = (recentPosts != null && recentPosts.length() > 0)
                        ? recentPosts.optJSONObject(0)
                        : null;

                if (preferPost && recentPost != null) {
                    JSONObject post = recentPost;
                    JSONArray images = post.optJSONArray("images");
                    boolean hasImage = images != null && images.length() > 0;

                    JSONObject postJson = new JSONObject();
                    postJson.put("id", post.optInt("id"));
                    postJson.put("content", post.optString("content", ""));
                    postJson.put("has_image", hasImage);
                    friendUpdate.put("kind", "post");
                    friendUpdate.put("post", postJson);

                    if (hasImage) {
                        String firstImageUrl = images.optString(0, "");
                        if (!firstImageUrl.isEmpty()) {
                            contentImageBase64 = downloadAsBase64(firstImageUrl);
                        }
                    }
                } else {
                    String field = picked.optString("last_updated_field", "");
                    JSONObject checkinJson = new JSONObject();
                    boolean ok = false;
                    if ("mood".equals(field)) {
                        Object moodObj = picked.opt("mood");
                        String mood = "";
                        if (moodObj instanceof JSONArray) {
                            JSONArray arr = (JSONArray) moodObj;
                            if (arr.length() > 0) {
                                int idx = (int) (Math.random() * arr.length());
                                mood = arr.optString(idx, "");
                            }
                        } else if (moodObj != null) {
                            mood = moodObj.toString();
                        }
                        if (!mood.isEmpty()) {
                            checkinJson.put("variation", "mood");
                            checkinJson.put("mood", mood);
                            ok = true;
                        }
                    } else if ("social_battery".equals(field)) {
                        String battery = picked.optString("social_battery", "");
                        if (!battery.isEmpty() && !"null".equals(battery)) {
                            checkinJson.put("variation", "social_battery");
                            checkinJson.put("social_battery", battery);
                            ok = true;
                        }
                    } else if ("thought".equals(field)) {
                        String thought = picked.optString("thought", "");
                        if (!thought.isEmpty() && !"null".equals(thought)) {
                            checkinJson.put("variation", "thought");
                            checkinJson.put("description", thought);
                            ok = true;
                        }
                    } else if ("song".equals(field)) {
                        String trackId = picked.optString("track_id", "");
                        if (!trackId.isEmpty() && !"null".equals(trackId)) {
                            checkinJson.put("variation", "album");
                            checkinJson.put("track_id", trackId);
                            String albumUrl = fetchAlbumImageUrl(trackId);
                            if (albumUrl != null && !albumUrl.isEmpty()) {
                                contentImageBase64 = downloadAsBase64(albumUrl);
                            }
                            ok = true;
                        }
                    }
                    if (!ok) {
                        Log.w(TAG, "[fetchFriendUpdate] Checkin variation had no value, skipping");
                        return;
                    }
                    friendUpdate.put("kind", "checkin");
                    friendUpdate.put("checkin", checkinJson);
                }

                String profileImageBase64 = "";
                if (!profileImageUrl.isEmpty()) {
                    profileImageBase64 = downloadAsBase64(profileImageUrl);
                }

                String existingJson = prefs.getString("widget_data", "{}");
                JSONObject root = new JSONObject(existingJson);
                root.put("friend_update", friendUpdate);
                root.remove("friend_post");

                SharedPreferences.Editor editor = prefs.edit();
                editor.putString("widget_data", root.toString());
                if (!contentImageBase64.isEmpty()) {
                    editor.putString("widget_friend_update_content_image", contentImageBase64);
                } else {
                    editor.remove("widget_friend_update_content_image");
                }
                if (!profileImageBase64.isEmpty()) {
                    editor.putString("widget_friend_update_profile_image", profileImageBase64);
                } else {
                    editor.remove("widget_friend_update_profile_image");
                }
                editor.commit();

                Log.d(TAG, "[fetchFriendUpdate] Saved " + friendUpdate.optString("kind") + " for " + username);

                mainHandler.post(() -> updateAppWidget(context, appWidgetManager, appWidgetId));

            } catch (Exception e) {
                Log.e(TAG, "[fetchFriendUpdate] Failed", e);
            }
        });
    }

    /** Fetch album image URL from Spotify oEmbed. */
    private static String fetchAlbumImageUrl(String trackId) {
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
            try (BufferedReader reader = new BufferedReader(
                    new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8))) {
                String line;
                while ((line = reader.readLine()) != null) sb.append(line);
            }
            JSONObject json = new JSONObject(sb.toString());
            return json.optString("thumbnail_url", null);
        } catch (Exception e) {
            Log.w(TAG, "[fetchAlbumImageUrl] Failed for " + trackId, e);
            return null;
        }
    }

    /** social_battery enum string → emoji. */
    private static String getBatteryEmoji(String battery) {
        if (battery == null || battery.isEmpty()) return "";
        switch (battery.toLowerCase()) {
            case "super_social": return "\uD83E\uDD29";
            case "fully_charged": return "\uD83D\uDE80";
            case "moderately_social": return "\uD83D\uDD0B";
            case "needs_recharge": return "\uD83D\uDD0C";
            case "low": return "\uD83E\uDEAB";
            case "completely_drained": return "\uD83D\uDCA4";
            default: return battery;
        }
    }

    /** Download an image URL and return as base64. */
    private static String downloadAsBase64(String imageUrl) {
        try {
            URL url = new URL(imageUrl);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setDoInput(true);
            conn.setConnectTimeout(5000);
            conn.setReadTimeout(5000);
            conn.connect();
            InputStream input = conn.getInputStream();
            java.io.ByteArrayOutputStream baos = new java.io.ByteArrayOutputStream();
            byte[] buffer = new byte[4096];
            int bytesRead;
            while ((bytesRead = input.read(buffer)) != -1) {
                baos.write(buffer, 0, bytesRead);
            }
            input.close();
            return Base64.encodeToString(baos.toByteArray(), Base64.DEFAULT);
        } catch (Exception e) {
            Log.w(TAG, "[downloadAsBase64] Failed for " + imageUrl, e);
            return "";
        }
    }

    private static Bitmap getRoundedCornerBitmap(Bitmap bitmap, float cornerRadius) {
        Bitmap output = Bitmap.createBitmap(bitmap.getWidth(), bitmap.getHeight(), Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(output);
        final Paint paint = new Paint();
        final Rect rect = new Rect(0, 0, bitmap.getWidth(), bitmap.getHeight());
        final RectF rectF = new RectF(rect);
        paint.setAntiAlias(true);
        canvas.drawARGB(0, 0, 0, 0);
        canvas.drawRoundRect(rectF, cornerRadius, cornerRadius, paint);
        paint.setXfermode(new PorterDuffXfermode(PorterDuff.Mode.SRC_IN));
        canvas.drawBitmap(bitmap, rect, rect, paint);
        return output;
    }

    private static Bitmap getCircularBitmap(Bitmap bitmap) {
        if (bitmap == null) return null;
        int size = Math.min(bitmap.getWidth(), bitmap.getHeight());
        Bitmap output = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(output);

        final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        final Rect rect = new Rect(0, 0, size, size);

        canvas.drawARGB(0, 0, 0, 0);
        canvas.drawCircle(size / 2f, size / 2f, size / 2f, paint);

        paint.setXfermode(new PorterDuffXfermode(PorterDuff.Mode.SRC_IN));
        canvas.drawBitmap(bitmap, null, rect, paint);
        paint.setXfermode(null);

        Paint borderPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        borderPaint.setStyle(Paint.Style.STROKE);
        borderPaint.setColor(0xFFFFFFFF);
        borderPaint.setStrokeWidth(Math.max(2f, size * 0.08f));
        float radius = (size / 2f) - (borderPaint.getStrokeWidth() / 2f);
        canvas.drawCircle(size / 2f, size / 2f, radius, borderPaint);

        return output;
    }
}
