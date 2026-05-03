package com.whoami.today.app.bridge;

import android.net.Uri;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

import javax.annotation.Nullable;

/**
 * Exposes the initial Intent's data URI to JS so getInitialURL() can use it when
 * Linking.getInitialURL() returns null on cold start (e.g. from widget).
 */
public class InitialURLModule extends ReactContextBaseJavaModule {

  public InitialURLModule(ReactApplicationContext context) {
    super(context);
  }

  @Override
  public String getName() {
    return "InitialURLModule";
  }

  @ReactMethod
  public void getStoredInitialURL(Promise promise) {
    try {
      Uri uri = getInitialIntentUri();
      if (uri != null) {
        promise.resolve(uri.toString());
      } else {
        promise.resolve(null);
      }
    } catch (Exception e) {
      promise.reject("ERROR", e.getMessage());
    }
  }

  /** No-op on Android (URL comes from Intent each time). Kept for API parity with iOS. */
  @ReactMethod
  public void clearStoredInitialURL(Promise promise) {
    promise.resolve(null);
  }

  @Nullable
  private Uri getInitialIntentUri() {
    if (getCurrentActivity() == null) {
      return null;
    }
    return getCurrentActivity().getIntent() != null
        ? getCurrentActivity().getIntent().getData()
        : null;
  }
}
