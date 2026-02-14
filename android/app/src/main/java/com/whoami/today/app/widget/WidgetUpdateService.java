package com.whoami.today.app.widget;

import android.app.IntentService;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.util.Log;
import android.widget.RemoteViews;

import com.whoami.today.app.R;

import java.util.HashMap;
import java.util.Map;

public class WidgetUpdateService extends IntentService {
    private static final String TAG = "WidgetUpdateService";

    public WidgetUpdateService() {
        super("WidgetUpdateService");
    }

    @Override
    protected void onHandleIntent(Intent intent) {
        Log.d(TAG, "Updating widget with album images...");

        Context context = getApplicationContext();

        // When not logged in, do not overwrite widget (provider already set "Please Sign in" on question card)
        String accessToken = SharedPrefsHelper.getAccessToken(context);
        if (accessToken == null || accessToken.isEmpty()) {
            Log.d(TAG, "Not logged in: skipping widget content update (question card stays 'Please Sign in')");
            return;
        }

        AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
        ComponentName componentName = new ComponentName(context, WhoAmIWidgetProvider.class);
        int[] appWidgetIds = appWidgetManager.getAppWidgetIds(componentName);

        // Load widget data
        String widgetDataJson = SharedPrefsHelper.getWidgetData(context);
        if (widgetDataJson == null) {
            Log.d(TAG, "No widget data available");
            return;
        }

        WidgetData widgetData = WidgetData.fromJson(widgetDataJson);
        if (widgetData == null) {
            Log.e(TAG, "Failed to parse widget data");
            return;
        }

        SpotifyManager spotifyManager = new SpotifyManager(context);

        // Fetch daily question
        WidgetData.QuestionOfDay dailyQuestion = NetworkManager.fetchFirstDailyQuestion(context);

        for (int appWidgetId : appWidgetIds) {
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_large);

            // Set up click handlers (same as in WhoAmIWidgetProvider)
            WhoAmIWidgetProvider.setupClickHandlers(context, views);

            // Update question text with daily question content
            if (dailyQuestion != null && dailyQuestion.content != null && !dailyQuestion.content.isEmpty()) {
                views.setTextViewText(R.id.question_text, dailyQuestion.content);
                // Set click handler with actual question ID
                WhoAmIWidgetProvider.setupActionButton(context, views, R.id.question_card,
                    dailyQuestion.getDeepLink(), 11);
                Log.d(TAG, "Set daily question: " + dailyQuestion.content);
            }

            // Load playlist album images
            Map<String, Bitmap> albumImages = new HashMap<>();
            if (widgetData.sharedPlaylists != null && widgetData.sharedPlaylists.size() > 0) {
                for (int i = 0; i < Math.min(5, widgetData.sharedPlaylists.size()); i++) {
                    WidgetData.PlaylistSong song = widgetData.sharedPlaylists.get(i);
                    if (song.trackId != null && !song.trackId.isEmpty()) {
                        String albumImageUrl = spotifyManager.getAlbumImageUrl(song.trackId);
                        if (albumImageUrl != null) {
                            Bitmap albumBitmap = ImageLoader.loadImageFromUrl(albumImageUrl);
                            if (albumBitmap != null) {
                                albumImages.put(song.trackId, albumBitmap);
                                Log.d(TAG, "Loaded album image for track: " + song.trackId);
                            }
                        }
                    }
                }
            }

            // Load profile images for friends and playlist users
            Map<Integer, Bitmap> profileImages = new HashMap<>();

            // Load friend profile images
            if (widgetData.friendsWithUpdates != null) {
                for (int i = 0; i < Math.min(2, widgetData.friendsWithUpdates.size()); i++) {
                    WidgetData.FriendUpdate friend = widgetData.friendsWithUpdates.get(i);
                    if (friend.profileImage != null && !friend.profileImage.isEmpty()) {
                        Bitmap profileBitmap = ImageLoader.loadImageFromUrl(friend.profileImage);
                        if (profileBitmap != null) {
                            profileImages.put(friend.id, profileBitmap);
                            Log.d(TAG, "Loaded profile image for friend: " + friend.id);
                        }
                    }
                }
            }

            // Load playlist user profile images
            if (widgetData.sharedPlaylists != null) {
                for (int i = 0; i < Math.min(5, widgetData.sharedPlaylists.size()); i++) {
                    WidgetData.PlaylistSong song = widgetData.sharedPlaylists.get(i);
                    if (song.user.profileImage != null && !song.user.profileImage.isEmpty()) {
                        // Skip if already loaded (same user might have multiple songs)
                        if (!profileImages.containsKey(song.user.id)) {
                            Bitmap profileBitmap = ImageLoader.loadImageFromUrl(song.user.profileImage);
                            if (profileBitmap != null) {
                                profileImages.put(song.user.id, profileBitmap);
                                Log.d(TAG, "Loaded profile image for playlist user: " + song.user.id);
                            }
                        }
                    }
                }
            }

            // Update views with images
            updateFriendViews(context, views, widgetData, profileImages);
            updatePlaylistViews(context, views, widgetData, albumImages, profileImages);

            appWidgetManager.updateAppWidget(appWidgetId, views);
        }

