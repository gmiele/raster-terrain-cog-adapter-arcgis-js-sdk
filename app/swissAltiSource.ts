export const SWISS_ALTI_HORIZONTAL_WKID = 2056;
export const SWISS_ALTI_VERTICAL_WKID = 5728;
export const SWISS_ALTI_CELL_SIZE_METERS = 0.5;
export const SWISS_ALTI_COG_SIZE_METERS = 1_000;
export const SWISS_ALTI_COG_PIXEL_SIZE = 2_000;
export const SWISS_ALTI_NO_DATA_VALUE = -9_999;

const SWISS_ALTI_DATA_ROOT =
  "https://data.geo.admin.ch/ch.swisstopo.swissalti3d";

export type ExtentLike = {
  xmin: number;
  ymin: number;
  xmax: number;
  ymax: number;
};

export type SwissAltiCog = {
  cacheKey: string;
  eastKm: number;
  extent: ExtentLike;
  id: string;
  northKm: number;
  url: string;
  year: number;
};

export type SwissAltiCatalogRow = readonly [
  year: number,
  northKm: number,
  eastings: readonly number[],
];

export type SwissAltiCoverageProbe = {
  expectData: boolean;
  expectSources: number;
  id: "interior" | "cross-boundary" | "intentional-hole";
  x: number;
  y: number;
};

export type SwissAltiRegionId = "zermatt" | "zurich";

type SwissAltiRegionDefinition = {
  anchorId: string;
  detail: string;
  id: SwissAltiRegionId;
  initialPaddingMeters: number;
  label: string;
  rows: readonly SwissAltiCatalogRow[];
  validationProbes: readonly SwissAltiCoverageProbe[];
};

export type SwissAltiRegionCatalog = Omit<
  SwissAltiRegionDefinition,
  "anchorId" | "initialPaddingMeters" | "rows"
> & {
  anchorCog: SwissAltiCog;
  cogById: ReadonlyMap<string, SwissAltiCog>;
  cogs: readonly SwissAltiCog[];
  extent: ExtentLike;
  initialExtent: ExtentLike;
  years: readonly number[];
};

// Compact representation of the 298 URLs supplied for the Zermatt region.
export const SWISS_ALTI_ZERMATT_CATALOG_ROWS = [
  [2024, 1085, [2621, 2622, 2627, 2628, 2629, 2630, 2631, 2632, 2633]],
  [2024, 1086, [2620, 2621, 2622, 2623, 2625, 2626, 2627, 2628, 2629, 2630, 2631, 2632, 2633, 2634]],
  [2024, 1087, [2620, 2621, 2622, 2623, 2624, 2625, 2626, 2627, 2628, 2629, 2630, 2631, 2632, 2633]],
  [2024, 1088, [2620, 2621, 2622, 2623, 2624, 2625, 2626, 2627, 2628, 2629, 2630, 2631, 2632, 2633, 2634]],
  [2024, 1089, [2618, 2619, 2620, 2621, 2622, 2623, 2624, 2625, 2626, 2627, 2628, 2629, 2630, 2631, 2632, 2633, 2634]],
  [2024, 1090, [2612, 2613, 2614, 2615, 2617, 2618, 2619, 2620, 2621, 2622, 2623, 2624, 2625, 2626, 2627, 2628, 2629, 2630, 2631, 2632, 2633, 2634]],
  [2024, 1091, [2611, 2612, 2613, 2614, 2615, 2616, 2617, 2618, 2619, 2620, 2621, 2622, 2623, 2624, 2625, 2626, 2627, 2628, 2629, 2630, 2631, 2632, 2633, 2634, 2635]],
  [2024, 1092, [2610, 2611, 2612, 2613, 2614, 2615, 2616, 2617, 2618, 2619, 2620, 2621, 2622, 2623, 2624, 2625, 2626, 2627, 2628, 2629, 2630, 2631, 2632, 2633, 2634, 2635]],
  [2024, 1093, [2610, 2611, 2612, 2613, 2614, 2615, 2616, 2617, 2618, 2619, 2620, 2621, 2622, 2623, 2624, 2625, 2626, 2627, 2628, 2629, 2630, 2631, 2632, 2633, 2634, 2635, 2636]],
  [2024, 1094, [2611, 2612, 2613, 2614, 2615, 2616, 2617, 2618, 2619, 2620, 2621, 2622, 2623, 2624, 2625, 2626, 2627, 2628, 2629, 2630, 2631, 2632, 2633, 2634, 2635, 2636]],
  [2024, 1095, [2612, 2613, 2614, 2615, 2616, 2617, 2618, 2619, 2620, 2621, 2622, 2623, 2624, 2625, 2626, 2627, 2628, 2629, 2630, 2631, 2632, 2633, 2634, 2635, 2636]],
  [2024, 1096, [2612, 2613, 2614, 2615, 2616, 2617, 2618, 2619, 2620, 2621, 2622, 2623, 2624, 2625, 2626, 2627, 2628, 2629, 2630, 2631, 2632, 2633, 2634, 2635]],
  [2024, 1097, [2613, 2614, 2615, 2616, 2617, 2618, 2619, 2620, 2621, 2622, 2623, 2624, 2625, 2626, 2627, 2628, 2629, 2630]],
  [2024, 1098, [2613, 2614, 2616, 2617, 2618, 2619, 2620, 2621, 2622, 2623, 2624, 2625, 2626, 2627, 2628]],
  [2024, 1099, [2618, 2619, 2620, 2621, 2622, 2623, 2624, 2625, 2626, 2627, 2628]],
  [2024, 1100, [2618, 2619, 2620, 2621, 2622, 2623, 2624]],
  [2024, 1101, [2619, 2620, 2621]],
] as const satisfies readonly SwissAltiCatalogRow[];

