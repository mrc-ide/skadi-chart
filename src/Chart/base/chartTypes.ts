import { XorY } from "@/types";
import { AxisConfiguration, BaseAxisConfiguration, ChartsSatisfies, SingleChartSatisfies, TickConfig } from "./types";

const baseAxisConfiguration = {
  show: true,
  label: { text: "", translate: 0 },
  translate: 0
} as const satisfies BaseAxisConfiguration;

const defCatTickCfg = {
  translate: 0,
  size: 0,
} as const satisfies TickConfig<string>;

const defNumTickCfg = {
  ...defCatTickCfg,
  count: 10,
  // an SI-prefix with 2 significant figures and no trailing zeros, 42e6 -> 42M
  specifier: ".2~s",
  enableMathJax: false
} as const satisfies TickConfig<number>;

const defNumAxis = {
  type: "numerical",
  domain: [],
  drawOrigin: true,
  tick: defNumTickCfg,
  ...baseAxisConfiguration,
} as const satisfies AxisConfiguration;

const defCatAxis = {
  type: "categorical",
  domain: [],
  innerPadding: 0,
  tick: defCatTickCfg,
  ...baseAxisConfiguration,
} as const satisfies AxisConfiguration;

// [
//  { type: "categorical", domain: ["A", "B"], ... },
//  { type: "numerical", domain: [0, 100], ... },
// ]
// denotes a tree structure where each category has a numerical
// scale from 0 to 100 within it
//
// We can have any number of axes on x or y but for simplicity we
// will do either "default" if there is only one axis or "axis1"
// and "axis2" if there are multiple
const numXY = {
  x: { axis1: [defNumAxis] },
  y: { axis1: [defNumAxis] },
} as const satisfies SingleChartSatisfies;

const catNumXNumY = {
  x: { axis1: [defCatAxis, defNumAxis] },
  y: { axis1: [defNumAxis] },
} as const satisfies SingleChartSatisfies;

const numXCatNumY = {
  x: { axis1: [defNumAxis] },
  y: { axis1: [defCatAxis, defNumAxis] },
} as const satisfies SingleChartSatisfies;

const catNumXCatNumY = {
  x: { axis1: [defCatAxis, defNumAxis] },
  y: { axis1: [defCatAxis, defNumAxis] },
} as const satisfies SingleChartSatisfies;

export const charts = {
  numXY,
  numXCatNumY,
  catNumXNumY,
  catNumXCatNumY,
} as const satisfies ChartsSatisfies;

export type Charts = typeof charts
export type ChartType = keyof typeof charts
export type CategoricalChartType = Exclude<ChartType, "numXY">

export type FuncExtends = Record<AxisConfiguration["type"], any>
export type IsAxesFunc<T extends FuncExtends> = T
export type AxesArrayMap<
  Arr extends any[],
  Func extends FuncExtends
> =
  Arr extends [
    infer F extends AxisConfiguration,
    ...infer R extends AxisConfiguration[]
  ] ? [Func[F["type"]], ...AxesArrayMap<R, Func>] :
  []

export type MakeChartArgs<
  T extends ChartType,
  Func extends FuncExtends
> = {
  [K in XorY]: {
    [N in keyof Charts[T][K]]: Charts[T][K][N] extends AxisConfiguration[]
      ? AxesArrayMap<Charts[T][K][N], Func>
      : never
  }
}
