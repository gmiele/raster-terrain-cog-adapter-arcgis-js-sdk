"use client";

import {
  type CSSProperties,
  createElement,
  type DetailedHTMLProps,
  FormEvent,
  type HTMLAttributes,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  createElevationLods,
  createSwissAltiElevationLayer,
  prepareSwissAltiCatalog,
  type SwissAltiElevationLayer,
  type SwissAltiTilingProfile,
} from "./swissAltiElevation";
import {
  ELEVATION_SUISSE_DETAIL_LOD,
  loadElevationSuisseScheme,
} from "./elevationSuisseScheme";
import {
  DEFAULT_SWISS_ALTI_REGION,
  getSwissAltiRegion,
  SWISS_ALTI_REGIONS,
  SWISS_ALTI_CELL_SIZE_METERS,
  SWISS_ALTI_COG,
  SWISS_ALTI_HORIZONTAL_WKID,
  SWISS_ALTI_VERTICAL_WKID,
  type SwissAltiRegionId,
} from "./swissAltiSource";

const DEMO_COG_URL =
  "https://ss6imagery.arcgisonline.com/imagery_sample/landsat8/Bolivia_LC08_L1TP_001069_20190719_MS.tiff";
const SWISS_BUILDINGS_SCENE_URL =
  "https://tiles.arcgis.com/tiles/oPre3pOfRfefL8y0/arcgis/rest/services/swissbuildings3D_LOD2_lv95/SceneServer";

type AppMode = "imagery" | "terrain" | "terrain-suisse-grid";
type LoadState = "starting" | "loading" | "ready" | "error";
type TerrainOverlayState = "idle" | "loading" | "ready" | "error";

function isTerrainMode(mode: AppMode) {
  return mode !== "imagery";
}

function tilingProfileForMode(mode: AppMode): SwissAltiTilingProfile {
  return mode === "terrain-suisse-grid" ? "elevation-suisse" : "regional";
}

type ExampleDataset = {
  id: string;
  label: string;
  detail: string;
  group: "True-color imagery" | "Specialized rasters";
  url: string;
  bandIds?: number[];
};

const EXAMPLE_DATASETS: ExampleDataset[] = [
  {
    id: "bolivia-landsat",
    label: "Bolivia · Landsat 8",
    detail: "Multiband Landsat scene · Esri",
    group: "True-color imagery",
    url: DEMO_COG_URL,
    bandIds: [3, 2, 1],
  },
  {
    id: "iceland-sentinel",
    label: "Iceland · Sentinel-2",
    detail: "True color · 71 MB",
    group: "True-color imagery",
    url: "https://sentinel-cogs.s3.us-west-2.amazonaws.com/sentinel-s2-l2a-cogs/27/V/WL/2026/8/S2C_27VWL_20260809_0_L2A/TCI.tif",
  },
  {
    id: "namib-sentinel",
    label: "Namib Desert · Sentinel-2",
    detail: "True color · 193 MB",
    group: "True-color imagery",
    url: "https://sentinel-cogs.s3.us-west-2.amazonaws.com/sentinel-s2-l2a-cogs/33/J/VM/2026/8/S2C_33JVM_20260811_0_L2A/TCI.tif",
  },
  {
    id: "great-barrier-reef-sentinel",
    label: "Great Barrier Reef · Sentinel-2",
    detail: "True color · 291 MB",
    group: "True-color imagery",
    url: "https://sentinel-cogs.s3.us-west-2.amazonaws.com/sentinel-s2-l2a-cogs/55/K/DU/2026/8/S2B_55KDU_20260810_0_L2A/TCI.tif",
  },
  {
    id: "san-francisco-sentinel",
    label: "San Francisco · Sentinel-2",
    detail: "True color · 325 MB",
    group: "True-color imagery",
    url: "https://sentinel-cogs.s3.us-west-2.amazonaws.com/sentinel-s2-l2a-cogs/10/S/EH/2026/8/S2B_10SEH_20260806_0_L2A/TCI.tif",
  },
  {
    id: "zurich-sentinel",
    label: "Zürich region · Sentinel-2",
    detail: "True color · 322 MB",
    group: "True-color imagery",
    url: "https://sentinel-cogs.s3.us-west-2.amazonaws.com/sentinel-s2-l2a-cogs/32/T/MT/2026/8/S2C_32TMT_20260811_0_L2A/TCI.tif",
  },
  {
    id: "zurich-red-band",
    label: "Zürich · Red band",
    detail: "Single-band Sentinel-2 · 219 MB",
    group: "Specialized rasters",
    url: "https://sentinel-cogs.s3.us-west-2.amazonaws.com/sentinel-s2-l2a-cogs/32/T/MT/2026/8/S2C_32TMT_20260811_0_L2A/B04.tif",
  },
  {
    id: "zurich-scene-classification",
    label: "Zürich · Scene classification",
    detail: "Categorical Sentinel-2 · 3 MB",
    group: "Specialized rasters",
    url: "https://sentinel-cogs.s3.us-west-2.amazonaws.com/sentinel-s2-l2a-cogs/32/T/MT/2026/8/S2C_32TMT_20260811_0_L2A/SCL.tif",
  },
  {
    id: "swissalti3d",
    label: `SwissALTI3D · Tile ${SWISS_ALTI_COG.id}`,
    detail: "0.5 m elevation · swisstopo · 16 MB",
    group: "Specialized rasters",
    url: SWISS_ALTI_COG.url,
  },
];

const EXAMPLE_GROUPS: ExampleDataset["group"][] = [
  "True-color imagery",
  "Specialized rasters",
];

const TERRAIN_REGION_OPTIONS = SWISS_ALTI_REGIONS.filter(
  ({ id }) => id !== "bern",
);

type RasterDetails = {
  name: string;
  host: string;
  bands: string;
  spatialReference: string;
};

type ArcGISObject = Record<string, unknown> & {
  destroy?: () => void;
};

type ArcGISConstructor = new (
  options?: Record<string, unknown>,
) => ArcGISObject;

type RasterColorRamps = {
  byName: (name: string) => unknown;
  createColorRamp: (colors: unknown) => ArcGISObject;
};

type ViewshedAnalysis = ArcGISObject & {
  clear?: () => void;
};

type ViewshedAnalysisView = ArcGISObject & {
  interactive?: boolean;
  place?: (options?: { signal?: AbortSignal }) => Promise<unknown>;
  selectedViewshed?: unknown;
};

type ArcGISSceneElement = HTMLElement & {
  analyses?: {
    add?: (analysis: ArcGISObject) => void;
    remove?: (analysis: ArcGISObject) => void;
  };
  componentOnReady: () => Promise<ArcGISSceneElement>;
  viewOnReady: () => Promise<void>;
  whenAnalysisView?: (
    analysis: ArcGISObject,
  ) => Promise<ViewshedAnalysisView>;
  clippingArea?: ArcGISObject;
  environment?: Record<string, unknown>;
  map?: ArcGISObject | null;
  spatialReference?: ArcGISObject;
  view?: ArcGISObject;
  viewingMode?: "global" | "local";
};

type ArcGISSceneAttributes = DetailedHTMLProps<
  HTMLAttributes<ArcGISSceneElement>,
  ArcGISSceneElement
> & {
  basemap?: string;
  ground?: string;
  spatialReference?: { wkid: number };
  "viewing-mode"?: "global" | "local";
  "camera-position"?: string;
  "camera-heading"?: string;
  "camera-tilt"?: string;
  "quality-profile"?: "low" | "medium" | "high";
};

type ArcGISBasemapGalleryAttributes = DetailedHTMLProps<
  HTMLAttributes<HTMLElement>,
  HTMLElement
> & {
  label?: string;
};

type ArcGISMeasurementElement = HTMLElement & {
  clear?: () => Promise<void>;
  state?: "disabled" | "measured" | "measuring" | "ready" | "unsupported";
};

type ArcGISLineOfSightElement = HTMLElement & {
  clear?: () => Promise<void>;
  state?: "created" | "creating" | "disabled" | "ready";
};

type ArcGISClearableElement = HTMLElement & {
  clear?: () => Promise<void>;
};

type ArcGISExpandElement = HTMLElement & {
  expanded?: boolean;
};

type ArcGISExpandAttributes = DetailedHTMLProps<
  HTMLAttributes<ArcGISExpandElement>,
  ArcGISExpandElement
> & {
  "expand-icon"?: string;
  group?: string;
  label?: string;
  mode?: "auto" | "drawer" | "floating";
};

type ArcGISDaylightAttributes = DetailedHTMLProps<
  HTMLAttributes<HTMLElement>,
  HTMLElement
> & {
  label?: string;
};

type ArcGISNavigationAttributes = DetailedHTMLProps<
  HTMLAttributes<HTMLElement>,
  HTMLElement
> & {
  label?: string;
};

type ArcGISMeasurementAttributes = DetailedHTMLProps<
  HTMLAttributes<ArcGISMeasurementElement>,
  ArcGISMeasurementElement
