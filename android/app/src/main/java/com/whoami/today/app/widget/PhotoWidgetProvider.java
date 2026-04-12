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

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class PhotoWidgetProvider extends AppWidgetProvider {
    private static final String TAG = "FriendPostWidget";
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
                    fallback.setTextViewText(R.id.signin_description, "Sign in to see the latest updates from your friends");
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
                new android.content.ComponentName(context, PhotoWidgetProvider.class));
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

        Log.d(TAG, "[updateAppWidget] Auth state - isAuthenticated: " + isAuthenticated + 
                   ", versionType: " + versionType);

        RemoteViews views;

        if (!isAuthenticated) {
            views = new RemoteViews(context.getPackageName(), R.layout.widget_signin);
            Intent loginIntent = new Intent(Intent.ACTION_VIEW, Uri.parse("whoami://app/login"));
            PendingIntent pendingIntent = PendingIntent.getActivity(
                context, 0, loginIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            views.setOnClickPendingIntent(R.id.signin_button, pendingIntent);
            views.setTextViewText(R.id.signin_description, "Sign in to see the latest updates from your friends");
            appWidgetManager.updateAppWidget(appWidgetId, views);
            Log.d(TAG, "[updateAppWidget] Showing sign-in view");
            return;
        }
        
        if (isDefaultVersion) {
            views = new RemoteViews(context.getPackageName(), R.layout.widget_photo_2x2);
            views.setViewVisibility(R.id.friend_post_image, View.GONE);
            views.setViewVisibility(R.id.friend_post_text_container, View.GONE);
            views.setViewVisibility(R.id.friend_post_empty, View.GONE);
            views.setViewVisibility(R.id.friend_post_author_image, View.GONE);
            appWidgetManager.updateAppWidget(appWidgetId, views);
            Log.d(TAG, "[updateAppWidget] Default version - empty widget");
            return;
        }

        // Read friend post data
        String widgetDataJson = prefs.getString("widget_data", "{}");
        String postImageBase64 = prefs.getString("widget_friend_post_image_base64", "");
        String authorImageBase64 = prefs.getString("widget_friend_post_author_image_base64", "");
        
        String postContent = null;
        boolean hasImage = false;
        
        try {
            JSONObject widgetData = new JSONObject(widgetDataJson);
            if (widgetData.has("friend_post")) {
                JSONObject friendPost = widgetData.getJSONObject("friend_post");
                Log.d(TAG, "[updateAppWidget] friend_post object: " + friendPost.toString());
                
                postContent = friendPost.optString("content", null);
                
                if (friendPost.has("images") && !friendPost.isNull("images")) {
                    JSONArray images = friendPost.getJSONArray("images");
                    hasImage = images.length() > 0 && !postImageBase64.isEmpty();
                }
                
                Log.d(TAG, "[updateAppWidget] Post content length: " + (postContent != null ? postContent.length() : 0) + 
                           ", hasImage: " + hasImage);
            } else {
                Log.d(TAG, "[updateAppWidget] No friend_post in widget_data");
            }
        } catch (Exception e) {
            Log.e(TAG, "[updateAppWidget] Error parsing widget data", e);
        }

        views = new RemoteViews(context.getPackageName(), R.layout.widget_photo_2x2);
        Intent feedIntent = new Intent(Intent.ACTION_VIEW, Uri.parse("whoami://app/friends/feed"));
        PendingIntent pendingIntent = PendingIntent.getActivity(
            context, 0, feedIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.widget_friend_post_container, pendingIntent);

        if (postContent == null || postContent.trim().isEmpty()) {
            // No friend post - show empty state
            views.setViewVisibility(R.id.friend_post_image, View.GONE);
            views.setViewVisibility(R.id.friend_post_text_container, View.GONE);
            views.setViewVisibility(R.id.friend_post_empty, View.VISIBLE);
            views.setViewVisibility(R.id.friend_post_author_image, View.GONE);
            appWidgetManager.updateAppWidget(appWidgetId, views);
            Log.d(TAG, "[updateAppWidget] No post content - showing empty state");
            return;
        }

        // Show loading state first
        views.setViewVisibility(R.id.friend_post_image, View.GONE);
        views.setViewVisibility(R.id.friend_post_text_container, View.GONE);
        views.setViewVisibility(R.id.friend_post_empty, View.VISIBLE);
        views.setViewVisibility(R.id.friend_post_author_image, View.GONE);
        appWidgetManager.updateAppWidget(appWidgetId, views);

        final String finalContent = postContent;
        final String finalPostImageBase64 = postImageBase64;
        final String finalAuthorImageBase64 = authorImageBase64;
        final boolean finalHasImage = hasImage;
        
        executor.execute(() -> {
            Bitmap postImageBitmap = null;
            Bitmap authorImageBitmap = null;
            
            if (finalHasImage && !finalPostImageBase64.isEmpty()) {
                try {
                    byte[] decodedBytes = Base64.decode(finalPostImageBase64, Base64.DEFAULT);
                    postImageBitmap = BitmapFactory.decodeByteArray(decodedBytes, 0, decodedBytes.length);
                    Log.d(TAG, "[updateAppWidget] Post image decoded: " + (postImageBitmap != null));
                } catch (Exception e) {
                    Log.e(TAG, "[updateAppWidget] Failed to decode post image", e);
                }
            }
            
            if (!finalAuthorImageBase64.isEmpty()) {
                try {
                    byte[] decodedBytes = Base64.decode(finalAuthorImageBase64, Base64.DEFAULT);
                    Bitmap rawAvatar = BitmapFactory.decodeByteArray(decodedBytes, 0, decodedBytes.length);
                    if (rawAvatar != null) {
                        authorImageBitmap = getCircularBitmap(rawAvatar);
                    }
                    Log.d(TAG, "[updateAppWidget] Author image decoded: " + (authorImageBitmap != null));
                } catch (Exception e) {
                    Log.e(TAG, "[updateAppWidget] Failed to decode author image", e);
                }
            }

            final Bitmap finalPostImage = postImageBitmap;
            final Bitmap finalAuthorImage = authorImageBitmap;
            
            mainHandler.post(() -> {
                RemoteViews updatedViews = new RemoteViews(context.getPackageName(), R.layout.widget_photo_2x2);
                updatedViews.setOnClickPendingIntent(R.id.widget_friend_post_container, pendingIntent);
                
                if (finalPostImage != null) {
                    // Show image
                    updatedViews.setImageViewBitmap(R.id.friend_post_image, finalPostImage);
                    updatedViews.setViewVisibility(R.id.friend_post_image, View.VISIBLE);
                    updatedViews.setViewVisibility(R.id.friend_post_text_container, View.GONE);
                    updatedViews.setViewVisibility(R.id.friend_post_empty, View.GONE);
                } else {
                    // Show text
                    updatedViews.setTextViewText(R.id.friend_post_content, finalContent);
                    updatedViews.setViewVisibility(R.id.friend_post_image, View.GONE);
                    updatedViews.setViewVisibility(R.id.friend_post_text_container, View.VISIBLE);
                    updatedViews.setViewVisibility(R.id.friend_post_empty, View.GONE);
                }
                
                if (finalAuthorImage != null) {
                    updatedViews.setImageViewBitmap(R.id.friend_post_author_image, finalAuthorImage);
                    updatedViews.setViewVisibility(R.id.friend_post_author_image, View.VISIBLE);
                } else {
                    updatedViews.setViewVisibility(R.id.friend_post_author_image, View.GONE);
                }
                
                appWidgetManager.updateAppWidget(appWidgetId, updatedViews);
                
                long elapsed = System.currentTimeMillis() - startTime;
                Log.d(TAG, "[updateAppWidget] COMPLETE - Elapsed: " + elapsed + "ms");
            });
        });
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
