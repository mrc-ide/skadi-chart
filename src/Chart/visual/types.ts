import { ChartType, D3Selection, HasAllKeys, Prettify } from "@/types"
import { CurrFlags as PrevFlags, CurrOutputs as PrevOutputs } from "../config/types"
import { Visual } from "./Visual"
import { AxesLayer } from "./layers/AxesLayer"
import { TracesLayer } from "./layers/TracesLayer"



export type CurrFlags = { hasVisualDataLayer: boolean } & PrevFlags
export type DefaultCurrFlags<PFlags extends PrevFlags> = Prettify<
  { hasVisualDataLayer: false } & PFlags
>
type AllMethods = keyof Visual<any, any, any>
type Method<M extends AllMethods> = M



type VisualDataLayers = Method<"addTraces" | "addScatterPoints">
type RemoveIfNoData<Flags extends CurrFlags> =
  Flags["hasData"] extends true ? "" : VisualDataLayers
type MethodsToRemove<_T extends ChartType, Flags extends CurrFlags> = RemoveIfNoData<Flags>

export type This<M, T extends ChartType, Flags extends CurrFlags> =
  Omit<Visual<M, T, Flags>, MethodsToRemove<T, Flags>>



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
  // TODO
  // Area = "skadiChartArea",
  // Grid = "skadiChartGrid",
  // Scatter = "skadiChartScatter",
  // CustomVisual = "skadiChartCustomVisual",
}
export type VisualLayers<M> = HasAllKeys<VisualLayer, {
  [VisualLayer.Axes]: AxesLayer<M> | null
  [VisualLayer.Trace]: TracesLayer<M> | null
}>



export type CurrState<M> = {
  coreLayers: CoreLayers,
  visualLayers: VisualLayers<M>
}

export type CurrOutputs<M> = {
  [K in ChartType]: PrevOutputs<M>[K] & { visualState: CurrState<M> }
}

export type CurrOutput<M> = CurrOutputs<M>[ChartType]
