import { CategoricalChartType, ChartType, HasAllKeys, Prettify, XorY, XY } from "@/types"
import { Config } from "./Config"
import { CurrFlags as PrevFlags, CurrOutputs as PrevOutputs } from "../data/types"
import { ScaleOutput } from "./scales"
import { TickConfig } from "./ticks"



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

type AxisKeyMode = "required" | "optional"
type MaybePartial<T, Mode extends AxisKeyMode> = Mode extends "optional" ? Partial<T> : T
// When the per-axis type is never, that axis must be omitted.
type XYOmitNever<X, Y, Mode extends AxisKeyMode> =
  ([X] extends [never] ? {} : MaybePartial<{ x: X }, Mode>)
  & ([Y] extends [never] ? {} : MaybePartial<{ y: Y }, Mode>)

// In 'optional' mode, each axis can be omitted (if it isn't already omitted by XYOmitNever).
export type PerAxisConfigByChartType<
  Default,
  Categorical,
  Mode extends AxisKeyMode = "required",
> = HasAllKeys<ChartType, {
  default: XYOmitNever<Default, Default, Mode>,
  categoricalX: XYOmitNever<Categorical, Default, Mode>,
  categoricalY: XYOmitNever<Default, Categorical, Mode>,
  categoricalXY: XYOmitNever<Categorical, Categorical, Mode>,
}>


export type Categories = PerAxisConfigByChartType<never, string[]>


type AxisArgsNumerical = { label?: { text: string, padding?: number } }
type AxisArgsCategorical = AxisArgsNumerical & { innerPadding?: number }
export type AxisArgs = PerAxisConfigByChartType<AxisArgsNumerical, AxisArgsCategorical, "optional">

type AxisConfigNumerical = { label: { text: string, padding: number } }
type AxisConfigCategorical = AxisConfigNumerical & { innerPadding: number }
export type AxisConfig = PerAxisConfigByChartType<AxisConfigNumerical, AxisConfigCategorical>


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
