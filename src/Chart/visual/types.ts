import { ChartType, D3Selection, HasAllKeys, Prettify } from "@/types"
import { ConfigFlags, ConfigOutputs } from "../config/types"
import { Visual } from "./Visual"
import { AxesLayer } from "./layers/AxesLayer"



export type VisualFlags = { hasVisualDataLayer: boolean } & ConfigFlags
export type DefaultVisualFlags<PrevFlags extends ConfigFlags> = Prettify<
  { hasVisualDataLayer: false } & PrevFlags
>
type AllMethods = keyof Visual<any, any, any>
type Method<M extends AllMethods> = M



type VisualDataLayers = Method<"addTraces" | "addScatterPoints">
type RemoveIfNoData<Flags extends VisualFlags> =
  Flags["hasData"] extends true ? "" : VisualDataLayers
type Omits<_T extends ChartType, Flags extends VisualFlags> = RemoveIfNoData<Flags>

export type This<M, T extends ChartType, Flags extends VisualFlags> =
  Omit<Visual<M, T, Flags>, Omits<T, Flags>>



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
  // TODO
  // Area = "skadiChartArea",
  // Trace = "skadiChartTrace",
  // Grid = "skadiChartGrid",
  // Scatter = "skadiChartScatter",
  // CustomVisual = "skadiChartCustomVisual",
}
export type VisualLayers<M> = HasAllKeys<VisualLayer, {
  [VisualLayer.Axes]: AxesLayer<M> | null
}>



export type VisualState<M> = {
  coreLayers: CoreLayers,
  visualLayers: VisualLayers<M>
}

export type VisualOutputs<M> = {
  [K in ChartType]: ConfigOutputs<M>[K] & { visualState: VisualState<M> }
}

export type VisualOutput<M> = VisualOutputs<M>[ChartType]
