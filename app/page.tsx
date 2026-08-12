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

const DEMO_COG_URL =
  "https://ss6imagery.arcgisonline.com/imagery_sample/landsat8/Bolivia_LC08_L1TP_001069_20190719_MS.tiff";

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
    label: "SwissALTI3D · Zürich",
    detail: "0.5 m elevation · swisstopo · 16 MB",
    group: "Specialized rasters",
    url: "https://data.geo.admin.ch/ch.swisstopo.swissalti3d/swissalti3d_2024_2610-1092/swissalti3d_2024_2610-1092_0.5_2056_5728.tif",
  },
];

const EXAMPLE_GROUPS: ExampleDataset["group"][] = [
  "True-color imagery",
  "Specialized rasters",
];

type LoadState = "starting" | "loading" | "ready" | "error";

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
  options: Record<string, unknown>,
) => ArcGISObject;

type ArcGISSceneElement = HTMLElement & {
  componentOnReady: () => Promise<ArcGISSceneElement>;
  viewOnReady: () => Promise<void>;
  map?: ArcGISObject | null;
  view?: ArcGISObject;
  environment?: Record<string, unknown>;
};

type ArcGISSceneAttributes = DetailedHTMLProps<
  HTMLAttributes<ArcGISSceneElement>,
  ArcGISSceneElement
> & {
  basemap?: string;
  ground?: string;
  "camera-position"?: string;
  "camera-heading"?: string;
  "camera-tilt"?: string;
  "quality-profile"?: "low" | "medium" | "high";
};

