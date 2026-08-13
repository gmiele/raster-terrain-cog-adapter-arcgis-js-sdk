import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("imports all 298 regional SwissALTI COG coordinates", async () => {
  const source = await readFile(
    new URL("../app/swissAltiSource.ts", import.meta.url),
    "utf8",
  );
  const catalogBlock = source.match(
    /SWISS_ALTI_CATALOG_ROWS\s*=\s*\[([\s\S]*?)\]\s*as const/,
  )?.[1];
  assert.ok(catalogBlock, "regional catalog rows should be present");

  const entries = [];
  for (const match of catalogBlock.matchAll(/\[(\d{4}), (\d{4}), \[([^\]]*)\]\]/g)) {
    const year = Number(match[1]);
    const north = Number(match[2]);
    const eastings = match[3]
      .split(",")
      .map((value) => Number(value.trim()))
      .filter(Number.isFinite);
    for (const east of eastings) entries.push({ id: `${east}-${north}`, year });
  }

  const ids = entries.map(({ id }) => id);
  assert.equal(ids.length, 298);
  assert.equal(new Set(ids).size, 298);
  assert.deepEqual([...new Set(entries.map(({ year }) => year))], [2024]);
  assert.ok(ids.includes("2610-1092"));
  assert.ok(ids.includes("2636-1095"));
  assert.match(source, /resolveSwissAltiCogs/);
  assert.match(source, /SWISS_ALTI_REGIONAL_EXTENT/);
  assert.match(source, /createSwissAltiCatalog/);
  assert.match(source, /swissalti3d_\$\{year\}_\$\{id\}_0\.5_2056_5728\.tif/);
  assert.doesNotMatch(source, /swissalti3d_2024_\$\{id\}/);
});

test("preserves each source year for mixed-year catalogs such as Zürich", async () => {
  const source = await readFile(
    new URL("../app/swissAltiSource.ts", import.meta.url),
    "utf8",
  );

  assert.match(source, /year: number/);
  assert.match(source, /\[year, northKm, eastings\]/);
  assert.match(source, /createSwissAltiCog\(year, eastKm, northKm\)/);
  assert.match(source, /swissalti3d_\$\{year\}_\$\{id\}/);
  assert.match(source, /Duplicate SwissALTI tile coordinate/);
});

test("builds one cached virtual elevation mosaic without reprojection", async () => {
  const [page, adapter] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/swissAltiElevation.ts", import.meta.url), "utf8"),
  ]);

  assert.match(page, /prepareSwissAltiCatalog/);
  assert.match(page, /layers: \[terrainLayer\]/);
  assert.match(page, /terrainLayer\.auditRegionalCoverage/);
  assert.match(page, /metadata\.sourcePixelCount/);
  assert.match(page, /SWISS_ALTI_COGS\.length/);

  const auditIndex = page.indexOf("terrainLayer.auditRegionalCoverage");
  const frameIndex = page.indexOf("await frameTerrain()", auditIndex);
  const readyIndex = page.indexOf('setTerrainState("ready")', frameIndex);
  assert.ok(auditIndex >= 0, "regional validation should run");
  assert.ok(frameIndex > auditIndex, "terrain should frame after validation");
  assert.ok(readyIndex > frameIndex, "terrain should become ready after framing");

  assert.match(adapter, /resolveSwissAltiCogs\(requestExtent\)/);
  assert.match(adapter, /mosaicWindow/);
  assert.match(adapter, /MAX_SOURCE_CACHE_SIZE/);
  assert.match(adapter, /withSource/);
  assert.match(adapter, /fetchPixels/);
  assert.match(adapter, /intentional-hole/);
  assert.match(adapter, /SWISS_ALTI_NO_DATA_VALUE/);
  assert.doesNotMatch(
    adapter,
    /world-elevation|projectOperator|WebMercator|queryElevation/i,
  );
});
