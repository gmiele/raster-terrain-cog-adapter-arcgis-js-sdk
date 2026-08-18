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

function parseCatalogRuns(source, constantName) {
  const catalogBlock = source.match(
    new RegExp(`${constantName}\\s*=\\s*\\[([\\s\\S]*?)\\]\\s*as const`),
  )?.[1];
  assert.ok(catalogBlock, `${constantName} should be present`);

  const entries = [];
  const rowPattern =
    /\[(\d{4}), (\d{4}), \[((?:\[\d{4}, \d{4}\](?:, )?)*)\]\]/g;
  for (const row of catalogBlock.matchAll(rowPattern)) {
    const year = Number(row[1]);
    const north = Number(row[2]);
    for (const range of row[3].matchAll(/\[(\d{4}), (\d{4})\]/g)) {
      const start = Number(range[1]);
      const end = Number(range[2]);
      for (let east = start; east <= end; east += 1) {
        entries.push({ east, id: `${east}-${north}`, north, year });
      }
    }
  }
  return entries;
}

test("keeps complete, independent SwissALTI regional catalogs", async () => {
  const source = await readFile(
    new URL("../app/swissAltiSource.ts", import.meta.url),
    "utf8",
  );
  const zermatt = parseCatalog(source, "SWISS_ALTI_ZERMATT_CATALOG_ROWS");
  const zurich = parseCatalog(source, "SWISS_ALTI_ZURICH_CATALOG_ROWS");
  const bern = parseCatalogRuns(source, "SWISS_ALTI_BERN_CATALOG_RUNS");
  const chur = parseCatalogRuns(source, "SWISS_ALTI_CHUR_CATALOG_RUNS");
  const parpan = parseCatalogRuns(source, "SWISS_ALTI_PARPAN_CATALOG_RUNS");
  const vazObervaz = parseCatalogRuns(
    source,
    "SWISS_ALTI_VAZ_OBERVAZ_CATALOG_RUNS",
  );

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

  assert.equal(bern.length, 6380);
  assert.equal(new Set(bern.map(({ id }) => id)).size, 6380);
  assert.equal(bern.filter(({ year }) => year === 2021).length, 7);
  assert.equal(bern.filter(({ year }) => year === 2025).length, 6373);
  assert.equal(Math.min(...bern.map(({ east }) => east)), 2556);
  assert.equal(Math.max(...bern.map(({ east }) => east)), 2677);
  assert.equal(Math.min(...bern.map(({ north }) => north)), 1130);
  assert.equal(Math.max(...bern.map(({ north }) => north)), 1243);
  assert.ok(bern.some(({ id, year }) => id === "2616-1186" && year === 2025));
  assert.ok(!bern.some(({ id }) => id === "2593-1234"));

  assert.equal(chur.length, 114);
  assert.equal(new Set(chur.map(({ id }) => id)).size, 114);
  assert.deepEqual([...new Set(chur.map(({ year }) => year))], [2023]);
  assert.equal(Math.min(...chur.map(({ east }) => east)), 2753);
  assert.equal(Math.max(...chur.map(({ east }) => east)), 2768);
  assert.equal(Math.min(...chur.map(({ north }) => north)), 1180);
  assert.equal(Math.max(...chur.map(({ north }) => north)), 1196);
  assert.ok(chur.some(({ id }) => id === "2760-1189"));
  assert.ok(!chur.some(({ id }) => id === "2761-1187"));

  assert.equal(parpan.length, 71);
  assert.equal(new Set(parpan.map(({ id }) => id)).size, 71);
  assert.deepEqual([...new Set(parpan.map(({ year }) => year))], [2023]);
  assert.equal(Math.min(...parpan.map(({ east }) => east)), 2756);
  assert.equal(Math.max(...parpan.map(({ east }) => east)), 2764);
  assert.equal(Math.min(...parpan.map(({ north }) => north)), 1179);
  assert.equal(Math.max(...parpan.map(({ north }) => north)), 1189);
  assert.ok(parpan.some(({ id }) => id === "2760-1184"));
  assert.ok(!parpan.some(({ id }) => id === "2763-1186"));

  assert.equal(vazObervaz.length, 65);
  assert.equal(new Set(vazObervaz.map(({ id }) => id)).size, 65);
  assert.deepEqual([...new Set(vazObervaz.map(({ year }) => year))], [2023]);
  assert.equal(Math.min(...vazObervaz.map(({ east }) => east)), 2756);
  assert.equal(Math.max(...vazObervaz.map(({ east }) => east)), 2765);
  assert.equal(Math.min(...vazObervaz.map(({ north }) => north)), 1171);
  assert.equal(Math.max(...vazObervaz.map(({ north }) => north)), 1182);
  assert.ok(vazObervaz.some(({ id }) => id === "2760-1176"));
  assert.ok(!vazObervaz.some(({ id }) => id === "2762-1181"));
});