declare global {
  interface Window {
    $arcgis?: {
      import: (
        modules: string | string[],
      ) => Promise<ArcGISConstructor | ArcGISConstructor[]>;
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

export default function Home() {
  const sceneElementRef = useRef<ArcGISSceneElement>(null);
  const mapRef = useRef<ArcGISObject | null>(null);
  const viewRef = useRef<ArcGISObject | null>(null);
  const layerRef = useRef<ArcGISObject | null>(null);
  const layerConstructorRef = useRef<ArcGISConstructor | null>(null);
  const opacityRef = useRef(88);

  const [cogUrl, setCogUrl] = useState(DEMO_COG_URL);
  const [activeUrl, setActiveUrl] = useState(DEMO_COG_URL);
  const [selectedExampleId, setSelectedExampleId] = useState("bolivia-landsat");
  const [loadState, setLoadState] = useState<LoadState>("starting");
  const [statusText, setStatusText] = useState("Preparing 3D scene…");
  const [opacity, setOpacity] = useState(88);
  const [visible, setVisible] = useState(true);
  const [details, setDetails] = useState<RasterDetails>({
    name: "Bolivia · Landsat 8",
    host: "ss6imagery.arcgisonline.com",
    bands: "9 bands",
    spatialReference: "Detecting…",
  });

  const frameLayer = useCallback(async () => {
    const view = viewRef.current as
      | (ArcGISObject & {
          goTo?: (target: unknown, options?: unknown) => Promise<void>;
        })
      | null;
    const layer = layerRef.current as
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

  const loadCog = useCallback(
    async (url: string) => {
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

      if (layerRef.current) {
        map.remove?.(layerRef.current);
        layerRef.current.destroy?.();
        layerRef.current = null;
      }

      const example = EXAMPLE_DATASETS.find((dataset) => dataset.url === url);
      const layer = new ImageryTileLayer({
        url,
        title: example?.label ?? "Cloud raster",
        opacity: opacityRef.current / 100,
        visible: true,
        ...(example?.bandIds ? { bandIds: example.bandIds } : {}),
      });

      layerRef.current = layer;
      map.add?.(layer);
      setVisible(true);

      try {
        const load = layer.load as (() => Promise<ArcGISObject>) | undefined;
        if (load) await load.call(layer);

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
          bands: bandCount ? `${bandCount} band${bandCount === 1 ? "" : "s"}` : "Auto bands",
          spatialReference: spatialReference?.latestWkid
            ? `EPSG:${spatialReference.latestWkid}`
            : spatialReference?.wkid
              ? `EPSG:${spatialReference.wkid}`
              : "Embedded CRS",
        });
        setActiveUrl(url);
        setLoadState("ready");
        setStatusText("COG connected · tiles streaming");
        await frameLayer();
      } catch (error) {
        map.remove?.(layer);
        layer.destroy?.();
        layerRef.current = null;
        setLoadState("error");
        setStatusText(
          `${getErrorMessage(error)} Check that the URL is public, CORS-enabled, and supports byte-range requests.`,
        );
      }
    },
    [frameLayer],
  );

  useEffect(() => {
    let cancelled = false;

    const initialize = async () => {
      try {
        await waitForArcGIS();
        await window.customElements.whenDefined("arcgis-scene");
        if (cancelled || !sceneElementRef.current || !window.$arcgis) return;

        const ImageryTileLayer = (await window.$arcgis.import(
          "@arcgis/core/layers/ImageryTileLayer.js",
        )) as ArcGISConstructor;

        if (cancelled) return;

        const sceneElement = sceneElementRef.current;
        await sceneElement.componentOnReady();
        sceneElement.environment = {
          atmosphereEnabled: true,
          starsEnabled: false,
          lighting: {
            directShadowsEnabled: true,
            date: new Date("2025-07-19T15:00:00Z"),
          },
        };
        await sceneElement.viewOnReady();

        if (cancelled || !sceneElement.map || !sceneElement.view) return;

        mapRef.current = sceneElement.map;
        viewRef.current = sceneElement.view;
        layerConstructorRef.current = ImageryTileLayer;

        if (!cancelled) await loadCog(DEMO_COG_URL);
      } catch (error) {
        if (cancelled) return;
        console.error("ArcGIS scene initialization failed", error);
        setLoadState("error");
        setStatusText(getErrorMessage(error));
      }
    };

    void initialize();

    return () => {
      cancelled = true;
      const map = mapRef.current as
        | (ArcGISObject & { remove?: (layer: ArcGISObject) => void })
        | null;
      if (layerRef.current) map?.remove?.(layerRef.current);
      layerRef.current?.destroy?.();
      layerRef.current = null;
      viewRef.current = null;
      mapRef.current = null;
      layerConstructorRef.current = null;
    };
  }, [loadCog]);

  useEffect(() => {
    opacityRef.current = opacity;
    if (layerRef.current) layerRef.current.opacity = opacity / 100;
  }, [opacity]);

  useEffect(() => {
    if (layerRef.current) layerRef.current.visible = visible;
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
      void frameLayer();
    } else {
      void loadCog(example.url);
    }
  };

  const useDemo = () => {
    selectExample("bolivia-landsat");
  };

  const selectedExample = EXAMPLE_DATASETS.find(
    (dataset) => dataset.id === selectedExampleId,
  );

  return (
    <main className="app-shell">
      <div className="map-stage" aria-label="Interactive 3D map">
        {createElement("arcgis-scene", {
          ref: sceneElementRef,
          className: "map-view",
          suppressHydrationWarning: true,
          basemap: "dark-gray-vector",
          ground: "world-elevation",
          "camera-position": "-66.65, -15.8, 1080000",
          "camera-heading": "6",
          "camera-tilt": "43",
          "quality-profile": "high",
        } as ArcGISSceneAttributes)}
        <div className={`map-wash ${loadState === "ready" ? "is-hidden" : ""}`} />

        <div className="map-label" aria-hidden="true">
          <span className="map-label__mark">3D</span>
          <span>DRAG TO ORBIT · SCROLL TO ZOOM</span>
        </div>

        <button
          className="frame-button"
          type="button"
          onClick={() => void frameLayer()}
          disabled={loadState !== "ready"}
          aria-label="Frame the active raster layer"
        >
          <span className="frame-button__target" aria-hidden="true" />
          Frame layer
        </button>
      </div>

      <aside className="control-panel" aria-label="Cloud raster controls">
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

        <section className="intro-block">
          <p className="section-kicker">Cloud imagery viewer</p>
          <h1>Bring a cloud raster into 3D.</h1>
          <p className="intro-copy">
            Paste a public Cloud Optimized GeoTIFF URL. The scene reads only the
            tiles it needs and drapes them over world elevation.
          </p>
        </section>

        <section className="example-picker">
          <div className="example-picker__heading">
            <label htmlFor="example-dataset">
              Try an example dataset
            </label>
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
                  {EXAMPLE_DATASETS.filter((dataset) => dataset.group === group).map(
                    (dataset) => (
                      <option key={dataset.id} value={dataset.id}>
                        {dataset.label}
                      </option>
                    ),
                  )}
                </optgroup>
              ))}
            </select>
            <span className="select-field__chevron" aria-hidden="true">⌄</span>
          </div>
          <p className="example-picker__detail">
            {selectedExample?.detail ?? "Paste and open your own public COG below."}
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
            <button className="primary-button" type="submit" disabled={loadState === "loading"}>
              {loadState === "loading" ? "Connecting…" : "Open raster"}
              <span aria-hidden="true">→</span>
            </button>
            <button className="text-button" type="button" onClick={useDemo}>
              Use example
            </button>
          </div>
          <p id="url-hint" className="field-hint">
            Requires CORS and HTTP byte-range support.
          </p>
        </form>

        <section className={`status-card status-card--${loadState}`} aria-live="polite">
          <div className="status-card__heading">
            <span className="status-dot" aria-hidden="true" />
            <span>{loadState === "error" ? "Connection issue" : "Stream status"}</span>
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

        <footer className="panel-footer">
          <span className="beta-dot" aria-hidden="true" />
          Direct COG display is a beta capability in the ArcGIS Maps SDK.
        </footer>
      </aside>
    </main>
  );
}
