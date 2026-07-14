const { withAndroidManifest, withStringsXml, withDangerousMod, AndroidConfig } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const SHORT_LABEL_NAME = 'nearest_toilet_shortcut_short_label';
const LONG_LABEL_NAME = 'nearest_toilet_shortcut_long_label';

function withNearestToiletShortcutStrings(config) {
  return withStringsXml(config, (config) => {
    config.modResults = AndroidConfig.Strings.setStringItem(
      [
        { $: { name: SHORT_LABEL_NAME }, _: 'Nächste Toilette' },
        { $: { name: LONG_LABEL_NAME }, _: 'Nächste Toilette finden' },
      ],
      config.modResults
    );
    return config;
  });
}

function withNearestToiletShortcutXml(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const packageName = config.android && config.android.package;
      if (!packageName) {
        throw new Error('withNearestToiletShortcut: android.package ist in app.json nicht gesetzt.');
      }

      const shortcutsXml = `<?xml version="1.0" encoding="utf-8"?>
<shortcuts xmlns:android="http://schemas.android.com/apk/res/android">
  <shortcut
      android:shortcutId="nearest_toilet"
      android:enabled="true"
      android:icon="@android:drawable/ic_menu_mylocation"
      android:shortcutShortLabel="@string/${SHORT_LABEL_NAME}"
      android:shortcutLongLabel="@string/${LONG_LABEL_NAME}">
    <intent
        android:action="android.intent.action.VIEW"
        android:targetPackage="${packageName}"
        android:targetClass="${packageName}.MainActivity"
        android:data="colitisapp://schnellzugriff" />
  </shortcut>
</shortcuts>
`;

      const xmlDir = path.join(config.modRequest.platformProjectRoot, 'app/src/main/res/xml');
      fs.mkdirSync(xmlDir, { recursive: true });
      fs.writeFileSync(path.join(xmlDir, 'shortcuts.xml'), shortcutsXml, 'utf-8');

      return config;
    },
  ]);
}

function withNearestToiletShortcutManifest(config) {
  return withAndroidManifest(config, (config) => {
    const androidManifest = config.modResults;
    const mainActivity = AndroidConfig.Manifest.getMainActivityOrThrow(androidManifest);

    mainActivity['meta-data'] = mainActivity['meta-data'] || [];
    const alreadyPresent = mainActivity['meta-data'].some(
      (item) => item.$ && item.$['android:name'] === 'android.app.shortcuts'
    );
    if (!alreadyPresent) {
      mainActivity['meta-data'].push({
        $: { 'android:name': 'android.app.shortcuts', 'android:resource': '@xml/shortcuts' },
      });
    }

    return config;
  });
}

module.exports = function withNearestToiletShortcut(config) {
  config = withNearestToiletShortcutStrings(config);
  config = withNearestToiletShortcutXml(config);
  config = withNearestToiletShortcutManifest(config);
  return config;
};
