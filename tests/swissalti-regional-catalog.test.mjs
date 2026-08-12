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

  const ids = [];
  for (const match of catalogBlock.matchAll(/\[(\d{4}), \[([^\]]*)\]\]/g)) {
    const north = Number(match[1]);
    const eastings = match[2]
      .split(",")
      .map((value) => Number(value.trim()))
      .filter(Number.isFinite);
    for (const east of eastings) ids.push(`${east}-${north}`);
  }

  assert.equal(ids.length, 298);
  assert.equal(new Set(ids).size, 298);
  assert.ok(ids.includes("2610-1092"));
  assert.ok(ids.includes("2636-1095"));
  assert.match(source, /resolveSwissAltiCogs/);
  assert.match(source, /SWISS_ALTI_REGIONAL_EXTENT/);
  assert.match(source, /swissalti3d_2024_\$\{id\}_0\.5_2056_5728\.tif/);
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
