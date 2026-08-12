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

type ElevationLayerInstance = ArcGISObject & {
  disposeSource?: () => void;
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

type CustomLayerThis = ElevationLayerInstance & {
  addResolvingPromise?: (promise: Promise<unknown>) => void;
  spatialReference: { wkid?: number; latestWkid?: number };
  tileInfo: { size: number[] };
};

export type TerrainDiagnostic =
  | { type: "source-ready"; message: string }
  | { type: "tile-ready"; message: string; validSampleCount: number }
  | { type: "tile-empty"; message: string }
  | { type: "tile-error"; message: string };

type CreateSwissAltiElevationLayerOptions = {
  BaseElevationLayer: BaseElevationConstructor;
  Extent: ArcGISConstructor;
  ImageryTileLayer: ArcGISConstructor;
  fullExtent: ArcGISObject;
  onDiagnostic?: (diagnostic: TerrainDiagnostic) => void;
  spatialReference: ArcGISObject;
  tileInfo: ArcGISObject;
};

const NO_DATA_VALUE = -3.4028234663852886e38;

function sourceWkid(layer: SourceLayer) {
  const spatialReference =
    layer.serviceRasterInfo?.spatialReference ?? layer.spatialReference;
  return spatialReference?.latestWkid ?? spatialReference?.wkid;
}

function intersectsSource(extent: {
  xmin: number;
  ymin: number;
  xmax: number;
  ymax: number;
}) {
  const source = SWISS_ALTI_COG.extent;
  return !(
    source.xmax <= extent.xmin ||
    source.xmin >= extent.xmax ||
    source.ymax <= extent.ymin ||
    source.ymin >= extent.ymax
  );
}

export function createSwissAltiElevationLayer({
  BaseElevationLayer,
  Extent,
  ImageryTileLayer,
  fullExtent,
  onDiagnostic,
  spatialReference,
  tileInfo,
}: CreateSwissAltiElevationLayerOptions): ElevationLayerInstance {
  const sourceLayer = new ImageryTileLayer({
    url: SWISS_ALTI_COG.url,
    title: `SwissALTI3D ${SWISS_ALTI_COG.id}`,
    visible: false,
  }) as SourceLayer;
  let sourceReady: Promise<void> | null = null;
  let reportedTileReady = false;

  const loadSource = () => {
    sourceReady ??= (
      sourceLayer.load?.() ?? Promise.resolve(sourceLayer)
    ).then(() => {
      const wkid = sourceWkid(sourceLayer);
      if (wkid !== SWISS_ALTI_HORIZONTAL_WKID) {
        throw new Error(
          `The elevation COG is EPSG:${wkid ?? "unknown"}; EPSG:2056 is required.`,
        );
      }
      if (!sourceLayer.fetchPixels) {
        throw new Error("ImageryTileLayer.fetchPixels is unavailable.");
      }
      onDiagnostic?.({
        type: "source-ready",
        message: `Source ${SWISS_ALTI_COG.id} loaded in EPSG:2056`,
      });
    });
    return sourceReady;
  };

  const SwissAltiElevationLayer = BaseElevationLayer.createSubclass({
    declaredClass: "raster-terrain-lab.SingleCogElevationLayer",

    load(this: CustomLayerThis) {
      this.addResolvingPromise?.(loadSource());
      return this;
    },

    async fetchTile(
      this: CustomLayerThis,
      level: number,
      row: number,
      column: number,
      options?: { signal?: AbortSignal },
    ): Promise<ElevationTileData> {
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
      const values = new Float32Array(size * size);
      values.fill(NO_DATA_VALUE);

      if (!intersectsSource(requestExtent)) {
        return { values, width: size, height: size, noDataValue: NO_DATA_VALUE };
      }

      try {
        await loadSource();
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
          onDiagnostic?.({
            type: "tile-empty",
            message: `COG returned no pixels for ground tile ${level}/${row}/${column}`,
          });
          return { values, width: size, height: size, noDataValue: NO_DATA_VALUE };
        }

        const mask = pixelBlock.mask;
        const sourceNoData = pixelBlock.statistics?.[0]?.noDataValue;
        const length = Math.min(values.length, pixels.length);
        let validSampleCount = 0;

        for (let index = 0; index < length; index += 1) {
          const value = Number(pixels[index]);
          const isValid =
            (!mask || Number(mask[index]) > 0) &&
            Number.isFinite(value) &&
            value !== sourceNoData;

          if (isValid) {
            values[index] = value;
            validSampleCount += 1;
          }
        }

        if (validSampleCount > 0 && !reportedTileReady) {
          reportedTileReady = true;
          onDiagnostic?.({
            type: "tile-ready",
            validSampleCount,
            message: `Ground tile received ${validSampleCount.toLocaleString()} elevation samples`,
          });
        } else if (validSampleCount === 0) {
          onDiagnostic?.({
            type: "tile-empty",
            message: `COG returned only no-data for ground tile ${level}/${row}/${column}`,
          });
        }

        return { values, width: size, height: size, noDataValue: NO_DATA_VALUE };
      } catch (error) {
        if (options?.signal?.aborted) throw error;
        const message = error instanceof Error ? error.message : "Ground tile failed.";
        onDiagnostic?.({ type: "tile-error", message });
        throw error;
      }
    },

    disposeSource() {
      sourceLayer.destroy?.();
    },
  });

  return new SwissAltiElevationLayer({
    title: `SwissALTI3D ${SWISS_ALTI_COG.id} COG terrain`,
    spatialReference,
    tileInfo,
    fullExtent,
  }) as ElevationLayerInstance;
}
