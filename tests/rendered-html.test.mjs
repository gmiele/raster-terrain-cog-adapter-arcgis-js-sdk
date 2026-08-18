import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders all three Raster Terrain Lab modes", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /Raster Terrain Lab/);
  assert.match(html, /Cloud imagery/);
  assert.match(html, /SwissALTI terrain/);
  assert.match(html, /Swiss cache grid/);
  assert.match(html, /Zürich/);
  assert.match(html, /Bring a cloud raster into 3D/);
  assert.match(html, /ArcGIS JS SDK/);
});

test("keeps the experimental scene on web components and EPSG:2056", async () => {
  const [page, adapter] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/swissAltiElevation.ts", import.meta.url), "utf8"),
  ]);

  assert.match(page, /"viewing-mode": "local"/);
  assert.match(page, /spatialReference: \{ wkid: SWISS_ALTI_HORIZONTAL_WKID \}/);
  assert.match(page, /createElement\(\s*"arcgis-scene"/);
  assert.doesNotMatch(page, /new\s+SceneView\s*\(/);
  assert.doesNotMatch(adapter, /world-elevation|projectOperator|WebMercator/i);
  assert.match(adapter, /ImageryTileLayer/);
  assert.match(adapter, /fetchPixels/);
  assert.match(page, /Ground validation/);
  assert.match(page, /ground verified/);
  assert.match(page, /interior, seam, and no-data probes passed/);
  assert.doesNotMatch(page, /queryElevation|center elevation/i);
});

test("nests terrain analysis tools in six grouped expands", async () => {
  const page = await readFile(
    new URL("../app/page.tsx", import.meta.url),
    "utf8",
  );

  assert.match(page, /key: "terrain-daylight-expand"/);
  assert.match(page, /key: "terrain-measurement-expand"/);
  assert.match(page, /key: "terrain-line-of-sight-expand"/);
  assert.match(page, /key: "terrain-viewshed-expand"/);
  assert.match(page, /key: "terrain-volume-measurement-expand"/);
  assert.match(page, /"expand-icon": "viewshed"/);
  assert.match(page, /"expand-icon": "cut-and-fill-volume-calculation"/);
  assert.doesNotMatch(page, /\bicon: "(?:viewshed|cut-and-fill-volume-calculation)"/);
  assert.match(page, /key: "terrain-elevation-profile-expand"/);
  assert.match(page, /createElement\("arcgis-daylight"/);
  assert.match(page, /createElement\("arcgis-direct-line-measurement-3d"/);
  assert.match(page, /createElement\("arcgis-area-measurement-3d"/);
  assert.match(page, /createElement\("arcgis-line-of-sight"/);
  assert.match(page, /createElement\("arcgis-volume-measurement"/);
  assert.match(page, /createElement\("arcgis-elevation-profile"/);
  assert.match(page, /@arcgis\/core\/analysis\/ViewshedAnalysis\.js/);
  assert.match(page, /sceneElement\.analyses\.add\(analysis\)/);
  assert.match(page, /sceneElement\.whenAnalysisView\(analysis\)/);
  assert.match(page, /analysisView\.place\(\{ signal: controller\.signal \}\)/);
  assert.match(page, /group: "terrain-tools"/);
  assert.match(page, /slot: "top-right"/);
  assert.match(page, /unit: "metric"/);
  assert.match(page, /directLineMeasurement\.state === "measuring"/);
  assert.match(page, /areaMeasurement\.state === "measuring"/);
  assert.match(page, /!measurementExpand\.expanded/);
  assert.match(page, /!lineOfSightExpand\.expanded/);
  assert.match(page, /lineOfSight\.clear/);
  assert.match(page, /!viewshedExpand\.expanded/);
  assert.match(page, /clearViewsheds\(\)/);
  assert.match(page, /volumeMeasurementExpandRef/);
  assert.match(page, /elevationProfileExpandRef/);
  assert.match(page, /!expand\.expanded/);
  assert.match(page, /tool\.clear/);
  assert.match(page, /areaDisplayUnit: "metric"/);
  assert.match(page, /volumeDisplayUnit: "metric"/);
  assert.match(page, /distanceUnit: "metric"/);
  assert.match(page, /elevationUnit: "metric"/);
  assert.doesNotMatch(page, /createElement\("arcgis-viewshed"/);
  assert.ok(
    page.indexOf('key: "terrain-viewshed-expand"') >
      page.indexOf('key: "terrain-line-of-sight-expand"'),
    "Viewshed should be listed below Line of sight",
  );
  assert.ok(
    page.indexOf('key: "terrain-volume-measurement-expand"') >
      page.indexOf('key: "terrain-viewshed-expand"'),
    "Volume measurement should be listed below Viewshed",
  );
  assert.ok(
    page.indexOf('key: "terrain-elevation-profile-expand"') >
      page.indexOf('key: "terrain-volume-measurement-expand"'),
    "Elevation profile should be listed below Volume measurement",
  );
  assert.doesNotMatch(page, /new\s+(?:Daylight|DirectLineMeasurement3D|AreaMeasurement3D|LineOfSight)\s*\(/);
});
