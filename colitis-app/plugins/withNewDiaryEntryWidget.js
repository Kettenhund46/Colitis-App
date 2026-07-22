const { withAndroidManifest, withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const WIDGET_PROVIDER_CLASS_NAME = 'NewDiaryEntryWidgetProvider';
const DEEP_LINK_URL = 'colitisapp://tagebuch/neu';

function withNewDiaryEntryWidgetResources(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const packageName = config.android && config.android.package;
      if (!packageName) {
        throw new Error('withNewDiaryEntryWidget: android.package ist in app.json nicht gesetzt.');
      }

      const androidRoot = config.modRequest.platformProjectRoot;
      const resRoot = path.join(androidRoot, 'app/src/main/res');

      const valuesDir = path.join(resRoot, 'values');
      fs.mkdirSync(valuesDir, { recursive: true });
      fs.writeFileSync(
        path.join(valuesDir, 'widget_colors.xml'),
        `<?xml version="1.0" encoding="utf-8"?>
<resources>
  <color name="widget_background_color">#E6F4FE</color>
</resources>
`,
        'utf-8'
      );
      fs.writeFileSync(
        path.join(valuesDir, 'widget_strings.xml'),
        `<?xml version="1.0" encoding="utf-8"?>
<resources>
  <string name="widget_new_diary_entry_label">Neuer Tagebucheintrag</string>
  <string name="widget_new_diary_entry_description">Neuer Tagebucheintrag</string>
</resources>
`,
        'utf-8'
      );

      const valuesNightDir = path.join(resRoot, 'values-night');
      fs.mkdirSync(valuesNightDir, { recursive: true });
      fs.writeFileSync(
        path.join(valuesNightDir, 'widget_colors.xml'),
        `<?xml version="1.0" encoding="utf-8"?>
<resources>
  <color name="widget_background_color">#2A2A2A</color>
</resources>
`,
        'utf-8'
      );

      const drawableDir = path.join(resRoot, 'drawable');
      fs.mkdirSync(drawableDir, { recursive: true });
      fs.writeFileSync(
        path.join(drawableDir, 'widget_background.xml'),
        `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android">
  <solid android:color="@color/widget_background_color" />
  <corners android:radius="16dp" />
</shape>
`,
        'utf-8'
      );

      const iconSource = path.join(config.modRequest.projectRoot, 'assets/images/android-icon-monochrome.png');
      fs.copyFileSync(iconSource, path.join(drawableDir, 'widget_new_diary_entry_icon.png'));

      const layoutDir = path.join(resRoot, 'layout');
      fs.mkdirSync(layoutDir, { recursive: true });
      fs.writeFileSync(
        path.join(layoutDir, 'widget_new_diary_entry.xml'),
        `<?xml version="1.0" encoding="utf-8"?>
<FrameLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:background="@drawable/widget_background">

    <ImageView
        android:id="@+id/widget_icon"
        android:layout_width="32dp"
        android:layout_height="32dp"
        android:layout_gravity="center"
        android:src="@drawable/widget_new_diary_entry_icon"
        android:contentDescription="@string/widget_new_diary_entry_description" />

</FrameLayout>
`,
        'utf-8'
      );

      const xmlDir = path.join(resRoot, 'xml');
      fs.mkdirSync(xmlDir, { recursive: true });
      fs.writeFileSync(
        path.join(xmlDir, 'new_diary_entry_widget_info.xml'),
        `<?xml version="1.0" encoding="utf-8"?>
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
    android:minWidth="40dp"
    android:minHeight="40dp"
    android:targetCellWidth="1"
    android:targetCellHeight="1"
    android:updatePeriodMillis="0"
    android:resizeMode="none"
    android:widgetCategory="home_screen"
    android:initialLayout="@layout/widget_new_diary_entry" />
`,
        'utf-8'
      );

      const javaDir = path.join(androidRoot, 'app/src/main/java', packageName.replace(/\./g, '/'));
      fs.mkdirSync(javaDir, { recursive: true });
      fs.writeFileSync(
        path.join(javaDir, `${WIDGET_PROVIDER_CLASS_NAME}.kt`),
        `package ${packageName}

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.RemoteViews

class ${WIDGET_PROVIDER_CLASS_NAME} : AppWidgetProvider() {
    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        for (appWidgetId in appWidgetIds) {
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse("${DEEP_LINK_URL}"))
            val pendingIntent = PendingIntent.getActivity(
                context,
                0,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            val views = RemoteViews(context.packageName, R.layout.widget_new_diary_entry)
            views.setOnClickPendingIntent(R.id.widget_icon, pendingIntent)

            appWidgetManager.updateAppWidget(appWidgetId, views)
        }
    }
}
`,
        'utf-8'
      );

      return config;
    },
  ]);
}

function withNewDiaryEntryWidgetManifest(config) {
  return withAndroidManifest(config, (config) => {
    const androidManifest = config.modResults;
    const application = androidManifest.manifest.application[0];

    application.receiver = application.receiver || [];

    const alreadyPresent = application.receiver.some(
      (receiver) => receiver.$ && receiver.$['android:name'] === `.${WIDGET_PROVIDER_CLASS_NAME}`
    );

    if (!alreadyPresent) {
      application.receiver.push({
        $: {
          'android:name': `.${WIDGET_PROVIDER_CLASS_NAME}`,
          'android:exported': 'true',
          'android:label': '@string/widget_new_diary_entry_label',
        },
        'intent-filter': [
          {
            action: [{ $: { 'android:name': 'android.appwidget.action.APPWIDGET_UPDATE' } }],
          },
        ],
        'meta-data': [
          {
            $: {
              'android:name': 'android.appwidget.provider',
              'android:resource': '@xml/new_diary_entry_widget_info',
            },
          },
        ],
      });
    }

    return config;
  });
}

module.exports = function withNewDiaryEntryWidget(config) {
  config = withNewDiaryEntryWidgetResources(config);
  config = withNewDiaryEntryWidgetManifest(config);
  return config;
};

module.exports.WIDGET_PROVIDER_CLASS_NAME = WIDGET_PROVIDER_CLASS_NAME;
