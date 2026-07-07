import { CategoricalChartType, ChartType, HasAllKeys, Prettify, XY } from "@/types"
import { Config } from "./Config"
import { CurrFlags as PrevFlags, CurrOutputs as PrevOutputs } from "../data/types"
import { ScaleOutput } from "./scales"



export type CurrFlags = {
  hasConfiguredCategories: boolean
  hasConfiguredScale: boolean,
} & PrevFlags
export type DefaultCurrFlags<PFlags extends PrevFlags> = Prettify<
  {
    hasConfiguredCategories: false,
    hasConfiguredScale: false,
  } & PFlags
>
type AllMethods = keyof Config<any, any, any>
type Method<M extends AllMethods> = M



type RemoveIfNotCategorical<T extends ChartType> = T extends CategoricalChartType
  ? ""
  : Method<"configureCategories">
type RemoveIfNotConfiguredCategories<T extends ChartType, Flags extends CurrFlags> =
  T extends "default"
    ? ""
    : Flags["hasConfiguredCategories"] extends true
      ? ""
      : Method<"configureScales">
type BlockIfNotConfiguredScale<Flags extends CurrFlags> =
  Flags["hasConfiguredScale"] extends true ? "" : Method<"startVisual">
type MethodsToRemove<T extends ChartType, Flags extends CurrFlags> = 
  | RemoveIfNotCategorical<T>
  | RemoveIfNotConfiguredCategories<T, Flags>
  | BlockIfNotConfiguredScale<Flags>

export type This<M, T extends ChartType, Flags extends CurrFlags> =
  Omit<Config<M, T, Flags>, MethodsToRemove<T, Flags>>


export type Categories = HasAllKeys<ChartType, {
  default: never,
  categoricalX: { x: string[] },
  categoricalY: { y: string[] },
  categoricalXY: { x: string[], y: string[] },
}>

type AxisArgsBase = { label?: { text: string, padding?: number } }
type AxisArgsCategorical = AxisArgsBase & { innerPadding?: number }
type AxisConfigNumerical = { label: { text: string, padding: number } }
type AxisConfigCategorical = AxisConfigNumerical & { innerPadding: number }

export type AxisArgs = HasAllKeys<ChartType, {
  default: Partial<XY<AxisArgsBase>>,
  categoricalX: Partial<{ x: AxisArgsCategorical } & { y: AxisArgsBase }>,
  categoricalY: Partial<{ x: AxisArgsBase } & { y: AxisArgsCategorical }>,
  categoricalXY: Partial<{ x: AxisArgsCategorical } & { y: AxisArgsCategorical }>,
}>

export type AxisConfig = HasAllKeys<ChartType, {
  default: XY<AxisConfigNumerical>,
  categoricalX: { x: AxisConfigCategorical } & { y: AxisConfigNumerical },
  categoricalY: { x: AxisConfigNumerical } & { y: AxisConfigCategorical },
  categoricalXY: { x: AxisConfigCategorical } & { y: AxisConfigCategorical },
}>

// Shared per-domain shape (mirrors legacy's TickConfig<Domain> in src/types.ts): numerical and
// categorical only need to say how they differ (formatter's value type, and count/specifier/
// enableMathJax being numerical-only) rather than repeating padding/size/formatter twice.
// `formatter` is intentionally optional on both storage (Config) types: if unset, AxesLayer never
// calls d3's `.tickFormat(...)`, so d3-axis falls back to its own built-in default
// (scale.tickFormat(...) for numerical scales, which already respects `specifier`/`count`;
// identity for band/categorical scales).
type TickArgsBase<Domain> = {
  padding?: number,
  size?: number,
  formatter?: (value: Domain, index: number) => string,
} & (Domain extends number ? { count?: number, specifier?: string, enableMathJax?: boolean } : {})

export type TickArgsNumerical = TickArgsBase<number>
export type TickArgsCategorical = TickArgsBase<string>
export type TickArgsAxisNumerical = { numerical?: TickArgsNumerical }
export type TickArgsAxisCategorical = { categorical?: TickArgsCategorical, numerical?: TickArgsNumerical }

export type TickArgs = HasAllKeys<ChartType, {
  default: Partial<XY<TickArgsAxisNumerical>>,
  categoricalX: Partial<{ x: TickArgsAxisCategorical } & { y: TickArgsAxisNumerical }>,
  categoricalY: Partial<{ x: TickArgsAxisNumerical } & { y: TickArgsAxisCategorical }>,
  categoricalXY: Partial<{ x: TickArgsAxisCategorical } & { y: TickArgsAxisCategorical }>,
}>

type TickConfigBase<Domain> = {
  padding: number,
  size: number,
  formatter?: (value: Domain, index: number) => string,
} & (Domain extends number ? { count: number, specifier: string, enableMathJax: boolean } : {})

export type TickConfigNumerical = TickConfigBase<number>
export type TickConfigCategorical = TickConfigBase<string>
export type TickConfigAxisNumerical = { numerical: TickConfigNumerical }
export type TickConfigAxisCategorical = { categorical: TickConfigCategorical, numerical: TickConfigNumerical }

export type TickConfig = HasAllKeys<ChartType, {
  default: XY<TickConfigAxisNumerical>,
  categoricalX: { x: TickConfigAxisCategorical } & { y: TickConfigAxisNumerical },
  categoricalY: { x: TickConfigAxisNumerical } & { y: TickConfigAxisCategorical },
  categoricalXY: { x: TickConfigAxisCategorical } & { y: TickConfigAxisCategorical },
}>


export type CurrState<T extends ChartType> = {
  axes: AxisConfig[T],
  categories: Categories[T],
  scales: ScaleOutput[T],
  ticks: TickConfig[T],
}

export type CurrOutputs<M> = {
  [K in ChartType]: PrevOutputs<M>[K] & { configState: CurrState<K> }
}

export type CurrOutput<M> = CurrOutputs<M>[ChartType]