> & {
  label?: string;
  unit?: "metric" | "imperial" | "meters" | "kilometers";
};

type ArcGISLineOfSightAttributes = DetailedHTMLProps<
  HTMLAttributes<ArcGISLineOfSightElement>,
  ArcGISLineOfSightElement
> & {
  label?: string;
};

type ArcGISVolumeMeasurementAttributes = DetailedHTMLProps<
  HTMLAttributes<ArcGISMeasurementElement>,
  ArcGISMeasurementElement
> & {
  areaDisplayUnit?: "metric" | "imperial";
  elevationDisplayUnit?: "metric" | "imperial";
  elevationInputUnit?: "meters" | "feet";
  label?: string;
  perimeterDisplayUnit?: "metric" | "imperial";
  volumeDisplayUnit?: "metric" | "imperial";
};

type ArcGISElevationProfileAttributes = DetailedHTMLProps<
  HTMLAttributes<ArcGISClearableElement>,
  ArcGISClearableElement
> & {
  distanceUnit?: "metric" | "imperial";
  elevationUnit?: "metric" | "imperial";
  label?: string;
};

declare global {
  interface Window {
    $arcgis?: {
      import: (modules: string | string[]) => Promise<unknown>;
    };
  }
}

function waitForArcGIS(timeout = 20000) {
  return new Promise<void>((resolve, reject) => {
    if (window.$arcgis) {
      resolve();
      return;
    }

    const startedAt = Date.now();
    const interval = window.setInterval(() => {
      if (window.$arcgis) {
        window.clearInterval(interval);
        resolve();
      } else if (Date.now() - startedAt > timeout) {
        window.clearInterval(interval);
        reject(new Error("The ArcGIS Maps SDK could not be loaded."));
      }
    }, 80);
  });
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "The raster could not be opened.";
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

function getHost(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return "Remote source";
  }
}

function sceneEnvironment(local: boolean) {
  return {
    atmosphereEnabled: !local,
    starsEnabled: false,
    background: local
      ? { type: "color", color: [229, 232, 222, 1] }
      : undefined,
    lighting: {
      directShadowsEnabled: true,
      ambientOcclusionEnabled: true,
      date: new Date("2025-07-19T15:00:00Z"),
    },
  };
}

