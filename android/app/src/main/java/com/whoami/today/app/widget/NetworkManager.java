package com.whoami.today.app.widget;

import android.content.Context;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.List;

public class NetworkManager {
    private static final String TAG = "NetworkManager";
    private static final String BASE_URL = "https://whoami-admin-group.gina-park.site";

    /**
     * Fetch full widget data from API (same as iOS getTimeline -> fetchWidgetData).
     * Saves to SharedPreferences so WidgetUpdateService can use it.
     */
    public static boolean fetchWidgetData(Context context) {
        String csrfToken = SharedPrefsHelper.getCsrfToken(context);
        String accessToken = SharedPrefsHelper.getAccessToken(context);
        if (csrfToken == null || accessToken == null || csrfToken.isEmpty() || accessToken.isEmpty()) {
            Log.d(TAG, "fetchWidgetData: No auth tokens");
            return false;
        }
        try {
            String cookie = "csrftoken=" + csrfToken + "; access_token=" + accessToken;
            JSONObject existing = new JSONObject();
            String existingJson = SharedPrefsHelper.getWidgetData(context);
            if (existingJson != null && !existingJson.isEmpty()) {
                try {
                    existing = new JSONObject(existingJson);
                } catch (Exception ignored) {}
            }
            JSONObject root = new JSONObject();
            if (existing.has("my_check_in") && !existing.isNull("my_check_in")) {
                root.put("my_check_in", existing.get("my_check_in"));
            } else {
                JSONObject profile = getJson(context, BASE_URL + "/api/user/me/profile", cookie);
                if (profile != null && profile.has("check_in") && !profile.isNull("check_in")) {
                    root.put("my_check_in", profile.getJSONObject("check_in"));
                }
            }
            JSONArray friends = fetchFriendsWithUpdates(context, cookie);
            root.put("friends_with_updates", friends != null ? friends : new JSONArray());
            JSONArray playlists = fetchPlaylistFeed(context, cookie);
            root.put("shared_playlists", playlists != null ? playlists : new JSONArray());
            WidgetData.QuestionOfDay question = fetchFirstDailyQuestion(context);
            if (question != null) {
                JSONObject qJson = new JSONObject();
                qJson.put("id", question.id);
                qJson.put("question", question.content);
                qJson.put("content", question.content);
                qJson.put("created_at", question.createdAt != null ? question.createdAt : "");
                root.put("question_of_day", qJson);
            }
            SharedPrefsHelper.saveWidgetData(context, root.toString());
            Log.d(TAG, "fetchWidgetData: saved friends=" + (friends != null ? friends.length() : 0) + " playlists=" + (playlists != null ? playlists.length() : 0));
            return true;
        } catch (Exception e) {
            Log.e(TAG, "fetchWidgetData error", e);
            return false;
        }
    }

