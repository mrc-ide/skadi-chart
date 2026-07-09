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

// When the per-axis type is never, that axis must be omitted.
type XYOmitNever<X, Y> =
  ([X] extends [never] ? {} : { x: X })
  & ([Y] extends [never] ? {} : { y: Y })

export type PerAxisConfigByChartType<
  Default,
  Categorical,
  AxisKeyMode extends "required" | "optional" = "required"
> = HasAllKeys<ChartType, {
  default: XYOmitNever<Default, Default>,
  categoricalX: XYOmitNever<Categorical, Default>,
  categoricalY: XYOmitNever<Default, Categorical>,
  categoricalXY: XYOmitNever<Categorical, Categorical>,
} extends infer Types ? {
  [T in keyof Types]: AxisKeyMode extends "optional"
    ? Partial<Types[T]> // In 'optional' mode, each axis can be omitted (if it isn't already omitted by XYOmitNever).
    : Types[T]
} : never>


export type Categories = PerAxisConfigByChartType<never, string[]>


type AxisArgsBase = { label?: { text: string, padding?: number } }
type AxisArgsCategorical = AxisArgsBase & { innerPadding?: number }
export type AxisArgs = PerAxisConfigByChartType<AxisArgsBase, AxisArgsCategorical, "optional">

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
