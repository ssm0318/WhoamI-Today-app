package com.whoami.today.app.bridge;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import com.facebook.react.bridge.Promise;
import com.whoami.today.app.BuildConfig;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableMap;

import org.json.JSONObject;
import android.util.Base64;

public class WidgetDataModule extends ReactContextBaseJavaModule {
    private static final String TAG = "WidgetDataModule";
    private static final String PREFS_NAME = "WhoAmIWidgetPrefs";
    private static final Handler mainHandler = new Handler(Looper.getMainLooper());

    public WidgetDataModule(ReactApplicationContext context) {
        super(context);
    }

    @Override
    public String getName() {
        return "WidgetDataModule";
    }

    @ReactMethod
    public void syncAuthTokens(String csrftoken, String accessToken, Promise promise) {
        try {
            Context context = getReactApplicationContext();
            SharedPreferences prefs = context.getSharedPreferences(
                PREFS_NAME, Context.MODE_PRIVATE);

            boolean success = prefs.edit()
                .putString("csrftoken", csrftoken)
                .putString("access_token", accessToken)
                .commit();

            Log.d(TAG, "[syncAuthTokens] Tokens saved with commit(): " + success);

            // Trigger widget update with follow-up
            updateWidgetsWithFollowUp(context);

            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void clearAuthTokens(Promise promise) {
        try {
            Context context = getReactApplicationContext();
            SharedPreferences prefs = context.getSharedPreferences(
                PREFS_NAME, Context.MODE_PRIVATE);

            boolean success = prefs.edit()
                .remove("csrftoken")
                .remove("access_token")
                .commit();

            Log.d(TAG, "[clearAuthTokens] Tokens cleared with commit(): " + success);

            updateWidgetsWithFollowUp(context);

            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void refreshWidgets(Promise promise) {
        try {
            Context context = getReactApplicationContext();
            if (context == null) {
                promise.reject("ERROR", "App context not available");
                return;
            }
            updateWidgets(context);
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void syncSpotifyCredentials(String clientId, String clientSecret, Promise promise) {
        try {
            Context context = getReactApplicationContext();
            String id = clientId != null ? clientId.trim() : "";
            String secret = clientSecret != null ? clientSecret.trim() : "";
            // Fallback: if JS Config is empty (e.g. react-native-config on Android), use BuildConfig from .env
            if (id.isEmpty() || secret.isEmpty()) {
                String fromBuildConfigId = getBuildConfigString("SPOTIFY_CLIENT_ID");
                String fromBuildConfigSecret = getBuildConfigString("SPOTIFY_CLIENT_SECRET");
                if (fromBuildConfigId != null && !fromBuildConfigId.isEmpty()
                        && fromBuildConfigSecret != null && !fromBuildConfigSecret.isEmpty()) {
                    id = fromBuildConfigId;
                    secret = fromBuildConfigSecret;
                    Log.d(TAG, "syncSpotifyCredentials: using BuildConfig (clientId length=" + id.length() + " clientSecret length=" + secret.length() + ")");
                } else {
                    Log.w(TAG, "syncSpotifyCredentials: one or both empty - check .env / Config.SPOTIFY_* on Android");
                }
            }
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            boolean success = prefs.edit()
                .putString("spotify_client_id", id)
                .putString("spotify_client_secret", secret)
                .commit();
            Log.d(TAG, "[syncSpotifyCredentials] Spotify credentials saved with commit(): " + success);
            updateWidgets(context);
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("ERROR", e.getMessage());
        }
    }

    /** Read a string field from BuildConfig (injected from .env in build.gradle). */
    private static String getBuildConfigString(String fieldName) {
        try {
            java.lang.reflect.Field f = BuildConfig.class.getDeclaredField(fieldName);
            f.setAccessible(true);
            Object v = f.get(null);
            return v != null ? v.toString().trim() : null;
        } catch (Exception e) {
            return null;
        }
    }

    @ReactMethod
    public void syncMyCheckIn(ReadableMap checkInData, Promise promise) {
        long startTime = System.currentTimeMillis();
        try {
            Context context = getReactApplicationContext();
            if (context == null) {
                Log.e(TAG, "[syncMyCheckIn] App context not available");
                promise.reject("ERROR", "App context not available");
                return;
            }
            
            Log.d(TAG, "[syncMyCheckIn] START - Syncing check-in data to widget");
            
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            String existingJson = prefs.getString("widget_data", "{}");
            if (existingJson == null) existingJson = "{}";
            
            Log.d(TAG, "[syncMyCheckIn] Existing widget_data: " + existingJson);
            
            JSONObject root = new JSONObject(existingJson);
            JSONObject myCheckIn = new JSONObject();
            
            if (checkInData.hasKey("id")) {
                int id = checkInData.getInt("id");
                myCheckIn.put("id", id);
                Log.d(TAG, "[syncMyCheckIn] id: " + id);
            }
            if (checkInData.hasKey("is_active")) {
                boolean isActive = checkInData.getBoolean("is_active");
                myCheckIn.put("is_active", isActive);
                Log.d(TAG, "[syncMyCheckIn] is_active: " + isActive);
            }
            if (checkInData.hasKey("created_at")) {
                String createdAt = checkInData.getString("created_at");
                myCheckIn.put("created_at", createdAt);
                Log.d(TAG, "[syncMyCheckIn] created_at: " + createdAt);
            }
            if (checkInData.hasKey("mood")) {
                String mood = checkInData.getString("mood");
                myCheckIn.put("mood", mood);
                Log.d(TAG, "[syncMyCheckIn] mood: " + mood);
            }
            if (checkInData.hasKey("social_battery")) {
                String socialBattery = checkInData.getString("social_battery");
                myCheckIn.put("social_battery", socialBattery);
                Log.d(TAG, "[syncMyCheckIn] social_battery: " + socialBattery);
            }
            if (checkInData.hasKey("description")) {
                String description = checkInData.getString("description");
                myCheckIn.put("description", description);
                Log.d(TAG, "[syncMyCheckIn] description length: " + (description != null ? description.length() : 0));
            }
            if (checkInData.hasKey("track_id")) {
                String trackId = checkInData.getString("track_id");
                myCheckIn.put("track_id", trackId);
                Log.d(TAG, "[syncMyCheckIn] track_id: " + trackId);
            }
            if (checkInData.hasKey("album_image_url")) {
                String albumImageUrl = checkInData.isNull("album_image_url") ? null : checkInData.getString("album_image_url");
                myCheckIn.put("album_image_url", albumImageUrl != null ? albumImageUrl : JSONObject.NULL);
                Log.d(TAG, "[syncMyCheckIn] album_image_url: " + albumImageUrl);
            }
            
            root.put("my_check_in", myCheckIn);
            String finalJson = root.toString();
            
            Log.d(TAG, "[syncMyCheckIn] Final widget_data JSON to save: " + finalJson);
            
            boolean success = prefs.edit().putString("widget_data", finalJson).commit();
            
            Log.d(TAG, "[syncMyCheckIn] Data saved to SharedPreferences with commit(): " + success);
            
            updateWidgetsWithFollowUp(context);
            
            long elapsed = System.currentTimeMillis() - startTime;
            Log.d(TAG, "[syncMyCheckIn] COMPLETE - Elapsed: " + elapsed + "ms");
            
            promise.resolve(true);
        } catch (Exception e) {
            long elapsed = System.currentTimeMillis() - startTime;
            Log.e(TAG, "[syncMyCheckIn] FAILED after " + elapsed + "ms", e);
            promise.reject("ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void clearMyCheckIn(Promise promise) {
        try {
            Context context = getReactApplicationContext();
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            String existingJson = prefs.getString("widget_data", "{}");
            JSONObject root = new JSONObject(existingJson);
            root.remove("my_check_in");
            boolean success = prefs.edit().putString("widget_data", root.toString()).commit();
            Log.d(TAG, "[clearMyCheckIn] my_check_in cleared with commit(): " + success);
            updateWidgetsWithFollowUp(context);
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void syncVersionType(String versionType, Promise promise) {
        try {
            Context context = getReactApplicationContext();
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            boolean success = prefs.edit()
                .putString("user_version_type", versionType)
                .commit();
            Log.d(TAG, "[syncVersionType] Version type '" + versionType + "' saved with commit(): " + success);
            updateWidgetsWithFollowUp(context);
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void syncSharedPlaylistTrack(ReadableMap trackData, String albumImageBase64, String avatarImageBase64, Promise promise) {
        long startTime = System.currentTimeMillis();
        try {
            Context context = getReactApplicationContext();
            if (context == null) {
                Log.e(TAG, "[syncSharedPlaylistTrack] App context not available");
                promise.reject("ERROR", "App context not available");
                return;
            }
            
            Log.d(TAG, "[syncSharedPlaylistTrack] START - Syncing shared playlist track to widget");
            
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            String existingJson = prefs.getString("widget_data", "{}");
            if (existingJson == null) existingJson = "{}";
            
            JSONObject root = new JSONObject(existingJson);
            JSONObject sharedTrack = new JSONObject();
            
            if (trackData.hasKey("id")) {
                int id = trackData.getInt("id");
                sharedTrack.put("id", id);
                Log.d(TAG, "[syncSharedPlaylistTrack] id: " + id);
            }
            if (trackData.hasKey("track_id")) {
                String trackId = trackData.getString("track_id");
                sharedTrack.put("track_id", trackId);
                Log.d(TAG, "[syncSharedPlaylistTrack] track_id: " + trackId);
            }
            if (trackData.hasKey("album_image_url")) {
                String albumImageUrl = trackData.isNull("album_image_url") ? null : trackData.getString("album_image_url");
                sharedTrack.put("album_image_url", albumImageUrl != null ? albumImageUrl : JSONObject.NULL);
                Log.d(TAG, "[syncSharedPlaylistTrack] album_image_url: " + albumImageUrl);
            }
            if (trackData.hasKey("sharer_username")) {
                String sharerUsername = trackData.getString("sharer_username");
                sharedTrack.put("sharer_username", sharerUsername);
                Log.d(TAG, "[syncSharedPlaylistTrack] sharer_username: " + sharerUsername);
            }
            if (trackData.hasKey("sharer_profile_image_url")) {
                String sharerProfileImageUrl = trackData.isNull("sharer_profile_image_url") ? null : trackData.getString("sharer_profile_image_url");
                sharedTrack.put("sharer_profile_image_url", sharerProfileImageUrl != null ? sharerProfileImageUrl : JSONObject.NULL);
                Log.d(TAG, "[syncSharedPlaylistTrack] sharer_profile_image_url: " + sharerProfileImageUrl);
            }
            
            root.put("shared_playlist_track", sharedTrack);
            
            SharedPreferences.Editor editor = prefs.edit();
            editor.putString("widget_data", root.toString());
            
            // Store album image as base64 string (Android doesn't support byte arrays in SharedPreferences easily)
            if (albumImageBase64 != null && !albumImageBase64.isEmpty()) {
                editor.putString("widget_shared_playlist_album_image_base64", albumImageBase64);
                Log.d(TAG, "[syncSharedPlaylistTrack] Album image base64 length: " + albumImageBase64.length());
            } else {
                editor.remove("widget_shared_playlist_album_image_base64");
                Log.d(TAG, "[syncSharedPlaylistTrack] No album image provided");
            }
            
            // Store avatar image as base64 string
            if (avatarImageBase64 != null && !avatarImageBase64.isEmpty()) {
                editor.putString("widget_shared_playlist_avatar_image_base64", avatarImageBase64);
                Log.d(TAG, "[syncSharedPlaylistTrack] Avatar image base64 length: " + avatarImageBase64.length());
            } else {
                editor.remove("widget_shared_playlist_avatar_image_base64");
                Log.d(TAG, "[syncSharedPlaylistTrack] No avatar image provided");
            }
            
            boolean success = editor.commit();
            
            long elapsed = System.currentTimeMillis() - startTime;
            Log.d(TAG, "[syncSharedPlaylistTrack] Data saved with commit(): " + success + ", Elapsed: " + elapsed + "ms");
            
            updateWidgetsWithFollowUp(context);
            
            promise.resolve(true);
        } catch (Exception e) {
            long elapsed = System.currentTimeMillis() - startTime;
            Log.e(TAG, "[syncSharedPlaylistTrack] FAILED after " + elapsed + "ms", e);
            promise.reject("ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void clearSharedPlaylistTrack(Promise promise) {
        try {
            Context context = getReactApplicationContext();
            if (context == null) {
                Log.e(TAG, "[clearSharedPlaylistTrack] App context not available");
                promise.reject("ERROR", "App context not available");
                return;
            }
            
            Log.d(TAG, "[clearSharedPlaylistTrack] Clearing shared playlist track from widget");
            
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            String existingJson = prefs.getString("widget_data", "{}");
            JSONObject root = new JSONObject(existingJson);
            root.remove("shared_playlist_track");
            
            boolean success = prefs.edit()
                .putString("widget_data", root.toString())
                .remove("widget_shared_playlist_album_image_base64")
                .remove("widget_shared_playlist_avatar_image_base64")
                .commit();
            
            Log.d(TAG, "[clearSharedPlaylistTrack] Cleared with commit(): " + success);
            
            updateWidgetsWithFollowUp(context);
            
            promise.resolve(true);
        } catch (Exception e) {
            Log.e(TAG, "[clearSharedPlaylistTrack] FAILED", e);
            promise.reject("ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void syncFriendPost(ReadableMap postData, String authorImageBase64, String postImageBase64, Promise promise) {
        long startTime = System.currentTimeMillis();
        try {
            Context context = getReactApplicationContext();
            if (context == null) {
                Log.e(TAG, "[syncFriendPost] App context not available");
                promise.reject("ERROR", "App context not available");
                return;
            }
            
            Log.d(TAG, "[syncFriendPost] START - Syncing friend post to widget");
            
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            String existingJson = prefs.getString("widget_data", "{}");
            if (existingJson == null) existingJson = "{}";
            
            JSONObject root = new JSONObject(existingJson);
            JSONObject friendPost = new JSONObject();
            
            if (postData.hasKey("id")) {
                int id = postData.getInt("id");
                friendPost.put("id", id);
                Log.d(TAG, "[syncFriendPost] id: " + id);
            }
            if (postData.hasKey("type")) {
                String type = postData.getString("type");
                friendPost.put("type", type);
                Log.d(TAG, "[syncFriendPost] type: " + type);
            }
            if (postData.hasKey("content")) {
                String content = postData.getString("content");
                friendPost.put("content", content);
                Log.d(TAG, "[syncFriendPost] content length: " + (content != null ? content.length() : 0));
            }
            if (postData.hasKey("images")) {
                // Convert ReadableArray to JSONArray
                com.facebook.react.bridge.ReadableArray imagesArray = postData.getArray("images");
                org.json.JSONArray jsonImages = new org.json.JSONArray();
                if (imagesArray != null) {
                    for (int i = 0; i < imagesArray.size(); i++) {
                        jsonImages.put(imagesArray.getString(i));
                    }
                }
                friendPost.put("images", jsonImages);
                Log.d(TAG, "[syncFriendPost] images count: " + jsonImages.length());
            }
            if (postData.hasKey("current_user_read")) {
                boolean currentUserRead = postData.getBoolean("current_user_read");
                friendPost.put("current_user_read", currentUserRead);
                Log.d(TAG, "[syncFriendPost] current_user_read: " + currentUserRead);
            }
            if (postData.hasKey("author_username")) {
                String authorUsername = postData.getString("author_username");
                friendPost.put("author_username", authorUsername);
                Log.d(TAG, "[syncFriendPost] author_username: " + authorUsername);
            }
            
            root.put("friend_post", friendPost);
            
            SharedPreferences.Editor editor = prefs.edit();
            editor.putString("widget_data", root.toString());
            
            // Store post image as base64 string
            if (postImageBase64 != null && !postImageBase64.isEmpty()) {
                editor.putString("widget_friend_post_image_base64", postImageBase64);
                Log.d(TAG, "[syncFriendPost] Post image base64 length: " + postImageBase64.length());
            } else {
                editor.remove("widget_friend_post_image_base64");
                Log.d(TAG, "[syncFriendPost] No post image provided");
            }
            
            // Store author image as base64 string
            if (authorImageBase64 != null && !authorImageBase64.isEmpty()) {
                editor.putString("widget_friend_post_author_image_base64", authorImageBase64);
                Log.d(TAG, "[syncFriendPost] Author image base64 length: " + authorImageBase64.length());
            } else {
                editor.remove("widget_friend_post_author_image_base64");
                Log.d(TAG, "[syncFriendPost] No author image provided");
            }
            
            boolean success = editor.commit();
            
            long elapsed = System.currentTimeMillis() - startTime;
            Log.d(TAG, "[syncFriendPost] Data saved with commit(): " + success + ", Elapsed: " + elapsed + "ms");
            
            updateWidgetsWithFollowUp(context);
            
            promise.resolve(true);
        } catch (Exception e) {
            long elapsed = System.currentTimeMillis() - startTime;
            Log.e(TAG, "[syncFriendPost] FAILED after " + elapsed + "ms", e);
            promise.reject("ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void clearFriendPost(Promise promise) {
        try {
            Context context = getReactApplicationContext();
            if (context == null) {
                Log.e(TAG, "[clearFriendPost] App context not available");
                promise.reject("ERROR", "App context not available");
                return;
            }
            
            Log.d(TAG, "[clearFriendPost] Clearing friend post from widget");
            
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            String existingJson = prefs.getString("widget_data", "{}");
            JSONObject root = new JSONObject(existingJson);
            root.remove("friend_post");
            
            boolean success = prefs.edit()
                .putString("widget_data", root.toString())
                .remove("widget_friend_post_image_base64")
                .remove("widget_friend_post_author_image_base64")
                .commit();
            
            Log.d(TAG, "[clearFriendPost] Cleared with commit(): " + success);
            
            updateWidgetsWithFollowUp(context);
            
            promise.resolve(true);
        } catch (Exception e) {
            Log.e(TAG, "[clearFriendPost] FAILED", e);
            promise.reject("ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void getWidgetDiagnostics(Promise promise) {
        try {
            Context context = getReactApplicationContext();
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            
            org.json.JSONObject diagnostics = new org.json.JSONObject();
            
            // Auth tokens
            String csrftoken = prefs.getString("csrftoken", "");
            String accessToken = prefs.getString("access_token", "");
            diagnostics.put("csrftokenLen", csrftoken != null ? csrftoken.length() : 0);
            diagnostics.put("accessTokenLen", accessToken != null ? accessToken.length() : 0);
            
            // Version type
            String versionType = prefs.getString("user_version_type", "");
            diagnostics.put("userVersionType", versionType);
            
            // Widget data
            String widgetDataJson = prefs.getString("widget_data", "{}");
            diagnostics.put("widgetDataJson", widgetDataJson);
            diagnostics.put("widgetDataJsonLen", widgetDataJson != null ? widgetDataJson.length() : 0);
            
            // Parse my_check_in
            boolean myCheckInPresent = false;
            boolean myCheckInDecodeOk = false;
            String lastSeenMood = "";
            String lastSeenBattery = "";
            String lastSeenDescription = "";
            String lastSeenTrackId = "";
            String lastSeenAlbumImageUrl = "";
            
            try {
                JSONObject widgetData = new JSONObject(widgetDataJson);
                if (widgetData.has("my_check_in")) {
                    myCheckInPresent = true;
                    JSONObject myCheckIn = widgetData.getJSONObject("my_check_in");
                    myCheckInDecodeOk = true;
                    
                    lastSeenMood = myCheckIn.optString("mood", "");
                    lastSeenBattery = myCheckIn.optString("social_battery", "");
                    lastSeenDescription = myCheckIn.optString("description", "");
                    lastSeenTrackId = myCheckIn.optString("track_id", "");
                    lastSeenAlbumImageUrl = myCheckIn.optString("album_image_url", "");
                }
            } catch (Exception e) {
                Log.e(TAG, "getWidgetDiagnostics: failed to parse widget_data", e);
            }
            
            diagnostics.put("myCheckInRawPresent", myCheckInPresent);
            diagnostics.put("myCheckInDecodeOk", myCheckInDecodeOk);
            diagnostics.put("lastSeenMood", lastSeenMood);
            diagnostics.put("lastSeenBattery", lastSeenBattery);
            diagnostics.put("lastSeenDescription", lastSeenDescription);
            diagnostics.put("lastSeenTrackId", lastSeenTrackId);
            diagnostics.put("lastSeenAlbumImageUrl", lastSeenAlbumImageUrl);
            
            // Shared playlist track
            String sharedPlaylistJson = "";
            try {
                JSONObject widgetData = new JSONObject(widgetDataJson);
                if (widgetData.has("shared_playlist_track")) {
                    sharedPlaylistJson = widgetData.getJSONObject("shared_playlist_track").toString();
                }
            } catch (Exception e) {
                Log.e(TAG, "getWidgetDiagnostics: failed to parse shared_playlist_track", e);
            }
            diagnostics.put("sharedPlaylistJson", sharedPlaylistJson);
            diagnostics.put("sharedPlaylistJsonLen", sharedPlaylistJson.length());
            
            String albumImageBase64 = prefs.getString("widget_shared_playlist_album_image_base64", "");
            String avatarImageBase64 = prefs.getString("widget_shared_playlist_avatar_image_base64", "");
            diagnostics.put("sharedPlaylistAlbumImageLen", albumImageBase64 != null ? albumImageBase64.length() : 0);
            diagnostics.put("sharedPlaylistAvatarImageLen", avatarImageBase64 != null ? avatarImageBase64.length() : 0);
            
            // Friend post
            String friendPostJson = "";
            try {
                JSONObject widgetData = new JSONObject(widgetDataJson);
                if (widgetData.has("friend_post")) {
                    friendPostJson = widgetData.getJSONObject("friend_post").toString();
                }
            } catch (Exception e) {
                Log.e(TAG, "getWidgetDiagnostics: failed to parse friend_post", e);
            }
            diagnostics.put("friendPostJson", friendPostJson);
            diagnostics.put("friendPostJsonLen", friendPostJson.length());
            
            String postImageBase64 = prefs.getString("widget_friend_post_image_base64", "");
            String authorImageBase64 = prefs.getString("widget_friend_post_author_image_base64", "");
            diagnostics.put("friendPostImageLen", postImageBase64 != null ? postImageBase64.length() : 0);
            diagnostics.put("friendPostAuthorImageLen", authorImageBase64 != null ? authorImageBase64.length() : 0);
            
            // Spotify credentials
            String spotifyClientId = prefs.getString("spotify_client_id", "");
            String spotifyClientSecret = prefs.getString("spotify_client_secret", "");
            diagnostics.put("spotifyClientIdLen", spotifyClientId != null ? spotifyClientId.length() : 0);
            diagnostics.put("spotifyClientSecretLen", spotifyClientSecret != null ? spotifyClientSecret.length() : 0);
            
            // Timestamp
            diagnostics.put("diagnosticsTimestamp", System.currentTimeMillis());
            
            // All prefs keys for debugging
            java.util.Map<String, ?> allPrefs = prefs.getAll();
            org.json.JSONArray allKeys = new org.json.JSONArray();
            for (String key : allPrefs.keySet()) {
                allKeys.put(key);
            }
            diagnostics.put("allPrefsKeys", allKeys);
            
            Log.d(TAG, "getWidgetDiagnostics: " + diagnostics.toString());
            promise.resolve(diagnostics.toString());
        } catch (Exception e) {
            Log.e(TAG, "getWidgetDiagnostics failed", e);
            promise.reject("ERROR", e.getMessage());
        }
    }

    private void updateWidgets(Context context) {
        if (context == null) return;
        try {
            AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
            
            // Update CheckinWidget
            ComponentName checkinProvider = new ComponentName(context, com.whoami.today.app.widget.CheckinWidgetProvider.class);
            int[] checkinIds = appWidgetManager.getAppWidgetIds(checkinProvider);
            if (checkinIds.length > 0) {
                Log.d(TAG, "[updateWidgets] Triggering update for " + checkinIds.length + " CheckinWidget(s)");
                Intent checkinIntent = new Intent(context, com.whoami.today.app.widget.CheckinWidgetProvider.class);
                checkinIntent.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
                checkinIntent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, checkinIds);
                context.sendBroadcast(checkinIntent);
            }
            
            // Update AlbumCoverWidget
            ComponentName albumProvider = new ComponentName(context, com.whoami.today.app.widget.AlbumCoverWidgetProvider.class);
            int[] albumIds = appWidgetManager.getAppWidgetIds(albumProvider);
            if (albumIds.length > 0) {
                Log.d(TAG, "[updateWidgets] Triggering update for " + albumIds.length + " AlbumCoverWidget(s)");
                Intent albumIntent = new Intent(context, com.whoami.today.app.widget.AlbumCoverWidgetProvider.class);
                albumIntent.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
                albumIntent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, albumIds);
                context.sendBroadcast(albumIntent);
            }
            
            // Update PhotoWidget
            ComponentName photoProvider = new ComponentName(context, com.whoami.today.app.widget.PhotoWidgetProvider.class);
            int[] photoIds = appWidgetManager.getAppWidgetIds(photoProvider);
            if (photoIds.length > 0) {
                Log.d(TAG, "[updateWidgets] Triggering update for " + photoIds.length + " PhotoWidget(s)");
                Intent photoIntent = new Intent(context, com.whoami.today.app.widget.PhotoWidgetProvider.class);
                photoIntent.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
                photoIntent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, photoIds);
                context.sendBroadcast(photoIntent);
            }
            
            Log.d(TAG, "[updateWidgets] Widget update broadcasts sent");
        } catch (Exception e) {
            Log.e(TAG, "updateWidgets failed", e);
        }
    }

    private void updateWidgetsWithFollowUp(Context context) {
        if (context == null) return;
        
        updateWidgets(context);
        
        // iOS-style delayed retry: send another broadcast after 800ms to ensure
        // SharedPreferences data has been fully written to disk
        mainHandler.postDelayed(() -> {
            Log.d(TAG, "[updateWidgetsWithFollowUp] Sending delayed follow-up widget update broadcast");
            updateWidgets(context);
        }, 800);
    }
}
