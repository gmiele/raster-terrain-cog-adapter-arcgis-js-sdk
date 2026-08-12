import {
  resolveSwissAltiCogs,
  SWISS_ALTI_CELL_SIZE_METERS,
  SWISS_ALTI_COG,
  SWISS_ALTI_COG_PIXEL_SIZE,
  SWISS_ALTI_COGS,
  SWISS_ALTI_HORIZONTAL_WKID,
  SWISS_ALTI_NO_DATA_VALUE,
  SWISS_ALTI_REGIONAL_EXTENT,
  type SwissAltiCog,
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

type SourceMetadata = {
  bandCount: number;
  extent: ExtentLike;
  height: number;
  nativeResolution: number;
  noDataValue: number;
  pixelType: string;
  width: number;
};

type PreparedSource = {
  layer: SourceLayer;
  metadata: SourceMetadata;
};

type SourceCacheEntry = {
  active: number;
  lastUsed: number;
  promise: Promise<PreparedSource>;
};

export type SwissAltiMetadata = SourceMetadata & {
  sourceCount: number;
  sourcePixelCount: number;
};

export type PreparedSwissAltiCatalog = {
  dispose: () => void;
  metadata: SwissAltiMetadata;
  withSource: <T>(
    cog: SwissAltiCog,
    signal: AbortSignal | undefined,
    callback: (source: PreparedSource) => Promise<T>,
  ) => Promise<T>;
};

type ElevationTileData = {
  values: Float32Array;
  width: number;
  height: number;
  noDataValue: number;
};

export type RegionalCoverageAudit = {
  completedProbes: number;
  elevationMax: number;
  elevationMin: number;
  expectedSampleCount: number;
  nativeLevel: number;
  totalProbes: number;
  validSampleCount: number;
};

type CoverageAuditOptions = {
  onProgress?: (completed: number, total: number) => void;
  signal?: AbortSignal;
};

export type SwissAltiElevationLayer = ArcGISObject & {
  auditRegionalCoverage: (
    options?: CoverageAuditOptions,
  ) => Promise<RegionalCoverageAudit>;
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
  preparedCatalog: PreparedSwissAltiCatalog;
  spatialReference: ArcGISObject;
  tileInfo: ArcGISObject;
};

type MosaicWindow = {
  columnStart: number;
  extent: ExtentLike;
  height: number;
  rowStart: number;
  width: number;
};

const ELEVATION_NO_DATA_VALUE = -3.4028234663852886e38;
const ELEVATION_TILE_SIZE = 256;
const MAX_SOURCE_CACHE_SIZE = 32;
const SOURCE_FETCH_CONCURRENCY = 6;
const MAX_COARSE_FACTOR = 32;
const COORDINATE_TOLERANCE = 1e-6;

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

function nearlyEqual(left: number, right: number) {
  return Math.abs(left - right) <= COORDINATE_TOLERANCE;
}

function intersectsExtent(left: ExtentLike, right: ExtentLike) {
  return !(
    left.xmax <= right.xmin ||
    left.xmin >= right.xmax ||
    left.ymax <= right.ymin ||
    left.ymin >= right.ymax
  );
}

function intersectExtents(left: ExtentLike, right: ExtentLike): ExtentLike | null {
  if (!intersectsExtent(left, right)) return null;
  return {
    xmin: Math.max(left.xmin, right.xmin),
    ymin: Math.max(left.ymin, right.ymin),
    xmax: Math.min(left.xmax, right.xmax),
    ymax: Math.min(left.ymax, right.ymax),
  };
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

function mosaicWindow(
  requestExtent: ExtentLike,
  sourceExtent: ExtentLike,
  size: number,
): MosaicWindow | null {
  const intersection = intersectExtents(requestExtent, sourceExtent);
  if (!intersection) return null;

  const xResolution =
    (requestExtent.xmax - requestExtent.xmin) / Math.max(1, size - 1);
  const yResolution =
    (requestExtent.ymax - requestExtent.ymin) / Math.max(1, size - 1);
  const columnStart = clamp(
    Math.ceil((intersection.xmin - requestExtent.xmin) / xResolution - 1e-9),
    0,
    size,
  );
  const columnEnd = nearlyEqual(intersection.xmax, requestExtent.xmax)
    ? size
    : clamp(
        Math.ceil((intersection.xmax - requestExtent.xmin) / xResolution - 1e-9),
        0,
        size,
      );
  const rowStart = clamp(
    Math.ceil((requestExtent.ymax - intersection.ymax) / yResolution - 1e-9),
    0,
    size,
  );
  const rowEnd = nearlyEqual(intersection.ymin, requestExtent.ymin)
    ? size
    : clamp(
        Math.ceil((requestExtent.ymax - intersection.ymin) / yResolution - 1e-9),
        0,
        size,
      );
  const width = columnEnd - columnStart;
  const height = rowEnd - rowStart;

  if (width <= 0 || height <= 0) return null;

  const firstX = requestExtent.xmin + columnStart * xResolution;
  const lastX = requestExtent.xmin + (columnEnd - 1) * xResolution;
  const firstY = requestExtent.ymax - rowStart * yResolution;
  const lastY = requestExtent.ymax - (rowEnd - 1) * yResolution;
  const halfX = xResolution / 2;
  const halfY = yResolution / 2;

  return {
    columnStart,
    rowStart,
    width,
    height,
    extent: {
      xmin: clamp(
        width === 1 ? firstX - halfX : firstX,
        sourceExtent.xmin,
        sourceExtent.xmax,
      ),
      xmax: clamp(
        width === 1 ? lastX + halfX : lastX,
        sourceExtent.xmin,
        sourceExtent.xmax,
      ),
      ymin: clamp(
        height === 1 ? lastY - halfY : lastY,
        sourceExtent.ymin,
        sourceExtent.ymax,
      ),
      ymax: clamp(
        height === 1 ? firstY + halfY : firstY,
        sourceExtent.ymin,
        sourceExtent.ymax,
      ),
    },
  };
}

async function runWithConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  concurrency: number,
) {
  if (tasks.length === 0) return [];
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

async function loadSource(
  ImageryTileLayer: ArcGISConstructor,
  cog: SwissAltiCog,
  signal?: AbortSignal,
): Promise<PreparedSource> {
  const layer = new ImageryTileLayer({
    url: cog.url,
    title: `SwissALTI3D ${cog.id}`,
    visible: false,
  }) as SourceLayer;

  try {
    await layer.load?.({ signal });
    assertNotAborted(signal);

    const rasterInfo = layer.serviceRasterInfo;
    if (!rasterInfo) {
      throw new Error(`COG ${cog.id} did not expose raster metadata.`);
    }

    const wkid = spatialReferenceWkid(
      rasterInfo.spatialReference ?? layer.spatialReference,
    );
    const extent = rasterInfo.extent ?? layer.fullExtent;
    const width = rasterInfo.width;
    const height = rasterInfo.height;
    const pixelSizeX = Math.abs(rasterInfo.pixelSize?.x ?? Number.NaN);
    const pixelSizeY = Math.abs(rasterInfo.pixelSize?.y ?? Number.NaN);
    const bandCount = rasterInfo.bandCount;

    if (wkid !== SWISS_ALTI_HORIZONTAL_WKID) {
      throw new Error(
        `COG ${cog.id} is EPSG:${wkid ?? "unknown"}; EPSG:2056 is required.`,
      );
    }
    if (!extent || !finitePositive(width) || !finitePositive(height)) {
      throw new Error(`COG ${cog.id} has incomplete dimensions.`);
    }
    if (!finitePositive(pixelSizeX) || !finitePositive(pixelSizeY)) {
      throw new Error(`COG ${cog.id} has no native pixel size.`);
    }
    if (
      !nearlyEqual(pixelSizeX, SWISS_ALTI_CELL_SIZE_METERS) ||
      !nearlyEqual(pixelSizeY, SWISS_ALTI_CELL_SIZE_METERS) ||
      width !== SWISS_ALTI_COG_PIXEL_SIZE ||
      height !== SWISS_ALTI_COG_PIXEL_SIZE ||
      bandCount !== 1
    ) {
      throw new Error(`COG ${cog.id} does not match the regional DTM grid.`);
    }
    if (
      !nearlyEqual(extent.xmin, cog.extent.xmin) ||
      !nearlyEqual(extent.ymin, cog.extent.ymin) ||
      !nearlyEqual(extent.xmax, cog.extent.xmax) ||
      !nearlyEqual(extent.ymax, cog.extent.ymax)
    ) {
      throw new Error(`COG ${cog.id} is not aligned to its kilometre tile.`);
    }
    if (!layer.fetchPixels) {
      throw new Error(`COG ${cog.id} cannot provide pixel windows.`);
    }

    return {
      layer,
      metadata: {
        bandCount,
        extent: { ...cog.extent },
        height,
        nativeResolution: pixelSizeX,
        noDataValue:
          firstNoDataValue(rasterInfo.noDataValue) ?? SWISS_ALTI_NO_DATA_VALUE,
        pixelType: rasterInfo.pixelType ?? "f32",
        width,
      },
    };
  } catch (error) {
    layer.destroy?.();
    throw error;
  }
}

export async function prepareSwissAltiCatalog(
  ImageryTileLayer: ArcGISConstructor,
  signal?: AbortSignal,
): Promise<PreparedSwissAltiCatalog> {
  const cache = new Map<string, SourceCacheEntry>();
  let accessCounter = 0;
  let disposed = false;

  const evictUnusedSources = () => {
    if (cache.size <= MAX_SOURCE_CACHE_SIZE) return;
    const candidates = [...cache.entries()]
      .filter(([, entry]) => entry.active === 0)
      .sort(([, left], [, right]) => left.lastUsed - right.lastUsed);

    while (cache.size > MAX_SOURCE_CACHE_SIZE && candidates.length > 0) {
      const [id, entry] = candidates.shift()!;
      if (cache.get(id) !== entry || entry.active > 0) continue;
      cache.delete(id);
      void entry.promise.then(({ layer }) => layer.destroy?.()).catch(() => {});
    }
  };

  const getEntry = (cog: SwissAltiCog, requestSignal?: AbortSignal) => {
    const existing = cache.get(cog.id);
    if (existing) return existing;

    const entry: SourceCacheEntry = {
      active: 0,
      lastUsed: ++accessCounter,
      promise: Promise.resolve(null as unknown as PreparedSource),
    };
    entry.promise = loadSource(
      ImageryTileLayer,
      cog,
      requestSignal,
    ).then((source) => {
      if (disposed) source.layer.destroy?.();
      return source;
    }).catch((error) => {
      if (cache.get(cog.id) === entry) cache.delete(cog.id);
      throw error;
    });
    cache.set(cog.id, entry);
    return entry;
  };

  const withSource: PreparedSwissAltiCatalog["withSource"] = async (
    cog,
    requestSignal,
    callback,
  ) => {
    assertNotAborted(requestSignal);
    if (disposed) throw new Error("The regional COG catalog was disposed.");
    const entry = getEntry(cog, requestSignal);
    entry.active += 1;
    entry.lastUsed = ++accessCounter;

    try {
      const source = await entry.promise;
      assertNotAborted(requestSignal);
      return await callback(source);
    } finally {
      entry.active -= 1;
      entry.lastUsed = ++accessCounter;
      evictUnusedSources();
    }
  };

  const anchorMetadata = await withSource(
    SWISS_ALTI_COG,
    signal,
    async ({ metadata }) => metadata,
  );

  const metadata: SwissAltiMetadata = {
    ...anchorMetadata,
    extent: { ...SWISS_ALTI_REGIONAL_EXTENT },
    width: Math.round(
      (SWISS_ALTI_REGIONAL_EXTENT.xmax - SWISS_ALTI_REGIONAL_EXTENT.xmin) /
        anchorMetadata.nativeResolution,
    ),
    height: Math.round(
      (SWISS_ALTI_REGIONAL_EXTENT.ymax - SWISS_ALTI_REGIONAL_EXTENT.ymin) /
        anchorMetadata.nativeResolution,
    ),
    sourceCount: SWISS_ALTI_COGS.length,
    sourcePixelCount:
      SWISS_ALTI_COGS.length * anchorMetadata.width * anchorMetadata.height,
  };

  return {
    metadata,
    withSource,
    dispose() {
      disposed = true;
      for (const entry of cache.values()) {
        void entry.promise.then(({ layer }) => layer.destroy?.()).catch(() => {});
      }
      cache.clear();
    },
  };
}

export function createElevationLods(metadata: SwissAltiMetadata) {
  const maxDimension = Math.max(metadata.width, metadata.height);
  const nativeTileCount = Math.ceil(maxDimension / ELEVATION_TILE_SIZE);
  const requiredFactor = 2 ** Math.ceil(Math.log2(Math.max(1, nativeTileCount)));
  const coarsestFactor = Math.min(requiredFactor, MAX_COARSE_FACTOR);
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

function summarizeTile(data: ElevationTileData) {
  let validSampleCount = 0;
  let elevationMin = Number.POSITIVE_INFINITY;
  let elevationMax = Number.NEGATIVE_INFINITY;

  for (const value of data.values) {
    if (value === data.noDataValue || !Number.isFinite(value)) continue;
    validSampleCount += 1;
    elevationMin = Math.min(elevationMin, value);
    elevationMax = Math.max(elevationMax, value);
  }

  return { validSampleCount, elevationMin, elevationMax };
}

export function createSwissAltiElevationLayer({
  BaseElevationLayer,
  Extent,
  fullExtent,
  lods,
  preparedCatalog,
  spatialReference,
  tileInfo,
}: CreateSwissAltiElevationLayerOptions): SwissAltiElevationLayer {
  const { metadata } = preparedCatalog;
  const nativeLevel = lods.length - 1;
  const nativeTileSpan = ELEVATION_TILE_SIZE * metadata.nativeResolution;

  const SwissAltiElevationLayerClass = BaseElevationLayer.createSubclass({
    declaredClass: "raster-terrain-lab.RegionalCogElevationLayer",

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
      values.fill(ELEVATION_NO_DATA_VALUE);
      const sources = resolveSwissAltiCogs(requestExtent);

      const tasks = sources.map((cog) => async () => {
        const window = mosaicWindow(requestExtent, cog.extent, size);
        if (!window) return;

        await preparedCatalog.withSource(
          cog,
          options?.signal,
          async ({ layer, metadata: sourceMetadata }) => {
            const extent = new Extent({
              ...window.extent,
              spatialReference: this.spatialReference,
            });
            const result = await layer.fetchPixels!(
              extent,
              window.width,
              window.height,
              { signal: options?.signal },
            );
            const pixelBlock = result.pixelBlock;
            const pixels = pixelBlock?.pixels?.[0];
            if (!pixelBlock || !pixels) return;

            const mask = pixelBlock.mask;
            const sourceNoData =
              pixelBlock.statistics?.[0]?.noDataValue ??
              sourceMetadata.noDataValue;
            const length = Math.min(
              pixels.length,
              window.width * window.height,
            );

            for (let index = 0; index < length; index += 1) {
              const value = Number(pixels[index]);
              const isValid =
                (!mask || Number(mask[index]) > 0) &&
                Number.isFinite(value) &&
                value !== sourceNoData &&
                value !== SWISS_ALTI_NO_DATA_VALUE;
              if (!isValid) continue;

              const sourceRow = Math.floor(index / window.width);
              const sourceColumn = index % window.width;
              const destination =
                (window.rowStart + sourceRow) * size +
                window.columnStart +
                sourceColumn;
              values[destination] = value;
            }
          },
        );
      });

      await runWithConcurrency(tasks, SOURCE_FETCH_CONCURRENCY);
      return {
        values,
        width: size,
        height: size,
        noDataValue: ELEVATION_NO_DATA_VALUE,
      };
    },

    disposeSource() {
      preparedCatalog.dispose();
    },
  });

  const layerInstance = new SwissAltiElevationLayerClass({
    title: `${metadata.sourceCount} SwissALTI3D COGs · regional terrain`,
    spatialReference,
    tileInfo,
    fullExtent,
  }) as SwissAltiElevationLayer;

  const tileAtCoordinate = (x: number, y: number) => ({
    column: Math.floor((x - metadata.extent.xmin) / nativeTileSpan),
    row: Math.floor((metadata.extent.ymax - y) / nativeTileSpan),
  });

  layerInstance.auditRegionalCoverage = async (
    options: CoverageAuditOptions = {},
  ) => {
    const probes = [
      {
        id: "interior",
        ...tileAtCoordinate(2_610_500, 1_092_500),
        expectSources: 1,
        expectData: true,
      },
      {
        id: "cross-boundary",
        ...tileAtCoordinate(2_611_000, 1_092_500),
        expectSources: 2,
        expectData: true,
      },
      {
        id: "intentional-hole",
        ...tileAtCoordinate(2_616_500, 1_090_500),
        expectSources: 0,
        expectData: false,
      },
    ];
    let completedProbes = 0;
    let elevationMin = Number.POSITIVE_INFINITY;
    let elevationMax = Number.NEGATIVE_INFINITY;
    let validSampleCount = 0;
    let expectedSampleCount = 0;

    for (const probe of probes) {
      assertNotAborted(options.signal);
      const bounds = layerInstance.getTileBounds?.(
        nativeLevel,
        probe.row,
        probe.column,
      );
      if (!bounds) throw new Error(`The ${probe.id} probe has no tile bounds.`);
      const sourceCount = resolveSwissAltiCogs({
        xmin: bounds[0],
        ymin: bounds[1],
        xmax: bounds[2],
        ymax: bounds[3],
      }).length;
      if (sourceCount !== probe.expectSources) {
        throw new Error(
          `The ${probe.id} probe resolved ${sourceCount} COGs instead of ${probe.expectSources}.`,
        );
      }

      const data = await layerInstance.fetchTile(
        nativeLevel,
        probe.row,
        probe.column,
        { signal: options.signal },
      );
      const summary = summarizeTile(data);
      if (probe.expectData && summary.validSampleCount === 0) {
        throw new Error(`The ${probe.id} probe returned no terrain samples.`);
      }
      if (!probe.expectData && summary.validSampleCount !== 0) {
        throw new Error(`The ${probe.id} probe did not preserve the no-data hole.`);
      }

      if (probe.expectData) {
        expectedSampleCount += data.values.length;
        validSampleCount += summary.validSampleCount;
        elevationMin = Math.min(elevationMin, summary.elevationMin);
        elevationMax = Math.max(elevationMax, summary.elevationMax);
      }
      completedProbes += 1;
      options.onProgress?.(completedProbes, probes.length);
    }

    return {
      completedProbes,
      elevationMax,
      elevationMin,
      expectedSampleCount,
      nativeLevel,
      totalProbes: probes.length,
      validSampleCount,
    };
  };

  return layerInstance;
}
