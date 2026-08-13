export const SWISS_ALTI_HORIZONTAL_WKID = 2056;
export const SWISS_ALTI_VERTICAL_WKID = 5728;
export const SWISS_ALTI_CELL_SIZE_METERS = 0.5;
export const SWISS_ALTI_COG_SIZE_METERS = 1_000;
export const SWISS_ALTI_COG_PIXEL_SIZE = 2_000;
export const SWISS_ALTI_NO_DATA_VALUE = -9_999;

const SWISS_ALTI_DATA_ROOT =
  "https://data.geo.admin.ch/ch.swisstopo.swissalti3d";

export type SwissAltiCog = {
  eastKm: number;
  extent: {
    xmin: number;
    ymin: number;
    xmax: number;
    ymax: number;
  };
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

// Compact representation of the 298 URLs supplied in the regional CSV.
// Each id is the kilometre coordinate of a complete 1 km² SwissALTI3D tile.
export const SWISS_ALTI_CATALOG_ROWS = [
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

export function createSwissAltiCog(
  year: number,
  eastKm: number,
  northKm: number,
): SwissAltiCog {
  const id = `${eastKm}-${northKm}`;
  const fileName = `swissalti3d_${year}_${id}_0.5_2056_5728.tif`;
  return {
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

export const SWISS_ALTI_COGS = createSwissAltiCatalog(
  SWISS_ALTI_CATALOG_ROWS,
);

export const SWISS_ALTI_COG_BY_ID = new Map(
  SWISS_ALTI_COGS.map((cog) => [cog.id, cog]),
);

export const SWISS_ALTI_COG = SWISS_ALTI_COG_BY_ID.get("2610-1092")!;

export const SWISS_ALTI_REGIONAL_EXTENT = SWISS_ALTI_COGS.reduce(
  (extent, cog) => ({
    xmin: Math.min(extent.xmin, cog.extent.xmin),
    ymin: Math.min(extent.ymin, cog.extent.ymin),
    xmax: Math.max(extent.xmax, cog.extent.xmax),
    ymax: Math.max(extent.ymax, cog.extent.ymax),
  }),
  {
    xmin: Number.POSITIVE_INFINITY,
    ymin: Number.POSITIVE_INFINITY,
    xmax: Number.NEGATIVE_INFINITY,
    ymax: Number.NEGATIVE_INFINITY,
  },
);

export function resolveSwissAltiCogs(extent: {
  xmin: number;
  ymin: number;
  xmax: number;
  ymax: number;
}) {
  const epsilon = 1e-7;
  const minEastKm = Math.floor(extent.xmin / SWISS_ALTI_COG_SIZE_METERS);
  const maxEastKm = Math.floor(
    (extent.xmax - epsilon) / SWISS_ALTI_COG_SIZE_METERS,
  );
  const minNorthKm = Math.floor(extent.ymin / SWISS_ALTI_COG_SIZE_METERS);
  const maxNorthKm = Math.floor(
    (extent.ymax - epsilon) / SWISS_ALTI_COG_SIZE_METERS,
  );
  const matches: SwissAltiCog[] = [];

  for (let northKm = minNorthKm; northKm <= maxNorthKm; northKm += 1) {
    for (let eastKm = minEastKm; eastKm <= maxEastKm; eastKm += 1) {
      const cog = SWISS_ALTI_COG_BY_ID.get(`${eastKm}-${northKm}`);
      if (cog) matches.push(cog);
    }
  }

  return matches;
}
