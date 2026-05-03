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
    public void syncMyCheckIn(ReadableMap checkInData, String albumImageBase64, Promise promise) {
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
            if (checkInData.hasKey("mood") && !checkInData.isNull("mood")) {
                String mood;
                com.facebook.react.bridge.ReadableType moodType = checkInData.getType("mood");
                if (moodType == com.facebook.react.bridge.ReadableType.Array) {
                    com.facebook.react.bridge.ReadableArray arr = checkInData.getArray("mood");
                    if (arr != null && arr.size() > 0) {
                        int idx = (int) (Math.random() * arr.size());
                        mood = arr.getString(idx);
                    } else {
                        mood = "";
                    }
                } else {
                    mood = checkInData.getString("mood");
                }
                myCheckIn.put("mood", mood != null ? mood : "");
                Log.d(TAG, "[syncMyCheckIn] mood: " + mood);
            }
            if (checkInData.hasKey("social_battery")) {
                String socialBattery = checkInData.isNull("social_battery") ? null : checkInData.getString("social_battery");
                myCheckIn.put("social_battery", socialBattery != null ? socialBattery : JSONObject.NULL);
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

            SharedPreferences.Editor editor = prefs.edit();
            editor.putString("widget_data", finalJson);

            // Store album image base64 if provided
            if (albumImageBase64 != null && !albumImageBase64.isEmpty()) {
                editor.putString("widget_checkin_album_image_base64", albumImageBase64);
                Log.d(TAG, "[syncMyCheckIn] Album image base64 stored: " + albumImageBase64.length() + " chars");
            } else {
                editor.remove("widget_checkin_album_image_base64");
            }

            boolean success = editor.commit();
            
            Log.d(TAG, "[syncMyCheckIn] Data saved to SharedPreferences with commit(): " + success);

            updateCheckinWidget(context);
            
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
            updateCheckinWidget(context);
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void syncApiBaseUrl(String url, Promise promise) {
        try {
            Context context = getReactApplicationContext();
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            boolean success = prefs.edit()
                .putString("api_base_url", url)
                .commit();
            Log.d(TAG, "[syncApiBaseUrl] API base URL saved: " + url + ", commit: " + success);
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

            updateAlbumWidget(context);
            
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

            updateAlbumWidget(context);
            
            promise.resolve(true);
        } catch (Exception e) {
            Log.e(TAG, "[clearSharedPlaylistTrack] FAILED", e);
            promise.reject("ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void syncFriendUpdate(ReadableMap payload, String profileImageBase64, String contentImageBase64, Promise promise) {
        long startTime = System.currentTimeMillis();
        try {
            Context context = getReactApplicationContext();
            if (context == null) {
                Log.e(TAG, "[syncFriendUpdate] App context not available");
                promise.reject("ERROR", "App context not available");
                return;
            }

            String kind = payload.hasKey("kind") ? payload.getString("kind") : null;
            Log.d(TAG, "[syncFriendUpdate] START kind=" + kind);

            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            String existingJson = prefs.getString("widget_data", "{}");
            if (existingJson == null) existingJson = "{}";

            JSONObject root = new JSONObject(existingJson);
            JSONObject friendUpdate = new JSONObject();
            friendUpdate.put("kind", kind);

            if (payload.hasKey("friend")) {
                ReadableMap friend = payload.getMap("friend");
                JSONObject friendJson = new JSONObject();
                if (friend != null && friend.hasKey("username")) {
                    friendJson.put("username", friend.getString("username"));
                }
                friendUpdate.put("friend", friendJson);
            }

            if ("post".equals(kind) && payload.hasKey("post")) {
                ReadableMap post = payload.getMap("post");
                JSONObject postJson = new JSONObject();
                if (post != null) {
                    if (post.hasKey("id")) postJson.put("id", post.getInt("id"));
                    if (post.hasKey("content")) postJson.put("content", post.getString("content"));
                    if (post.hasKey("has_image")) postJson.put("has_image", post.getBoolean("has_image"));
                }
                friendUpdate.put("post", postJson);
            } else if ("checkin".equals(kind) && payload.hasKey("checkin")) {
                ReadableMap checkin = payload.getMap("checkin");
                JSONObject checkinJson = new JSONObject();
                if (checkin != null) {
                    if (checkin.hasKey("variation")) checkinJson.put("variation", checkin.getString("variation"));
                    if (checkin.hasKey("mood") && !checkin.isNull("mood")) checkinJson.put("mood", checkin.getString("mood"));
                    if (checkin.hasKey("social_battery") && !checkin.isNull("social_battery")) checkinJson.put("social_battery", checkin.getString("social_battery"));
                    if (checkin.hasKey("description") && !checkin.isNull("description")) checkinJson.put("description", checkin.getString("description"));
                    if (checkin.hasKey("track_id") && !checkin.isNull("track_id")) checkinJson.put("track_id", checkin.getString("track_id"));
                }
                friendUpdate.put("checkin", checkinJson);
            }

            root.put("friend_update", friendUpdate);
            // Remove legacy key if present
            root.remove("friend_post");

            SharedPreferences.Editor editor = prefs.edit();
            editor.putString("widget_data", root.toString());

            if (contentImageBase64 != null && !contentImageBase64.isEmpty()) {
                editor.putString("widget_friend_update_content_image", contentImageBase64);
            } else {
                editor.remove("widget_friend_update_content_image");
            }
            if (profileImageBase64 != null && !profileImageBase64.isEmpty()) {
                editor.putString("widget_friend_update_profile_image", profileImageBase64);
            } else {
                editor.remove("widget_friend_update_profile_image");
            }
            // Clean up legacy keys
            editor.remove("widget_friend_post_image_base64");
            editor.remove("widget_friend_post_author_image_base64");

            boolean success = editor.commit();
            long elapsed = System.currentTimeMillis() - startTime;
            Log.d(TAG, "[syncFriendUpdate] saved=" + success + " elapsed=" + elapsed + "ms");

            updatePhotoWidget(context);
            promise.resolve(true);
        } catch (Exception e) {
            long elapsed = System.currentTimeMillis() - startTime;
            Log.e(TAG, "[syncFriendUpdate] FAILED after " + elapsed + "ms", e);
            promise.reject("ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void clearFriendUpdate(Promise promise) {
        try {
            Context context = getReactApplicationContext();
            if (context == null) {
                promise.reject("ERROR", "App context not available");
                return;
            }

            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            String existingJson = prefs.getString("widget_data", "{}");
            JSONObject root = new JSONObject(existingJson);
            root.remove("friend_update");
            root.remove("friend_post");

            boolean success = prefs.edit()
                .putString("widget_data", root.toString())
                .remove("widget_friend_update_content_image")
                .remove("widget_friend_update_profile_image")
                .remove("widget_friend_post_image_base64")
                .remove("widget_friend_post_author_image_base64")
                .commit();

            Log.d(TAG, "[clearFriendUpdate] cleared=" + success);
            updatePhotoWidget(context);
            promise.resolve(true);
        } catch (Exception e) {
            Log.e(TAG, "[clearFriendUpdate] FAILED", e);
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
                if (widgetData.has("friend_update")) {
                    friendPostJson = widgetData.getJSONObject("friend_update").toString();
                }
            } catch (Exception e) {
                Log.e(TAG, "getWidgetDiagnostics: failed to parse friend_update", e);
            }
            diagnostics.put("friendUpdateJson", friendPostJson);
            diagnostics.put("friendUpdateJsonLen", friendPostJson.length());

            String contentImageBase64 = prefs.getString("widget_friend_update_content_image", "");
            String profileImageBase64 = prefs.getString("widget_friend_update_profile_image", "");
            diagnostics.put("friendUpdateContentImageLen", contentImageBase64 != null ? contentImageBase64.length() : 0);
            diagnostics.put("friendUpdateProfileImageLen", profileImageBase64 != null ? profileImageBase64.length() : 0);
            
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

    /** Update only the specified widget provider class. */
    private void updateWidget(Context context, Class<?> providerClass) {
        if (context == null) return;
        try {
            AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
            ComponentName provider = new ComponentName(context, providerClass);
            int[] ids = appWidgetManager.getAppWidgetIds(provider);
            if (ids.length > 0) {
                Intent intent = new Intent(context, providerClass);
                intent.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
                intent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids);
                context.sendBroadcast(intent);
            }
        } catch (Exception e) {
            Log.e(TAG, "updateWidget failed for " + providerClass.getSimpleName(), e);
        }
    }

    /** Update all widget types. Used for auth token changes. */
    private void updateWidgets(Context context) {
        if (context == null) return;
        updateWidget(context, com.whoami.today.app.widget.CheckinWidgetProvider.class);
        updateWidget(context, com.whoami.today.app.widget.AlbumCoverWidgetProvider.class);
        updateWidget(context, com.whoami.today.app.widget.PhotoWidgetProvider.class);
        Log.d(TAG, "[updateWidgets] All widget update broadcasts sent");
    }

    private void updateWidgetsWithFollowUp(Context context) {
        if (context == null) return;
        updateWidgets(context);
        mainHandler.postDelayed(() -> {
            updateWidgets(context);
        }, 800);
    }

    /** Update only CheckinWidget. */
    private void updateCheckinWidget(Context context) {
        updateWidget(context, com.whoami.today.app.widget.CheckinWidgetProvider.class);
    }

    /** Update only AlbumCoverWidget. */
    private void updateAlbumWidget(Context context) {
        updateWidget(context, com.whoami.today.app.widget.AlbumCoverWidgetProvider.class);
    }

    /** Update only PhotoWidget (friend post). */
    private void updatePhotoWidget(Context context) {
        updateWidget(context, com.whoami.today.app.widget.PhotoWidgetProvider.class);
    }
}