// Compact representation of the 124 mixed-year URLs supplied for Zürich.
export const SWISS_ALTI_ZURICH_CATALOG_ROWS = [
  [2020, 1241, [2680, 2681]],
  [2019, 1242, [2680, 2681]],
  [2020, 1242, [2682, 2683]],
  [2019, 1243, [2680, 2681, 2682, 2684]],
  [2020, 1243, [2683]],
  [2019, 1244, [2679]],
  [2020, 1244, [2680, 2681, 2682, 2683, 2684, 2685, 2686]],
  [2019, 1245, [2678, 2679, 2680, 2681, 2688, 2689]],
  [2020, 1245, [2682, 2683, 2684, 2685, 2686, 2687]],
  [2019, 1246, [2678, 2679, 2687, 2688]],
  [2020, 1246, [2677, 2680, 2681, 2682, 2683, 2684, 2685, 2686, 2689]],
  [2019, 1247, [2677, 2679, 2680, 2683, 2686, 2687, 2688, 2689]],
  [2020, 1247, [2676, 2678, 2681, 2682, 2684, 2685]],
  [2019, 1248, [2676, 2680, 2681, 2685]],
  [2020, 1248, [2677, 2678, 2679, 2682, 2683, 2684, 2686, 2687]],
  [2019, 1249, [2685]],
  [2020, 1249, [2677, 2678, 2679, 2680, 2681, 2682, 2683, 2684, 2686, 2687]],
  [2019, 1250, [2679, 2684, 2685]],
  [2020, 1250, [2677, 2678, 2680, 2681, 2682, 2683, 2686, 2687]],
  [2019, 1251, [2677, 2681]],
  [2020, 1251, [2678, 2679, 2680, 2682, 2683, 2684, 2685, 2686, 2687]],
  [2019, 1252, [2678, 2679, 2680, 2681]],
  [2020, 1252, [2677, 2682, 2683, 2684, 2685]],
  [2020, 1253, [2678, 2679, 2680, 2681, 2682, 2683, 2684]],
  [2019, 1254, [2679, 2680]],
  [2020, 1254, [2681, 2682, 2683]],
] as const satisfies readonly SwissAltiCatalogRow[];

export function createSwissAltiCog(
  year: number,
  eastKm: number,
  northKm: number,
): SwissAltiCog {
  const id = `${eastKm}-${northKm}`;
  const fileName = `swissalti3d_${year}_${id}_0.5_2056_5728.tif`;
  return {
    cacheKey: `${year}:${id}`,
    eastKm,
    northKm,
    id,
    year,
    url: `${SWISS_ALTI_DATA_ROOT}/swissalti3d_${year}_${id}/${fileName}`,
    extent: {
      xmin: eastKm * SWISS_ALTI_COG_SIZE_METERS,
      ymin: northKm * SWISS_ALTI_COG_SIZE_METERS,
      xmax: (eastKm + 1) * SWISS_ALTI_COG_SIZE_METERS,
      ymax: (northKm + 1) * SWISS_ALTI_COG_SIZE_METERS,
    },
  };
}

export function createSwissAltiCatalog(
  rows: readonly SwissAltiCatalogRow[],
) {
  const catalog = rows.flatMap(([year, northKm, eastings]) =>
    eastings.map((eastKm) => createSwissAltiCog(year, eastKm, northKm)),
  );
  const tileIds = new Set<string>();

  for (const cog of catalog) {
    if (tileIds.has(cog.id)) {
      throw new Error(`Duplicate SwissALTI tile coordinate ${cog.id}.`);
    }
    tileIds.add(cog.id);
  }

  return catalog;
}

