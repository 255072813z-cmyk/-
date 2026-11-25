package com.onlinemasjid.app;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.graphics.Typeface;
import android.text.SpannableString;
import android.text.style.StyleSpan;
import android.widget.RemoteViews;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * 桌面小组件：下一番礼拜（名称、时间、还有多久）和这一天的五番时间。
 * 时间由应用算好交过来（未来 7 天，见 src/core/widget.js）；小组件只负责显示，到下一番的时刻自己刷新一次。
 * 7 天内不打开应用，小组件提示"打开一次应用"。
 */
public class PrayerWidget extends AppWidgetProvider {
    static final String PREFS = "joynamoz_widget";
    static final String KEY = "data";
    static final String[] PRAYERS = { "fajr", "dhuhr", "asr", "maghrib", "isha" };
    static final int[] NAME_IDS = { R.id.w_n0, R.id.w_n1, R.id.w_n2, R.id.w_n3, R.id.w_n4 };
    static final int[] TIME_IDS = { R.id.w_t0, R.id.w_t1, R.id.w_t2, R.id.w_t3, R.id.w_t4 };

    @Override
    public void onUpdate(Context ctx, AppWidgetManager mgr, int[] ids) {
        render(ctx, mgr, ids);
    }

    @Override
    public void onReceive(Context ctx, Intent intent) {
        super.onReceive(ctx, intent);
        String a = intent.getAction();
        // 改了手机时间、时区：重新画（重启后系统自己会叫小组件刷新）
        if (Intent.ACTION_TIME_CHANGED.equals(a) || Intent.ACTION_TIMEZONE_CHANGED.equals(a)) refreshAll(ctx);
    }

    static int count(Context ctx) {
        return AppWidgetManager.getInstance(ctx).getAppWidgetIds(new ComponentName(ctx, PrayerWidget.class)).length;
    }

    static void refreshAll(Context ctx) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
        int[] ids = mgr.getAppWidgetIds(new ComponentName(ctx, PrayerWidget.class));
        if (ids.length > 0) render(ctx, mgr, ids);
    }

    static void render(Context ctx, AppWidgetManager mgr, int[] ids) {
        long now = System.currentTimeMillis();
        long nextAt = 0;
        RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.widget_prayer);
        Intent open = new Intent(ctx, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        v.setOnClickPendingIntent(R.id.w_root, PendingIntent.getActivity(ctx, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        try {
            String raw = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, null);
            if (raw == null) throw new Exception("empty");
            JSONObject d = new JSONObject(raw);
            JSONObject lb = d.getJSONObject("labels");
            JSONArray days = d.getJSONArray("days");
            SimpleDateFormat hm = new SimpleDateFormat("HH:mm", Locale.US);
            int off = d.optInt("off", 0); // 城市的 UTC 偏移（分钟），时间按城市当地显示
            hm.setTimeZone(TimeZone.getTimeZone(String.format(Locale.US, "GMT%+03d:%02d", off / 60, Math.abs(off % 60))));
            // 找下一番：第一个还没到的
            int dayIdx = -1;
            int pIdx = -1;
            for (int i = 0; i < days.length() && dayIdx < 0; i++) {
                JSONObject t = days.getJSONObject(i).getJSONObject("t");
                for (int k = 0; k < PRAYERS.length; k++) {
                    if (t.getLong(PRAYERS[k]) > now) {
                        dayIdx = i;
                        pIdx = k;
                        break;
                    }
                }
            }
            if (dayIdx < 0) throw new Exception("stale");
            JSONObject day = days.getJSONObject(dayIdx);
            JSONObject t = day.getJSONObject("t");
            boolean fri = day.optBoolean("fri", false);
            nextAt = t.getLong(PRAYERS[pIdx]);
            String nextName = fri && pIdx == 1 ? lb.optString("jumuah", lb.getString("dhuhr")) : lb.getString(PRAYERS[pIdx]);
            long mins = Math.max(0, (nextAt - now + 59999) / 60000);
            String left = mins >= 60 ? String.format(Locale.US, lb.optString("leftHM", "%1$d:%2$02d"), mins / 60, mins % 60) : String.format(Locale.US, lb.optString("leftM", "%1$d min"), mins);
            v.setTextViewText(R.id.w_city, d.optString("city", ""));
            v.setTextViewText(R.id.w_next_label, lb.optString("next", ""));
            v.setTextViewText(R.id.w_next_name, nextName);
            v.setTextViewText(R.id.w_next_time, hm.format(new Date(nextAt)));
            v.setTextViewText(R.id.w_left, left);
            for (int k = 0; k < PRAYERS.length; k++) {
                String name = lb.getString(PRAYERS[k]);
                String time = hm.format(new Date(t.getLong(PRAYERS[k])));
                if (k == pIdx) {
                    v.setTextViewText(NAME_IDS[k], bold(name));
                    v.setTextViewText(TIME_IDS[k], bold(time));
                    v.setTextColor(NAME_IDS[k], 0xFF0F5940);
                    v.setTextColor(TIME_IDS[k], 0xFF0F5940);
                } else {
                    v.setTextViewText(NAME_IDS[k], name);
                    v.setTextViewText(TIME_IDS[k], time);
                    v.setTextColor(NAME_IDS[k], 0xFF5F6B64);
                    v.setTextColor(TIME_IDS[k], 0xFF1D2B24);
                }
            }
            v.setViewVisibility(R.id.w_body, android.view.View.VISIBLE);
            v.setViewVisibility(R.id.w_empty, android.view.View.GONE);
        } catch (Exception e) {
            v.setViewVisibility(R.id.w_body, android.view.View.GONE);
            v.setViewVisibility(R.id.w_empty, android.view.View.VISIBLE);
        }
        for (int id : ids) mgr.updateAppWidget(id, v);
        schedule(ctx, nextAt, now);
    }

    private static SpannableString bold(String s) {
        SpannableString out = new SpannableString(s);
        out.setSpan(new StyleSpan(Typeface.BOLD), 0, s.length(), 0);
        return out;
    }

    /** 下一番礼拜到点时（以及"还有多久"每分钟变化不必实时，最多 15 分钟刷新一次）再画一次 */
    private static void schedule(Context ctx, long nextAt, long now) {
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        Intent i = new Intent(ctx, PrayerWidget.class);
        i.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
        i.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, AppWidgetManager.getInstance(ctx).getAppWidgetIds(new ComponentName(ctx, PrayerWidget.class)));
        PendingIntent pi = PendingIntent.getBroadcast(ctx, 7, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        long at = now + 15 * 60000;
        if (nextAt > now && nextAt + 1000 < at) at = nextAt + 1000;
        // 不需要精确闹钟权限：系统可能推迟几分钟，对小组件够用
        am.setAndAllowWhileIdle(AlarmManager.RTC, at, pi);
    }
}
