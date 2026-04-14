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
                    fallback.setTextViewText(R.id.signin_description, "Sign in to see what music your friends are sharing");
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
        long startTime = System.currentTimeMillis();
        Log.d(TAG, "[updateAppWidget] START - Widget ID: " + appWidgetId);
        
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String accessToken = prefs.getString("access_token", "");
        String versionType = prefs.getString("user_version_type", VERSION_TYPE_DEFAULT);
        boolean isAuthenticated = accessToken != null && !accessToken.isEmpty();
        boolean isDefaultVersion = VERSION_TYPE_DEFAULT.equals(versionType);

        Log.d(TAG, "[updateAppWidget] Auth state - isAuthenticated: " + isAuthenticated + 
                   ", versionType: " + versionType);

        RemoteViews views;

        if (!isAuthenticated) {
            views = new RemoteViews(context.getPackageName(), R.layout.widget_signin);
            Intent loginIntent = new Intent(Intent.ACTION_VIEW, Uri.parse("whoami://app/login"));
            PendingIntent pendingIntent = PendingIntent.getActivity(
                context, 0, loginIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            views.setOnClickPendingIntent(R.id.signin_button, pendingIntent);
            views.setTextViewText(R.id.signin_description, "Sign in to see what music your friends are sharing");
            appWidgetManager.updateAppWidget(appWidgetId, views);
            Log.d(TAG, "[updateAppWidget] Showing sign-in view");
            return;
        }
        
        if (isDefaultVersion) {
            views = new RemoteViews(context.getPackageName(), R.layout.widget_album_2x2);
            views.setViewVisibility(R.id.album_image, View.GONE);
            views.setViewVisibility(R.id.album_placeholder, View.GONE);
            views.setViewVisibility(R.id.friend_profile_image, View.GONE);
            appWidgetManager.updateAppWidget(appWidgetId, views);
            Log.d(TAG, "[updateAppWidget] Default version - empty widget");
            return;
        }

        // Read shared playlist track data
        String widgetDataJson = prefs.getString("widget_data", "{}");
        String albumImageBase64 = prefs.getString("widget_shared_playlist_album_image_base64", "");
        String avatarImageBase64 = prefs.getString("widget_shared_playlist_avatar_image_base64", "");
        
        Log.d(TAG, "[updateAppWidget] Base64 lengths - album: " + albumImageBase64.length() + 
                   ", avatar: " + avatarImageBase64.length());

        views = new RemoteViews(context.getPackageName(), R.layout.widget_album_2x2);
        Intent playlistIntent = new Intent(Intent.ACTION_VIEW, Uri.parse("whoami://app/discover"));
        PendingIntent pendingIntent = PendingIntent.getActivity(
            context, 0, playlistIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.widget_album_container, pendingIntent);

        if (albumImageBase64.isEmpty() && avatarImageBase64.isEmpty()) {
            views.setViewVisibility(R.id.album_image, View.GONE);
            views.setViewVisibility(R.id.album_placeholder, View.VISIBLE);
            views.setViewVisibility(R.id.friend_profile_image, View.GONE);
            appWidgetManager.updateAppWidget(appWidgetId, views);
            Log.d(TAG, "[updateAppWidget] No images - showing placeholder, trying API fetch");
            fetchSharedPlaylistFromApi(context, appWidgetManager, appWidgetId, prefs);
            return;
        }

        final String finalAlbumBase64 = albumImageBase64;
        final String finalAvatarBase64 = avatarImageBase64;
        
        executor.execute(() -> {
            Bitmap albumBitmap = null;
            Bitmap avatarBitmap = null;
            
            if (!finalAlbumBase64.isEmpty()) {
                try {
                    byte[] decodedBytes = Base64.decode(finalAlbumBase64, Base64.DEFAULT);
                    albumBitmap = BitmapFactory.decodeByteArray(decodedBytes, 0, decodedBytes.length);
                    if (albumBitmap != null) {
                        albumBitmap = getRoundedCornerBitmap(albumBitmap, 16);
                    }
                    Log.d(TAG, "[updateAppWidget] Album bitmap decoded: " + (albumBitmap != null));
                } catch (Exception e) {
                    Log.e(TAG, "[updateAppWidget] Failed to decode album image", e);
                }
            }
            
            if (!finalAvatarBase64.isEmpty()) {
                try {
                    byte[] decodedBytes = Base64.decode(finalAvatarBase64, Base64.DEFAULT);
                    Bitmap rawAvatar = BitmapFactory.decodeByteArray(decodedBytes, 0, decodedBytes.length);
                    if (rawAvatar != null) {
                        avatarBitmap = getCircularBitmap(rawAvatar);
                    }
                    Log.d(TAG, "[updateAppWidget] Avatar bitmap decoded: " + (avatarBitmap != null));
                } catch (Exception e) {
                    Log.e(TAG, "[updateAppWidget] Failed to decode avatar image", e);
                }
            }

            final Bitmap finalAlbum = albumBitmap;
            final Bitmap finalAvatar = avatarBitmap;
            
            mainHandler.post(() -> {
                RemoteViews updatedViews = new RemoteViews(context.getPackageName(), R.layout.widget_album_2x2);
                updatedViews.setOnClickPendingIntent(R.id.widget_album_container, pendingIntent);
                
                if (finalAlbum != null) {
                    updatedViews.setImageViewBitmap(R.id.album_image, finalAlbum);
                    updatedViews.setViewVisibility(R.id.album_image, View.VISIBLE);
                    updatedViews.setViewVisibility(R.id.album_placeholder, View.GONE);
                } else {
                    updatedViews.setViewVisibility(R.id.album_image, View.GONE);
                    updatedViews.setViewVisibility(R.id.album_placeholder, View.VISIBLE);
                }
                
                if (finalAvatar != null) {
                    updatedViews.setImageViewBitmap(R.id.friend_profile_image, finalAvatar);
                    updatedViews.setViewVisibility(R.id.friend_profile_image, View.VISIBLE);
                } else {
                    updatedViews.setViewVisibility(R.id.friend_profile_image, View.GONE);
                }
                
                appWidgetManager.updateAppWidget(appWidgetId, updatedViews);
                
                long elapsed = System.currentTimeMillis() - startTime;
                Log.d(TAG, "[updateAppWidget] COMPLETE - Elapsed: " + elapsed + "ms");
            });
        });
    }

    /**
     * When widget has no shared playlist data, fetch from API and update.
     */
    private static void fetchSharedPlaylistFromApi(Context context, AppWidgetManager appWidgetManager,
            int appWidgetId, SharedPreferences prefs) {
        String apiBaseUrl = prefs.getString("api_base_url", "https://whoami-test-group.gina-park.site/api/");
        String accessToken = prefs.getString("access_token", "");
        String csrftoken = prefs.getString("csrftoken", "");

        if (apiBaseUrl.isEmpty() || accessToken.isEmpty()) {
            Log.w(TAG, "[fetchSharedPlaylist] Missing api_base_url or access_token, skipping");
            return;
        }

        executor.execute(() -> {
            try {
                // Fetch discover feed
                String endpoint = apiBaseUrl + "user/discover/?page=1";
                Log.d(TAG, "[fetchSharedPlaylist] Fetching: " + endpoint);

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
                    Log.w(TAG, "[fetchSharedPlaylist] API returned " + conn.getResponseCode());
                    return;
                }

                StringBuilder sb = new StringBuilder();
                try (BufferedReader reader = new BufferedReader(
                        new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8))) {
                    String line;
                    while ((line = reader.readLine()) != null) sb.append(line);
                }

                JSONObject discover = new JSONObject(sb.toString());
                org.json.JSONArray musicTracks = discover.optJSONArray("music_tracks");
                if (musicTracks == null || musicTracks.length() == 0) {
                    Log.w(TAG, "[fetchSharedPlaylist] No music_tracks in discover response");
                    return;
                }

                // Pick first track
                JSONObject picked = musicTracks.getJSONObject(0);
                String trackId = picked.optString("track_id", "");
                JSONObject user = picked.optJSONObject("user");
                String sharerUsername = user != null ? user.optString("username", "") : "";
                String profileImageUrl = user != null
                        ? (user.optString("profile_image", user.optString("profile_pic", "")))
                        : "";

                Log.d(TAG, "[fetchSharedPlaylist] Picked track: " + trackId + " from " + sharerUsername);

                // Get album image URL from Spotify oEmbed
                String albumImageUrl = null;
                if (!trackId.isEmpty()) {
                    albumImageUrl = fetchAlbumImageUrl(trackId);
                }

                // Download and encode images as base64
                String albumBase64 = "";
                String avatarBase64 = "";

                if (albumImageUrl != null && !albumImageUrl.isEmpty()) {
                    albumBase64 = downloadImageAsBase64(albumImageUrl);
                }
                if (!profileImageUrl.isEmpty()) {
                    avatarBase64 = downloadImageAsBase64(profileImageUrl);
                }

                if (albumBase64.isEmpty() && avatarBase64.isEmpty()) {
                    Log.w(TAG, "[fetchSharedPlaylist] Could not download any images");
                    return;
                }

                // Save to SharedPreferences
                JSONObject sharedTrack = new JSONObject();
                sharedTrack.put("id", picked.optInt("id", 0));
                sharedTrack.put("track_id", trackId);
                sharedTrack.put("sharer_username", sharerUsername);

                String existingJson = prefs.getString("widget_data", "{}");
                JSONObject root = new JSONObject(existingJson);
                root.put("shared_playlist_track", sharedTrack);

                SharedPreferences.Editor editor = prefs.edit();
                editor.putString("widget_data", root.toString());
                if (!albumBase64.isEmpty()) {
                    editor.putString("widget_shared_playlist_album_image_base64", albumBase64);
                }
                if (!avatarBase64.isEmpty()) {
                    editor.putString("widget_shared_playlist_avatar_image_base64", avatarBase64);
                }
                editor.commit();

                Log.d(TAG, "[fetchSharedPlaylist] Saved - albumBase64Len: " + albumBase64.length()
                        + ", avatarBase64Len: " + avatarBase64.length());

                // Re-render widget on main thread
                mainHandler.post(() -> updateAppWidget(context, appWidgetManager, appWidgetId));

            } catch (Exception e) {
                Log.e(TAG, "[fetchSharedPlaylist] Failed", e);
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

    /** Download an image URL and return as base64 string. */
    private static String downloadImageAsBase64(String imageUrl) {
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
            Log.w(TAG, "[downloadImageAsBase64] Failed for " + imageUrl, e);
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
        int size = Math.min(bitmap.getWidth(), bitmap.getHeight());
        Bitmap output = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(output);

        final Paint paint = new Paint();
        final Rect rect = new Rect(0, 0, size, size);

        paint.setAntiAlias(true);
        canvas.drawARGB(0, 0, 0, 0);
        canvas.drawCircle(size / 2f, size / 2f, size / 2f, paint);

        paint.setXfermode(new PorterDuffXfermode(PorterDuff.Mode.SRC_IN));
        canvas.drawBitmap(bitmap, null, rect, paint);

        return output;
    }
}