function createSwissAltiRegion(
  definition: SwissAltiRegionDefinition,
): SwissAltiRegionCatalog {
  const cogs = createSwissAltiCatalog(definition.rows);
  const cogById = new Map(cogs.map((cog) => [cog.id, cog]));
  const anchorCog = cogById.get(definition.anchorId);
  if (!anchorCog) {
    throw new Error(
      `SwissALTI region ${definition.id} has no anchor ${definition.anchorId}.`,
    );
  }

  const extent = cogs.reduce<ExtentLike>(
    (current, cog) => ({
      xmin: Math.min(current.xmin, cog.extent.xmin),
      ymin: Math.min(current.ymin, cog.extent.ymin),
      xmax: Math.max(current.xmax, cog.extent.xmax),
      ymax: Math.max(current.ymax, cog.extent.ymax),
    }),
    {
      xmin: Number.POSITIVE_INFINITY,
      ymin: Number.POSITIVE_INFINITY,
      xmax: Number.NEGATIVE_INFINITY,
      ymax: Number.NEGATIVE_INFINITY,
    },
  );
  const padding = definition.initialPaddingMeters;

  return {
    anchorCog,
    cogById,
    cogs,
    detail: definition.detail,
    extent,
    id: definition.id,
    initialExtent: {
      xmin: Math.max(extent.xmin, anchorCog.extent.xmin - padding),
      ymin: Math.max(extent.ymin, anchorCog.extent.ymin - padding),
      xmax: Math.min(extent.xmax, anchorCog.extent.xmax + padding),
      ymax: Math.min(extent.ymax, anchorCog.extent.ymax + padding),
    },
    label: definition.label,
    validationProbes: definition.validationProbes,
    years: [...new Set(cogs.map(({ year }) => year))].sort(),
  };
}

export const SWISS_ALTI_REGIONS: readonly SwissAltiRegionCatalog[] = [
  createSwissAltiRegion({
    id: "zermatt",
    label: "Zermatt",
    detail: "298 tiles · 2024 · Swiss Alps",
    rows: SWISS_ALTI_ZERMATT_CATALOG_ROWS,
    anchorId: "2610-1092",
    initialPaddingMeters: 1_000,
    validationProbes: [
      { id: "interior", x: 2_610_500, y: 1_092_500, expectSources: 1, expectData: true },
      { id: "cross-boundary", x: 2_611_000, y: 1_092_500, expectSources: 2, expectData: true },
      { id: "intentional-hole", x: 2_616_500, y: 1_090_500, expectSources: 0, expectData: false },
    ],
  }),
  createSwissAltiRegion({
    id: "zurich",
    label: "Zürich",
    detail: "124 tiles · 2019–2020 · Swiss Plateau",
    rows: SWISS_ALTI_ZURICH_CATALOG_ROWS,
    anchorId: "2683-1248",
    initialPaddingMeters: 2_000,
    validationProbes: [
      { id: "interior", x: 2_676_500, y: 1_248_500, expectSources: 1, expectData: true },
      { id: "cross-boundary", x: 2_677_000, y: 1_247_500, expectSources: 2, expectData: true },
      { id: "intentional-hole", x: 2_676_500, y: 1_241_500, expectSources: 0, expectData: false },
    ],
  }),
];

export const DEFAULT_SWISS_ALTI_REGION = SWISS_ALTI_REGIONS[0];

export function getSwissAltiRegion(id: SwissAltiRegionId) {
  return (
    SWISS_ALTI_REGIONS.find((region) => region.id === id) ??
    DEFAULT_SWISS_ALTI_REGION
  );
}

export function resolveSwissAltiCogs(
  region: SwissAltiRegionCatalog,
  extent: ExtentLike,
) {
  if (
    extent.xmax <= region.extent.xmin ||
    extent.xmin >= region.extent.xmax ||
    extent.ymax <= region.extent.ymin ||
    extent.ymin >= region.extent.ymax
  ) {
    return [];
  }

  return region.cogs.filter(
    (cog) =>
      cog.extent.xmax > extent.xmin &&
      cog.extent.xmin < extent.xmax &&
      cog.extent.ymax > extent.ymin &&
      cog.extent.ymin < extent.ymax,
  );
}

// The original Zermatt exports remain available for the imagery example.
export const SWISS_ALTI_CATALOG_ROWS = SWISS_ALTI_ZERMATT_CATALOG_ROWS;
export const SWISS_ALTI_COGS = DEFAULT_SWISS_ALTI_REGION.cogs;
export const SWISS_ALTI_COG_BY_ID = DEFAULT_SWISS_ALTI_REGION.cogById;
export const SWISS_ALTI_COG = DEFAULT_SWISS_ALTI_REGION.anchorCog;
export const SWISS_ALTI_REGIONAL_EXTENT = DEFAULT_SWISS_ALTI_REGION.extent;
