import { expectTypeOf } from "vitest";
import type { AxesArgs, DomainArgs, MakeChartArgs } from "@/Chart/config/types";

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

  test("domain arguments require only configured axes and positions", () => {
    type Chart = {
      x: { start: ["numerical"], end: [] },
      y: { start: [], end: ["categorical"] },
    };

    expectTypeOf<DomainArgs<Chart>>().toEqualTypeOf<{
      x: { start: [number[]] },
      y: { end: [string[]] },
    }>();
  });

  test("numerical axes must not accept categorical innerPadding or borders", () => {
    type Chart = {
      x: { start: ["numerical"], end: [] },
      y: { start: [], end: [] },
    };

    type OptionKeys = AxesArgs<Chart> extends {
      x?: { start?: (infer Options)[] },
    } ? keyof Options : never;

    expectTypeOf<OptionKeys>().toEqualTypeOf<
      "show" | "label" | "translate" | "drawOrigin" | "log"
    >();
  });

  test("numerical axes must not accept drawOrigin as true when log is true", () => {
    type Chart = {
      x: { start: ["numerical"], end: [] },
      y: { start: [], end: [] },
    };

    type Options = NonNullable<NonNullable<AxesArgs<Chart>["x"]>["start"]>[0];

    expectTypeOf<{ log: true, drawOrigin: true }>().not.toExtend<Options>();
    expectTypeOf<{ log: true, drawOrigin: false }>().toExtend<Options>();
    expectTypeOf<{ log: false, drawOrigin: true }>().toExtend<Options>();
    expectTypeOf<{ log: false, drawOrigin: false }>().toExtend<Options>();
  });

  test("categorical axes must not accept numerical drawOrigin", () => {
    type Chart = {
      x: { start: [], end: [] },
      y: { start: [], end: ["categorical"] },
    };

    type OptionKeys = AxesArgs<Chart> extends {
      y?: { end?: (infer Options)[] },
    } ? keyof Options : never;

    expectTypeOf<OptionKeys>().toEqualTypeOf<
      "show" | "label" | "translate" | "borders" | "innerPadding"
    >();
  });
});
