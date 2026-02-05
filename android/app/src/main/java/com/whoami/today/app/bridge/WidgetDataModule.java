package com.whoami.today.app.bridge;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

public class WidgetDataModule extends ReactContextBaseJavaModule {
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
            updateWidgets(getReactApplicationContext());
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("ERROR", e.getMessage());
        }
    }

    private void updateWidgets(Context context) {
        // Widget provider will be added later
        // For now, send a broadcast that can be caught when widget is implemented
        Intent intent = new Intent("com.whoami.today.app.WIDGET_UPDATE");
        context.sendBroadcast(intent);
    }
}
