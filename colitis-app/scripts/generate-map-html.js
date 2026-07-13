const fs = require('fs');
const path = require('path');

const leafletJs = fs.readFileSync(
  path.join(__dirname, '../node_modules/leaflet/dist/leaflet.js'),
  'utf-8'
);
const leafletCss = fs.readFileSync(
  path.join(__dirname, '../node_modules/leaflet/dist/leaflet.css'),
  'utf-8'
);

const bridgeScript = `
  var map = L.map('map', { zoomControl: false }).setView([51.1657, 10.4515], 13);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap-Mitwirkende'
  }).addTo(map);

  var markers = {};

  window.setCenter = function(lat, lon) {
    map.setView([lat, lon], 15);
  };

  window.setToilets = function(toiletsJson) {
    var toilets = JSON.parse(toiletsJson);
    Object.keys(markers).forEach(function(id) {
      map.removeLayer(markers[id]);
      delete markers[id];
    });
    toilets.forEach(function(toilet) {
      var marker = L.marker([toilet.latitude, toilet.longitude]).addTo(map);
      marker.on('click', function() {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'markerTap', id: toilet.id }));
      });
      markers[toilet.id] = marker;
    });
  };

  map.on('moveend', function() {
    var center = map.getCenter();
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'regionChange', latitude: center.lat, longitude: center.lng }));
  });

  window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }));
`;

const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <style>
    html, body, #map { height: 100%; margin: 0; padding: 0; }
    ${leafletCss}
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    ${leafletJs}
  </script>
  <script>
    ${bridgeScript}
  </script>
</body>
</html>`;

const output = `// GENERATED FILE - do not edit by hand.
// Regenerate with: node scripts/generate-map-html.js
// (requires the "leaflet" devDependency to be installed)
export const MAP_HTML: string = ${JSON.stringify(html)};
`;

fs.writeFileSync(path.join(__dirname, '../src/features/toilets/mapHtml.generated.ts'), output);
console.log('Wrote src/features/toilets/mapHtml.generated.ts');
