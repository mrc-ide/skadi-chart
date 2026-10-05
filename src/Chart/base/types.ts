import { DeepWriteable, XY } from "@/types"
import { Charts, ChartType } from "./chartTypes"



export type BaseTickConfig = {
  translate: number,
  size: number,
}
export type NumericalTickConfig = {
  count: number,
  specifier: string,
  enableMathJax: boolean,
}
export type TickConfig<T> = (
  T extends number ? NumericalTickConfig : {}
) & {
  formatter?: (val: T, idx: number) => string
} & BaseTickConfig



export type BaseAxisConfiguration = {
  show: boolean,
  label: { text: string, translate: number },
  translate: number,
}

export type ConfigurableNumAxis = {
  drawOrigin: boolean,
  domain: number[],
  tick: TickConfig<number>,
} & BaseAxisConfiguration

export type ConfigurableCatAxis = {
  innerPadding: number,
  domain: string[],
  tick: TickConfig<string>,
} & BaseAxisConfiguration

export type AxisConfiguration = 
  | { type: "numerical" } & ConfigurableNumAxis
  | { type: "categorical" } & ConfigurableCatAxis



export type AxesLevels = AxisConfiguration[]
export type SingleChartSatisfies = XY<{
  axis1: AxesLevels,
  axis2?: AxesLevels,
}>
export type ChartsSatisfies = Record<string, SingleChartSatisfies>



export type SingleRange = { start: number, end: number }
export type Rect = XY<SingleRange>
export type Bounds = {
  width: number,
  height: number,
  margin: Rect,
}



export type CurrState = {
  id: string,
  getHtmlId: (key: string) => string,
  element: HTMLDivElement,
  bounds: Bounds,
  clipPathBounds: Bounds,
}

export type CurrOutputs = {
  [K in ChartType]: {
    chartType: K,
    chart: DeepWriteable<Charts[K]>,
    baseState: CurrState,
  }
}

export type CurrOutput = CurrOutputs[ChartType]
