import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("defines the active elevation_suisse EPSG:2056 tile profile", async () => {
  const scheme = await readFile(
    new URL("../app/elevationSuisseScheme.ts", import.meta.url),
    "utf8",
  );
  const lodDefinitions = [
    ...scheme.matchAll(/\{ level: (\d+), resolution: ([\d.]+), scale: ([\d.]+) \}/g),
  ];

  assert.match(scheme, /elevation_suisse\/ImageServer/);
  assert.match(scheme, /EXPECTED_ORIGIN = \{ x: 2_420_000, y: 1_350_000 \}/);
  assert.match(scheme, /EXPECTED_SIZE = 512/);
  assert.match(scheme, /ELEVATION_SUISSE_MAX_LOD = 18/);
  assert.equal(lodDefinitions.length, 19);
  assert.equal(Number(lodDefinitions[0][1]), 0);
  assert.equal(Number(lodDefinitions.at(-1)[1]), 18);
  assert.equal(Number(lodDefinitions.at(-1)[2]), 0.5000635001270003);
  assert.match(scheme, /tileInfo\.format\?\.toLowerCase\(\) !== "lerc"/);
  assert.match(scheme, /metadataUrl\.searchParams\.set\("f", "json"\)/);
  assert.doesNotMatch(scheme, /\/tile\//);
});

test("routes the third mode through a COG-only custom ground", async () => {
  const [page, adapter, source] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/swissAltiElevation.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/swissAltiSource.ts", import.meta.url), "utf8"),
  ]);

  assert.match(page, /type AppMode = "imagery" \| "terrain" \| "terrain-suisse-grid"/);
  assert.match(page, /Swiss cache grid/);
  assert.match(page, /loadElevationSuisseScheme\(abortController\.signal\)/);
  assert.match(page, /tilingProfile: terrainTilingProfile/);
  assert.match(page, /layers: \[terrainLayer\]/);
  assert.doesNotMatch(page, /new ElevationLayer|@arcgis\/core\/layers\/ElevationLayer/);
  assert.match(adapter, /tilingProfile === "elevation-suisse"/);
  assert.match(adapter, /outputTileCache/);
  assert.match(adapter, /MAX_OUTPUT_TILE_CACHE_SIZE/);
  assert.match(adapter, /resolveSwissAltiCogs\(region, requestExtent\)/);
  assert.match(source, /return region\.cogs\.filter/);
  assert.doesNotMatch(source, /for \(let northKm = minNorthKm/);
});
