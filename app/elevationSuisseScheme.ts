import { SWISS_ALTI_HORIZONTAL_WKID } from "./swissAltiSource";

export const ELEVATION_SUISSE_SERVICE_URL =
  "https://tiles.arcgis.com/tiles/oPre3pOfRfefL8y0/arcgis/rest/services/elevation_suisse/ImageServer";
export const ELEVATION_SUISSE_DETAIL_LOD = 13;
export const ELEVATION_SUISSE_MAX_LOD = 18;

export type ElevationSuisseLod = {
  level: number;
  resolution: number;
  scale: number;
};

export type ElevationSuisseScheme = {
  dpi: number;
  format: "lerc";
  lods: ElevationSuisseLod[];
  maxLod: number;
  minLod: number;
  origin: { x: number; y: number };
  size: [number, number];
  spatialReference: { wkid: number };
};

type ElevationSuisseServiceMetadata = {
  maxLOD?: number;
  minLOD?: number;
  spatialReference?: { latestWkid?: number; wkid?: number };
  tileInfo?: {
    cols?: number;
    dpi?: number;
    format?: string;
    lods?: ElevationSuisseLod[];
    origin?: { x?: number; y?: number };
    rows?: number;
    spatialReference?: { latestWkid?: number; wkid?: number };
  };
};

const EXPECTED_ORIGIN = { x: 2_420_000, y: 1_350_000 };
const EXPECTED_SIZE = 512;
const EXPECTED_LODS: readonly ElevationSuisseLod[] = [
  { level: 0, resolution: 131088.64617729236, scale: 495452160 },
  { level: 1, resolution: 65544.32308864618, scale: 247726080 },
  { level: 2, resolution: 32772.16154432309, scale: 123863040 },
  { level: 3, resolution: 16386.080772161546, scale: 61931520 },
  { level: 4, resolution: 8193.040386080773, scale: 30965760 },
  { level: 5, resolution: 4096.520193040386, scale: 15482880 },
  { level: 6, resolution: 2048.260096520193, scale: 7741440 },
  { level: 7, resolution: 1024.1300482600966, scale: 3870720 },
  { level: 8, resolution: 512.0650241300483, scale: 1935360 },
  { level: 9, resolution: 256.03251206502415, scale: 967680 },
  { level: 10, resolution: 128.01625603251208, scale: 483840 },
  { level: 11, resolution: 64.00812801625604, scale: 241920 },
  { level: 12, resolution: 32.00406400812802, scale: 120960 },
  { level: 13, resolution: 16.00203200406401, scale: 60480 },
  { level: 14, resolution: 8.001016002032005, scale: 30240 },
  { level: 15, resolution: 4.000508001016002, scale: 15120 },
  { level: 16, resolution: 2.000254000508001, scale: 7560 },
  { level: 17, resolution: 1.0001270002540006, scale: 3780 },
  { level: 18, resolution: 0.5000635001270003, scale: 1890 },
];

let schemePromise: Promise<ElevationSuisseScheme> | null = null;

function nearlyEqual(left: number | undefined, right: number) {
  return (
    typeof left === "number" &&
    Number.isFinite(left) &&
    Math.abs(left - right) <= Math.max(1e-9, Math.abs(right) * 1e-12)
  );
}

function metadataWkid(metadata: ElevationSuisseServiceMetadata) {
  return (
    metadata.tileInfo?.spatialReference?.latestWkid ??
    metadata.tileInfo?.spatialReference?.wkid ??
    metadata.spatialReference?.latestWkid ??
    metadata.spatialReference?.wkid
  );
}

export function validateElevationSuisseScheme(
  metadata: ElevationSuisseServiceMetadata,
): ElevationSuisseScheme {
  const tileInfo = metadata.tileInfo;
  if (!tileInfo) throw new Error("elevation_suisse has no tileInfo.");
  if (metadataWkid(metadata) !== SWISS_ALTI_HORIZONTAL_WKID) {
    throw new Error("elevation_suisse is not published in EPSG:2056.");
  }
  if (
    tileInfo.rows !== EXPECTED_SIZE ||
    tileInfo.cols !== EXPECTED_SIZE ||
    tileInfo.dpi !== 96 ||
    tileInfo.format?.toLowerCase() !== "lerc"
  ) {
    throw new Error("elevation_suisse uses an unexpected tile format or size.");
  }
  if (
    !nearlyEqual(tileInfo.origin?.x, EXPECTED_ORIGIN.x) ||
    !nearlyEqual(tileInfo.origin?.y, EXPECTED_ORIGIN.y)
  ) {
    throw new Error("elevation_suisse uses an unexpected tile origin.");
  }
  if (metadata.minLOD !== 0 || metadata.maxLOD !== ELEVATION_SUISSE_MAX_LOD) {
    throw new Error("elevation_suisse uses an unexpected active LOD range.");
  }

  const activeLods = (tileInfo.lods ?? []).filter(
    ({ level }) => level >= metadata.minLOD! && level <= metadata.maxLOD!,
  );
  if (
    activeLods.length !== EXPECTED_LODS.length ||
    !activeLods.every((lod, index) => {
      const expected = EXPECTED_LODS[index];
      return (
        lod.level === expected.level &&
        nearlyEqual(lod.resolution, expected.resolution) &&
        nearlyEqual(lod.scale, expected.scale)
      );
    })
  ) {
    throw new Error("elevation_suisse LODs no longer match the expected grid.");
  }

  return {
    dpi: 96,
    format: "lerc",
    lods: activeLods.map((lod) => ({ ...lod })),
    maxLod: ELEVATION_SUISSE_MAX_LOD,
    minLod: 0,
    origin: { ...EXPECTED_ORIGIN },
    size: [EXPECTED_SIZE, EXPECTED_SIZE],
    spatialReference: { wkid: SWISS_ALTI_HORIZONTAL_WKID },
  };
}

export function loadElevationSuisseScheme(signal?: AbortSignal) {
  if (signal?.aborted) {
    return Promise.reject(
      signal.reason ?? new DOMException("The grid request was cancelled.", "AbortError"),
    );
  }
  if (!schemePromise) {
    const metadataUrl = new URL(ELEVATION_SUISSE_SERVICE_URL);
    metadataUrl.searchParams.set("f", "json");
    schemePromise = fetch(metadataUrl)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(
            "elevation_suisse metadata returned HTTP " + response.status + ".",
          );
        }
        return validateElevationSuisseScheme(
          (await response.json()) as ElevationSuisseServiceMetadata,
        );
      })
      .catch((error) => {
        schemePromise = null;
        throw error;
      });
  }
  return schemePromise;
}
