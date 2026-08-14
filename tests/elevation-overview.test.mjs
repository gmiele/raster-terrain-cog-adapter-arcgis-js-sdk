import assert from "node:assert/strict";
import test from "node:test";

import { aggregateElevationChildren } from "../app/swissAltiElevation.ts";

function tile(values, size = 3, noDataValue = -9999) {
  return {
    values: Float32Array.from(values),
    width: size,
    height: size,
    noDataValue,
  };
}

test("recursively aggregates the four child quadrants into a parent elevation tile", () => {
  const size = 3;
  const children = [
    { rowOffset: 0, columnOffset: 0, data: tile(Array(9).fill(100)) },
    { rowOffset: 0, columnOffset: 1, data: tile(Array(9).fill(200)) },
    { rowOffset: 1, columnOffset: 0, data: tile(Array(9).fill(300)) },
    { rowOffset: 1, columnOffset: 1, data: tile(Array(9).fill(400)) },
  ];

  const parent = aggregateElevationChildren(children, size, 8, 8);

  assert.equal(parent.values[0], 100);
  assert.equal(parent.values[size - 1], 200);
  assert.equal(parent.values[(size - 1) * size], 300);
  assert.equal(parent.values.at(-1), 400);
  assert.ok(parent.values.every(Number.isFinite));
});

test("retains a COG-derived bootstrap surface when coverage is sub-pixel", () => {
  const size = 3;
  const noDataValue = -9999;
  const childValues = Array(9).fill(noDataValue);
  childValues[0] = 3456;
  const parent = aggregateElevationChildren(
    [
      {
        rowOffset: 0,
        columnOffset: 0,
        data: tile(childValues, size, noDataValue),
      },
    ],
    size,
    0.2,
    0.1,
  );

  assert.ok(parent.values.every((value) => value === 3456));
});
