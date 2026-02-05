package com.whoami.today.app.widget;

import android.content.Context;
import android.content.SharedPreferences;

public class SharedPrefsHelper {
    private static final String PREFS_NAME = "WhoAmIWidgetPrefs";

    public static String getAccessToken(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        return prefs.getString("access_token", null);
    }

    public static String getCsrfToken(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        return prefs.getString("csrftoken", null);
    }

    public static boolean isAuthenticated(Context context) {
        String accessToken = getAccessToken(context);
        String csrfToken = getCsrfToken(context);
        return accessToken != null && !accessToken.isEmpty() &&
               csrfToken != null && !csrfToken.isEmpty();
    }

    public static void saveWidgetData(Context context, String jsonData) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit().putString("widget_data", jsonData).apply();
    }

    public static String getWidgetData(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        return prefs.getString("widget_data", null);
    }
}
