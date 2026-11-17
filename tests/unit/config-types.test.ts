import { expectTypeOf } from "vitest";
import type { DefaultChartType } from "@/Chart/axes/types";
import type { DomainArgs, MakeChartArgs } from "@/Chart/config/types";

type AxisValues = {
  numerical: number,
  categorical: string,
};

describe("MakeChartArgs", () => {
  test("omits axes and positions from argument interface where they are not registered in the chart type", () => {
    type Chart = {
      x: { start: ["numerical"], end: [] },
      y: { start: [], end: [] },
    };

    expectTypeOf<MakeChartArgs<Chart, AxisValues>>().toEqualTypeOf<{
      x: { start: [number] },
    }>();
  });

  test("supports end-only axes and preserves level order and types", () => {
    type Chart = {
      x: { start: [], end: [] },
      y: { start: [], end: ["categorical", "numerical"] },
    };

    expectTypeOf<MakeChartArgs<Chart, AxisValues>>().toEqualTypeOf<{
      y: { end: [string, number] },
    }>();
  });

  test("requires every populated axis and position", () => {
    type Chart = {
      x: { start: ["numerical"], end: ["categorical"] },
      y: { start: ["categorical"], end: ["numerical"] },
    };

    expectTypeOf<MakeChartArgs<Chart, AxisValues>>().toEqualTypeOf<{
      x: { start: [number], end: [string] },
      y: { start: [string], end: [number] },
    }>();
  });

  test("has no required keys for an empty chart", () => {
    expectTypeOf<keyof MakeChartArgs<DefaultChartType, AxisValues>>()
      .toEqualTypeOf<never>();
  });

  test("domain arguments require only configured axes and positions", () => {
    type Chart = {
      x: { start: ["numerical"], end: [] },
      y: { start: [], end: ["categorical"] },
    };

    expectTypeOf<DomainArgs<Chart>>().toEqualTypeOf<{
      x: { start: [{ domain: number[] }] },
      y: { end: [{ domain: string[] }] },
    }>();
  });
});
