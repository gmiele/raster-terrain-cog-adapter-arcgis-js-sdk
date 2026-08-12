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
} from "./swissAltiElevation";
import {
  SWISS_ALTI_CELL_SIZE_METERS,
  SWISS_ALTI_COG,
  SWISS_ALTI_COGS,
  SWISS_ALTI_HORIZONTAL_WKID,
  SWISS_ALTI_VERTICAL_WKID,
} from "./swissAltiSource";

const DEMO_COG_URL =
  "https://ss6imagery.arcgisonline.com/imagery_sample/landsat8/Bolivia_LC08_L1TP_001069_20190719_MS.tiff";

type AppMode = "imagery" | "terrain";
type LoadState = "starting" | "loading" | "ready" | "error";

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

type ArcGISSceneElement = HTMLElement & {
  componentOnReady: () => Promise<ArcGISSceneElement>;
  viewOnReady: () => Promise<void>;
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

type ArcGISExpandAttributes = DetailedHTMLProps<
  HTMLAttributes<HTMLElement>,
  HTMLElement
> & {
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
  const mapRef = useRef<ArcGISObject | null>(null);
  const viewRef = useRef<ArcGISObject | null>(null);
  const imageryLayerRef = useRef<ArcGISObject | null>(null);
  const terrainLayerRef = useRef<SwissAltiElevationLayer | null>(null);
  const terrainExtentRef = useRef<ArcGISObject | null>(null);
  const layerConstructorRef = useRef<ArcGISConstructor | null>(null);
  const sceneGenerationRef = useRef(0);
  const loadRequestRef = useRef(0);
  const activeUrlRef = useRef(DEMO_COG_URL);
  const modeRef = useRef<AppMode>("imagery");
  const opacityRef = useRef(88);

  const [sdkReady, setSdkReady] = useState(false);
  const [mode, setMode] = useState<AppMode>("imagery");
  const [cogUrl, setCogUrl] = useState(DEMO_COG_URL);
  const [activeUrl, setActiveUrl] = useState(DEMO_COG_URL);
  const [selectedExampleId, setSelectedExampleId] = useState("bolivia-landsat");
  const [loadState, setLoadState] = useState<LoadState>("starting");
  const [statusText, setStatusText] = useState("Preparing 3D scene…");
  const [terrainState, setTerrainState] = useState<LoadState>("starting");
  const [terrainStatus, setTerrainStatus] = useState(
    "Preparing local EPSG:2056 scene…",
  );
  const [terrainValidation, setTerrainValidation] = useState({
    source: "Pending",
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
      setTerrainStatus(`Preparing ${SWISS_ALTI_COGS.length} SwissALTI COGs…`);
      setTerrainValidation({
        source: "Loading",
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
        SpatialReference,
        TileInfo,
      ] = (await window.$arcgis!.import([
        "@arcgis/core/layers/BaseElevationLayer.js",
        "@arcgis/core/geometry/Extent.js",
        "@arcgis/core/Ground.js",
        "@arcgis/core/layers/ImageryTileLayer.js",
        "@arcgis/core/geometry/Point.js",
        "@arcgis/core/geometry/SpatialReference.js",
        "@arcgis/core/layers/support/TileInfo.js",
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
      ];

      const preparedCatalog = await prepareSwissAltiCatalog(
        ImageryTileLayer,
        abortController.signal,
      );
      if (!isCurrent()) {
        preparedCatalog.dispose();
        return;
      }
      const { metadata } = preparedCatalog;
      const lods = createElevationLods(metadata);
      const spatialReference = new SpatialReference({ wkid: SWISS_ALTI_HORIZONTAL_WKID });
      const fullExtent = new Extent({
        ...metadata.extent,
        spatialReference,
      });
      const initialExtent = new Extent({
        xmin: SWISS_ALTI_COG.extent.xmin - 1_000,
        ymin: SWISS_ALTI_COG.extent.ymin - 1_000,
        xmax: SWISS_ALTI_COG.extent.xmax + 1_000,
        ymax: SWISS_ALTI_COG.extent.ymax + 1_000,
        spatialReference,
      });
      const tileInfo = new TileInfo({
        dpi: 96,
        format: "lerc",
        spatialReference,
        size: [256, 256],
        origin: new Point({
          x: metadata.extent.xmin,
          y: metadata.extent.ymax,
          spatialReference,
        }),
        lods,
      });
      setTerrainValidation((current) => ({
        ...current,
        source: `${metadata.sourceCount} aligned COGs · EPSG:2056`,
        sourcePixels: metadata.sourcePixelCount.toLocaleString(),
      }));
      setTerrainStatus(
        `Regional grid verified · ${metadata.nativeResolution} m native pixels`,
      );

      const terrainLayer = createSwissAltiElevationLayer({
        BaseElevationLayer,
        Extent,
        fullExtent,
        lods,
        preparedCatalog,
        spatialReference,
        tileInfo,
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
      terrainExtentRef.current = fullExtent;
      const groundLayerCount = ground.layers?.length ?? 0;
      setTerrainValidation((current) => ({
        ...current,
        groundLayers: String(groundLayerCount),
      }));
      if (groundLayerCount !== 1) {
        throw new Error(`Expected one ground layer; found ${groundLayerCount}.`);
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

      setTerrainStatus("Checking interior, seam, and no-data terrain probes…");
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
      setTerrainState("ready");
      setTerrainStatus(
        "Regional ground verified · interior, seam, and no-data probes passed",
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

      terrainLayerRef.current?.disposeSource?.();
      terrainLayerRef.current?.destroy?.();
      terrainLayerRef.current = null;
      terrainExtentRef.current = null;
      layerConstructorRef.current = null;
      viewRef.current = null;
      mapRef.current = null;
    };
  }, [loadCog, mode, sdkReady]);

  useEffect(() => {
    opacityRef.current = opacity;
    if (imageryLayerRef.current) imageryLayerRef.current.opacity = opacity / 100;
  }, [opacity]);

  useEffect(() => {
    if (imageryLayerRef.current) imageryLayerRef.current.visible = visible;
  }, [visible]);

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
              key: "terrain-scene",
              ref: sceneElementRef,
              className: "map-view",
              suppressHydrationWarning: true,
              spatialReference: { wkid: SWISS_ALTI_HORIZONTAL_WKID },
              "viewing-mode": "local",
              "quality-profile": "high",
            } as ArcGISSceneAttributes),
        mode === "imagery"
          ? createElement(
              "arcgis-expand",
              {
                slot: "top-right",
                label: "Basemap gallery",
                suppressHydrationWarning: true,
              } as ArcGISExpandAttributes,
              createElement("arcgis-basemap-gallery", {
                label: "Choose a basemap",
                suppressHydrationWarning: true,
              } as ArcGISBasemapGalleryAttributes),
            )
          : undefined,
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
              : "LOCAL · EPSG:2056 · NO REPROJECTION"}
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
              : "Frame the SwissALTI terrain coverage"
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
            <p className="eyebrow">COG / SCENE</p>
            <p className="brand-name">Raster Terrain Lab</p>
          </div>
          <span className="sdk-badge">ArcGIS SDK 5.1</span>
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
        </nav>

        <section className="intro-block">
          <p className="section-kicker">
            {mode === "imagery" ? "Cloud imagery viewer" : "Local terrain experiment"}
          </p>
          <h1>
            {mode === "imagery"
              ? "Bring a cloud raster into 3D."
              : "Build the ground from elevation COGs."}
          </h1>
          <p className="intro-copy">
            {mode === "imagery"
              ? "Paste a public Cloud Optimized GeoTIFF URL. The scene reads only the tiles it needs and drapes them over world elevation."
              : `Explore ${SWISS_ALTI_COGS.length} aligned SwissALTI3D COGs as one local LV95 ground surface—without reprojection or world elevation.`}
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
            <section className="experiment-card" aria-label="Experimental terrain configuration">
              <div className="experiment-card__title">
                <span className="experiment-badge">Experimental</span>
                <strong>SwissALTI3D · Regional COG mosaic</strong>
              </div>
              <p>
                One custom elevation layer routes every terrain request to the
                intersecting kilometre COGs, stitches their pixels directly,
                and preserves intentional no-data areas.
              </p>
              <div className="terrain-facts">
                <div><span>View</span><strong>Local</strong></div>
                <div><span>Horizontal</span><strong>EPSG:{SWISS_ALTI_HORIZONTAL_WKID}</strong></div>
                <div><span>Vertical</span><strong>EPSG:{SWISS_ALTI_VERTICAL_WKID}</strong></div>
                <div><span>Resolution</span><strong>{SWISS_ALTI_CELL_SIZE_METERS} m</strong></div>
                <div><span>Source</span><strong>{SWISS_ALTI_COGS.length} COGs</strong></div>
                <div><span>Fallback</span><strong>None</strong></div>
              </div>
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
                This mode has no satellite basemap, basemap gallery, world
                elevation, or arbitrary elevation URL. Sources are loaded on
                demand and cached while intentional no-data remains untouched.
              </p>
            </section>
          </>
        )}

        <footer className="panel-footer">
          <span className="beta-dot" aria-hidden="true" />
          {mode === "imagery"
            ? "Direct COG display is a beta capability in the ArcGIS Maps SDK."
            : `Experimental local terrain uses ${SWISS_ALTI_COGS.length} SwissALTI3D COGs as one virtual mosaic.`}
        </footer>
      </aside>
    </main>
  );
}
