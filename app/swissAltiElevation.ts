import {
  intersectsSwissAltiTile,
  SWISS_ALTI_HORIZONTAL_WKID,
  type SwissAltiCatalog,
  type SwissAltiCatalogTile,
} from "./swissAltiCatalog";

type ArcGISObject = Record<string, unknown> & {
  destroy?: () => void;
};

type ArcGISConstructor = new (
  options?: Record<string, unknown>,
) => ArcGISObject;

type BaseElevationConstructor = ArcGISConstructor & {
  createSubclass: (definition: Record<string, unknown>) => ArcGISConstructor;
};

type ElevationLayerInstance = ArcGISObject & {
  disposeSources?: () => void;
  fetchTile?: (
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

type SourceLayer = ArcGISObject & {
  fetchPixels?: (
    extent: ArcGISObject,
    width: number,
    height: number,
    options?: { signal?: AbortSignal },
  ) => Promise<FetchPixelsResult>;
  load?: () => Promise<ArcGISObject>;
  serviceRasterInfo?: {
    spatialReference?: { wkid?: number; latestWkid?: number };
  };
  spatialReference?: { wkid?: number; latestWkid?: number };
};

type FetchPixelsResult = {
  pixelBlock?: {
    mask?: ArrayLike<number>;
    pixels?: ArrayLike<number>[];
    statistics?: Array<{ noDataValue?: number }>;
  } | null;
};

type ElevationTileData = {
  values: Float32Array;
  width: number;
  height: number;
  noDataValue: number;
};

type SourceEntry = {
  active: number;
  lastUsed: number;
  layer: SourceLayer;
  loadPromise: Promise<void> | null;
};

type CustomLayerThis = ElevationLayerInstance & {
  spatialReference: { wkid?: number; latestWkid?: number };
  tileInfo: { size: number[] };
};

type CreateSwissAltiElevationLayerOptions = {
  BaseElevationLayer: BaseElevationConstructor;
  Extent: ArcGISConstructor;
  ImageryTileLayer: ArcGISConstructor;
  catalog: SwissAltiCatalog;
  fullExtent: ArcGISObject;
  spatialReference: ArcGISObject;
  tileInfo: ArcGISObject;
};

const NO_DATA_VALUE = -3.4028234663852886e38;
const MAX_CACHED_SOURCES = 48;
const MAX_PIXEL_REQUESTS = 8;

function abortError(signal?: AbortSignal) {
  if (signal?.reason instanceof Error) return signal.reason;
  return new DOMException("The terrain request was cancelled.", "AbortError");
}

function assertNotAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw abortError(signal);
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

function sourceSpatialReference(layer: SourceLayer) {
  return layer.serviceRasterInfo?.spatialReference ?? layer.spatialReference;
}

function sourceWkid(layer: SourceLayer) {
  const spatialReference = sourceSpatialReference(layer);
  return spatialReference?.latestWkid ?? spatialReference?.wkid;
}

function createRequestLimiter(limit: number) {
  let active = 0;
  const queue: Array<() => void> = [];

  const acquire = async (signal?: AbortSignal) => {
    assertNotAborted(signal);
    if (active < limit) {
      active += 1;
      return;
    }

    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const resume = () => {
        if (settled) return;
        settled = true;
        signal?.removeEventListener("abort", cancel);
        active += 1;
        resolve();
      };
      const cancel = () => {
        if (settled) return;
        settled = true;
        const index = queue.indexOf(resume);
        if (index >= 0) queue.splice(index, 1);
        reject(abortError(signal));
      };

      queue.push(resume);
      signal?.addEventListener("abort", cancel, { once: true });
    });
  };

  const release = () => {
    active = Math.max(0, active - 1);
    queue.shift()?.();
  };

  return async <T>(signal: AbortSignal | undefined, task: () => Promise<T>) => {
    await acquire(signal);
    try {
      assertNotAborted(signal);
      return await task();
    } finally {
      release();
    }
  };
}

