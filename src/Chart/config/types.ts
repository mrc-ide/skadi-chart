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


export type AxisArgs = Partial<XY<{
  label?: {
    text: string,
    padding?: number,
  }
}>>
export type AxisConfig = XY<{
  label: {
    text: string,
    padding: number,
  }
}>;


type CategoriesPropertiesByChartType<Props> = HasAllKeys<ChartType, {
  default: never,
  categoricalX: { x: Props },
  categoricalY: { y: Props },
  categoricalXY: XY<Props>,
}>

export type CategoriesArgs = CategoriesPropertiesByChartType<{
  labels: string[],
  innerPadding?: number,
}>

export type CategoriesConfig = CategoriesPropertiesByChartType<{
  labels: string[],
  innerPadding: number,
}>


export type CurrState<T extends ChartType> = {
  axes: AxisConfig,
  categories: CategoriesConfig[T],
  scales: ScaleOutput[T],
}

export type CurrOutputs<M> = {
  [K in ChartType]: PrevOutputs<M>[K] & { configState: CurrState<K> }
}

export type CurrOutput<M> = CurrOutputs<M>[ChartType]
