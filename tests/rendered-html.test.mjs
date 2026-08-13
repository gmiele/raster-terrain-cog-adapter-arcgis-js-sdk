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

test("server-renders both Raster Terrain Lab modes", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /Raster Terrain Lab/);
  assert.match(html, /Cloud imagery/);
  assert.match(html, /SwissALTI terrain/);
  assert.match(html, /Zürich/);
  assert.match(html, /Bring a cloud raster into 3D/);
  assert.match(html, /ArcGIS(?: Maps SDK for JavaScript -| SDK) 5\.1/);
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
