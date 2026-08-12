import {
  SWISS_ALTI_COG,
  SWISS_ALTI_HORIZONTAL_WKID,
} from "./swissAltiSource";

type ArcGISObject = Record<string, unknown> & {
  destroy?: () => void;
};

type ArcGISConstructor = new (
  options?: Record<string, unknown>,
) => ArcGISObject;

type BaseElevationConstructor = ArcGISConstructor & {
  createSubclass: (definition: Record<string, unknown>) => ArcGISConstructor;
};

type ExtentLike = {
  xmin: number;
  ymin: number;
  xmax: number;
  ymax: number;
};

type RasterInfo = {
  bandCount?: number;
  extent?: ExtentLike;
  height?: number;
  noDataValue?: number | Array<number | null> | null;
  pixelSize?: { x?: number; y?: number };
  pixelType?: string;
  spatialReference?: { wkid?: number; latestWkid?: number };
  width?: number;
};

type SourceLayer = ArcGISObject & {
  fetchPixels?: (
    extent: ArcGISObject,
    width: number,
    height: number,
    options?: { signal?: AbortSignal },
  ) => Promise<FetchPixelsResult>;
  fullExtent?: ExtentLike;
  load?: (options?: { signal?: AbortSignal }) => Promise<ArcGISObject>;
  serviceRasterInfo?: RasterInfo;
  spatialReference?: { wkid?: number; latestWkid?: number };
};

type FetchPixelsResult = {
  pixelBlock?: {
    mask?: ArrayLike<number>;
    pixels?: ArrayLike<number>[];
    statistics?: Array<{ noDataValue?: number }>;
  } | null;
};

export type SwissAltiMetadata = {
  bandCount: number;
  extent: ExtentLike;
  height: number;
  nativeResolution: number;
  noDataValue?: number;
  pixelType: string;
  width: number;
};

export type PreparedSwissAltiSource = {
  layer: SourceLayer;
  metadata: SwissAltiMetadata;
};

type ElevationTileData = {
  values: Float32Array;
  width: number;
  height: number;
  noDataValue: number;
};

export type NativeCoverageAudit = {
  completedTiles: number;
  elevationMax: number;
  elevationMin: number;
  expectedSampleCount: number;
  nativeLevel: number;
  totalTiles: number;
  validSampleCount: number;
};

type CoverageAuditOptions = {
  onProgress?: (completed: number, total: number) => void;
  signal?: AbortSignal;
};

export type SwissAltiElevationLayer = ArcGISObject & {
  auditNativeCoverage: (
    options?: CoverageAuditOptions,
  ) => Promise<NativeCoverageAudit>;
  disposeSource: () => void;
  fetchTile: (
    level: number,
    row: number,
    column: number,
    options?: { signal?: AbortSignal },
  ) => Promise<ElevationTileData>;
  fullExtent?: ArcGISObject;
  getTileBounds?: (
    level: number,
    row: number,
    column: number,
  ) => [number, number, number, number];
  load?: () => Promise<ArcGISObject>;
  spatialReference?: { wkid?: number; latestWkid?: number };
  tileInfo?: { size?: number[] };
};

type CustomLayerThis = SwissAltiElevationLayer & {
  spatialReference: { wkid?: number; latestWkid?: number };
  tileInfo: { size: number[] };
};

type CreateSwissAltiElevationLayerOptions = {
  BaseElevationLayer: BaseElevationConstructor;
  Extent: ArcGISConstructor;
  fullExtent: ArcGISObject;
  lods: Array<{ level: number; resolution: number; scale: number }>;
  preparedSource: PreparedSwissAltiSource;
  spatialReference: ArcGISObject;
  tileInfo: ArcGISObject;
};

const NO_DATA_VALUE = -3.4028234663852886e38;
const ELEVATION_TILE_SIZE = 256;
const AUDIT_CONCURRENCY = 4;

function abortError(signal?: AbortSignal) {
  if (signal?.reason instanceof Error) return signal.reason;
  return new DOMException("The terrain request was cancelled.", "AbortError");
}

function assertNotAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw abortError(signal);
}

function spatialReferenceWkid(
  spatialReference?: { wkid?: number; latestWkid?: number },
) {
  return spatialReference?.latestWkid ?? spatialReference?.wkid;
}

function firstNoDataValue(noDataValue: RasterInfo["noDataValue"]) {
  if (typeof noDataValue === "number") return noDataValue;
  if (Array.isArray(noDataValue)) {
    return noDataValue.find((value): value is number => typeof value === "number");
  }
  return undefined;
}

