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

export type SwissAltiCatalogRunRow = readonly [
  year: number,
  northKm: number,
  eastingRuns: readonly (readonly [startKm: number, endKm: number])[],
];

export type SwissAltiCoverageProbe = {
  expectData: boolean;
  expectSources: number;
  id: "interior" | "cross-boundary" | "intentional-hole";
  x: number;
  y: number;
};

export type SwissAltiRegionId = "zermatt" | "zurich" | "bern" | "chur";

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

function expandSwissAltiCatalogRuns(
  rows: readonly SwissAltiCatalogRunRow[],
): SwissAltiCatalogRow[] {
  return rows.map(([year, northKm, eastingRuns]) => [
    year,
    northKm,
    eastingRuns.flatMap(([startKm, endKm]) =>
      Array.from({ length: endKm - startKm + 1 }, (_, index) => startKm + index),
    ),
  ]);
}

// Exact compact representation of the 6,380 URLs supplied for Canton Bern.
export const SWISS_ALTI_BERN_CATALOG_RUNS = [
  [2025, 1130, [[2583, 2585]]],
  [2025, 1131, [[2583, 2586]]],
  [2025, 1132, [[2583, 2586], [2590, 2592]]],
  [2025, 1133, [[2583, 2586], [2589, 2594]]],
  [2025, 1134, [[2582, 2595]]],
  [2025, 1135, [[2582, 2597], [2603, 2606]]],
  [2025, 1136, [[2581, 2607]]],
  [2025, 1137, [[2581, 2608]]],
  [2025, 1138, [[2581, 2608]]],
  [2025, 1139, [[2582, 2607], [2612, 2612]]],
  [2025, 1140, [[2582, 2612], [2619, 2621]]],
  [2025, 1141, [[2581, 2613], [2618, 2623]]],
  [2025, 1142, [[2581, 2613], [2615, 2625]]],
  [2025, 1143, [[2581, 2626]]],
  [2025, 1144, [[2583, 2627]]],
  [2025, 1145, [[2583, 2629]]],
  [2025, 1146, [[2583, 2630]]],
  [2025, 1147, [[2583, 2635]]],
  [2025, 1148, [[2583, 2636]]],
  [2025, 1149, [[2584, 2637]]],
  [2025, 1150, [[2585, 2639]]],
  [2025, 1151, [[2585, 2640]]],
  [2025, 1152, [[2585, 2641], [2656, 2659]]],
  [2025, 1153, [[2585, 2640], [2653, 2663]]],
  [2025, 1154, [[2584, 2640], [2652, 2665]]],
  [2025, 1155, [[2584, 2642], [2647, 2666]]],
  [2025, 1156, [[2585, 2668]]],
  [2025, 1157, [[2586, 2670]]],
  [2025, 1158, [[2586, 2670]]],
  [2025, 1159, [[2587, 2588], [2590, 2670]]],
  [2025, 1160, [[2590, 2670]]],
  [2025, 1161, [[2590, 2671]]],
  [2025, 1162, [[2590, 2671]]],
  [2025, 1163, [[2590, 2671]]],
  [2025, 1164, [[2590, 2671]]],
  [2025, 1165, [[2590, 2672]]],
  [2025, 1166, [[2591, 2673]]],
  [2025, 1167, [[2591, 2592], [2594, 2674]]],
  [2025, 1168, [[2594, 2674]]],
  [2025, 1169, [[2594, 2673]]],
  [2025, 1170, [[2595, 2673], [2676, 2676]]],
  [2025, 1171, [[2592, 2677]]],
  [2025, 1172, [[2592, 2677]]],
  [2025, 1173, [[2590, 2677]]],
  [2025, 1174, [[2589, 2677]]],
  [2025, 1175, [[2589, 2677]]],
  [2025, 1176, [[2589, 2677]]],
  [2025, 1177, [[2589, 2676]]],
  [2025, 1178, [[2589, 2677]]],
  [2025, 1179, [[2588, 2653], [2655, 2663], [2665, 2677]]],
  [2025, 1180, [[2588, 2652], [2657, 2658], [2661, 2661], [2666, 2677]]],
  [2025, 1181, [[2589, 2640], [2642, 2650], [2667, 2672]]],
  [2025, 1182, [[2589, 2639], [2644, 2649], [2670, 2671]]],
  [2025, 1183, [[2589, 2639]]],
  [2025, 1184, [[2590, 2638]]],
  [2025, 1185, [[2590, 2637]]],
  [2025, 1186, [[2590, 2636]]],
  [2025, 1187, [[2590, 2634]]],
  [2025, 1188, [[2589, 2633]]],
  [2025, 1189, [[2589, 2632]]],
  [2025, 1190, [[2590, 2591], [2593, 2632]]],
  [2025, 1191, [[2593, 2632]]],
  [2025, 1192, [[2593, 2632]]],
  [2025, 1193, [[2586, 2633]]],
  [2021, 1194, [[2575, 2576]]],
  [2025, 1194, [[2580, 2633]]],
  [2021, 1195, [[2575, 2577]]],
  [2025, 1195, [[2582, 2633]]],
  [2021, 1196, [[2575, 2576]]],
  [2025, 1196, [[2582, 2633]]],
  [2025, 1197, [[2582, 2634]]],
  [2025, 1198, [[2581, 2636]]],
  [2025, 1199, [[2582, 2637]]],
  [2025, 1200, [[2581, 2637]]],
  [2025, 1201, [[2581, 2638]]],
  [2025, 1202, [[2570, 2574], [2582, 2638]]],
  [2025, 1203, [[2569, 2578], [2583, 2639]]],
  [2025, 1204, [[2569, 2580], [2583, 2638]]],
  [2025, 1205, [[2568, 2639]]],
  [2025, 1206, [[2568, 2639]]],
  [2025, 1207, [[2569, 2635]]],
  [2025, 1208, [[2569, 2634]]],
  [2025, 1209, [[2569, 2634]]],
  [2025, 1210, [[2570, 2633]]],
  [2025, 1211, [[2572, 2632]]],
  [2025, 1212, [[2572, 2633]]],
  [2025, 1213, [[2572, 2633]]],
  [2025, 1214, [[2572, 2633]]],
  [2025, 1215, [[2556, 2558], [2572, 2599], [2602, 2633]]],
  [2025, 1216, [[2556, 2560], [2570, 2599], [2601, 2633]]],
  [2025, 1217, [[2556, 2562], [2568, 2595], [2601, 2633]]],
  [2025, 1218, [[2557, 2566], [2568, 2598], [2602, 2632]]],
  [2025, 1219, [[2558, 2600], [2604, 2633]]],
  [2025, 1220, [[2557, 2599], [2605, 2634]]],
  [2025, 1221, [[2557, 2600], [2606, 2634]]],
  [2025, 1222, [[2556, 2603], [2606, 2633]]],
  [2025, 1223, [[2556, 2557], [2559, 2604], [2606, 2610], [2616, 2633]]],
  [2025, 1224, [[2556, 2557], [2560, 2596], [2598, 2604], [2608, 2609], [2616, 2633]]],
  [2025, 1225, [[2562, 2596], [2599, 2603], [2617, 2633]]],
  [2025, 1226, [[2562, 2563], [2566, 2595], [2599, 2602], [2617, 2632]]],
  [2025, 1227, [[2566, 2594], [2615, 2631]]],
  [2025, 1228, [[2569, 2593], [2615, 2631]]],
  [2025, 1229, [[2569, 2594], [2615, 2631]]],
  [2025, 1230, [[2570, 2595], [2613, 2630]]],
  [2025, 1231, [[2570, 2597], [2612, 2630]]],
  [2025, 1232, [[2571, 2598], [2611, 2629]]],
  [2025, 1233, [[2572, 2572], [2577, 2599], [2611, 2629]]],
  [2025, 1234, [[2577, 2592], [2594, 2594], [2596, 2602], [2611, 2629]]],
  [2025, 1235, [[2577, 2593], [2596, 2602], [2610, 2621], [2624, 2625], [2627, 2627], [2629, 2629]]],
  [2025, 1236, [[2579, 2593], [2596, 2603], [2610, 2621]]],
  [2025, 1237, [[2579, 2593], [2596, 2605], [2616, 2620]]],
  [2025, 1238, [[2579, 2582], [2592, 2607], [2618, 2618]]],
  [2025, 1239, [[2593, 2608]]],
  [2025, 1240, [[2594, 2598], [2605, 2608]]],
  [2025, 1241, [[2606, 2610]]],
  [2025, 1242, [[2607, 2610]]],
  [2025, 1243, [[2607, 2609]]],
] as const satisfies readonly SwissAltiCatalogRunRow[];

