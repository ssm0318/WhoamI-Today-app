package com.whoami.today.app.bridge;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.util.Log;

import com.facebook.react.bridge.Promise;
import com.whoami.today.app.BuildConfig;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableMap;

import org.json.JSONObject;

public class WidgetDataModule extends ReactContextBaseJavaModule {
    private static final String TAG = "WidgetDataModule";
    private static final String PREFS_NAME = "WhoAmIWidgetPrefs";

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

            prefs.edit()
                .putString("csrftoken", csrftoken)
                .putString("access_token", accessToken)
                .apply();

            // Trigger widget update
            updateWidgets(context);

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

            prefs.edit()
                .remove("csrftoken")
                .remove("access_token")
                .apply();

            updateWidgets(context);

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
            prefs.edit()
                .putString("spotify_client_id", id)
                .putString("spotify_client_secret", secret)
                .apply();
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
        try {
            Context context = getReactApplicationContext();
            if (context == null) {
                promise.reject("ERROR", "App context not available");
                return;
            }
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            String existingJson = prefs.getString("widget_data", "{}");
            if (existingJson == null) existingJson = "{}";
            JSONObject root = new JSONObject(existingJson);
            JSONObject myCheckIn = new JSONObject();
            if (checkInData.hasKey("id")) myCheckIn.put("id", checkInData.getInt("id"));
            if (checkInData.hasKey("is_active")) myCheckIn.put("is_active", checkInData.getBoolean("is_active"));
            if (checkInData.hasKey("created_at")) myCheckIn.put("created_at", checkInData.getString("created_at"));
            if (checkInData.hasKey("mood")) myCheckIn.put("mood", checkInData.getString("mood"));
            if (checkInData.hasKey("social_battery")) myCheckIn.put("social_battery", checkInData.getString("social_battery"));
            if (checkInData.hasKey("description")) myCheckIn.put("description", checkInData.getString("description"));
            if (checkInData.hasKey("track_id")) myCheckIn.put("track_id", checkInData.getString("track_id"));
            if (checkInData.hasKey("album_image_url")) myCheckIn.put("album_image_url", checkInData.isNull("album_image_url") ? JSONObject.NULL : checkInData.getString("album_image_url"));
            root.put("my_check_in", myCheckIn);
            prefs.edit().putString("widget_data", root.toString()).apply();
            updateWidgets(context);
            promise.resolve(true);
        } catch (Exception e) {
            Log.e(TAG, "syncMyCheckIn failed", e);
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
            prefs.edit().putString("widget_data", root.toString()).apply();
            updateWidgets(context);
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
            prefs.edit()
                .putString("user_version_type", versionType)
                .apply();
            updateWidgets(context);
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("ERROR", e.getMessage());
        }
    }

    private void updateWidgets(Context context) {
        if (context == null) return;
        try {
            Intent intent = new Intent("com.whoami.today.app.WIDGET_UPDATE");
            context.sendBroadcast(intent);
        } catch (Exception e) {
            Log.e(TAG, "updateWidgets failed", e);
        }
    }
}
