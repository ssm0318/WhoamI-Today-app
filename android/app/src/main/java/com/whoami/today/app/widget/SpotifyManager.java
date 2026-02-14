package com.whoami.today.app.widget;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Base64;
import android.util.Log;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

public class SpotifyManager {
    private static final String TAG = "SpotifyManager";
    private static final String TOKEN_URL = "https://accounts.spotify.com/api/token";
    private static final String TRACK_URL = "https://api.spotify.com/v1/tracks/";
    private static final String PREFS_NAME = "WhoAmIWidgetPrefs";

    private Context context;
    private String accessToken;
    private long tokenExpiry;

    public SpotifyManager(Context context) {
        this.context = context;
    }

    private String getClientId() {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String s = prefs.getString("spotify_client_id", null);
        return s != null ? s.trim() : null;
    }

    private String getClientSecret() {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String s = prefs.getString("spotify_client_secret", null);
        return s != null ? s.trim() : null;
    }

    public boolean isConfigured() {
        String id = getClientId();
        String secret = getClientSecret();
        return id != null && !id.isEmpty() && secret != null && !secret.isEmpty();
    }

    private String getAccessToken() throws Exception {
        // Return cached token if still valid
        if (accessToken != null && System.currentTimeMillis() < tokenExpiry) {
            return accessToken;
        }

        String clientId = getClientId();
        String clientSecret = getClientSecret();

        if (clientId == null || clientSecret == null) {
            throw new Exception("Spotify credentials not configured");
        }

        // Request new token
        URL url = new URL(TOKEN_URL);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setRequestMethod("POST");
        conn.setRequestProperty("Content-Type", "application/x-www-form-urlencoded");

        // Basic auth header (UTF-8 like iOS: Data(credentials.utf8).base64EncodedString())
        String credentials = clientId + ":" + clientSecret;
        String encodedCredentials = Base64.encodeToString(credentials.getBytes(StandardCharsets.UTF_8), Base64.NO_WRAP);
        conn.setRequestProperty("Authorization", "Basic " + encodedCredentials);

        conn.setDoOutput(true);
        OutputStream os = conn.getOutputStream();
        os.write("grant_type=client_credentials".getBytes(StandardCharsets.UTF_8));
        os.flush();
        os.close();

        int responseCode = conn.getResponseCode();
        if (responseCode == 200) {
            BufferedReader in = new BufferedReader(new InputStreamReader(conn.getInputStream()));
            String inputLine;
            StringBuilder response = new StringBuilder();
            while ((inputLine = in.readLine()) != null) {
                response.append(inputLine);
            }
            in.close();

            JSONObject json = new JSONObject(response.toString());
            accessToken = json.getString("access_token");
            int expiresIn = json.getInt("expires_in");
            tokenExpiry = System.currentTimeMillis() + ((expiresIn - 60) * 1000); // Expire 1 min early

            return accessToken;
        } else {
            // Log error body so we can see Spotify's message (e.g. invalid_client, bad credentials)
            java.io.InputStream errStream = conn.getErrorStream();
            String errBody = "";
            if (errStream != null) {
                BufferedReader errReader = new BufferedReader(new InputStreamReader(errStream));
                StringBuilder errSb = new StringBuilder();
                String line;
                while ((line = errReader.readLine()) != null) errSb.append(line);
                errReader.close();
                errBody = errSb.toString();
            }
            Log.e(TAG, "Spotify token error " + responseCode + ": " + errBody);
            throw new Exception("Failed to get Spotify access token: " + responseCode + " " + errBody);
        }
    }

    public String getAlbumImageUrl(String trackId) {
        if (trackId == null || trackId.isEmpty()) {
            Log.d(TAG, "getAlbumImageUrl: trackId null/empty");
            return null;
        }
        try {
            if (!isConfigured()) {
                Log.d(TAG, "getAlbumImageUrl: Spotify not configured (no client_id/secret in prefs)");
                return null;
            }
            String token = getAccessToken();
            Log.d(TAG, "getAlbumImageUrl: got token, requesting track " + trackId);

            URL url = new URL(TRACK_URL + trackId);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setRequestProperty("Authorization", "Bearer " + token);

            int responseCode = conn.getResponseCode();
            Log.d(TAG, "getAlbumImageUrl: Spotify API response " + responseCode);
            if (responseCode == 200) {
                BufferedReader in = new BufferedReader(new InputStreamReader(conn.getInputStream()));
                String inputLine;
                StringBuilder response = new StringBuilder();
                while ((inputLine = in.readLine()) != null) {
                    response.append(inputLine);
                }
                in.close();

                JSONObject json = new JSONObject(response.toString());
                JSONObject album = json.getJSONObject("album");
                if (album.has("images") && album.getJSONArray("images").length() > 0) {
                    String urlStr = album.getJSONArray("images").getJSONObject(0).getString("url");
                    Log.d(TAG, "getAlbumImageUrl: success url=" + (urlStr != null ? urlStr.substring(0, Math.min(50, urlStr.length())) + "..." : "null"));
                    return urlStr;
                }
                Log.d(TAG, "getAlbumImageUrl: album has no images");
            } else {
                Log.e(TAG, "getAlbumImageUrl: Failed to get track info: " + responseCode);
            }
        } catch (Exception e) {
            Log.e(TAG, "getAlbumImageUrl: " + e.getMessage(), e);
        }
        return null;
    }
}
