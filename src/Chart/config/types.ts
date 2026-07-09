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

type AxisArgsNumerical = { label?: { text: string, padding?: number }, drawOrigin?: boolean }
type AxisArgsCategorical = AxisArgsNumerical & { innerPadding?: number }
type AxisConfigNumerical = { label: { text: string, padding: number }, drawOrigin: boolean }
type AxisConfigCategorical = AxisConfigNumerical & { innerPadding: number }

export type AxisArgs = HasAllKeys<ChartType, {
  default: Partial<XY<AxisArgsNumerical>>,
  categoricalX: Partial<{ x: AxisArgsCategorical } & { y: AxisArgsNumerical }>,
  categoricalY: Partial<{ x: AxisArgsNumerical } & { y: AxisArgsCategorical }>,
  categoricalXY: Partial<{ x: AxisArgsCategorical } & { y: AxisArgsCategorical }>,
}>

export type AxisConfig = HasAllKeys<ChartType, {
  default: XY<AxisConfigNumerical>,
  categoricalX: { x: AxisConfigCategorical } & { y: AxisConfigNumerical },
  categoricalY: { x: AxisConfigNumerical } & { y: AxisConfigCategorical },
  categoricalXY: { x: AxisConfigCategorical } & { y: AxisConfigCategorical },
}>


export type CurrState<T extends ChartType> = {
  axes: AxisConfig[T],
  categories: Categories[T],
  scales: ScaleOutput[T],
}

export type CurrOutputs<M> = {
  [K in ChartType]: PrevOutputs<M>[K] & { configState: CurrState<K> }
}

export type CurrOutput<M> = CurrOutputs<M>[ChartType]
