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


type AxisTypesByChartType<
  Default,
  Categorical,
  AxisKeyMode extends "required" | "optional" = "required"
> = HasAllKeys<ChartType, {
  default: Default extends never ? never : XY<Default>,
  categoricalX: { x: Categorical, y: Default },
  categoricalY: { x: Default, y: Categorical },
  categoricalXY: Categorical extends never ? never : XY<Categorical>,
} extends infer Types ? {
  [T in keyof Types]: AxisKeyMode extends "optional"
    ? Partial<Types[T]> // In 'optional' mode, each axis can be omitted.
    : Types[T]
} : never>


export type Categories = AxisTypesByChartType<never, string[]>


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



export type CurrState<T extends ChartType> = {
  axes: AxisConfig,
  categories: Categories[T],
  scales: ScaleOutput[T],
}

export type CurrOutputs<M> = {
  [K in ChartType]: PrevOutputs<M>[K] & { configState: CurrState<K> }
}

export type CurrOutput<M> = CurrOutputs<M>[ChartType]
