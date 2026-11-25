package com.onlinemasjid.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // 应用自带的插件（桌面小组件的数据）要在 super.onCreate 之前登记
        registerPlugin(WidgetPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
