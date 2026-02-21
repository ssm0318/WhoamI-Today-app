package com.whoami.today.app.widget;

import org.json.JSONArray;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.List;

public class WidgetData {
    public MyCheckIn myCheckIn;
    public List<FriendUpdate> friendsWithUpdates;
    public List<PlaylistSong> sharedPlaylists;
    public QuestionOfDay questionOfDay;

    public static WidgetData fromJson(String jsonString) {
        try {
            JSONObject json = new JSONObject(jsonString);
            WidgetData data = new WidgetData();

            // Parse my check-in
            if (json.has("my_check_in") && !json.isNull("my_check_in")) {
                data.myCheckIn = MyCheckIn.fromJson(json.getJSONObject("my_check_in"));
            }

            // Parse friends with updates
            data.friendsWithUpdates = new ArrayList<>();
            if (json.has("friends_with_updates")) {
                JSONArray friendsArray = json.getJSONArray("friends_with_updates");
                for (int i = 0; i < friendsArray.length(); i++) {
                    data.friendsWithUpdates.add(FriendUpdate.fromJson(friendsArray.getJSONObject(i)));
                }
            }

            // Parse shared playlists
            data.sharedPlaylists = new ArrayList<>();
            if (json.has("shared_playlists")) {
                JSONArray playlistsArray = json.getJSONArray("shared_playlists");
                for (int i = 0; i < playlistsArray.length(); i++) {
                    data.sharedPlaylists.add(PlaylistSong.fromJson(playlistsArray.getJSONObject(i)));
                }
            }

            // Parse question of day
            if (json.has("question_of_day") && !json.isNull("question_of_day")) {
                data.questionOfDay = QuestionOfDay.fromJson(json.getJSONObject("question_of_day"));
            }

            return data;
        } catch (Exception e) {
            e.printStackTrace();
            return null;
        }
    }

    public static class MyCheckIn {
        public int id;
        public String mood;
        public String socialBattery;
        public String trackId;
        public String albumImageUrl;

        public static MyCheckIn fromJson(JSONObject json) {
            try {
                MyCheckIn checkIn = new MyCheckIn();
                checkIn.id = json.optInt("id");
                checkIn.mood = json.optString("mood", "🤔");
                checkIn.socialBattery = json.optString("social_battery", "half");
                checkIn.trackId = json.optString("track_id", "");
                checkIn.albumImageUrl = json.optString("album_image_url", null);
                return checkIn;
            } catch (Exception e) {
                e.printStackTrace();
                return null;
            }
        }

        /** Matches SocialBatteryChipAssets in TS: completely_drained, low, needs_recharge, moderately_social, fully_charged, super_social */
        public String getBatteryEmoji() {
            if (socialBattery == null) return "🪫";
            switch (socialBattery) {
                case "completely_drained": return "💤";
                case "low": return "🪫";
                case "needs_recharge": return "🔌";
                case "moderately_social": return "🔋";
                case "fully_charged": return "🚀";
                case "super_social": return "🤩";
                default: return "🔋";
            }
        }
    }

    public static class FriendUpdate {
        public int id;
        public String username;
        public String profilePic;
        public String profileImage;

        public static FriendUpdate fromJson(JSONObject json) {
            try {
                FriendUpdate friend = new FriendUpdate();
                friend.id = json.optInt("id");
                friend.username = json.optString("username", "");
                friend.profilePic = json.optString("profile_pic", "#AABBCC");
                friend.profileImage = json.optString("profile_image", null);
                // Support nested "user" object (e.g. API returns { "user": { "username": "x" } })
                if (json.has("user") && !json.isNull("user")) {
                    JSONObject user = json.getJSONObject("user");
                    if (friend.username.isEmpty()) friend.username = user.optString("username", "");
                    if (friend.profileImage == null || friend.profileImage.isEmpty()) friend.profileImage = user.optString("profile_image", null);
                    if ("#AABBCC".equals(friend.profilePic)) friend.profilePic = user.optString("profile_pic", friend.profilePic);
                }
                return friend;
            } catch (Exception e) {
                e.printStackTrace();
                return null;
            }
        }
    }

    public static class PlaylistSong {
        public int id;
        public PlaylistUser user;
        public String trackId;
        public String createdAt;

        public static PlaylistSong fromJson(JSONObject json) {
            try {
                PlaylistSong song = new PlaylistSong();
                song.id = json.optInt("id");
                song.user = PlaylistUser.fromJson(json.getJSONObject("user"));
                song.trackId = json.optString("track_id", "");
                song.createdAt = json.optString("created_at", "");
                return song;
            } catch (Exception e) {
                e.printStackTrace();
                return null;
            }
        }
    }

    public static class PlaylistUser {
        public int id;
        public String username;
        public String profilePic;
        public String profileImage;

        public static PlaylistUser fromJson(JSONObject json) {
            try {
                PlaylistUser user = new PlaylistUser();
                user.id = json.optInt("id");
                user.username = json.optString("username", "");
                user.profilePic = json.optString("profile_pic", "#AABBCC");
                user.profileImage = json.optString("profile_image", null);
                return user;
            } catch (Exception e) {
                e.printStackTrace();
                return null;
            }
        }
    }

    public static class QuestionOfDay {
        public String id;
        public String question;
        public String content;
        public String createdAt;

        public static QuestionOfDay fromJson(JSONObject json) {
            try {
                QuestionOfDay q = new QuestionOfDay();
                q.id = json.optString("id", "");
                q.question = json.optString("question", "");
                q.content = json.optString("content", "");
                q.createdAt = json.optString("created_at", "");
                return q;
            } catch (Exception e) {
                e.printStackTrace();
                return null;
            }
        }

        public String getDeepLink() {
            return "whoami://app/questions/" + id + "/new";
        }
    }
}
