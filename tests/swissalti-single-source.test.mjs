import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("uses the existing imagery example as the only experimental ground source", async () => {
  const [page, source, adapter] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/swissAltiSource.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/swissAltiElevation.ts", import.meta.url), "utf8"),
  ]);

  const expectedUrl =
    "https://data.geo.admin.ch/ch.swisstopo.swissalti3d/swissalti3d_2024_2610-1092/swissalti3d_2024_2610-1092_0.5_2056_5728.tif";

  assert.match(source, new RegExp(expectedUrl.replaceAll(".", "\\.")));
  assert.match(page, /url: SWISS_ALTI_COG\.url/);
  assert.match(adapter, /url: SWISS_ALTI_COG\.url/);
  assert.match(page, /layers: \[terrainLayer\]/);
  assert.match(page, /terrainLayer\.auditNativeCoverage/);
  assert.match(adapter, /serviceRasterInfo/);
  assert.match(adapter, /metadata\.width/);
  assert.match(adapter, /metadata\.nativeResolution/);
  assert.doesNotMatch(adapter, /catalog|mosaic|world-elevation|projectOperator/i);
});
