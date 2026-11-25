package com.onlinemasjid.app;

import android.content.Context;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * 网页那边把未来 7 天的礼拜时间交给桌面小组件（只存在手机里，不联网）。
 * 每次打开应用、改城市或设置时，网页会调用 Widget.update({ data: "..." })。
 */
@CapacitorPlugin(name = "Widget")
public class WidgetPlugin extends Plugin {
    @PluginMethod
    public void update(PluginCall call) {
        String data = call.getString("data");
        if (data == null || data.length() > 20000) {
            call.reject("bad data");
            return;
        }
        Context ctx = getContext();
        ctx.getSharedPreferences(PrayerWidget.PREFS, Context.MODE_PRIVATE).edit().putString(PrayerWidget.KEY, data).apply();
        PrayerWidget.refreshAll(ctx);
        JSObject ret = new JSObject();
        ret.put("widgets", PrayerWidget.count(ctx));
        call.resolve(ret);
    }
}