    private static JSONObject getJson(Context context, String urlString, String cookie) {
        try {
            URL url = new URL(urlString);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setRequestProperty("X-CSRFToken", SharedPrefsHelper.getCsrfToken(context));
            conn.setRequestProperty("Cookie", cookie);
            conn.setConnectTimeout(10000);
            conn.setReadTimeout(10000);
            if (conn.getResponseCode() == 200) {
                BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream()));
                StringBuilder sb = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) sb.append(line);
                reader.close();
                conn.disconnect();
                return new JSONObject(sb.toString());
            }
            conn.disconnect();
        } catch (Exception e) {
            Log.e(TAG, "getJson " + urlString + ": " + e.getMessage());
        }
        return null;
    }

    private static JSONArray fetchFriendsWithUpdates(Context context, String cookie) {
        try {
            URL url = new URL(BASE_URL + "/api/user/friends/updates/");
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setRequestProperty("X-CSRFToken", SharedPrefsHelper.getCsrfToken(context));
            conn.setRequestProperty("Cookie", cookie);
            conn.setConnectTimeout(10000);
            conn.setReadTimeout(10000);
            int code = conn.getResponseCode();
            Log.d(TAG, "fetchFriendsWithUpdates: HTTP " + code);
            if (code == 200) {
                BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream()));
                StringBuilder sb = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) sb.append(line);
                reader.close();
                String body = sb.toString();
                conn.disconnect();
                JSONArray arr;
                if (body.startsWith("[")) {
                    arr = new JSONArray(body);
                } else {
                    JSONObject paginated = new JSONObject(body);
                    arr = paginated.has("results") ? paginated.getJSONArray("results") : new JSONArray();
                }
                Log.d(TAG, "fetchFriendsWithUpdates: parsed count=" + arr.length());
                return arr;
            }
            conn.disconnect();
        } catch (Exception e) {
            Log.e(TAG, "fetchFriendsWithUpdates: " + e.getMessage());
        }
        return null;
    }

    private static JSONArray fetchPlaylistFeed(Context context, String cookie) {
        try {
            URL url = new URL(BASE_URL + "/api/playlist/feed");
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setRequestProperty("X-CSRFToken", SharedPrefsHelper.getCsrfToken(context));
            conn.setRequestProperty("Cookie", cookie);
            conn.setConnectTimeout(10000);
            conn.setReadTimeout(10000);
            int code = conn.getResponseCode();
            Log.d(TAG, "fetchPlaylistFeed: HTTP " + code);
            if (code == 200) {
                BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream()));
                StringBuilder sb = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) sb.append(line);
                reader.close();
                JSONObject paginated = new JSONObject(sb.toString());
                conn.disconnect();
                JSONArray arr = paginated.has("results") ? paginated.getJSONArray("results") : new JSONArray();
                Log.d(TAG, "fetchPlaylistFeed: parsed count=" + arr.length());
                return arr;
            }
            conn.disconnect();
        } catch (Exception e) {
            Log.e(TAG, "fetchPlaylistFeed: " + e.getMessage());
        }
        return null;
    }

    public static WidgetData.QuestionOfDay fetchFirstDailyQuestion(Context context) {
        // Try daily questions first
        WidgetData.QuestionOfDay question = fetchFromDailyQuestions(context);

        // Fallback to general questions if daily failed or is null
        if (question == null) {
            Log.d(TAG, "Daily questions failed or empty, trying general questions...");
            question = fetchFromGeneralQuestions(context);
        }

        return question;
    }

    private static WidgetData.QuestionOfDay fetchFromDailyQuestions(Context context) {
        try {
            String csrfToken = SharedPrefsHelper.getCsrfToken(context);
            String accessToken = SharedPrefsHelper.getAccessToken(context);

            if (csrfToken == null || accessToken == null) {
                Log.e(TAG, "No auth tokens available");
                return null;
            }

            URL url = new URL(BASE_URL + "/api/qna/questions/daily/");
            HttpURLConnection connection = (HttpURLConnection) url.openConnection();
            connection.setRequestMethod("GET");
            connection.setRequestProperty("X-CSRFToken", csrfToken);
            connection.setRequestProperty("Cookie", "csrftoken=" + csrfToken + "; access_token=" + accessToken);
            connection.setConnectTimeout(10000);
            connection.setReadTimeout(10000);

            int responseCode = connection.getResponseCode();
            Log.d(TAG, "Daily questions response code: " + responseCode);

            if (responseCode == 200) {
                BufferedReader reader = new BufferedReader(new InputStreamReader(connection.getInputStream()));
                StringBuilder response = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) {
                    response.append(line);
                }
                reader.close();

                String responseBody = response.toString();
                Log.d(TAG, "Daily questions raw response (first 500 chars): " + responseBody.substring(0, Math.min(500, responseBody.length())));

                // Parse JSON array and get first question
                JSONArray questionsArray = new JSONArray(responseBody);
                Log.d(TAG, "✅ Daily questions decoded: " + questionsArray.length() + " questions");

                if (questionsArray.length() == 0) {
                    Log.w(TAG, "⚠️ Daily questions array is EMPTY!");
                    return null;
                }

                if (questionsArray.length() > 0) {
                    JSONObject firstQuestion = questionsArray.getJSONObject(0);
                    WidgetData.QuestionOfDay question = WidgetData.QuestionOfDay.fromJson(firstQuestion);
                    Log.d(TAG, "✅ Successfully fetched daily question - ID: " + question.id + ", Content: " + question.content);
                    return question;
                }
            } else {
                Log.e(TAG, "❌ Failed to fetch daily questions: " + responseCode);
            }

            connection.disconnect();
        } catch (Exception e) {
            Log.e(TAG, "Error fetching daily questions: " + e.getMessage());
            e.printStackTrace();
        }

        return null;
    }

    private static WidgetData.QuestionOfDay fetchFromGeneralQuestions(Context context) {
        try {
            String csrfToken = SharedPrefsHelper.getCsrfToken(context);
            String accessToken = SharedPrefsHelper.getAccessToken(context);

            if (csrfToken == null || accessToken == null) {
                Log.e(TAG, "No auth tokens available");
                return null;
            }

            URL url = new URL(BASE_URL + "/api/qna/questions/?page=1");
            HttpURLConnection connection = (HttpURLConnection) url.openConnection();
            connection.setRequestMethod("GET");
            connection.setRequestProperty("X-CSRFToken", csrfToken);
            connection.setRequestProperty("Cookie", "csrftoken=" + csrfToken + "; access_token=" + accessToken);
            connection.setConnectTimeout(10000);
            connection.setReadTimeout(10000);

            int responseCode = connection.getResponseCode();
            Log.d(TAG, "General questions response code: " + responseCode);

            if (responseCode == 200) {
                BufferedReader reader = new BufferedReader(new InputStreamReader(connection.getInputStream()));
                StringBuilder response = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) {
                    response.append(line);
                }
                reader.close();

                String responseBody = response.toString();
                Log.d(TAG, "General questions raw response (first 500 chars): " + responseBody.substring(0, Math.min(500, responseBody.length())));

                // Parse paginated response
                JSONObject paginatedResponse = new JSONObject(responseBody);
                JSONArray resultsArray = paginatedResponse.getJSONArray("results");
                Log.d(TAG, "✅ General questions decoded: " + resultsArray.length() + " groups");

                if (resultsArray.length() == 0) {
                    Log.w(TAG, "⚠️ Results array is EMPTY!");
                    return null;
                }

                if (resultsArray.length() > 0) {
                    // Get first question group
                    JSONObject firstGroup = resultsArray.getJSONObject(0);
                    String groupDate = firstGroup.optString("date", "unknown");
                    JSONArray questionsArray = firstGroup.getJSONArray("questions");
                    Log.d(TAG, "First group date: " + groupDate + ", questions count: " + questionsArray.length());

                    if (questionsArray.length() == 0) {
                        Log.w(TAG, "⚠️ First group has NO questions!");
                        return null;
                    }

                    if (questionsArray.length() > 0) {
                        // Get first question from first group
                        JSONObject firstQuestion = questionsArray.getJSONObject(0);

                        // Convert to QuestionOfDay format
                        WidgetData.QuestionOfDay question = new WidgetData.QuestionOfDay();
                        question.id = String.valueOf(firstQuestion.optInt("id"));
                        question.content = firstQuestion.optString("content", "");
                        question.question = question.content;
                        question.createdAt = firstQuestion.optString("created_at", "");

                        Log.d(TAG, "✅ Using fallback question - ID: " + question.id + ", Content: " + question.content);
                        return question;
                    }
                }

                Log.w(TAG, "⚠️ Could not extract first question from results");
            } else {
                Log.e(TAG, "❌ Failed to fetch general questions: " + responseCode);
            }

            connection.disconnect();
        } catch (Exception e) {
            Log.e(TAG, "Error fetching general questions: " + e.getMessage());
            e.printStackTrace();
        }

        return null;
    }
}
