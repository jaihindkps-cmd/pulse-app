package com.pulse.app;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.media.AudioDeviceInfo;
import android.media.AudioManager;
import android.os.Build;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.util.ArrayList;
import java.util.List;

/** Chooses where call audio plays: phone earpiece, loudspeaker, wired headset or Bluetooth. */
@CapacitorPlugin(
    name = "AudioRoute",
    permissions = {
        @Permission(strings = { Manifest.permission.BLUETOOTH_CONNECT }, alias = "bt"),
        @Permission(strings = { Manifest.permission.POST_NOTIFICATIONS }, alias = "notif")
    }
)
public class AudioRoutePlugin extends Plugin {
    private int prevMode = AudioManager.MODE_NORMAL;
    private boolean active = false;

    private AudioManager am() {
        return (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
    }

    private static String kindOf(int type) {
        switch (type) {
            case AudioDeviceInfo.TYPE_BUILTIN_EARPIECE: return "earpiece";
            case AudioDeviceInfo.TYPE_BUILTIN_SPEAKER: return "speaker";
            case AudioDeviceInfo.TYPE_BLUETOOTH_SCO:
            case AudioDeviceInfo.TYPE_BLUETOOTH_A2DP:
            case 26: /* TYPE_BLE_HEADSET */
            case 27: /* TYPE_BLE_SPEAKER */
                return "bluetooth";
            case AudioDeviceInfo.TYPE_WIRED_HEADSET:
            case AudioDeviceInfo.TYPE_WIRED_HEADPHONES:
            case AudioDeviceInfo.TYPE_USB_HEADSET:
            case AudioDeviceInfo.TYPE_USB_DEVICE:
                return "wired";
            case AudioDeviceInfo.TYPE_HEARING_AID: return "bluetooth";
            default: return "";
        }
    }

    private boolean needsBtPermission() {
        return Build.VERSION.SDK_INT >= 31 && getPermissionState("bt") != PermissionState.GRANTED;
    }

    private List<AudioDeviceInfo> candidates(AudioManager a) {
        List<AudioDeviceInfo> out = new ArrayList<>();
        if (Build.VERSION.SDK_INT >= 31) {
            try { out.addAll(a.getAvailableCommunicationDevices()); } catch (Exception e) { /* ignore */ }
        } else {
            for (AudioDeviceInfo d : a.getDevices(AudioManager.GET_DEVICES_OUTPUTS)) out.add(d);
        }
        return out;
    }

    private void applyDefault(AudioManager a, boolean speaker) {
        List<AudioDeviceInfo> l = candidates(a);
        AudioDeviceInfo bt = null, wired = null, spk = null, ear = null;
        for (AudioDeviceInfo d : l) {
            String k = kindOf(d.getType());
            if (k.equals("bluetooth") && d.getType() != AudioDeviceInfo.TYPE_BLUETOOTH_A2DP && bt == null) bt = d;
            else if (k.equals("wired") && wired == null) wired = d;
            else if (k.equals("speaker") && spk == null) spk = d;
            else if (k.equals("earpiece") && ear == null) ear = d;
        }
        AudioDeviceInfo pick = bt != null ? bt : wired != null ? wired : (speaker ? spk : ear);
        setDevice(a, pick, pick == null ? (speaker ? "speaker" : "earpiece") : kindOf(pick.getType()));
    }

    @SuppressWarnings("deprecation")
    private void setDevice(AudioManager a, AudioDeviceInfo d, String kind) {
        if (Build.VERSION.SDK_INT >= 31 && d != null) {
            try { a.setCommunicationDevice(d); return; } catch (Exception e) { /* fall through */ }
        }
        if (kind.equals("bluetooth")) {
            a.setSpeakerphoneOn(false);
            a.startBluetoothSco();
            a.setBluetoothScoOn(true);
        } else {
            try { a.stopBluetoothSco(); } catch (Exception e) { /* ignore */ }
            a.setBluetoothScoOn(false);
            a.setSpeakerphoneOn(kind.equals("speaker"));
        }
    }

    /** Keeps the call (mic/camera) alive when the app is minimized. */
    @PluginMethod
    public void startService(PluginCall call) {
        Intent i = new Intent(getContext(), CallService.class);
        i.putExtra("video", Boolean.TRUE.equals(call.getBoolean("video", false)));
        i.putExtra("title", call.getString("title", "Pulse call"));
        try {
            if (Build.VERSION.SDK_INT >= 26) getContext().startForegroundService(i); else getContext().startService(i);
        } catch (Exception e) { /* call still works while the app is open */ }
        if (Build.VERSION.SDK_INT >= 33 && getPermissionState("notif") != PermissionState.GRANTED) {
            requestPermissionForAlias("notif", call, "notifDone");
            return;
        }
        call.resolve();
    }

    @PermissionCallback
    private void notifDone(PluginCall call) {
        call.resolve();
    }

    @PluginMethod
    public void stopService(PluginCall call) {
        try { getContext().stopService(new Intent(getContext(), CallService.class)); } catch (Exception e) { /* ignore */ }
        call.resolve();
    }

    @PluginMethod
    public void start(PluginCall call) {
        AudioManager a = am();
        if (!active) { prevMode = a.getMode(); active = true; }
        a.setMode(AudioManager.MODE_IN_COMMUNICATION);
        if (needsBtPermission()) {
            // Ask once so Bluetooth headsets can be used; the call works without it.
            requestPermissionForAlias("bt", call, "startAfterPerm");
            return;
        }
        applyDefault(a, Boolean.TRUE.equals(call.getBoolean("speaker", false)));
        call.resolve();
    }

    @PermissionCallback
    private void startAfterPerm(PluginCall call) {
        applyDefault(am(), Boolean.TRUE.equals(call.getBoolean("speaker", false)));
        call.resolve();
    }

    @PluginMethod
    public void list(PluginCall call) {
        AudioManager a = am();
        JSArray arr = new JSArray();
        boolean hasSpeaker = false, hasEarpiece = false;
        List<String> seen = new ArrayList<>();
        for (AudioDeviceInfo d : candidates(a)) {
            String k = kindOf(d.getType());
            if (k.isEmpty()) continue;
            if (d.getType() == AudioDeviceInfo.TYPE_BLUETOOTH_A2DP && Build.VERSION.SDK_INT < 31) continue;
            String key = k + ":" + d.getProductName();
            if (!k.equals("speaker") && !k.equals("earpiece") && seen.contains(key)) continue;
            seen.add(key);
            if (k.equals("speaker")) hasSpeaker = true;
            if (k.equals("earpiece")) hasEarpiece = true;
            JSObject o = new JSObject();
            o.put("id", d.getId());
            o.put("kind", k);
            o.put("name", d.getProductName() == null ? "" : d.getProductName().toString());
            arr.put(o);
        }
        // Older phones do not list the built-in outputs as communication devices; always offer both.
        if (!hasEarpiece) { JSObject o = new JSObject(); o.put("id", -1); o.put("kind", "earpiece"); o.put("name", ""); arr.put(o); }
        if (!hasSpeaker) { JSObject o = new JSObject(); o.put("id", -2); o.put("kind", "speaker"); o.put("name", ""); arr.put(o); }
        String cur = "earpiece";
        if (Build.VERSION.SDK_INT >= 31) {
            try { AudioDeviceInfo c = a.getCommunicationDevice(); if (c != null) cur = kindOf(c.getType()); } catch (Exception e) { /* ignore */ }
        } else if (a.isBluetoothScoOn()) cur = "bluetooth";
        else if (a.isSpeakerphoneOn()) cur = "speaker";
        JSObject res = new JSObject();
        res.put("devices", arr);
        res.put("current", cur);
        call.resolve(res);
    }

    @PluginMethod
    public void set(PluginCall call) {
        AudioManager a = am();
        int id = call.getInt("id", -1);
        String kind = call.getString("kind", "earpiece");
        AudioDeviceInfo target = null;
        for (AudioDeviceInfo d : candidates(a)) if (d.getId() == id) { target = d; break; }
        if (!active) { prevMode = a.getMode(); active = true; a.setMode(AudioManager.MODE_IN_COMMUNICATION); }
        setDevice(a, target, kind);
        call.resolve();
    }

    @SuppressWarnings("deprecation")
    @PluginMethod
    public void stop(PluginCall call) {
        AudioManager a = am();
        if (active) {
            try { if (Build.VERSION.SDK_INT >= 31) a.clearCommunicationDevice(); } catch (Exception e) { /* ignore */ }
            try { a.stopBluetoothSco(); } catch (Exception e) { /* ignore */ }
            a.setBluetoothScoOn(false);
            a.setSpeakerphoneOn(false);
            a.setMode(prevMode);
            active = false;
        }
        call.resolve();
    }
}
