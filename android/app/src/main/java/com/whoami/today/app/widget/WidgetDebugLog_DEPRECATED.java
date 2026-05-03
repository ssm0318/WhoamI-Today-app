package com.whoami.today.app.widget;

import android.content.Context;
import android.util.Log;
import org.json.JSONObject;
import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStreamWriter;
import java.nio.charset.StandardCharsets;
import java.util.Map;

/** Writes NDJSON debug lines to app files dir and to logcat (tag WhoAmIWidgetDebug) for adb logcat. */
public class WidgetDebugLog_DEPRECATED {
    private static final String TAG = "WhoAmIWidgetDebug";
    private static final String FILENAME = "widget_debug.log";

    public static void log(Context context, String location, String message, Map<String, Object> data, String hypothesisId) {
        try {
            JSONObject o = new JSONObject();
            o.put("timestamp", System.currentTimeMillis());
            o.put("location", location);
            o.put("message", message);
            o.put("hypothesisId", hypothesisId);
            if (data != null) {
                for (Map.Entry<String, Object> e : data.entrySet()) {
                    Object v = e.getValue();
                    if (v instanceof Number) o.put(e.getKey(), (Number) v);
                    else if (v instanceof Boolean) o.put(e.getKey(), (Boolean) v);
                    else o.put(e.getKey(), v != null ? v.toString() : "");
                }
            }
            String line = o.toString();
            Log.w(TAG, line);
            if (context != null) {
                File dir = context.getFilesDir();
                if (dir != null) {
                    File file = new File(dir, FILENAME);
                    try (FileOutputStream fos = new FileOutputStream(file, true);
                         OutputStreamWriter w = new OutputStreamWriter(fos, StandardCharsets.UTF_8)) {
                        w.write(line + "\n");
                        w.flush();
                    }
                }
            }
        } catch (Throwable t) {
            Log.e(TAG, "log failed", t);
        }
    }
}
