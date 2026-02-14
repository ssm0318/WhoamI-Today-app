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
        return prefs.getString("spotify_client_id", null);
    }

    private String getClientSecret() {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        return prefs.getString("spotify_client_secret", null);
    }

    public boolean isConfigured() {
        return getClientId() != null && getClientSecret() != null;
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

        // Basic auth header
        String credentials = clientId + ":" + clientSecret;
        String encodedCredentials = Base64.encodeToString(credentials.getBytes(), Base64.NO_WRAP);
        conn.setRequestProperty("Authorization", "Basic " + encodedCredentials);

        conn.setDoOutput(true);
        OutputStream os = conn.getOutputStream();
        os.write("grant_type=client_credentials".getBytes());
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
            throw new Exception("Failed to get Spotify access token: " + responseCode);
        }
    }

    public String getAlbumImageUrl(String trackId) {
        try {
            String token = getAccessToken();

            URL url = new URL(TRACK_URL + trackId);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setRequestProperty("Authorization", "Bearer " + token);

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
                JSONObject album = json.getJSONObject("album");
                if (album.has("images") && album.getJSONArray("images").length() > 0) {
                    return album.getJSONArray("images").getJSONObject(0).getString("url");
                }
            } else {
                Log.e(TAG, "Failed to get track info: " + responseCode);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error fetching album image: " + e.getMessage());
        }
        return null;
    }
}
