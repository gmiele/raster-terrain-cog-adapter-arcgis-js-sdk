export const SWISS_ALTI_CATALOG_PATH = "/data/swissalti3d-zermatt.csv";

export const SWISS_ALTI_HORIZONTAL_WKID = 2056;
export const SWISS_ALTI_VERTICAL_WKID = 5728;
export const SWISS_ALTI_CELL_SIZE_METERS = 0.5;
export const SWISS_ALTI_TILE_SIZE_METERS = 1000;

export type SwissAltiCatalogTile = {
  id: string;
  url: string;
  xmin: number;
  ymin: number;
  xmax: number;
  ymax: number;
};

export type SwissAltiCatalog = {
  tiles: SwissAltiCatalogTile[];
  extent: {
    xmin: number;
    ymin: number;
    xmax: number;
    ymax: number;
  };
};

const FILE_PATTERN =
  /^swissalti3d_2024_(\d+)-(\d+)_0\.5_2056_5728\.tif$/;

export async function loadSwissAltiCatalog(
  signal?: AbortSignal,
): Promise<SwissAltiCatalog> {
  const response = await fetch(SWISS_ALTI_CATALOG_PATH, { signal });
  if (!response.ok) {
    throw new Error(`SwissALTI catalog could not be loaded (${response.status}).`);
  }

  const urls = (await response.text())
    .split(/\r?\n/)
    .map((value) => value.trim().replace(/^\uFEFF/, ""))
    .filter(Boolean);
  const uniqueUrls = [...new Set(urls)];

  if (uniqueUrls.length !== urls.length) {
    throw new Error("SwissALTI catalog contains duplicate URLs.");
  }

  const tiles = uniqueUrls.map((url): SwissAltiCatalogTile => {
    const parsedUrl = new URL(url);
    const fileName = decodeURIComponent(
      parsedUrl.pathname.split("/").pop() ?? "",
    );
    const match = fileName.match(FILE_PATTERN);

    if (
      parsedUrl.protocol !== "https:" ||
      parsedUrl.hostname !== "data.geo.admin.ch" ||
      !match
    ) {
      throw new Error(`Unsupported SwissALTI catalog entry: ${url}`);
    }

    const eastKilometers = Number(match[1]);
    const northKilometers = Number(match[2]);
    const xmin = eastKilometers * SWISS_ALTI_TILE_SIZE_METERS;
    const ymin = northKilometers * SWISS_ALTI_TILE_SIZE_METERS;

    return {
      id: `${eastKilometers}-${northKilometers}`,
      url,
      xmin,
      ymin,
      xmax: xmin + SWISS_ALTI_TILE_SIZE_METERS,
      ymax: ymin + SWISS_ALTI_TILE_SIZE_METERS,
    };
  });

  if (tiles.length === 0) {
    throw new Error("SwissALTI catalog is empty.");
  }

  return {
    tiles,
    extent: {
      xmin: Math.min(...tiles.map((tile) => tile.xmin)),
      ymin: Math.min(...tiles.map((tile) => tile.ymin)),
      xmax: Math.max(...tiles.map((tile) => tile.xmax)),
      ymax: Math.max(...tiles.map((tile) => tile.ymax)),
    },
  };
}

export function intersectsSwissAltiTile(
  tile: SwissAltiCatalogTile,
  extent: { xmin: number; ymin: number; xmax: number; ymax: number },
) {
  return !(
    tile.xmax <= extent.xmin ||
    tile.xmin >= extent.xmax ||
    tile.ymax <= extent.ymin ||
    tile.ymin >= extent.ymax
  );
}