function finitePositive(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export async function prepareSwissAltiSource(
  ImageryTileLayer: ArcGISConstructor,
  signal?: AbortSignal,
): Promise<PreparedSwissAltiSource> {
  const layer = new ImageryTileLayer({
    url: SWISS_ALTI_COG.url,
    title: `SwissALTI3D ${SWISS_ALTI_COG.id}`,
    visible: false,
  }) as SourceLayer;

  try {
    await layer.load?.({ signal });
    assertNotAborted(signal);

    const rasterInfo = layer.serviceRasterInfo;
    if (!rasterInfo) {
      throw new Error("The COG did not expose serviceRasterInfo metadata.");
    }

    const wkid = spatialReferenceWkid(
      rasterInfo.spatialReference ?? layer.spatialReference,
    );
    if (wkid !== SWISS_ALTI_HORIZONTAL_WKID) {
      throw new Error(
        `The elevation COG is EPSG:${wkid ?? "unknown"}; EPSG:2056 is required.`,
      );
    }

    const extent = rasterInfo.extent ?? layer.fullExtent;
    const width = rasterInfo.width;
    const height = rasterInfo.height;
    const pixelSizeX = Math.abs(rasterInfo.pixelSize?.x ?? Number.NaN);
    const pixelSizeY = Math.abs(rasterInfo.pixelSize?.y ?? Number.NaN);
    const bandCount = rasterInfo.bandCount;

    if (!extent || !finitePositive(width) || !finitePositive(height)) {
      throw new Error("The COG extent or pixel dimensions are unavailable.");
    }
    if (!finitePositive(pixelSizeX) || !finitePositive(pixelSizeY)) {
      throw new Error("The COG native pixel size is unavailable.");
    }
    if (Math.abs(pixelSizeX - pixelSizeY) > Math.max(pixelSizeX, pixelSizeY) * 1e-6) {
      throw new Error("The COG uses non-square pixels and cannot be ground terrain.");
    }
    if (bandCount !== 1) {
      throw new Error(`The elevation COG must have one band; found ${bandCount ?? 0}.`);
    }
    if (!layer.fetchPixels) {
      throw new Error("ImageryTileLayer.fetchPixels is unavailable.");
    }

    const extentWidth = extent.xmax - extent.xmin;
    const extentHeight = extent.ymax - extent.ymin;
    const expectedWidth = width * pixelSizeX;
    const expectedHeight = height * pixelSizeY;
    const tolerance = Math.max(pixelSizeX, pixelSizeY) * 2;

    if (
      Math.abs(extentWidth - expectedWidth) > tolerance ||
      Math.abs(extentHeight - expectedHeight) > tolerance
    ) {
      throw new Error("The COG extent does not match its pixel grid metadata.");
    }

    return {
      layer,
      metadata: {
        bandCount,
        extent: {
          xmin: extent.xmin,
          ymin: extent.ymin,
          xmax: extent.xmax,
          ymax: extent.ymax,
        },
        height,
        nativeResolution: pixelSizeX,
        noDataValue: firstNoDataValue(rasterInfo.noDataValue),
        pixelType: rasterInfo.pixelType ?? "unknown",
        width,
      },
    };
  } catch (error) {
    layer.destroy?.();
    throw error;
  }
}

export function createElevationLods(metadata: SwissAltiMetadata) {
  const maxDimension = Math.max(metadata.width, metadata.height);
  const nativeTileCount = Math.ceil(maxDimension / ELEVATION_TILE_SIZE);
  const coarsestFactor = 2 ** Math.ceil(Math.log2(Math.max(1, nativeTileCount)));
  const factors: number[] = [];

  for (let factor = coarsestFactor; factor >= 1; factor /= 2) {
    factors.push(factor);
  }

  return factors.map((factor, level) => {
    const resolution = metadata.nativeResolution * factor;
    return {
      level,
      resolution,
      scale: resolution * 96 * 39.37,
    };
  });
}

function intersectsExtent(left: ExtentLike, right: ExtentLike) {
  return !(
    left.xmax <= right.xmin ||
    left.xmin >= right.xmax ||
    left.ymax <= right.ymin ||
    left.ymin >= right.ymax
  );
}

async function runWithConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  concurrency: number,
) {
  const results: T[] = new Array(tasks.length);
  let nextIndex = 0;

  const worker = async () => {
    while (nextIndex < tasks.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await tasks[index]();
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker()),
  );
  return results;
}