export function createSwissAltiElevationLayer({
  BaseElevationLayer,
  Extent,
  ImageryTileLayer,
  catalog,
  fullExtent,
  spatialReference,
  tileInfo,
}: CreateSwissAltiElevationLayerOptions): ElevationLayerInstance {
  const sourceCache = new Map<string, SourceEntry>();
  const failedSources = new Set<string>();
  const withRequestSlot = createRequestLimiter(MAX_PIXEL_REQUESTS);

  const trimCache = () => {
    if (sourceCache.size <= MAX_CACHED_SOURCES) return;

    const removable = [...sourceCache.entries()]
      .filter(([, entry]) => entry.active === 0)
      .sort((left, right) => left[1].lastUsed - right[1].lastUsed);

    while (sourceCache.size > MAX_CACHED_SOURCES && removable.length > 0) {
      const [url, entry] = removable.shift()!;
      sourceCache.delete(url);
      entry.layer.destroy?.();
    }
  };

  const getSource = (tile: SwissAltiCatalogTile) => {
    const cached = sourceCache.get(tile.url);
    if (cached) {
      cached.lastUsed = performance.now();
      return cached;
    }

    const layer = new ImageryTileLayer({
      url: tile.url,
      title: `SwissALTI3D ${tile.id}`,
      visible: false,
    }) as SourceLayer;

    const entry: SourceEntry = {
      active: 0,
      lastUsed: performance.now(),
      layer,
      loadPromise: null,
    };

    sourceCache.set(tile.url, entry);
    trimCache();
    return entry;
  };

  const fetchSourcePixels = async (
    tile: SwissAltiCatalogTile,
    extent: ArcGISObject,
    size: number,
    signal?: AbortSignal,
  ) => {
    const entry = getSource(tile);
    entry.active += 1;
    entry.lastUsed = performance.now();

    try {
      return await withRequestSlot(signal, async () => {
        entry.loadPromise ??= (
          entry.layer.load?.() ?? Promise.resolve(entry.layer)
        ).then(() => {
          const wkid = sourceWkid(entry.layer);
          if (wkid !== SWISS_ALTI_HORIZONTAL_WKID) {
            throw new Error(
              `SwissALTI source ${tile.id} is EPSG:${wkid ?? "unknown"}; EPSG:2056 is required.`,
            );
          }
        });

        await entry.loadPromise;
        assertNotAborted(signal);
        if (!entry.layer.fetchPixels) {
          throw new Error("ImageryTileLayer.fetchPixels is unavailable.");
        }

        return entry.layer.fetchPixels(extent, size, size, { signal });
      });
    } finally {
      entry.active = Math.max(0, entry.active - 1);
      entry.lastUsed = performance.now();
      trimCache();
    }
  };

  const SwissAltiElevationLayer = BaseElevationLayer.createSubclass({
    declaredClass: "raster-terrain-lab.SwissAltiCogElevationLayer",

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
      const requestExtent = {
        xmin: bounds[0],
        ymin: bounds[1],
        xmax: bounds[2],
        ymax: bounds[3],
      };
      const size = (this.tileInfo.size?.[0] ?? 256) + 1;
      const extent = new Extent({
        ...requestExtent,
        spatialReference: this.spatialReference,
      });
      const values = new Float32Array(size * size);
      values.fill(NO_DATA_VALUE);

      const sourceTiles = catalog.tiles.filter((tile) =>
        intersectsSwissAltiTile(tile, requestExtent),
      );

      await Promise.all(
        sourceTiles.map(async (tile) => {
          try {
            const result = await fetchSourcePixels(
              tile,
              extent,
              size,
              options?.signal,
            );
            const pixelBlock = result.pixelBlock;
            const pixels = pixelBlock?.pixels?.[0];
            if (!pixelBlock || !pixels) return;

            const mask = pixelBlock.mask;
            const sourceNoData = pixelBlock.statistics?.[0]?.noDataValue;
            const length = Math.min(values.length, pixels.length);

            for (let index = 0; index < length; index += 1) {
              const value = Number(pixels[index]);
              const isValid =
                (!mask || Number(mask[index]) > 0) &&
                Number.isFinite(value) &&
                value !== sourceNoData;

              if (isValid) values[index] = value;
            }
          } catch (error) {
            if (isAbortError(error) || options?.signal?.aborted) throw error;
            if (!failedSources.has(tile.url)) {
              failedSources.add(tile.url);
              console.warn(`SwissALTI terrain tile ${tile.id} failed to load.`, error);
            }
          }
        }),
      );

      return {
        values,
        width: size,
        height: size,
        noDataValue: NO_DATA_VALUE,
      };
    },

    disposeSources() {
      sourceCache.forEach((entry) => entry.layer.destroy?.());
      sourceCache.clear();
    },
  });

  return new SwissAltiElevationLayer({
    title: "SwissALTI3D COG terrain",
    spatialReference,
    tileInfo,
    fullExtent,
  }) as ElevationLayerInstance;
}
