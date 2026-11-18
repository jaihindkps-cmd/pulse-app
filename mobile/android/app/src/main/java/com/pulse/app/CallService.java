package com.pulse.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;

/** Foreground service that keeps the microphone (and camera) alive while Pulse is minimized during a call. */
public class CallService extends Service {
    public static volatile boolean running = false;
    public static volatile boolean video = false;
    private static final String CHANNEL = "pulse_call";
    private PowerManager.WakeLock wl;

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        boolean video = intent != null && intent.getBooleanExtra("video", false);
        CallService.video = video;
        String title = intent != null && intent.getStringExtra("title") != null ? intent.getStringExtra("title") : "Pulse call";
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= 26 && nm != null) {
            NotificationChannel ch = new NotificationChannel(CHANNEL, "Calls in progress", NotificationManager.IMPORTANCE_LOW);
            ch.setShowBadge(false);
            nm.createNotificationChannel(ch);
        }
        Intent open = getPackageManager().getLaunchIntentForPackage(getPackageName());
        if (open != null) open.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
        PendingIntent pi = PendingIntent.getActivity(this, 0, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(this, CHANNEL) : new Notification.Builder(this);
        b.setSmallIcon(getApplicationInfo().icon).setContentTitle(title).setContentText("Tap to return to the call")
            .setOngoing(true).setContentIntent(pi);
        if (Build.VERSION.SDK_INT >= 31) b.setForegroundServiceBehavior(Notification.FOREGROUND_SERVICE_IMMEDIATE);
        Notification n = b.build();
        if (Build.VERSION.SDK_INT >= 29) {
            int type = ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE;
            if (video) type |= ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA;
            startForeground(4711, n, type);
        } else {
            startForeground(4711, n);
        }
        try {
            if (wl == null) { PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE); wl = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "pulse:call"); wl.setReferenceCounted(false); }
            if (!wl.isHeld()) wl.acquire(4 * 60 * 60 * 1000L);
        } catch (Exception e) { /* ignore */ }
        running = true;
        return START_NOT_STICKY;
    }

    @Override
    public void onDestroy() {
        running = false;
        try { if (wl != null && wl.isHeld()) wl.release(); } catch (Exception e) { /* ignore */ }
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
