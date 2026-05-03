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

public class NetworkManager_DEPRECATED {
    private static final String TAG = "NetworkManager_DEPRECATED";
    private static final String BASE_URL = "https://whoami-admin-group.gina-park.site";

    /**
     * Fetch full widget data from API (same as iOS getTimeline -> fetchWidgetData).
     * Saves to SharedPreferences so WidgetUpdateService can use it.
     */
    public static boolean fetchWidgetData(Context context) {
        String csrfToken = SharedPrefsHelper_DEPRECATED.getCsrfToken(context);
        String accessToken = SharedPrefsHelper_DEPRECATED.getAccessToken(context);
        boolean hasTokens = csrfToken != null && accessToken != null && !csrfToken.isEmpty() && !accessToken.isEmpty();
        if (!hasTokens) {
            Log.d(TAG, "fetchWidgetData: No auth tokens");
            return false;
        }
        try {
            String cookie = "csrftoken=" + csrfToken + "; access_token=" + accessToken;
            JSONObject existing = new JSONObject();
            String existingJson = SharedPrefsHelper_DEPRECATED.getWidgetData(context);
            if (existingJson != null && !existingJson.isEmpty()) {
                try {
                    existing = new JSONObject(existingJson);
                } catch (Exception ignored) {}
            }
            JSONObject root = new JSONObject();
            // Always fetch profile so check-in is latest (same as iOS fetchWidgetData)
            JSONObject profile = getJson(context, BASE_URL + "/api/user/me/profile", cookie);
            // Prefer app-synced check-in when newer than API (avoids widget showing stale data after app sync)
            JSONObject apiCheckIn = (profile != null && profile.has("check_in") && !profile.isNull("check_in"))
                ? profile.getJSONObject("check_in") : null;
            JSONObject existingCheckIn = (existing.has("my_check_in") && !existing.isNull("my_check_in"))
                ? existing.getJSONObject("my_check_in") : null;
            boolean useExisting = existingCheckIn != null && isCheckInNewerThan(existingCheckIn, apiCheckIn);
            JSONObject chosenCheckIn = useExisting ? existingCheckIn : (apiCheckIn != null ? apiCheckIn : existingCheckIn);
            if (chosenCheckIn != null) {
                root.put("my_check_in", chosenCheckIn);
            }
            // Use existing friends/playlists only when fetch fails (null); if API returns empty array, show empty
            JSONArray friends = fetchFriendsWithUpdates(context, cookie);
            JSONArray existingFriends = (existing.has("friends_with_updates") && !existing.isNull("friends_with_updates"))
                ? existing.optJSONArray("friends_with_updates") : null;
            if (friends != null) {
                root.put("friends_with_updates", friends);
            } else if (existingFriends != null && existingFriends.length() > 0) {
                root.put("friends_with_updates", existingFriends);
            } else {
                root.put("friends_with_updates", new JSONArray());
            }
            JSONArray playlists = fetchPlaylistFeed(context, cookie);
            JSONArray existingPlaylists = (existing.has("shared_playlists") && !existing.isNull("shared_playlists"))
                ? existing.optJSONArray("shared_playlists") : null;
            if (playlists != null) {
                root.put("shared_playlists", playlists);
            } else if (existingPlaylists != null && existingPlaylists.length() > 0) {
                root.put("shared_playlists", existingPlaylists);
            } else {
                root.put("shared_playlists", new JSONArray());
            }
            WidgetData_DEPRECATED.QuestionOfDay question = fetchFirstDailyQuestion(context);
            if (question != null) {
                JSONObject qJson = new JSONObject();
                qJson.put("id", question.id);
                qJson.put("question", question.content);
                qJson.put("content", question.content);
                qJson.put("created_at", question.createdAt != null ? question.createdAt : "");
                root.put("question_of_day", qJson);
            }
            SharedPrefsHelper_DEPRECATED.saveWidgetData(context, root.toString());
            Log.d(TAG, "fetchWidgetData: saved friends=" + (friends != null ? friends.length() : 0) + " playlists=" + (playlists != null ? playlists.length() : 0));
            return true;
        } catch (Exception e) {
            Log.e(TAG, "fetchWidgetData error", e);
            return false;
        }
    }

    /** True if existing check-in is newer than or equal to api, so we keep app-synced data when same id. */
    private static boolean isCheckInNewerThan(JSONObject existing, JSONObject api) {
        if (api == null) return true;
        if (existing == null) return false;
        try {
            if (existing.has("id") && api.has("id") && !existing.isNull("id") && !api.isNull("id")) {
                return existing.getInt("id") >= api.getInt("id");
            }
            String exTs = existing.optString("created_at", "");
            String apiTs = api.optString("created_at", "");
            if (!exTs.isEmpty() && !apiTs.isEmpty()) return exTs.compareTo(apiTs) >= 0;
        } catch (Exception ignored) {}
        return true;
    }

    private static JSONObject getJson(Context context, String urlString, String cookie) {
        try {
            URL url = new URL(urlString);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setUseCaches(false);
            conn.setRequestProperty("X-CSRFToken", SharedPrefsHelper_DEPRECATED.getCsrfToken(context));
            conn.setRequestProperty("Cookie", cookie);
            conn.setRequestProperty("Cache-Control", "no-cache, no-store");
            conn.setRequestProperty("Pragma", "no-cache");
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
            conn.setRequestProperty("X-CSRFToken", SharedPrefsHelper_DEPRECATED.getCsrfToken(context));
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
            conn.setRequestProperty("X-CSRFToken", SharedPrefsHelper_DEPRECATED.getCsrfToken(context));
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

    public static WidgetData_DEPRECATED.QuestionOfDay fetchFirstDailyQuestion(Context context) {
        // Try daily questions first
        WidgetData_DEPRECATED.QuestionOfDay question = fetchFromDailyQuestions(context);

        // Fallback to general questions if daily failed or is null
        if (question == null) {
            Log.d(TAG, "Daily questions failed or empty, trying general questions...");
            question = fetchFromGeneralQuestions(context);
        }

        return question;
    }

    private static WidgetData_DEPRECATED.QuestionOfDay fetchFromDailyQuestions(Context context) {
        try {
            String csrfToken = SharedPrefsHelper_DEPRECATED.getCsrfToken(context);
            String accessToken = SharedPrefsHelper_DEPRECATED.getAccessToken(context);

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
                    WidgetData_DEPRECATED.QuestionOfDay question = WidgetData_DEPRECATED.QuestionOfDay.fromJson(firstQuestion);
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

    private static WidgetData_DEPRECATED.QuestionOfDay fetchFromGeneralQuestions(Context context) {
        try {
            String csrfToken = SharedPrefsHelper_DEPRECATED.getCsrfToken(context);
            String accessToken = SharedPrefsHelper_DEPRECATED.getAccessToken(context);

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
                        WidgetData_DEPRECATED.QuestionOfDay question = new WidgetData_DEPRECATED.QuestionOfDay();
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
