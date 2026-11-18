package com.pulse.app;

import android.app.PictureInPictureParams;
import android.os.Build;
import android.os.Bundle;
import android.util.Rational;
import android.webkit.WebView;

import androidx.activity.OnBackPressedCallback;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AudioRoutePlugin.class);
        super.onCreate(savedInstanceState);
        // Back during a call minimizes Pulse (like WhatsApp) instead of closing it and ending the call.
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (CallService.running) { moveTaskToBack(true); return; }
                setEnabled(false);
                getOnBackPressedDispatcher().onBackPressed();
                setEnabled(true);
            }
        });
    }

    /** Home / recents during a call: video calls shrink to a floating window, voice calls keep running in the background. */
    @Override
    public void onUserLeaveHint() {
        super.onUserLeaveHint();
        if (CallService.running && CallService.video && Build.VERSION.SDK_INT >= 26) {
            try { enterPictureInPictureMode(new PictureInPictureParams.Builder().setAspectRatio(new Rational(9, 16)).build()); } catch (Exception e) { /* ignore */ }
        }
    }

    private void keepAlive() {
        if (CallService.running && getBridge() != null) {
            WebView w = getBridge().getWebView();
            if (w != null) { w.onResume(); w.resumeTimers(); }
        }
    }

    @Override
    public void onPause() { super.onPause(); keepAlive(); }

    @Override
    public void onStop() { super.onStop(); keepAlive(); }
}