test("preserves source years and creates region-scoped lookup state", async () => {
  const source = await readFile(
    new URL("../app/swissAltiSource.ts", import.meta.url),
    "utf8",
  );

  assert.match(source, /type SwissAltiRegionId =/);
  assert.match(source, /\| "parpan"/);
  assert.match(source, /\| "vaz-obervaz"/);
  assert.match(source, /SWISS_ALTI_REGIONS/);
  assert.match(source, /label: "Zürich"/);
  assert.match(source, /label: "Canton Bern"/);
  assert.match(source, /label: "Chur"/);
  assert.match(source, /label: "Parpan"/);
  assert.match(source, /label: "Vaz\/Obervaz"/);
  assert.match(source, /detail: "124 tiles · 2019–2020 · Swiss Plateau"/);
  assert.match(source, /detail: "6,380 tiles · 2021 & 2025 · Swiss Plateau and Alps"/);
  assert.match(source, /detail: "114 tiles · 2023 · Graubünden"/);
  assert.match(source, /detail: "71 tiles · 2023 · Graubünden"/);
  assert.match(source, /detail: "65 tiles · 2023 · Graubünden"/);
  assert.match(source, /expandSwissAltiCatalogRuns/);
  assert.match(source, /createSwissAltiCog\(year, eastKm, northKm\)/);
  assert.match(source, /swissalti3d_\$\{year\}_\$\{id\}/);
  assert.match(source, /cacheKey: `\$\{year\}:\$\{id\}`/);
  assert.match(source, /Duplicate SwissALTI tile coordinate/);
  assert.match(source, /resolveSwissAltiCogs\(\s*region: SwissAltiRegionCatalog/);
  assert.match(source, /region\.cogById\.get/);
  assert.match(source, /for \(let northKm = minNorthKm/);
  assert.doesNotMatch(source, /region\.cogs\.filter/);
  assert.doesNotMatch(source, /swissalti3d_2024_\$\{id\}/);
});

test("resolves regional coverage without filling catalog holes", async () => {
  const { getSwissAltiRegion, resolveSwissAltiCogs } = await import(
    "../app/swissAltiSource.ts"
  );
  const bern = getSwissAltiRegion("bern");
  const chur = getSwissAltiRegion("chur");
  const parpan = getSwissAltiRegion("parpan");
  const vazObervaz = getSwissAltiRegion("vaz-obervaz");

  assert.equal(
    resolveSwissAltiCogs(bern, {
      xmin: -10_000_000,
      ymin: -10_000_000,
      xmax: 10_000_000,
      ymax: 10_000_000,
    }).length,
    6380,
  );

  assert.equal(
    resolveSwissAltiCogs(bern, {
      xmin: 2_616_400,
      ymin: 1_186_400,
      xmax: 2_616_600,
      ymax: 1_186_600,
    }).length,
    1,
  );
  assert.equal(
    resolveSwissAltiCogs(bern, {
      xmin: 2_616_999,
      ymin: 1_186_400,
      xmax: 2_617_001,
      ymax: 1_186_600,
    }).length,
    2,
  );
  assert.equal(
    resolveSwissAltiCogs(bern, {
      xmin: 2_593_400,
      ymin: 1_234_400,
      xmax: 2_593_600,
      ymax: 1_234_600,
    }).length,
    0,
  );

  assert.equal(
    resolveSwissAltiCogs(chur, {
      xmin: 2_760_400,
      ymin: 1_189_400,
      xmax: 2_760_600,
      ymax: 1_189_600,
    }).length,
    1,
  );
  assert.equal(
    resolveSwissAltiCogs(chur, {
      xmin: 2_760_999,
      ymin: 1_188_400,
      xmax: 2_761_001,
      ymax: 1_188_600,
    }).length,
    2,
  );
  assert.equal(
    resolveSwissAltiCogs(chur, {
      xmin: 2_761_400,
      ymin: 1_187_400,
      xmax: 2_761_600,
      ymax: 1_187_600,
    }).length,
    0,
  );

  assert.equal(
    resolveSwissAltiCogs(parpan, {
      xmin: 2_760_400,
      ymin: 1_184_400,
      xmax: 2_760_600,
      ymax: 1_184_600,
    }).length,
    1,
  );
  assert.equal(
    resolveSwissAltiCogs(parpan, {
      xmin: 2_759_999,
      ymin: 1_184_400,
      xmax: 2_760_001,
      ymax: 1_184_600,
    }).length,
    2,
  );
  assert.equal(
    resolveSwissAltiCogs(parpan, {
      xmin: 2_763_400,
      ymin: 1_186_400,
      xmax: 2_763_600,
      ymax: 1_186_600,
    }).length,
    0,
  );

  assert.equal(
    resolveSwissAltiCogs(vazObervaz, {
      xmin: 2_760_400,
      ymin: 1_176_400,
      xmax: 2_760_600,
      ymax: 1_176_600,
    }).length,
    1,
  );
  assert.equal(
    resolveSwissAltiCogs(vazObervaz, {
      xmin: 2_760_999,
      ymin: 1_176_400,
      xmax: 2_761_001,
      ymax: 1_176_600,
    }).length,
    2,
  );
  assert.equal(
    resolveSwissAltiCogs(vazObervaz, {
      xmin: 2_762_400,
      ymin: 1_181_400,
      xmax: 2_762_600,
      ymax: 1_181_600,
    }).length,
    0,
  );

  assert.ok(parpan.cogById.has("2760-1180"));
  assert.ok(vazObervaz.cogById.has("2760-1180"));
  assert.ok(chur.cogById.has("2764-1181"));
  assert.ok(vazObervaz.cogById.has("2764-1181"));
});

test("switches one cached virtual elevation mosaic between regional catalogs", async () => {
  const [page, adapter] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/swissAltiElevation.ts", import.meta.url), "utf8"),
  ]);

  assert.match(page, /id="terrain-region"/);
  assert.match(page, /TERRAIN_REGION_OPTIONS\.map/);
  assert.match(page, /TERRAIN_REGION_OPTIONS = SWISS_ALTI_REGIONS\.filter/);
  assert.match(page, /\(\{ id \}\) => id !== "bern"/);
  assert.match(page, /setTerrainRegionId/);
  assert.match(page, /prepareSwissAltiCatalog\(\s*ImageryTileLayer,\s*terrainRegion,/);
  assert.match(page, /terrainRegion\.initialExtent/);
  assert.match(page, /sceneElement\.clippingArea = fullExtent/);
  assert.match(page, /terrainExtentRef\.current = initialExtent/);
  assert.doesNotMatch(page, /terrainExtentRef\.current = fullExtent/);
  assert.match(page, /Framing the \$\{terrainRegion\.label\} terrain focus/);
  assert.match(page, /key: `terrain-scene-\$\{mode\}-\$\{terrainRegion\.id\}`/);
  assert.match(page, /terrainTilingProfile/);
  assert.match(page, /layers: \[terrainLayer\]/);
  assert.match(page, /terrainLayer\.auditRegionalCoverage/);
  assert.match(page, /terrainRegion\.id === "zermatt"/);
  assert.match(page, /url: terrainRegion\.anchorCog\.url/);
  assert.match(page, /RasterShadedReliefRenderer/);
  assert.match(page, /byName\("Elevation #1"\)/);
  assert.match(page, /renderer: overlayRenderer/);
  assert.match(page, /map\.add\?\.\(overlayLayer\)/);
  assert.match(page, /terrainOverlayLayerRef\.current/);
  assert.match(page, /Frame overlay/);
  assert.match(page, /Surface overlay · tinted relief/);
  assert.match(page, /SWISS_BUILDINGS_SCENE_URL/);
  assert.match(page, /@arcgis\/core\/layers\/SceneLayer\.js/);
  assert.match(page, /const buildingsLayer = new SceneLayer/);
  assert.match(page, /buildingsLayerRef\.current/);
  assert.match(page, /Scene layer · swissBUILDINGS3D/);
  assert.match(page, /setBuildingsVisible/);
  assert.match(page, /setBuildingsOpacity/);
  assert.match(page, /const buildingsVisibleRef = useRef\(false\)/);
  assert.match(
    page,
    /const \[buildingsVisible, setBuildingsVisible\] = useState\(false\)/,
  );
  assert.doesNotMatch(page, /frameBuildings/i);

  const buildingsLayerIndex = page.indexOf(
    "const buildingsLayer = new SceneLayer",
  );
  const zermattOverlayIndex = page.indexOf(
    'if (terrainRegion.id === "zermatt")',
    buildingsLayerIndex,
  );
  assert.ok(buildingsLayerIndex >= 0, "buildings SceneLayer should be created");
  assert.ok(
    zermattOverlayIndex > buildingsLayerIndex,
    "buildings should load independently of the Zermatt-only tinted relief",
  );

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
