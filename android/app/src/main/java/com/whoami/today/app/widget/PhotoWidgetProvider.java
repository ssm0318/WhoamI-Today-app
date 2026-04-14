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
        boolean hasFriendPost = false;

        try {
            JSONObject widgetData = new JSONObject(widgetDataJson);
            if (widgetData.has("friend_post")) {
                JSONObject friendPost = widgetData.getJSONObject("friend_post");
                Log.d(TAG, "[updateAppWidget] friend_post object: " + friendPost.toString());
                hasFriendPost = true;

                postContent = friendPost.optString("content", null);

                if (friendPost.has("images") && !friendPost.isNull("images")) {
                    JSONArray images = friendPost.getJSONArray("images");
                    hasImage = images.length() > 0 && !postImageBase64.isEmpty();
                }

                Log.d(TAG, "[updateAppWidget] Post content length: " + (postContent != null ? postContent.length() : 0) +
                           ", hasImage: " + hasImage);
            } else {
                Log.w(TAG, "[updateAppWidget] No friend_post in widget_data - will try API fetch");
                fetchFriendPostFromApi(context, appWidgetManager, appWidgetId, prefs);
            }
        } catch (Exception e) {
            Log.e(TAG, "[updateAppWidget] Error parsing widget data", e);
        }

        views = new RemoteViews(context.getPackageName(), R.layout.widget_photo_2x2);
        Intent feedIntent = new Intent(Intent.ACTION_VIEW, Uri.parse("whoami://app/friends/feed"));
        PendingIntent pendingIntent = PendingIntent.getActivity(
            context, 0, feedIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.widget_friend_post_container, pendingIntent);

        // Show empty state if no post data, or post has neither content nor image
        boolean hasContent = postContent != null && !postContent.trim().isEmpty();
        if (!hasFriendPost || (!hasContent && !hasImage)) {
            views.setViewVisibility(R.id.friend_post_image, View.GONE);
            views.setViewVisibility(R.id.friend_post_text_container, View.GONE);
            views.setViewVisibility(R.id.friend_post_empty, View.VISIBLE);
            views.setViewVisibility(R.id.friend_post_author_image, View.GONE);
            appWidgetManager.updateAppWidget(appWidgetId, views);
            Log.d(TAG, "[updateAppWidget] No post content/image - showing empty state");
            return;
        }

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
                    Bitmap raw = BitmapFactory.decodeByteArray(decodedBytes, 0, decodedBytes.length);
                    if (raw != null) {
                        // Crop to square (center crop) + rounded corners
                        int w = raw.getWidth();
                        int h = raw.getHeight();
                        int side = Math.min(w, h);
                        int x = (w - side) / 2;
                        int y = (h - side) / 2;
                        Bitmap square = Bitmap.createBitmap(raw, x, y, side, side);
                        postImageBitmap = getRoundedCornerBitmap(square, 32);
                    }
                    Log.d(TAG, "[updateAppWidget] Post image decoded + cropped to square: " + (postImageBitmap != null));
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
                    // Show image — make container transparent so only the rounded image is visible
                    updatedViews.setInt(R.id.widget_friend_post_container, "setBackgroundResource", 0);
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
                } else {
                    // Fallback to default profile icon
                    updatedViews.setImageViewResource(R.id.friend_post_author_image, R.drawable.ic_default_profile);
                }
                updatedViews.setViewVisibility(R.id.friend_post_author_image, View.VISIBLE);
                
                appWidgetManager.updateAppWidget(appWidgetId, updatedViews);
                
                long elapsed = System.currentTimeMillis() - startTime;
                Log.d(TAG, "[updateAppWidget] COMPLETE - Elapsed: " + elapsed + "ms");
            });
        });
    }

    /**
     * When widget has no friend post data, fetch from /user/friends/ API.
     * Picks a random friend with unread posts and saves their latest post.
     */
    private static void fetchFriendPostFromApi(Context context, AppWidgetManager appWidgetManager,
            int appWidgetId, SharedPreferences prefs) {
        String apiBaseUrl = prefs.getString("api_base_url", "https://whoami-test-group.gina-park.site/api/");
        String accessToken = prefs.getString("access_token", "");
        String csrftoken = prefs.getString("csrftoken", "");

        if (apiBaseUrl.isEmpty() || accessToken.isEmpty()) {
            Log.w(TAG, "[fetchFriendPost] Missing api_base_url or access_token, skipping");
            return;
        }

        executor.execute(() -> {
            try {
                String endpoint = apiBaseUrl + "user/friends/?type=all";
                Log.d(TAG, "[fetchFriendPost] Fetching: " + endpoint);

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
                    Log.w(TAG, "[fetchFriendPost] API returned " + conn.getResponseCode());
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
                    Log.w(TAG, "[fetchFriendPost] No friends in response");
                    return;
                }

                // Filter friends with unread posts
                java.util.List<JSONObject> friendsWithPosts = new java.util.ArrayList<>();
                for (int i = 0; i < results.length(); i++) {
                    JSONObject friend = results.getJSONObject(i);
                    if (friend.optInt("unread_post_cnt", 0) > 0
                            && friend.has("latest_unread_post") && !friend.isNull("latest_unread_post")) {
                        friendsWithPosts.add(friend);
                    }
                }

                if (friendsWithPosts.isEmpty()) {
                    Log.d(TAG, "[fetchFriendPost] No friends with unread posts");
                    return;
                }

                // Pick random friend
                int idx = (int) (Math.random() * friendsWithPosts.size());
                JSONObject pickedFriend = friendsWithPosts.get(idx);
                JSONObject post = pickedFriend.getJSONObject("latest_unread_post");
                String authorUsername = pickedFriend.optString("username", "");
                String profileImageUrl = pickedFriend.optString("profile_image", "");

                Log.d(TAG, "[fetchFriendPost] Picked friend: " + authorUsername +
                        ", postId: " + post.optInt("id"));

                // Build friend_post JSON
                JSONObject friendPost = new JSONObject();
                friendPost.put("id", post.optInt("id"));
                friendPost.put("type", post.optString("type", ""));
                friendPost.put("content", post.optString("content", ""));
                friendPost.put("images", post.optJSONArray("images") != null
                        ? post.getJSONArray("images") : new JSONArray());
                friendPost.put("current_user_read", false);
                friendPost.put("author_username", authorUsername);

                // Download images
                String authorBase64 = "";
                String postImageBase64 = "";

                if (!profileImageUrl.isEmpty()) {
                    authorBase64 = downloadAsBase64(profileImageUrl);
                }

                JSONArray images = friendPost.optJSONArray("images");
                if (images != null && images.length() > 0) {
                    String firstImageUrl = images.optString(0, "");
                    if (!firstImageUrl.isEmpty()) {
                        postImageBase64 = downloadAsBase64(firstImageUrl);
                    }
                }

                // Save to SharedPreferences
                String existingJson = prefs.getString("widget_data", "{}");
                JSONObject root = new JSONObject(existingJson);
                root.put("friend_post", friendPost);

                SharedPreferences.Editor editor = prefs.edit();
                editor.putString("widget_data", root.toString());
                if (!authorBase64.isEmpty()) {
                    editor.putString("widget_friend_post_author_image_base64", authorBase64);
                }
                if (!postImageBase64.isEmpty()) {
                    editor.putString("widget_friend_post_image_base64", postImageBase64);
                }
                editor.commit();

                Log.d(TAG, "[fetchFriendPost] Saved friend post from API, author=" + authorUsername);

                mainHandler.post(() -> updateAppWidget(context, appWidgetManager, appWidgetId));

            } catch (Exception e) {
                Log.e(TAG, "[fetchFriendPost] Failed", e);
            }
        });
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