// Exact compact representation of the 114 URLs supplied for Chur.
export const SWISS_ALTI_CHUR_CATALOG_RUNS = [
  [2023, 1180, [[2765, 2765]]],
  [2023, 1181, [[2764, 2766]]],
  [2023, 1182, [[2764, 2766]]],
  [2023, 1183, [[2763, 2767]]],
  [2023, 1184, [[2763, 2768]]],
  [2023, 1185, [[2762, 2768]]],
  [2023, 1186, [[2762, 2766]]],
  [2023, 1187, [[2756, 2757], [2762, 2766]]],
  [2023, 1188, [[2756, 2766]]],
  [2023, 1189, [[2756, 2764]]],
  [2023, 1190, [[2756, 2764]]],
  [2023, 1191, [[2756, 2764]]],
  [2023, 1192, [[2755, 2764]]],
  [2023, 1193, [[2754, 2762]]],
  [2023, 1194, [[2753, 2761]]],
  [2023, 1195, [[2754, 2760]]],
  [2023, 1196, [[2757, 2760]]],
] as const satisfies readonly SwissAltiCatalogRunRow[];

export const SWISS_ALTI_BERN_CATALOG_ROWS = expandSwissAltiCatalogRuns(
  SWISS_ALTI_BERN_CATALOG_RUNS,
);
export const SWISS_ALTI_CHUR_CATALOG_ROWS = expandSwissAltiCatalogRuns(
  SWISS_ALTI_CHUR_CATALOG_RUNS,
);

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
  createSwissAltiRegion({
    id: "bern",
    label: "Canton Bern",
    detail: "6,380 tiles · 2021 & 2025 · Swiss Plateau and Alps",
    rows: SWISS_ALTI_BERN_CATALOG_ROWS,
    anchorId: "2616-1186",
    initialPaddingMeters: 3_000,
    validationProbes: [
      { id: "interior", x: 2_616_500, y: 1_186_500, expectSources: 1, expectData: true },
      { id: "cross-boundary", x: 2_617_000, y: 1_186_500, expectSources: 2, expectData: true },
      { id: "intentional-hole", x: 2_593_500, y: 1_234_500, expectSources: 0, expectData: false },
    ],
  }),
  createSwissAltiRegion({
    id: "chur",
    label: "Chur",
    detail: "114 tiles · 2023 · Graubünden",
    rows: SWISS_ALTI_CHUR_CATALOG_ROWS,
    anchorId: "2760-1189",
    initialPaddingMeters: 2_000,
    validationProbes: [
      { id: "interior", x: 2_760_500, y: 1_189_500, expectSources: 1, expectData: true },
      { id: "cross-boundary", x: 2_761_000, y: 1_188_500, expectSources: 2, expectData: true },
      { id: "intentional-hole", x: 2_761_500, y: 1_187_500, expectSources: 0, expectData: false },
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

  const boundedExtent = {
    xmin: Math.max(extent.xmin, region.extent.xmin),
    ymin: Math.max(extent.ymin, region.extent.ymin),
    xmax: Math.min(extent.xmax, region.extent.xmax),
    ymax: Math.min(extent.ymax, region.extent.ymax),
  };
  const minEastKm = Math.floor(
    boundedExtent.xmin / SWISS_ALTI_COG_SIZE_METERS,
  );
  const maxEastKm =
    Math.ceil(boundedExtent.xmax / SWISS_ALTI_COG_SIZE_METERS) - 1;
  const minNorthKm = Math.floor(
    boundedExtent.ymin / SWISS_ALTI_COG_SIZE_METERS,
  );
  const maxNorthKm =
    Math.ceil(boundedExtent.ymax / SWISS_ALTI_COG_SIZE_METERS) - 1;
  const matches: SwissAltiCog[] = [];

  for (let northKm = minNorthKm; northKm <= maxNorthKm; northKm += 1) {
    for (let eastKm = minEastKm; eastKm <= maxEastKm; eastKm += 1) {
      const cog = region.cogById.get(`${eastKm}-${northKm}`);
      if (cog) matches.push(cog);
    }
  }

  return matches;
}

// The original Zermatt exports remain available for the imagery example.
export const SWISS_ALTI_CATALOG_ROWS = SWISS_ALTI_ZERMATT_CATALOG_ROWS;
export const SWISS_ALTI_COGS = DEFAULT_SWISS_ALTI_REGION.cogs;
export const SWISS_ALTI_COG_BY_ID = DEFAULT_SWISS_ALTI_REGION.cogById;
export const SWISS_ALTI_COG = DEFAULT_SWISS_ALTI_REGION.anchorCog;
export const SWISS_ALTI_REGIONAL_EXTENT = DEFAULT_SWISS_ALTI_REGION.extent;
