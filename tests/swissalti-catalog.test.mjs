import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const catalogUrl = new URL(
  "../public/data/swissalti3d-zermatt.csv",
  import.meta.url,
);
const filePattern =
  /^swissalti3d_2024_(\d+)-(\d+)_0\.5_2056_5728\.tif$/;

test("contains only the approved SwissALTI3D elevation COGs", async () => {
  const urls = (await readFile(catalogUrl, "utf8"))
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter(Boolean);

  assert.equal(urls.length, 298);
  assert.equal(new Set(urls).size, 298);

  for (const url of urls) {
    const parsed = new URL(url);
    assert.equal(parsed.protocol, "https:");
    assert.equal(parsed.hostname, "data.geo.admin.ch");
    assert.match(parsed.pathname.split("/").at(-1) ?? "", filePattern);
  }

  assert.ok(
    urls.some((url) => url.includes("swissalti3d_2024_2610-1092_0.5_2056_5728.tif")),
  );
});
