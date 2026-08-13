import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

function parseCatalog(source, constantName) {
  const catalogBlock = source.match(
    new RegExp(`${constantName}\\s*=\\s*\\[([\\s\\S]*?)\\]\\s*as const`),
  )?.[1];
  assert.ok(catalogBlock, `${constantName} should be present`);

  const entries = [];
  for (const match of catalogBlock.matchAll(/\[(\d{4}), (\d{4}), \[([^\]]*)\]\]/g)) {
    const year = Number(match[1]);
    const north = Number(match[2]);
    const eastings = match[3]
      .split(",")
      .map((value) => Number(value.trim()))
      .filter(Number.isFinite);
    for (const east of eastings) entries.push({ east, id: `${east}-${north}`, north, year });
  }
  return entries;
}

test("keeps complete, independent Zermatt and Zürich regional catalogs", async () => {
  const source = await readFile(
    new URL("../app/swissAltiSource.ts", import.meta.url),
    "utf8",
  );
  const zermatt = parseCatalog(source, "SWISS_ALTI_ZERMATT_CATALOG_ROWS");
  const zurich = parseCatalog(source, "SWISS_ALTI_ZURICH_CATALOG_ROWS");

  assert.equal(zermatt.length, 298);
  assert.equal(new Set(zermatt.map(({ id }) => id)).size, 298);
  assert.deepEqual([...new Set(zermatt.map(({ year }) => year))], [2024]);
  assert.ok(zermatt.some(({ id }) => id === "2610-1092"));
  assert.ok(zermatt.some(({ id }) => id === "2636-1095"));

  assert.equal(zurich.length, 124);
  assert.equal(new Set(zurich.map(({ id }) => id)).size, 124);
  assert.equal(zurich.filter(({ year }) => year === 2019).length, 41);
  assert.equal(zurich.filter(({ year }) => year === 2020).length, 83);
  assert.equal(Math.min(...zurich.map(({ east }) => east)), 2676);
  assert.equal(Math.max(...zurich.map(({ east }) => east)), 2689);
  assert.equal(Math.min(...zurich.map(({ north }) => north)), 1241);
  assert.equal(Math.max(...zurich.map(({ north }) => north)), 1254);
  assert.ok(zurich.some(({ id, year }) => id === "2683-1248" && year === 2020));
});

test("preserves source years and creates region-scoped lookup state", async () => {
  const source = await readFile(
    new URL("../app/swissAltiSource.ts", import.meta.url),
    "utf8",
  );

  assert.match(source, /type SwissAltiRegionId = "zermatt" \| "zurich"/);
  assert.match(source, /SWISS_ALTI_REGIONS/);
  assert.match(source, /label: "Zürich"/);
  assert.match(source, /detail: "124 tiles · 2019–2020 · Swiss Plateau"/);
  assert.match(source, /createSwissAltiCog\(year, eastKm, northKm\)/);
  assert.match(source, /swissalti3d_\$\{year\}_\$\{id\}/);
  assert.match(source, /cacheKey: `\$\{year\}:\$\{id\}`/);
  assert.match(source, /Duplicate SwissALTI tile coordinate/);
  assert.match(source, /resolveSwissAltiCogs\(\s*region: SwissAltiRegionCatalog/);
  assert.match(source, /region\.cogById\.get/);
  assert.doesNotMatch(source, /swissalti3d_2024_\$\{id\}/);
});

test("switches one cached virtual elevation mosaic between regional catalogs", async () => {
  const [page, adapter] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/swissAltiElevation.ts", import.meta.url), "utf8"),
  ]);

  assert.match(page, /id="terrain-region"/);
  assert.match(page, /SWISS_ALTI_REGIONS\.map/);
  assert.match(page, /setTerrainRegionId/);
  assert.match(page, /prepareSwissAltiCatalog\(\s*ImageryTileLayer,\s*terrainRegion,/);
  assert.match(page, /terrainRegion\.initialExtent/);
  assert.match(page, /key: `terrain-scene-\$\{terrainRegion\.id\}`/);
  assert.match(page, /\[frameTerrain, loadCog, mode, sdkReady, terrainRegion\]/);
  assert.match(page, /layers: \[terrainLayer\]/);
  assert.match(page, /terrainLayer\.auditRegionalCoverage/);
  assert.match(page, /terrainRegion\.id === "zermatt"/);
  assert.match(page, /url: terrainRegion\.anchorCog\.url/);
  assert.match(page, /map\.add\?\.\(overlayLayer\)/);
  assert.match(page, /terrainOverlayLayerRef\.current/);
  assert.match(page, /Frame overlay/);
  assert.match(page, /Surface overlay · 2610-1092/);

  const auditIndex = page.indexOf("terrainLayer.auditRegionalCoverage");
  const frameIndex = page.indexOf("await frameTerrain()", auditIndex);
  const readyIndex = page.indexOf('setTerrainState("ready")', frameIndex);
  assert.ok(auditIndex >= 0, "regional validation should run");
  assert.ok(frameIndex > auditIndex, "terrain should frame after validation");
  assert.ok(readyIndex > frameIndex, "terrain should become ready after framing");

  assert.match(adapter, /resolveSwissAltiCogs\(region, requestExtent\)/);
  assert.match(adapter, /region\.validationProbes\.map/);
  assert.match(adapter, /cache\.get\(cog\.cacheKey\)/);
  assert.match(adapter, /cache\.set\(cog\.cacheKey, entry\)/);
  assert.match(adapter, /mosaicWindow/);
  assert.match(adapter, /MAX_SOURCE_CACHE_SIZE/);
  assert.match(adapter, /withSource/);
  assert.match(adapter, /fetchPixels/);
  assert.match(adapter, /SWISS_ALTI_NO_DATA_VALUE/);
  assert.doesNotMatch(
    adapter,
    /world-elevation|projectOperator|WebMercator|queryElevation/i,
  );
});