export default function Home() {
  const sceneElementRef = useRef<ArcGISSceneElement>(null);
  const measurementExpandRef = useRef<ArcGISExpandElement>(null);
  const directLineMeasurementRef = useRef<ArcGISMeasurementElement>(null);
  const areaMeasurementRef = useRef<ArcGISMeasurementElement>(null);
  const lineOfSightExpandRef = useRef<ArcGISExpandElement>(null);
  const lineOfSightRef = useRef<ArcGISLineOfSightElement>(null);
  const viewshedExpandRef = useRef<ArcGISExpandElement>(null);
  const viewshedAnalysisRef = useRef<ViewshedAnalysis | null>(null);
  const viewshedAnalysisViewRef = useRef<ViewshedAnalysisView | null>(null);
  const viewshedPlacementRef = useRef<AbortController | null>(null);
  const volumeMeasurementExpandRef = useRef<ArcGISExpandElement>(null);
  const volumeMeasurementRef = useRef<ArcGISMeasurementElement>(null);
  const elevationProfileExpandRef = useRef<ArcGISExpandElement>(null);
  const elevationProfileRef = useRef<ArcGISClearableElement>(null);
  const mapRef = useRef<ArcGISObject | null>(null);
  const viewRef = useRef<ArcGISObject | null>(null);
  const imageryLayerRef = useRef<ArcGISObject | null>(null);
  const terrainLayerRef = useRef<SwissAltiElevationLayer | null>(null);
  const terrainOverlayLayerRef = useRef<ArcGISObject | null>(null);
  const buildingsLayerRef = useRef<ArcGISObject | null>(null);
  const terrainExtentRef = useRef<ArcGISObject | null>(null);
  const layerConstructorRef = useRef<ArcGISConstructor | null>(null);
  const sceneGenerationRef = useRef(0);
  const loadRequestRef = useRef(0);
  const activeUrlRef = useRef(DEMO_COG_URL);
  const modeRef = useRef<AppMode>("imagery");
  const opacityRef = useRef(88);
  const terrainOverlayOpacityRef = useRef(82);
  const terrainOverlayVisibleRef = useRef(true);
  const buildingsOpacityRef = useRef(90);
  const buildingsVisibleRef = useRef(false);

  const [sdkReady, setSdkReady] = useState(false);
  const [mode, setMode] = useState<AppMode>("imagery");
  const [terrainRegionId, setTerrainRegionId] =
    useState<SwissAltiRegionId>(DEFAULT_SWISS_ALTI_REGION.id);
  const [cogUrl, setCogUrl] = useState(DEMO_COG_URL);
  const [activeUrl, setActiveUrl] = useState(DEMO_COG_URL);
  const [selectedExampleId, setSelectedExampleId] = useState("bolivia-landsat");
  const [loadState, setLoadState] = useState<LoadState>("starting");
  const [statusText, setStatusText] = useState("Preparing 3D scene…");
  const [terrainState, setTerrainState] = useState<LoadState>("starting");
  const [terrainOverlayState, setTerrainOverlayState] =
    useState<TerrainOverlayState>("idle");
  const [terrainOverlayStatus, setTerrainOverlayStatus] = useState(
    "Waiting for the Zermatt terrain…",
  );
  const [terrainOverlayOpacity, setTerrainOverlayOpacity] = useState(82);
  const [terrainOverlayVisible, setTerrainOverlayVisible] = useState(true);
  const [buildingsState, setBuildingsState] =
    useState<TerrainOverlayState>("idle");
  const [buildingsStatus, setBuildingsStatus] = useState(
    "Waiting for the local terrain scene…",
  );
  const [buildingsOpacity, setBuildingsOpacity] = useState(90);
  const [buildingsVisible, setBuildingsVisible] = useState(false);
  const [terrainStatus, setTerrainStatus] = useState(
    "Preparing local EPSG:2056 scene…",
  );
  const [viewshedState, setViewshedState] = useState<
    "idle" | "ready" | "placing" | "error"
  >("idle");
  const [viewshedStatus, setViewshedStatus] = useState(
    "Waiting for the terrain…",
  );
  const [terrainValidation, setTerrainValidation] = useState({
    source: "Pending",
    tiling: "—",
    groundLayers: "—",
    coverage: "—",
    elevationRange: "—",
    sourcePixels: "—",
    terrainSamples: "—",
  });
  const [opacity, setOpacity] = useState(88);
  const [visible, setVisible] = useState(true);
  const [details, setDetails] = useState<RasterDetails>({
    name: "Bolivia · Landsat 8",
    host: "ss6imagery.arcgisonline.com",
    bands: "9 bands",
    spatialReference: "Detecting…",
  });
  const terrainRegion = getSwissAltiRegion(terrainRegionId);
  const terrainYears = terrainRegion.years.join("–");
  const terrainTilingProfile = tilingProfileForMode(mode);
  const usesElevationSuisseGrid =
    terrainTilingProfile === "elevation-suisse";
  const terrainTilingLabel = usesElevationSuisseGrid
    ? "elevation_suisse · 512 px"
    : "Regional COG · 256 px";

  const frameImagery = useCallback(async () => {
    const view = viewRef.current as
      | (ArcGISObject & {
          goTo?: (target: unknown, options?: unknown) => Promise<void>;
        })
      | null;
    const layer = imageryLayerRef.current as
      | (ArcGISObject & { fullExtent?: { expand?: (factor: number) => unknown } })
      | null;

    if (!view?.goTo || !layer?.fullExtent) return;
    const target = layer.fullExtent.expand
      ? layer.fullExtent.expand(1.55)
      : layer.fullExtent;

    try {
      await view.goTo(target, { duration: 1300, easing: "ease-in-out" });
    } catch {
      // Navigation cancellation is expected when the user moves the camera.
    }
  }, []);

  const frameTerrain = useCallback(async () => {
    const view = viewRef.current as
      | (ArcGISObject & {
          goTo?: (target: unknown, options?: unknown) => Promise<void>;
        })
      | null;
    if (!view?.goTo || !terrainExtentRef.current) return;

    try {
      await view.goTo(
        {
          target: terrainExtentRef.current,
          tilt: 58,
          heading: 318,
        },
        { duration: 1300, easing: "ease-in-out" },
      );
    } catch {
      // Navigation cancellation is expected when the user moves the camera.
    }
  }, []);

  const frameTerrainOverlay = useCallback(async () => {
    const view = viewRef.current as
      | (ArcGISObject & {
          goTo?: (target: unknown, options?: unknown) => Promise<void>;
        })
      | null;
    const layer = terrainOverlayLayerRef.current as
      | (ArcGISObject & { fullExtent?: { expand?: (factor: number) => unknown } })
      | null;
    if (!view?.goTo || !layer?.fullExtent) return;

    const target = layer.fullExtent.expand
      ? layer.fullExtent.expand(1.7)
      : layer.fullExtent;
    try {
      await view.goTo(
        { target, tilt: 62, heading: 318 },
        { duration: 1200, easing: "ease-in-out" },
      );
    } catch {
      // Navigation cancellation is expected when the user moves the camera.
    }
  }, []);

  const cancelViewshedPlacement = useCallback(() => {
    const controller = viewshedPlacementRef.current;
    if (!controller) return;

    viewshedPlacementRef.current = null;
    controller.abort();
    setViewshedState(viewshedAnalysisViewRef.current ? "ready" : "idle");
    setViewshedStatus("Viewshed placement cancelled.");
  }, []);

  const clearViewsheds = useCallback(() => {
    const controller = viewshedPlacementRef.current;
    viewshedPlacementRef.current = null;
    controller?.abort();

    viewshedAnalysisRef.current?.clear?.();
    if (viewshedAnalysisViewRef.current) {
      viewshedAnalysisViewRef.current.selectedViewshed = null;
    }

    const ready = Boolean(viewshedAnalysisViewRef.current);
    setViewshedState(ready ? "ready" : "idle");
    setViewshedStatus(
      ready
        ? "Viewsheds cleared. Place an observer and target to create another."
        : "Waiting for the terrain…",
    );
  }, []);

  const startViewshedPlacement = useCallback(async () => {
    const analysisView = viewshedAnalysisViewRef.current;
    if (!analysisView?.place) {
      setViewshedState("error");
      setViewshedStatus("The viewshed analysis is not ready.");
      return;
    }

    viewshedPlacementRef.current?.abort();
    const controller = new AbortController();
    viewshedPlacementRef.current = controller;
    setViewshedState("placing");
    setViewshedStatus(
      "Click the terrain to place the observer, then click its target.",
    );

    try {
      await analysisView.place({ signal: controller.signal });
      if (viewshedPlacementRef.current !== controller) return;
      viewshedPlacementRef.current = null;
      setViewshedState("ready");
      setViewshedStatus("Viewshed created. Place another or clear the result.");
    } catch (error) {
      if (
        controller.signal.aborted ||
        isAbortError(error) ||
        viewshedPlacementRef.current !== controller
      ) {
        return;
      }
      viewshedPlacementRef.current = null;
      setViewshedState("error");
      setViewshedStatus(`Viewshed placement failed: ${getErrorMessage(error)}`);
    }
  }, []);

  const loadCog = useCallback(
    async (url: string) => {
      if (modeRef.current !== "imagery") return;
      const requestId = ++loadRequestRef.current;
      const ImageryTileLayer = layerConstructorRef.current;
      const map = mapRef.current as
        | (ArcGISObject & {
            add?: (layer: ArcGISObject) => void;
            remove?: (layer: ArcGISObject) => void;
          })
        | null;

      if (!ImageryTileLayer || !map) return;
      setLoadState("loading");
      setStatusText("Reading GeoTIFF header and tiles…");

      if (imageryLayerRef.current) {
        map.remove?.(imageryLayerRef.current);
        imageryLayerRef.current.destroy?.();
        imageryLayerRef.current = null;
      }

      const example = EXAMPLE_DATASETS.find((dataset) => dataset.url === url);
      const layer = new ImageryTileLayer({
        url,
        title: example?.label ?? "Cloud raster",
        opacity: opacityRef.current / 100,
        visible: true,
        ...(example?.bandIds ? { bandIds: example.bandIds } : {}),
      });

      imageryLayerRef.current = layer;
      map.add?.(layer);
      setVisible(true);

      try {
        const load = layer.load as (() => Promise<ArcGISObject>) | undefined;
        if (load) await load.call(layer);

        if (
          requestId !== loadRequestRef.current ||
          modeRef.current !== "imagery"
        ) {
          map.remove?.(layer);
          layer.destroy?.();
          return;
        }

        const rasterInfo = (layer.serviceRasterInfo ?? layer.rasterInfo ?? {}) as {
          bandCount?: number;
          bandInfos?: unknown[];
          spatialReference?: { wkid?: number; latestWkid?: number };
        };
        const spatialReference =
          rasterInfo.spatialReference ??
          (layer.spatialReference as
            | { wkid?: number; latestWkid?: number }
            | undefined);
        const bandCount = rasterInfo.bandCount ?? rasterInfo.bandInfos?.length;
        const fileName = decodeURIComponent(
          new URL(url).pathname.split("/").pop() || "Cloud raster",
        );

        setDetails({
          name: example?.label ?? fileName,
          host: getHost(url),
          bands: bandCount
            ? `${bandCount} band${bandCount === 1 ? "" : "s"}`
            : "Auto bands",
          spatialReference: spatialReference?.latestWkid
            ? `EPSG:${spatialReference.latestWkid}`
            : spatialReference?.wkid
              ? `EPSG:${spatialReference.wkid}`
              : "Embedded CRS",
        });
        setActiveUrl(url);
        setLoadState("ready");
        setStatusText("COG connected · tiles streaming");
        await frameImagery();
      } catch (error) {
        if (
          requestId !== loadRequestRef.current ||
          modeRef.current !== "imagery"
        ) {
          return;
        }
        map.remove?.(layer);
        layer.destroy?.();
        imageryLayerRef.current = null;
        setLoadState("error");
        setStatusText(
          `${getErrorMessage(error)} Check that the URL is public, CORS-enabled, and supports byte-range requests.`,
        );
      }
    },
    [frameImagery],
  );

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    activeUrlRef.current = activeUrl;
  }, [activeUrl]);

  useEffect(() => {
    let cancelled = false;

    const prepareSdk = async () => {
      try {
        await waitForArcGIS();
        await window.customElements.whenDefined("arcgis-scene");
        if (!cancelled) setSdkReady(true);
      } catch (error) {
        if (cancelled) return;
        const message = getErrorMessage(error);
        setLoadState("error");
        setTerrainState("error");
        setStatusText(message);
        setTerrainStatus(message);
      }
    };

    void prepareSdk();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!sdkReady) return;

    let cancelled = false;
    const abortController = new AbortController();
    const generation = ++sceneGenerationRef.current;
    const isCurrent = () =>
      !cancelled && generation === sceneGenerationRef.current;

    const initializeImagery = async (sceneElement: ArcGISSceneElement) => {
      setLoadState("starting");
      setStatusText("Preparing global imagery scene…");

      const ImageryTileLayer = (await window.$arcgis!.import(
        "@arcgis/core/layers/ImageryTileLayer.js",
      )) as ArcGISConstructor;
      if (!isCurrent()) return;

      await sceneElement.componentOnReady();
      sceneElement.environment = sceneEnvironment(false);
      await sceneElement.viewOnReady();
      if (!isCurrent() || !sceneElement.map || !sceneElement.view) return;

      mapRef.current = sceneElement.map;
      viewRef.current = sceneElement.view;
      layerConstructorRef.current = ImageryTileLayer;
      await loadCog(activeUrlRef.current);
    };

    const initializeTerrain = async (sceneElement: ArcGISSceneElement) => {
      setTerrainState("loading");
      setBuildingsState("loading");
      setBuildingsStatus("Loading the nationwide EPSG:2056 buildings layer…");
      setTerrainOverlayState(
        terrainRegion.id === "zermatt" ? "loading" : "idle",
      );
      setTerrainOverlayStatus(
        terrainRegion.id === "zermatt"
          ? `Loading tile ${terrainRegion.anchorCog.id} as a surface overlay…`
          : "The test overlay is available for the Zermatt catalog.",
      );
      setTerrainStatus(
        `Preparing ${terrainRegion.cogs.length} ${terrainRegion.label} SwissALTI COGs…`,
      );
      setTerrainValidation({
        source: "Loading",
        tiling: "Loading",
        groundLayers: "—",
        coverage: "—",
        elevationRange: "—",
        sourcePixels: "—",
        terrainSamples: "—",
      });

      const [
        BaseElevationLayer,
        Extent,
        Ground,
        ImageryTileLayer,
        Point,
        RasterShadedReliefRenderer,
        SceneLayer,
        SpatialReference,
        TileInfo,
        rasterColorRamps,
      ] = (await window.$arcgis!.import([
        "@arcgis/core/layers/BaseElevationLayer.js",
        "@arcgis/core/geometry/Extent.js",
        "@arcgis/core/Ground.js",
        "@arcgis/core/layers/ImageryTileLayer.js",
        "@arcgis/core/geometry/Point.js",
        "@arcgis/core/renderers/RasterShadedReliefRenderer.js",
        "@arcgis/core/layers/SceneLayer.js",
        "@arcgis/core/geometry/SpatialReference.js",
        "@arcgis/core/layers/support/TileInfo.js",
        "@arcgis/core/smartMapping/raster/support/colorRamps.js",
      ])) as [
        ArcGISConstructor & {
          createSubclass: (definition: Record<string, unknown>) => ArcGISConstructor;
        },
        ArcGISConstructor,
        ArcGISConstructor,
        ArcGISConstructor,
        ArcGISConstructor,
        ArcGISConstructor,
        ArcGISConstructor,
        ArcGISConstructor,
        ArcGISConstructor,
        RasterColorRamps,
      ];

      const elevationSuisseScheme = usesElevationSuisseGrid
        ? await loadElevationSuisseScheme(abortController.signal)
        : null;
      if (!isCurrent()) return;

      const preparedCatalog = await prepareSwissAltiCatalog(
        ImageryTileLayer,
        terrainRegion,
        abortController.signal,
      );
      if (!isCurrent()) {
        preparedCatalog.dispose();
        return;
      }
      const { metadata } = preparedCatalog;
      const lods =
        elevationSuisseScheme?.lods ?? createElevationLods(metadata);
      const tileSize = elevationSuisseScheme?.size ?? [256, 256];
      const tileOrigin = elevationSuisseScheme?.origin ?? {
        x: metadata.extent.xmin,
        y: metadata.extent.ymax,
      };
      const spatialReference = new SpatialReference({ wkid: SWISS_ALTI_HORIZONTAL_WKID });
      const fullExtent = new Extent({
        ...metadata.extent,
        spatialReference,
      });
      const initialExtent = new Extent({
        ...terrainRegion.initialExtent,
        spatialReference,
      });
      const tileInfo = new TileInfo({
        dpi: elevationSuisseScheme?.dpi ?? 96,
        format: elevationSuisseScheme?.format ?? "lerc",
        spatialReference,
        size: tileSize,
        origin: new Point({
          x: tileOrigin.x,
          y: tileOrigin.y,
          spatialReference,
        }),
        lods,
      });
      setTerrainValidation((current) => ({
        ...current,
        source: `${terrainRegion.label} · ${metadata.sourceCount} aligned COGs`,
        tiling: terrainTilingLabel,
        sourcePixels: metadata.sourcePixelCount.toLocaleString(),
      }));
      setTerrainStatus(
        usesElevationSuisseGrid
          ? `elevation_suisse grid verified · COG values · active LOD 0–${elevationSuisseScheme!.maxLod}`
          : `${terrainRegion.label} grid verified · ${metadata.nativeResolution} m native pixels`,
      );

      const terrainLayer = createSwissAltiElevationLayer({
        BaseElevationLayer,
        Extent,
        fullExtent,
        lods,
        preparedCatalog,
        spatialReference,
        tileInfo,
        tilingProfile: terrainTilingProfile,
      });

      const loadTerrainLayer = terrainLayer.load as
        | (() => Promise<ArcGISObject>)
        | undefined;
      if (loadTerrainLayer) await loadTerrainLayer.call(terrainLayer);
      if (!isCurrent()) return;

      await sceneElement.componentOnReady();
      if (!isCurrent() || !sceneElement.map) return;
      sceneElement.environment = sceneEnvironment(true);
      sceneElement.clippingArea = fullExtent;
      const ground = new Ground({
        layers: [terrainLayer],
        opacity: 1,
        surfaceColor: "#d6ddc7",
        navigationConstraint: { type: "stay-above" },
      }) as ArcGISObject & { layers?: { length?: number } };
      sceneElement.map.ground = ground;

      terrainLayerRef.current = terrainLayer;
      // Keep the complete catalog extent for terrain coverage and clipping, but
      // frame the camera around the selected region's known COG-covered focus.
      // The full rectangular bounds include intentional no-data holes and are
      // too broad to produce a useful initial terrain view.
      terrainExtentRef.current = initialExtent;
      const groundLayerCount = ground.layers?.length ?? 0;
      setTerrainValidation((current) => ({
        ...current,
        groundLayers: String(groundLayerCount),
      }));
      if (groundLayerCount !== 1) {
        throw new Error(`Expected one ground layer; found ${groundLayerCount}.`);
      }

      const terrainMap = sceneElement.map as ArcGISObject & {
        add?: (layer: ArcGISObject) => void;
        remove?: (layer: ArcGISObject) => void;
      };
      const buildingsLayer = new SceneLayer({
        url: SWISS_BUILDINGS_SCENE_URL,
        title: "swissBUILDINGS3D · nationwide LOD2",
        opacity: buildingsOpacityRef.current / 100,
        popupEnabled: true,
        visible: buildingsVisibleRef.current,
      }) as ArcGISObject & {
        load?: (options?: { signal?: AbortSignal }) => Promise<ArcGISObject>;
      };

      terrainMap.add?.(buildingsLayer);
      buildingsLayerRef.current = buildingsLayer;
      try {
        await buildingsLayer.load?.({ signal: abortController.signal });
        if (!isCurrent()) {
          terrainMap.remove?.(buildingsLayer);
          buildingsLayer.destroy?.();
          if (buildingsLayerRef.current === buildingsLayer) {
            buildingsLayerRef.current = null;
          }
          return;
        }
        setBuildingsState("ready");
        setBuildingsStatus(
          "Nationwide swissBUILDINGS3D LOD2 · EPSG:2056 scene layer.",
        );
      } catch (error) {
        terrainMap.remove?.(buildingsLayer);
        buildingsLayer.destroy?.();
        if (buildingsLayerRef.current === buildingsLayer) {
          buildingsLayerRef.current = null;
        }
        if (abortController.signal.aborted || !isCurrent()) return;
        setBuildingsState("error");
        setBuildingsStatus(
          `Buildings unavailable: ${getErrorMessage(error)}`,
        );
      }

      if (terrainRegion.id === "zermatt") {
        const overlayColorRamp = rasterColorRamps.createColorRamp(
          rasterColorRamps.byName("Elevation #1"),
        );
        const overlayRenderer = new RasterShadedReliefRenderer({
          altitude: 42,
          azimuth: 315,
          colorRamp: overlayColorRamp,
          hillshadeType: "traditional",
          scalingType: "none",
          zFactor: 1,
        });
        const overlayLayer = new ImageryTileLayer({
          url: terrainRegion.anchorCog.url,
          title: `Zermatt elevation COG ${terrainRegion.anchorCog.id} · surface overlay`,
          opacity: terrainOverlayOpacityRef.current / 100,
          renderer: overlayRenderer,
          visible: terrainOverlayVisibleRef.current,
        }) as ArcGISObject & {
          load?: (options?: { signal?: AbortSignal }) => Promise<ArcGISObject>;
        };

        try {
          await overlayLayer.load?.({ signal: abortController.signal });
          if (!isCurrent()) {
            overlayLayer.destroy?.();
            return;
          }
          const map = sceneElement.map as ArcGISObject & {
            add?: (layer: ArcGISObject) => void;
          };
          map.add?.(overlayLayer);
          terrainOverlayLayerRef.current = overlayLayer;
          setTerrainOverlayState("ready");
          setTerrainOverlayStatus(
            `Tile ${terrainRegion.anchorCog.id} uses a tinted elevation hillshade over the COG terrain.`,
          );
        } catch (error) {
          overlayLayer.destroy?.();
          if (abortController.signal.aborted || !isCurrent()) return;
          setTerrainOverlayState("error");
          setTerrainOverlayStatus(
            `Overlay unavailable: ${getErrorMessage(error)}`,
          );
        }
      }

      setTerrainStatus("Rendering the regional COG ground…");
      await sceneElement.viewOnReady();
      if (!isCurrent() || !sceneElement.map || !sceneElement.view) return;

      const viewSpatialReference = sceneElement.view.spatialReference as
        | { wkid?: number; latestWkid?: number }
        | undefined;
      const wkid =
        viewSpatialReference?.latestWkid ?? viewSpatialReference?.wkid;
      const viewingMode = sceneElement.view.viewingMode as string | undefined;

      if (wkid !== SWISS_ALTI_HORIZONTAL_WKID || viewingMode !== "local") {
        throw new Error(
          `Local terrain scene initialized as ${viewingMode ?? "unknown"} / EPSG:${wkid ?? "unknown"}.`,
        );
      }

      mapRef.current = sceneElement.map;
      viewRef.current = sceneElement.view;

      const view = sceneElement.view as ArcGISObject & {
        goTo?: (target: unknown, options?: unknown) => Promise<void>;
      };

      try {
        await view.goTo?.(
          { target: initialExtent, tilt: 62, heading: 318 },
          { duration: 1200, easing: "ease-in-out" },
        );
      } catch {
        // Navigation cancellation is expected when the user moves the camera.
      }

      setTerrainStatus(
        usesElevationSuisseGrid
          ? "Building the LOD 13 COG mosaic and recursive cache overviews…"
          : "Checking interior, seam, and no-data terrain probes…",
      );
      const audit = await terrainLayer.auditRegionalCoverage({
        signal: abortController.signal,
        onProgress: (completed, total) => {
          if (!isCurrent()) return;
          setTerrainValidation((current) => ({
            ...current,
            coverage: `${completed}/${total} probes`,
          }));
          setTerrainStatus(
            `Validating regional terrain · ${completed}/${total} probes`,
          );
        },
      });
      if (!isCurrent()) return;

      setTerrainValidation((current) => ({
        ...current,
        coverage: `${audit.completedProbes}/${audit.totalProbes} probes`,
        elevationRange: `${audit.elevationMin.toFixed(1)}–${audit.elevationMax.toFixed(1)} m`,
        terrainSamples: `${audit.validSampleCount.toLocaleString()} / ${audit.expectedSampleCount.toLocaleString()}`,
      }));
      setTerrainStatus(`Framing the ${terrainRegion.label} terrain focus…`);
      await frameTerrain();
      if (!isCurrent()) return;

      setTerrainState("ready");
      setTerrainStatus(
        usesElevationSuisseGrid
          ? `${terrainRegion.label} ground verified · cache overviews and COG detail probes passed`
          : `${terrainRegion.label} ground verified · interior, seam, and no-data probes passed`,
      );
    };

    const initialize = async () => {
      const sceneElement = sceneElementRef.current;
      if (!sceneElement || !window.$arcgis) return;

      try {
        if (mode === "imagery") {
          await initializeImagery(sceneElement);
        } else {
          await initializeTerrain(sceneElement);
        }
      } catch (error) {
        if (!isCurrent() || abortController.signal.aborted) return;
        console.error("ArcGIS scene initialization failed", error);
        if (mode === "imagery") {
          setLoadState("error");
          setStatusText(getErrorMessage(error));
        } else {
          setTerrainState("error");
          setTerrainStatus(getErrorMessage(error));
        }
      }
    };

    void initialize();

    return () => {
      cancelled = true;
      abortController.abort();
      sceneGenerationRef.current += 1;
      loadRequestRef.current += 1;

      const map = mapRef.current as
        | (ArcGISObject & { remove?: (layer: ArcGISObject) => void })
        | null;
      if (imageryLayerRef.current) map?.remove?.(imageryLayerRef.current);
      imageryLayerRef.current?.destroy?.();
      imageryLayerRef.current = null;

      if (terrainOverlayLayerRef.current) {
        map?.remove?.(terrainOverlayLayerRef.current);
      }
      terrainOverlayLayerRef.current?.destroy?.();
      terrainOverlayLayerRef.current = null;

      if (buildingsLayerRef.current) {
        map?.remove?.(buildingsLayerRef.current);
      }
      buildingsLayerRef.current?.destroy?.();
      buildingsLayerRef.current = null;

      terrainLayerRef.current?.disposeSource?.();
      terrainLayerRef.current?.destroy?.();
      terrainLayerRef.current = null;
      terrainExtentRef.current = null;
      layerConstructorRef.current = null;
      viewRef.current = null;
      mapRef.current = null;
    };
  }, [
    frameTerrain,
    loadCog,
    mode,
    sdkReady,
    terrainRegion,
    terrainTilingLabel,
    terrainTilingProfile,
    usesElevationSuisseGrid,
  ]);

  useEffect(() => {
    opacityRef.current = opacity;
    if (imageryLayerRef.current) imageryLayerRef.current.opacity = opacity / 100;
  }, [opacity]);

  useEffect(() => {
    if (imageryLayerRef.current) imageryLayerRef.current.visible = visible;
  }, [visible]);

  useEffect(() => {
    if (!sdkReady || !isTerrainMode(mode)) return;

    const measurementExpand = measurementExpandRef.current;
    const directLineMeasurement = directLineMeasurementRef.current;
    const areaMeasurement = areaMeasurementRef.current;
    if (!measurementExpand || !directLineMeasurement || !areaMeasurement) {
      return;
    }

    const clearMeasurements = () => {
      void directLineMeasurement.clear?.();
      void areaMeasurement.clear?.();
    };
    const handleExpandChange = (event: Event) => {
      const propertyEvent = event as CustomEvent<{ name?: string }>;
      if (
        propertyEvent.detail?.name === "expanded" &&
        !measurementExpand.expanded
      ) {
        clearMeasurements();
      }
    };
    const handleDirectLineChange = (event: Event) => {
      const propertyEvent = event as CustomEvent<{ name?: string }>;
      if (
        propertyEvent.detail?.name === "state" &&
        directLineMeasurement.state === "measuring"
      ) {
        void areaMeasurement.clear?.();
      }
    };
    const handleAreaChange = (event: Event) => {
      const propertyEvent = event as CustomEvent<{ name?: string }>;
      if (
        propertyEvent.detail?.name === "state" &&
        areaMeasurement.state === "measuring"
      ) {
        void directLineMeasurement.clear?.();
      }
    };

    measurementExpand.addEventListener(
      "arcgisPropertyChange",
      handleExpandChange,
    );
    directLineMeasurement.addEventListener(
      "arcgisPropertyChange",
      handleDirectLineChange,
    );
    areaMeasurement.addEventListener(
      "arcgisPropertyChange",
      handleAreaChange,
    );

    return () => {
      measurementExpand.removeEventListener(
        "arcgisPropertyChange",
        handleExpandChange,
      );
      directLineMeasurement.removeEventListener(
        "arcgisPropertyChange",
        handleDirectLineChange,
      );
      areaMeasurement.removeEventListener(
        "arcgisPropertyChange",
        handleAreaChange,
      );
      clearMeasurements();
    };
  }, [mode, sdkReady, terrainRegion]);

  useEffect(() => {
    if (!sdkReady || !isTerrainMode(mode)) return;

    const lineOfSightExpand = lineOfSightExpandRef.current;
    const lineOfSight = lineOfSightRef.current;
    if (!lineOfSightExpand || !lineOfSight) return;

    const handleExpandChange = (event: Event) => {
      const propertyEvent = event as CustomEvent<{ name?: string }>;
      if (
        propertyEvent.detail?.name === "expanded" &&
        !lineOfSightExpand.expanded
      ) {
        void lineOfSight.clear?.();
      }
    };

    lineOfSightExpand.addEventListener(
      "arcgisPropertyChange",
      handleExpandChange,
    );

    return () => {
      lineOfSightExpand.removeEventListener(
        "arcgisPropertyChange",
        handleExpandChange,
      );
      void lineOfSight.clear?.();
    };
  }, [mode, sdkReady, terrainRegion]);

  useEffect(() => {
    if (!sdkReady || !isTerrainMode(mode)) return;

    const sceneElement = sceneElementRef.current;
    const viewshedExpand = viewshedExpandRef.current;
    const arcgis = window.$arcgis;
    if (!sceneElement || !viewshedExpand || !arcgis) return;

    if (
      terrainState !== "ready" ||
      !terrainLayerRef.current ||
      sceneElement.view !== viewRef.current
    ) {
      setViewshedState("idle");
      setViewshedStatus("Waiting for the terrain…");
      return;
    }

    let cancelled = false;
    let analysis: ViewshedAnalysis | null = null;
    let analysisView: ViewshedAnalysisView | null = null;

    const handleExpandChange = (event: Event) => {
      const propertyEvent = event as CustomEvent<{ name?: string }>;
      if (
        propertyEvent.detail?.name === "expanded" &&
        !viewshedExpand.expanded
      ) {
        clearViewsheds();
      }
    };

    viewshedExpand.addEventListener(
      "arcgisPropertyChange",
      handleExpandChange,
    );

    const initializeViewshed = async () => {
      setViewshedState("idle");
      setViewshedStatus("Preparing the viewshed analysis…");

      try {
        await sceneElement.viewOnReady();
        if (cancelled) return;

        if (!sceneElement.analyses?.add || !sceneElement.whenAnalysisView) {
          throw new Error("This scene does not expose the analysis API.");
        }

        const ViewshedAnalysis = (await arcgis.import(
          "@arcgis/core/analysis/ViewshedAnalysis.js",
        )) as ArcGISConstructor;
        if (cancelled) return;

        analysis = new ViewshedAnalysis() as ViewshedAnalysis;
        sceneElement.analyses.add(analysis);
        analysisView = await sceneElement.whenAnalysisView(analysis);
        if (cancelled) return;

        analysisView.interactive = true;
        viewshedAnalysisRef.current = analysis;
        viewshedAnalysisViewRef.current = analysisView;
        setViewshedState("ready");
        setViewshedStatus(
          "Place an observer and target to calculate a viewshed.",
        );
      } catch (error) {
        if (cancelled) return;
        if (analysis) {
          analysis.clear?.();
          sceneElement.analyses?.remove?.(analysis);
          analysis.destroy?.();
          analysis = null;
        }
        analysisView = null;
        console.error("Viewshed analysis initialization failed", error);
        setViewshedState("error");
        setViewshedStatus(`Viewshed unavailable: ${getErrorMessage(error)}`);
      }
    };

    void initializeViewshed();

    return () => {
      cancelled = true;
      viewshedExpand.removeEventListener(
        "arcgisPropertyChange",
        handleExpandChange,
      );

      const controller = viewshedPlacementRef.current;
      viewshedPlacementRef.current = null;
      controller?.abort();

      if (analysis) {
        analysis.clear?.();
        sceneElement.analyses?.remove?.(analysis);
        analysis.destroy?.();
      }
      if (analysisView) analysisView.selectedViewshed = null;

      if (viewshedAnalysisRef.current === analysis) {
        viewshedAnalysisRef.current = null;
      }
      if (viewshedAnalysisViewRef.current === analysisView) {
        viewshedAnalysisViewRef.current = null;
      }
    };
  }, [clearViewsheds, mode, sdkReady, terrainRegion, terrainState]);

  useEffect(() => {
    if (!sdkReady || !isTerrainMode(mode)) return;

    const volumeMeasurementExpand = volumeMeasurementExpandRef.current;
    const volumeMeasurement = volumeMeasurementRef.current;
    const elevationProfileExpand = elevationProfileExpandRef.current;
    const elevationProfile = elevationProfileRef.current;
    if (
      !volumeMeasurementExpand ||
      !volumeMeasurement ||
      !elevationProfileExpand ||
      !elevationProfile
    ) {
      return;
    }

    const tools: Array<{
      expand: ArcGISExpandElement;
      tool: ArcGISClearableElement;
    }> = [
      { expand: volumeMeasurementExpand, tool: volumeMeasurement },
      { expand: elevationProfileExpand, tool: elevationProfile },
    ];

    const removeListeners = tools.map(({ expand, tool }) => {
      const handleExpandChange = (event: Event) => {
        const propertyEvent = event as CustomEvent<{ name?: string }>;
        if (
          propertyEvent.detail?.name === "expanded" &&
          !expand.expanded
        ) {
          void tool.clear?.();
        }
      };

      expand.addEventListener("arcgisPropertyChange", handleExpandChange);
      return () => {
        expand.removeEventListener("arcgisPropertyChange", handleExpandChange);
      };
    });

    return () => {
      removeListeners.forEach((removeListener) => removeListener());
      tools.forEach(({ tool }) => void tool.clear?.());
    };
  }, [mode, sdkReady, terrainRegion]);

  useEffect(() => {
    terrainOverlayOpacityRef.current = terrainOverlayOpacity;
    if (terrainOverlayLayerRef.current) {
      terrainOverlayLayerRef.current.opacity = terrainOverlayOpacity / 100;
    }
  }, [terrainOverlayOpacity]);

  useEffect(() => {
    terrainOverlayVisibleRef.current = terrainOverlayVisible;
    if (terrainOverlayLayerRef.current) {
      terrainOverlayLayerRef.current.visible = terrainOverlayVisible;
    }
  }, [terrainOverlayVisible]);

  useEffect(() => {
    buildingsOpacityRef.current = buildingsOpacity;
    if (buildingsLayerRef.current) {
      buildingsLayerRef.current.opacity = buildingsOpacity / 100;
    }
  }, [buildingsOpacity]);

  useEffect(() => {
    buildingsVisibleRef.current = buildingsVisible;
    if (buildingsLayerRef.current) {
      buildingsLayerRef.current.visible = buildingsVisible;
    }
  }, [buildingsVisible]);

  const submitUrl = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextUrl = cogUrl.trim();

    try {
      const parsed = new URL(nextUrl);
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
        throw new Error("Use an HTTP or HTTPS URL.");
      }
      void loadCog(nextUrl);
    } catch (error) {
      setLoadState("error");
      setStatusText(getErrorMessage(error));
    }
  };

  const selectExample = (exampleId: string) => {
    setSelectedExampleId(exampleId);
    const example = EXAMPLE_DATASETS.find((dataset) => dataset.id === exampleId);
    if (!example) return;

    setCogUrl(example.url);
    if (activeUrl === example.url && loadState === "ready") {
      void frameImagery();
    } else {
      void loadCog(example.url);
    }
  };

  const selectedExample = EXAMPLE_DATASETS.find(
    (dataset) => dataset.id === selectedExampleId,
  );
  const activeState = mode === "imagery" ? loadState : terrainState;
  const frameEnabled = activeState === "ready";

  const navigationControls = [
    createElement("arcgis-zoom", {
      key: "scene-zoom",
      slot: "bottom-left",
      label: "Zoom",
      suppressHydrationWarning: true,
    } as ArcGISNavigationAttributes),
    createElement("arcgis-compass", {
      key: "scene-compass",
      slot: "bottom-left",
      label: "Compass",
      suppressHydrationWarning: true,
    } as ArcGISNavigationAttributes),
  ];

  /* eslint-disable react-hooks/refs -- React owns this custom-element ref; it is not read while rendering. */
  const scene = sdkReady
    ? createElement(
        "arcgis-scene",
        mode === "imagery"
          ? ({
              key: "imagery-scene",
              ref: sceneElementRef,
              className: "map-view",
              suppressHydrationWarning: true,
              basemap: "satellite",
              ground: "world-elevation",
              "camera-position": "-66.65, -15.8, 1080000",
              "camera-heading": "6",
              "camera-tilt": "43",
              "quality-profile": "high",
            } as ArcGISSceneAttributes)
          : ({
              key: `terrain-scene-${mode}-${terrainRegion.id}`,
              ref: sceneElementRef,
              className: "map-view",
              suppressHydrationWarning: true,
              spatialReference: { wkid: SWISS_ALTI_HORIZONTAL_WKID },
              "viewing-mode": "local",
              "quality-profile": "high",
            } as ArcGISSceneAttributes),
        ...(mode === "imagery"
          ? [createElement(
              "arcgis-expand",
              {
                key: "imagery-basemap-expand",
                slot: "top-right",
                label: "Basemap gallery",
                suppressHydrationWarning: true,
              } as ArcGISExpandAttributes,
              createElement("arcgis-basemap-gallery", {
                label: "Choose a basemap",
                suppressHydrationWarning: true,
              } as ArcGISBasemapGalleryAttributes),
            )]
          : [
              createElement(
                "arcgis-expand",
                {
                  key: "terrain-daylight-expand",
                  slot: "top-right",
                  group: "terrain-tools",
                  "expand-icon": "brightness",
                  label: "Daylight",
                  mode: "floating",
                  suppressHydrationWarning: true,
                } as ArcGISExpandAttributes,
                createElement("arcgis-daylight", {
                  label: "Daylight",
                  suppressHydrationWarning: true,
                } as ArcGISDaylightAttributes),
              ),
              createElement(
                "arcgis-expand",
                {
                  key: "terrain-measurement-expand",
                  ref: measurementExpandRef,
                  slot: "top-right",
                  group: "terrain-tools",
                  "expand-icon": "measure",
                  label: "Measurements",
                  mode: "floating",
                  suppressHydrationWarning: true,
                } as ArcGISExpandAttributes,
                createElement(
                  "div",
                  {
                    className: "measurement-tools-panel",
                    role: "group",
                    "aria-label": "3D measurement tools",
                  },
                  createElement(
                    "section",
                    { className: "measurement-tool" },
                    createElement(
                      "p",
                      { className: "measurement-tool__heading" },
                      "Direct line",
                    ),
                    createElement("arcgis-direct-line-measurement-3d", {
                      ref: directLineMeasurementRef,
                      label: "Direct line measurement",
                      unit: "metric",
                      suppressHydrationWarning: true,
                    } as ArcGISMeasurementAttributes),
                  ),
                  createElement(
                    "section",
                    { className: "measurement-tool" },
                    createElement(
                      "p",
                      { className: "measurement-tool__heading" },
                      "Area",
                    ),
                    createElement("arcgis-area-measurement-3d", {
                      ref: areaMeasurementRef,
                      label: "Area measurement",
                      unit: "metric",
                      suppressHydrationWarning: true,
                    } as ArcGISMeasurementAttributes),
                  ),
                ),
              ),
              createElement(
                "arcgis-expand",
                {
                  key: "terrain-line-of-sight-expand",
                  ref: lineOfSightExpandRef,
                  slot: "top-right",
                  group: "terrain-tools",
                  "expand-icon": "line-of-sight",
                  label: "Line of sight",
                  mode: "floating",
                  suppressHydrationWarning: true,
                } as ArcGISExpandAttributes,
                createElement("arcgis-line-of-sight", {
                  ref: lineOfSightRef,
                  label: "Line of sight",
                  suppressHydrationWarning: true,
                } as ArcGISLineOfSightAttributes),
              ),
              createElement(
                "arcgis-expand",
                {
                  key: "terrain-viewshed-expand",
                  ref: viewshedExpandRef,
                  slot: "top-right",
                  group: "terrain-tools",
                  "expand-icon": "viewshed",
                  label: "Viewshed",
                  mode: "floating",
                  suppressHydrationWarning: true,
                } as ArcGISExpandAttributes,
                createElement(
                  "div",
                  {
                    className: "viewshed-tool-panel",
                    role: "group",
                    "aria-label": "Viewshed analysis",
                  },
                  createElement(
                    "p",
                    { className: "viewshed-tool__heading" },
                    "Viewshed",
                  ),
                  createElement(
                    "p",
                    {
                      className: "viewshed-tool__status",
                      role: "status",
                      "aria-live": "polite",
                    },
                    viewshedStatus,
                  ),
                  createElement(
                    "div",
                    { className: "viewshed-tool__actions" },
                    viewshedState === "placing"
                      ? createElement(
                          "button",
                          {
                            className:
                              "viewshed-tool__button viewshed-tool__button--primary",
                            type: "button",
                            onClick: cancelViewshedPlacement,
                          },
                          "Cancel placement",
                        )
                      : createElement(
                          "button",
                          {
                            className:
                              "viewshed-tool__button viewshed-tool__button--primary",
                            type: "button",
                            disabled: viewshedState !== "ready",
                            onClick: () => void startViewshedPlacement(),
                          },
                          "Place viewshed",
                        ),
                    createElement(
                      "button",
                      {
                        className: "viewshed-tool__button",
                        type: "button",
                        disabled: viewshedState === "idle",
                        onClick: clearViewsheds,
                      },
                      "Clear",
                    ),
                  ),
                ),
              ),
              createElement(
                "arcgis-expand",
                {
                  key: "terrain-volume-measurement-expand",
                  ref: volumeMeasurementExpandRef,
                  slot: "top-right",
                  group: "terrain-tools",
                  "expand-icon": "cut-and-fill-volume-calculation",
                  label: "Volume measurement",
                  mode: "floating",
                  suppressHydrationWarning: true,
                } as ArcGISExpandAttributes,
                createElement("arcgis-volume-measurement", {
                  ref: volumeMeasurementRef,
                  className:
                    "terrain-analysis-component terrain-analysis-component--volume",
                  label: "Volume measurement",
                  areaDisplayUnit: "metric",
                  elevationDisplayUnit: "metric",
                  elevationInputUnit: "meters",
                  perimeterDisplayUnit: "metric",
                  volumeDisplayUnit: "metric",
                  suppressHydrationWarning: true,
                } as ArcGISVolumeMeasurementAttributes),
              ),
              createElement(
                "arcgis-expand",
                {
                  key: "terrain-elevation-profile-expand",
                  ref: elevationProfileExpandRef,
                  slot: "top-right",
                  group: "terrain-tools",
                  "expand-icon": "altitude",
                  label: "Elevation profile",
                  mode: "floating",
                  suppressHydrationWarning: true,
                } as ArcGISExpandAttributes,
                createElement("arcgis-elevation-profile", {
                  ref: elevationProfileRef,
                  className:
                    "terrain-analysis-component terrain-analysis-component--profile",
                  label: "Elevation profile",
                  distanceUnit: "metric",
                  elevationUnit: "metric",
                  suppressHydrationWarning: true,
                } as ArcGISElevationProfileAttributes),
              ),
            ]),
        ...navigationControls,
      )
    : null;
  /* eslint-enable react-hooks/refs */

  return (
    <main className="app-shell">
      <div className="map-stage" aria-label="Interactive 3D map">
        {scene}
        <div className={`map-wash ${activeState === "ready" ? "is-hidden" : ""}`} />

        <div className="map-label" aria-hidden="true">
          <span className="map-label__mark">3D</span>
          <span>
            {mode === "imagery"
              ? "DRAG TO ORBIT · SCROLL TO ZOOM"
              : `${terrainRegion.label.toUpperCase()} · LOCAL · EPSG:2056 · NO REPROJECTION`}
          </span>
        </div>

        <button
          className="frame-button"
          type="button"
          onClick={() =>
            void (mode === "imagery" ? frameImagery() : frameTerrain())
          }
          disabled={!frameEnabled}
          aria-label={
            mode === "imagery"
              ? "Frame the active raster layer"
              : `Frame the ${terrainRegion.label} SwissALTI terrain coverage`
          }
        >
          <span className="frame-button__target" aria-hidden="true" />
          {mode === "imagery" ? "Frame layer" : "Frame terrain"}
        </button>
      </div>

      <aside className="control-panel" aria-label="Raster terrain controls">
        <header className="brand-row">
          <div className="brand-mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div>
            <p className="eyebrow">Cloud-Optimized GeoTIFF</p>
            <p className="brand-name">Imagery & Terrain</p>
          </div>
          <span className="sdk-badge">ArcGIS JS SDK</span>
        </header>

        <nav className="mode-switch" aria-label="Viewing mode">
          <button
            type="button"
            className={mode === "imagery" ? "is-active" : ""}
            onClick={() => setMode("imagery")}
            aria-pressed={mode === "imagery"}
          >
            Cloud imagery
          </button>
          <button
            type="button"
            className={mode === "terrain" ? "is-active" : ""}
            onClick={() => setMode("terrain")}
            aria-pressed={mode === "terrain"}
          >
            SwissALTI terrain
            <span>Experimental</span>
          </button>
          <button
            type="button"
            className={mode === "terrain-suisse-grid" ? "is-active" : ""}
            onClick={() => setMode("terrain-suisse-grid")}
            aria-pressed={mode === "terrain-suisse-grid"}
          >
            Swiss cache grid
            <span>Experimental</span>
          </button>
        </nav>

        <section className="intro-block">
          <p className="section-kicker">
            {mode === "imagery"
              ? "Cloud imagery viewer"
              : usesElevationSuisseGrid
                ? "Reference-grid terrain experiment"
                : "Local terrain experiment"}
          </p>
          <h1>
            {mode === "imagery"
              ? "Bring a cloud raster into 3D."
              : usesElevationSuisseGrid
                ? "Use the Swiss cache grid with COG heights."
                : "Build the ground from elevation COGs."}
          </h1>
          <p className="intro-copy">
            {mode === "imagery"
              ? "Paste a public Cloud Optimized GeoTIFF (COG) URL. The scene reads only the tiles it needs and drapes them over world elevation."
              : usesElevationSuisseGrid
                ? `Follow the national elevation_suisse tile grid while every height still comes from ${terrainRegion.cogs.length} ${terrainRegion.label} SwissALTI3D COGs.`
                : `Explore ${terrainRegion.cogs.length} aligned SwissALTI3D COGs around ${terrainRegion.label} as one local LV95 ground surface—without reprojection or world elevation.`}
          </p>
        </section>

        {mode === "imagery" ? (
          <>
            <section className="example-picker">
              <div className="example-picker__heading">
                <label htmlFor="example-dataset">Try an example dataset</label>
                <span>{EXAMPLE_DATASETS.length} sources</span>
              </div>
              <div className="select-field">
                <select
                  id="example-dataset"
                  value={selectedExampleId}
                  onChange={(event) => selectExample(event.target.value)}
                  disabled={loadState === "loading"}
                >
                  <option value="">Custom URL</option>
                  {EXAMPLE_GROUPS.map((group) => (
                    <optgroup key={group} label={group}>
                      {EXAMPLE_DATASETS.filter(
                        (dataset) => dataset.group === group,
                      ).map((dataset) => (
                        <option key={dataset.id} value={dataset.id}>
                          {dataset.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <span className="select-field__chevron" aria-hidden="true">⌄</span>
              </div>
              <p className="example-picker__detail">
                {selectedExample?.detail ??
                  "Paste and open your own public COG below."}
              </p>
            </section>

            <form className="url-form" onSubmit={submitUrl}>
              <label htmlFor="cog-url">COG file URL</label>
              <div className="url-field">
                <span className="url-field__protocol" aria-hidden="true">↗</span>
                <input
                  id="cog-url"
                  name="cog-url"
                  value={cogUrl}
                  onChange={(event) => {
                    setCogUrl(event.target.value);
                    setSelectedExampleId("");
                  }}
                  placeholder="https://…/raster.tif"
                  autoComplete="url"
                  spellCheck={false}
                  aria-describedby="url-hint"
                />
              </div>
              <div className="form-actions">
                <button
                  className="primary-button"
                  type="submit"
                  disabled={loadState === "loading"}
                >
                  {loadState === "loading" ? "Connecting…" : "Open raster"}
                  <span aria-hidden="true">→</span>
                </button>
                <button
                  className="text-button"
                  type="button"
                  onClick={() => selectExample("bolivia-landsat")}
                >
                  Use example
                </button>
              </div>
              <p id="url-hint" className="field-hint">
                Requires CORS and HTTP byte-range support.
              </p>
            </form>

            <section
              className={`status-card status-card--${loadState}`}
              aria-live="polite"
            >
              <div className="status-card__heading">
                <span className="status-dot" aria-hidden="true" />
                <span>
                  {loadState === "error" ? "Connection issue" : "Stream status"}
                </span>
              </div>
              <p>{statusText}</p>
            </section>

            <section className="layer-section" aria-label="Active layer">
              <div className="section-heading">
                <span>Active layer</span>
                <button
                  className={`visibility-toggle ${visible ? "is-on" : ""}`}
                  type="button"
                  onClick={() => setVisible((current) => !current)}
                  disabled={loadState !== "ready"}
                  aria-pressed={visible}
                >
                  <span className="visibility-toggle__track"><span /></span>
                  {visible ? "Visible" : "Hidden"}
                </button>
              </div>

              <div className="layer-card">
                <div className="layer-preview" aria-hidden="true">
                  <span className="layer-preview__river" />
                  <span className="layer-preview__ridge layer-preview__ridge--one" />
                  <span className="layer-preview__ridge layer-preview__ridge--two" />
                </div>
                <div className="layer-card__copy">
                  <strong title={details.name}>{details.name}</strong>
                  <span title={details.host}>{details.host}</span>
                </div>
                <span className="format-pill">COG</span>
              </div>

              <div className="metadata-grid">
                <div>
                  <span>Bands</span>
                  <strong>{details.bands}</strong>
                </div>
                <div>
                  <span>Reference</span>
                  <strong>{details.spatialReference}</strong>
                </div>
              </div>
            </section>

            <section className="opacity-section">
              <div className="section-heading">
                <label htmlFor="opacity">Layer opacity</label>
                <output htmlFor="opacity">{opacity}%</output>
              </div>
              <input
                id="opacity"
                type="range"
                min="0"
                max="100"
                value={opacity}
                onChange={(event) => setOpacity(Number(event.target.value))}
                style={{ "--range-progress": `${opacity}%` } as CSSProperties}
                disabled={loadState !== "ready"}
              />
              <div className="range-labels" aria-hidden="true">
                <span>Basemap</span>
                <span>Raster</span>
              </div>
            </section>
          </>
        ) : (
          <>
            <section className="example-picker terrain-region-picker">
              <div className="example-picker__heading">
                <label htmlFor="terrain-region">Terrain catalog</label>
                <span>{TERRAIN_REGION_OPTIONS.length} regions</span>
              </div>
              <div className="select-field">
                <select
                  id="terrain-region"
                  value={terrainRegionId}
                  onChange={(event) =>
                    setTerrainRegionId(event.target.value as SwissAltiRegionId)
                  }
                >
                  {TERRAIN_REGION_OPTIONS.map((region) => (
                    <option key={region.id} value={region.id}>
                      {region.label} · {region.cogs.length} COGs
                    </option>
                  ))}
                </select>
                <span className="select-field__chevron" aria-hidden="true">⌄</span>
              </div>
              <p className="example-picker__detail">{terrainRegion.detail}</p>
            </section>

            <section className="experiment-card" aria-label="Experimental terrain configuration">
              <div className="experiment-card__title">
                <span className="experiment-badge">Experimental</span>
                <strong>
                  SwissALTI3D · {terrainRegion.label} · {terrainTilingLabel}
                </strong>
              </div>
              <p>
                {usesElevationSuisseGrid
                  ? `The scene follows elevation_suisse levels 0–18. Its custom ground reads only intersecting COG pixels and caches COG-derived overview tiles below LOD ${ELEVATION_SUISSE_DETAIL_LOD}.`
                  : "One custom elevation layer routes every terrain request to the intersecting kilometre COGs, stitches their pixels directly, and preserves intentional no-data areas."}
              </p>
              <div className="terrain-facts">
                <div><span>View</span><strong>Local</strong></div>
                <div><span>Horizontal</span><strong>EPSG:{SWISS_ALTI_HORIZONTAL_WKID}</strong></div>
                <div><span>Vertical</span><strong>EPSG:{SWISS_ALTI_VERTICAL_WKID}</strong></div>
                <div><span>Tiling</span><strong>{terrainTilingLabel}</strong></div>
                <div><span>Resolution</span><strong>{SWISS_ALTI_CELL_SIZE_METERS} m</strong></div>
                <div><span>Years</span><strong>{terrainYears}</strong></div>
                <div><span>Source</span><strong>{terrainRegion.cogs.length} COGs</strong></div>
                <div><span>Fallback</span><strong>None</strong></div>
              </div>
            </section>

            {terrainRegion.id === "zermatt" ? (
              <section
                className="terrain-overlay-card"
                aria-label="Zermatt surface overlay"
              >
                <div className="section-heading">
                  <span>Surface overlay · tinted relief</span>
                  <button
                    className={`visibility-toggle ${terrainOverlayVisible ? "is-on" : ""}`}
                    type="button"
                    onClick={() =>
                      setTerrainOverlayVisible((current) => !current)
                    }
                    disabled={terrainOverlayState !== "ready"}
                    aria-pressed={terrainOverlayVisible}
                  >
                    <span className="visibility-toggle__track"><span /></span>
                    {terrainOverlayVisible ? "Visible" : "Hidden"}
                  </button>
                </div>
                <p className={`terrain-overlay-card__status terrain-overlay-card__status--${terrainOverlayState}`}>
                  {terrainOverlayStatus}
                </p>
                <div className="terrain-overlay-card__actions">
                  <label htmlFor="terrain-overlay-opacity">Opacity</label>
                  <output htmlFor="terrain-overlay-opacity">
                    {terrainOverlayOpacity}%
                  </output>
                </div>
                <input
                  id="terrain-overlay-opacity"
                  type="range"
                  min="0"
                  max="100"
                  value={terrainOverlayOpacity}
                  onChange={(event) =>
                    setTerrainOverlayOpacity(Number(event.target.value))
                  }
                  style={
                    {
                      "--range-progress": `${terrainOverlayOpacity}%`,
                    } as CSSProperties
                  }
                  disabled={terrainOverlayState !== "ready"}
                />
                <button
                  className="text-button terrain-overlay-card__frame"
                  type="button"
                  onClick={() => void frameTerrainOverlay()}
                  disabled={terrainOverlayState !== "ready"}
                >
                  Frame overlay
                </button>
              </section>
            ) : null}

            <section
              className="terrain-overlay-card"
              aria-label="Swiss buildings 3D scene layer"
            >
              <div className="section-heading">
                <span>Scene layer · swissBUILDINGS3D</span>
                <button
                  className={`visibility-toggle ${buildingsVisible ? "is-on" : ""}`}
                  type="button"
                  onClick={() =>
                    setBuildingsVisible((current) => !current)
                  }
                  disabled={buildingsState !== "ready"}
                  aria-pressed={buildingsVisible}
                >
                  <span className="visibility-toggle__track"><span /></span>
                  {buildingsVisible ? "Visible" : "Hidden"}
                </button>
              </div>
              <p className={`terrain-overlay-card__status terrain-overlay-card__status--${buildingsState}`}>
                {buildingsStatus}
              </p>
              <div className="terrain-overlay-card__actions">
                <label htmlFor="buildings-opacity">Opacity</label>
                <output htmlFor="buildings-opacity">
                  {buildingsOpacity}%
                </output>
              </div>
              <input
                id="buildings-opacity"
                type="range"
                min="0"
                max="100"
                value={buildingsOpacity}
                onChange={(event) =>
                  setBuildingsOpacity(Number(event.target.value))
                }
                style={
                  {
                    "--range-progress": `${buildingsOpacity}%`,
                  } as CSSProperties
                }
                disabled={buildingsState !== "ready"}
              />
            </section>

            <section
              className={`status-card status-card--${terrainState}`}
              aria-live="polite"
            >
              <div className="status-card__heading">
                <span className="status-dot" aria-hidden="true" />
                <span>
                  {terrainState === "error" ? "Terrain issue" : "Terrain status"}
                </span>
              </div>
              <p>{terrainStatus}</p>
            </section>

            <section className="validation-card" aria-label="Ground validation">
              <div className="section-heading">
                <span>Ground validation</span>
                <strong>{terrainState === "ready" ? "Verified" : "Checking"}</strong>
              </div>
              <dl>
                <div><dt>COG source</dt><dd>{terrainValidation.source}</dd></div>
                <div><dt>Tiling scheme</dt><dd>{terrainValidation.tiling}</dd></div>
                <div><dt>Source pixels</dt><dd>{terrainValidation.sourcePixels}</dd></div>
                <div><dt>Ground layers</dt><dd>{terrainValidation.groundLayers}</dd></div>
                <div><dt>Native coverage</dt><dd>{terrainValidation.coverage}</dd></div>
                <div><dt>Terrain samples</dt><dd>{terrainValidation.terrainSamples}</dd></div>
                <div><dt>Elevation range</dt><dd>{terrainValidation.elevationRange}</dd></div>
              </dl>
            </section>

            <section className="terrain-note">
              <strong>Purposefully isolated</strong>
              <p>
                {usesElevationSuisseGrid
                  ? "The reference ImageServer supplies grid metadata only. It is never added to Ground and no elevation tiles are requested from it."
                  : "This mode has no satellite basemap, basemap gallery, world elevation, or arbitrary elevation URL. Sources are loaded on demand and cached while intentional no-data remains untouched."}
              </p>
            </section>
          </>
        )}

        <footer className="panel-footer">
          <span className="beta-dot" aria-hidden="true" />
          {mode === "imagery"
            ? "Direct COG display is a beta capability in the ArcGIS Maps SDK."
            : usesElevationSuisseGrid
              ? `Experimental Swiss cache grid uses ${terrainRegion.cogs.length} ${terrainRegion.label} COGs for every elevation value.`
              : `Experimental local terrain uses ${terrainRegion.cogs.length} ${terrainRegion.label} SwissALTI3D COGs as one virtual mosaic.`}
        </footer>
      </aside>
    </main>
  );
}