export function createSwissAltiElevationLayer({
  BaseElevationLayer,
  Extent,
  fullExtent,
  lods,
  preparedSource,
  spatialReference,
  tileInfo,
}: CreateSwissAltiElevationLayerOptions): SwissAltiElevationLayer {
  const { layer: sourceLayer, metadata } = preparedSource;
  const nativeLevel = lods.length - 1;
  const nativeTileSpan = ELEVATION_TILE_SIZE * metadata.nativeResolution;

  const SwissAltiElevationLayerClass = BaseElevationLayer.createSubclass({
    declaredClass: "raster-terrain-lab.FullCogElevationLayer",

    load(this: CustomLayerThis) {
      return this;
    },

    async fetchTile(
      this: CustomLayerThis,
      level: number,
      row: number,
      column: number,
      options?: { signal?: AbortSignal },
    ): Promise<ElevationTileData> {
      assertNotAborted(options?.signal);
      if (!this.getTileBounds) {
        throw new Error("Elevation tile bounds are unavailable.");
      }

      const bounds = this.getTileBounds(level, row, column);
      const requestExtent: ExtentLike = {
        xmin: bounds[0],
        ymin: bounds[1],
        xmax: bounds[2],
        ymax: bounds[3],
      };
      const size = (this.tileInfo.size?.[0] ?? ELEVATION_TILE_SIZE) + 1;
      const values = new Float32Array(size * size);
      values.fill(NO_DATA_VALUE);

      if (!intersectsExtent(metadata.extent, requestExtent)) {
        return { values, width: size, height: size, noDataValue: NO_DATA_VALUE };
      }

      const extent = new Extent({
        ...requestExtent,
        spatialReference: this.spatialReference,
      });
      const result = await sourceLayer.fetchPixels!(extent, size, size, {
        signal: options?.signal,
      });
      const pixelBlock = result.pixelBlock;
      const pixels = pixelBlock?.pixels?.[0];

      if (!pixelBlock || !pixels) {
        return { values, width: size, height: size, noDataValue: NO_DATA_VALUE };
      }

      const mask = pixelBlock.mask;
      const blockNoData = pixelBlock.statistics?.[0]?.noDataValue;
      const sourceNoData = blockNoData ?? metadata.noDataValue;
      const length = Math.min(values.length, pixels.length);

      for (let index = 0; index < length; index += 1) {
        const value = Number(pixels[index]);
        const isValid =
          (!mask || Number(mask[index]) > 0) &&
          Number.isFinite(value) &&
          value !== sourceNoData;

        if (isValid) values[index] = value;
      }

      return { values, width: size, height: size, noDataValue: NO_DATA_VALUE };
    },

    disposeSource() {
      sourceLayer.destroy?.();
    },
  });

  const layerInstance = new SwissAltiElevationLayerClass({
    title: `SwissALTI3D ${SWISS_ALTI_COG.id} COG terrain`,
    spatialReference,
    tileInfo,
    fullExtent,
  }) as SwissAltiElevationLayer;

  layerInstance.auditNativeCoverage = async (
    options: CoverageAuditOptions = {},
  ) => {
    const columns = Math.ceil(
      (metadata.extent.xmax - metadata.extent.xmin) / nativeTileSpan,
    );
    const rows = Math.ceil(
      (metadata.extent.ymax - metadata.extent.ymin) / nativeTileSpan,
    );
    const totalTiles = rows * columns;
    let completedTiles = 0;

    const tasks = Array.from({ length: totalTiles }, (_, index) => {
      const row = Math.floor(index / columns);
      const column = index % columns;

      return async () => {
        assertNotAborted(options.signal);
        const data = await layerInstance.fetchTile(nativeLevel, row, column, {
          signal: options.signal,
        });
        const tileXmin = metadata.extent.xmin + column * nativeTileSpan;
        const tileXmax = Math.min(tileXmin + nativeTileSpan, metadata.extent.xmax);
        const tileYmax = metadata.extent.ymax - row * nativeTileSpan;
        const tileYmin = Math.max(tileYmax - nativeTileSpan, metadata.extent.ymin);
        const expectedColumns =
          Math.round((tileXmax - tileXmin) / metadata.nativeResolution) + 1;
        const expectedRows =
          Math.round((tileYmax - tileYmin) / metadata.nativeResolution) + 1;
        const expectedSampleCount = expectedColumns * expectedRows;
        let validSampleCount = 0;
        let elevationMin = Number.POSITIVE_INFINITY;
        let elevationMax = Number.NEGATIVE_INFINITY;

        for (const value of data.values) {
          if (value === data.noDataValue || !Number.isFinite(value)) continue;
          validSampleCount += 1;
          elevationMin = Math.min(elevationMin, value);
          elevationMax = Math.max(elevationMax, value);
        }

        if (validSampleCount < expectedSampleCount * 0.99) {
          throw new Error(
            `Native ground tile ${row}/${column} contains ${validSampleCount.toLocaleString()} of ${expectedSampleCount.toLocaleString()} expected samples.`,
          );
        }

        completedTiles += 1;
        options.onProgress?.(completedTiles, totalTiles);
        return {
          elevationMax,
          elevationMin,
          expectedSampleCount,
          validSampleCount,
        };
      };
    });

    const results = await runWithConcurrency(tasks, AUDIT_CONCURRENCY);
    return results.reduce<NativeCoverageAudit>(
      (audit, result) => ({
        ...audit,
        completedTiles: audit.completedTiles + 1,
        elevationMax: Math.max(audit.elevationMax, result.elevationMax),
        elevationMin: Math.min(audit.elevationMin, result.elevationMin),
        expectedSampleCount:
          audit.expectedSampleCount + result.expectedSampleCount,
        validSampleCount: audit.validSampleCount + result.validSampleCount,
      }),
      {
        completedTiles: 0,
        elevationMax: Number.NEGATIVE_INFINITY,
        elevationMin: Number.POSITIVE_INFINITY,
        expectedSampleCount: 0,
        nativeLevel,
        totalTiles,
        validSampleCount: 0,
      },
    );
  };

  return layerInstance;
}
