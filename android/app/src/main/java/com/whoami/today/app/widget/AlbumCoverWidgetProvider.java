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
        Intent playlistIntent = new Intent(Intent.ACTION_VIEW, Uri.parse("whoami://app/shared-playlist"));
        PendingIntent pendingIntent = PendingIntent.getActivity(
            context, 0, playlistIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.widget_album_container, pendingIntent);

        if (albumImageBase64.isEmpty() && avatarImageBase64.isEmpty()) {
            views.setViewVisibility(R.id.album_image, View.GONE);
            views.setViewVisibility(R.id.album_placeholder, View.VISIBLE);
            views.setViewVisibility(R.id.friend_profile_image, View.GONE);
            appWidgetManager.updateAppWidget(appWidgetId, views);
            Log.d(TAG, "[updateAppWidget] No images - showing placeholder");
            return;
        }

        // Show placeholder first, then load images in background
        views.setViewVisibility(R.id.album_image, View.GONE);
        views.setViewVisibility(R.id.album_placeholder, View.VISIBLE);
        views.setViewVisibility(R.id.friend_profile_image, View.GONE);
        appWidgetManager.updateAppWidget(appWidgetId, views);

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