        Log.d(TAG, "Widget update complete");
    }

    private void updateFriendViews(Context context, RemoteViews views, WidgetData data, Map<Integer, Bitmap> profileImages) {
        int[] friendAvatarIds = {R.id.friend_1_avatar, R.id.friend_2_avatar};
        int[] friendNameIds = {R.id.friend_1_name, R.id.friend_2_name};
        int[] friendContainerIds = {R.id.friend_1, R.id.friend_2};

        if (data.friendsWithUpdates != null) {
            for (int i = 0; i < Math.min(2, data.friendsWithUpdates.size()); i++) {
                WidgetData.FriendUpdate friend = data.friendsWithUpdates.get(i);

                // Set friend name
                views.setTextViewText(friendNameIds[i], friend.username);

                // Set profile image if available, otherwise use default
                if (profileImages.containsKey(friend.id)) {
                    Bitmap profileBitmap = profileImages.get(friend.id);
                    Bitmap circularProfile = ImageLoader.getCircularBitmap(profileBitmap);
                    views.setImageViewBitmap(friendAvatarIds[i], circularProfile);
                } else {
                    views.setImageViewResource(friendAvatarIds[i], R.drawable.default_profile);
                }

                // Set click handler for friend profile
                WhoAmIWidgetProvider.setupActionButton(context, views, friendContainerIds[i],
                    "whoami://app/users/" + friend.username, 200 + i);
            }
        }
    }

    private void updatePlaylistViews(Context context, RemoteViews views, WidgetData data, Map<String, Bitmap> albumImages, Map<Integer, Bitmap> profileImages) {
        int[] albumViewIds = {R.id.playlist_1_album, R.id.playlist_2_album, R.id.playlist_3_album,
                              R.id.playlist_4_album, R.id.playlist_5_album};
        int[] profileViewIds = {R.id.playlist_1_profile, R.id.playlist_2_profile, R.id.playlist_3_profile,
                                R.id.playlist_4_profile, R.id.playlist_5_profile};
        int[] containerIds = {R.id.playlist_1_container, R.id.playlist_2_container, R.id.playlist_3_container,
                              R.id.playlist_4_container, R.id.playlist_5_container};

        if (data.sharedPlaylists != null) {
            for (int i = 0; i < Math.min(5, data.sharedPlaylists.size()); i++) {
                WidgetData.PlaylistSong song = data.sharedPlaylists.get(i);

                // Set album image
                if (albumImages.containsKey(song.trackId)) {
                    Bitmap albumBitmap = albumImages.get(song.trackId);
                    Bitmap roundedAlbum = ImageLoader.getRoundedCornerBitmap(albumBitmap, 16);
                    views.setImageViewBitmap(albumViewIds[i], roundedAlbum);
                }

                // Set profile image overlay, otherwise use default
                if (profileImages.containsKey(song.user.id)) {
                    Bitmap profileBitmap = profileImages.get(song.user.id);
                    Bitmap circularProfile = ImageLoader.getCircularBitmap(profileBitmap);
                    views.setImageViewBitmap(profileViewIds[i], circularProfile);
                } else {
                    views.setImageViewResource(profileViewIds[i], R.drawable.default_profile);
                }

                // Set click handler to open Spotify
                WhoAmIWidgetProvider.setupActionButton(context, views, containerIds[i],
                    "spotify:track:" + song.trackId, 100 + i);
            }
        }
    }
}
