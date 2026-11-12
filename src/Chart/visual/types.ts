import { D3Selection, HasAllKeys, Prettify } from "@/types"
import { CurrFlags as PrevFlags, CurrOutput as PrevOutput } from "../config/types"
import { Visual } from "./Visual"
import { AxesLayer } from "./layers/AxesLayer"
import { TracesLayer } from "./layers/TracesLayer"
import { LinesLayer } from "./layers/predraw/LinesLayer"
import { ScalesLayer } from "./layers/predraw/ScalesLayer"
import { ChartType } from "../axes/types"
import { BarsLayer } from "./layers/BarsLayer"



export type CurrFlags = { hasVisualDataLayer: boolean } & PrevFlags
export type DefaultCurrFlags<PFlags extends PrevFlags> = Prettify<
  { hasVisualDataLayer: false } & PFlags
>
type AllMethods = keyof Visual<any, any>
type Method<M extends AllMethods> = M



type RemoveIfNoPoints<Flags extends CurrFlags> =
  (Flags["hasPoints"] extends true ? never : Method<"addScatterPoints">)
type RemoveIfNoLines<Flags extends CurrFlags> =
  (Flags["hasLines"] extends true ? never : Method<"addTraces">)
type RemoveIfNoBars<Flags extends CurrFlags> =
  (Flags["hasBars"] extends true ? never : Method<"addBars">)
type MethodsToRemove<_T extends ChartType, Flags extends CurrFlags> =
  | RemoveIfNoPoints<Flags>
  | RemoveIfNoLines<Flags>
  | RemoveIfNoBars<Flags>

export type This<T extends ChartType, Flags extends CurrFlags> =
  Omit<Visual<T, Flags>, MethodsToRemove<T, Flags>>



export enum CoreLayer {
  Svg = "skadiChartSvg",
  ClipPath = "skadiChartClipPath",
  BaseLayer = "skadiChartBaseLayer",
}
export type CoreLayers = HasAllKeys<CoreLayer, {
  [CoreLayer.Svg]: D3Selection<SVGSVGElement>,
  [CoreLayer.ClipPath]: D3Selection<SVGClipPathElement>,
  [CoreLayer.BaseLayer]: D3Selection<SVGGElement>,
}>

export enum VisualLayer {
  Axes = "skadiChartAxes",
  Trace = "skadiChartTrace",
  Bar = "skadiChartBar",
  // TODO
  // Area = "skadiChartArea",
  // Grid = "skadiChartGrid",
  // Scatter = "skadiChartScatter",
  // CustomVisual = "skadiChartCustomVisual",
}
export type VisualLayers = HasAllKeys<VisualLayer, {
  [VisualLayer.Axes]: AxesLayer | null
  [VisualLayer.Trace]: TracesLayer | null
  [VisualLayer.Bar]: BarsLayer | null
}>

export enum PredrawLayer {
  Scales = "skadiChartScales",
  Lines = "skadiChartLines",
}
export type PredrawLayers = {
  [PredrawLayer.Scales]: ScalesLayer | null
  [PredrawLayer.Lines]: LinesLayer | null
}



export type CurrState = {
  coreLayers: CoreLayers,
  visualLayers: VisualLayers
  predrawLayers: PredrawLayers,
}

export type CurrOutput = {
  visualState: CurrState
} & PrevOutput
