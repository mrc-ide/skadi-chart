import { CategoricalChartType, ChartType, HasAllKeys, Prettify } from "@/types"
import { Config } from "./Config"
import { DataFlags, DataOutputs } from "../data/types"
import { ScaleOutput } from "./scales"



export type ConfigFlags = {
  hasConfiguredScale: boolean,
  hasConfiguredCategories: boolean
} & DataFlags
export type DefaultConfigFlags<PrevFlags extends DataFlags> = Prettify<
  {
    hasConfiguredScale: false,
    hasConfiguredCategories: false,
  } & PrevFlags
>
type AllMethods = keyof Config<any, any, any>
type Method<M extends AllMethods> = M



type RemoveIfNotCategorical = HasAllKeys<ChartType, {
  default: Method<"configureCategories">,
  categoricalX: "",
  categoricalY: "",
  categoricalXY: ""
}>
type BlockIfNotConfiguredScale<Flags extends ConfigFlags> =
  Flags["hasConfiguredScale"] extends true ? "" : Method<"startVisual">
type BlockIfNotConfiguredCategories<T extends ChartType, Flags extends ConfigFlags> =
  T extends "default"
    ? ""
    : Flags["hasConfiguredCategories"] extends true
      ? ""
      : Method<"configureScales">
type Omits<T extends ChartType, Flags extends ConfigFlags> = 
  | RemoveIfNotCategorical[T]
  | BlockIfNotConfiguredScale<Flags>
  | BlockIfNotConfiguredCategories<T, Flags>

export type This<M, T extends ChartType, Flags extends ConfigFlags> =
  Omit<Config<M, T, Flags>, Omits<T, Flags>>



export type Categories = HasAllKeys<ChartType, {
  default: never,
  categoricalX: { x: string[] },
  categoricalY: { y: string[] },
  categoricalXY: { x: string[], y: string[] },
}>



export type ConfigState<T extends ChartType> = {
  scales: ScaleOutput[T],
  categories: T extends CategoricalChartType ? Categories[T] : never
}

export type ConfigOutputs<M> = {
  [K in ChartType]: DataOutputs<M>[K] & { configState: ConfigState<K> }
}

export type ConfigOutput<M> = ConfigOutputs<M>[ChartType]
