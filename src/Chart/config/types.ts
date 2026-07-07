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


export type NumericalTickArgs = {
  padding?: number,
  size?: number,
  count?: number,
  specifier?: string,
  formatter?: (value: number, index: number) => string,
  enableMathJax?: boolean,
}
export type CategoricalTickArgs = {
  padding?: number,
  size?: number,
  formatter?: (value: string, index: number) => string,
}
// formatter is left optional (undefined by default): d3 already derives a sensible default tick
// formatter from the specifier (via axis.ticks(count, specifier)), so we should only override it
// with an explicit tickFormat call when the user has actually supplied a custom formatter.
export type NumericalTickConfig = Required<Omit<NumericalTickArgs, "formatter">> & Pick<NumericalTickArgs, "formatter">
export type CategoricalTickConfig = Required<Omit<CategoricalTickArgs, "formatter">> & Pick<CategoricalTickArgs, "formatter">

// Every axis always has numerical tick config (numbers on a numerical axis, or on the numerical
// sub-ticks within each band of a categorical axis); only axes that are categorical for the given
// ChartType also carry a categorical tick config (for the band labels themselves).
export type TicksArgs = HasAllKeys<ChartType, {
  default: Partial<XY<{ numerical?: NumericalTickArgs }>>,
  categoricalX: Partial<{ x: { numerical?: NumericalTickArgs, categorical?: CategoricalTickArgs } } & { y: { numerical?: NumericalTickArgs } }>,
  categoricalY: Partial<{ x: { numerical?: NumericalTickArgs } } & { y: { numerical?: NumericalTickArgs, categorical?: CategoricalTickArgs } }>,
  categoricalXY: Partial<XY<{ numerical?: NumericalTickArgs, categorical?: CategoricalTickArgs }>>,
}>

export type TicksConfig = HasAllKeys<ChartType, {
  default: XY<{ numerical: NumericalTickConfig }>,
  categoricalX: { x: { numerical: NumericalTickConfig, categorical: CategoricalTickConfig } } & { y: { numerical: NumericalTickConfig } },
  categoricalY: { x: { numerical: NumericalTickConfig } } & { y: { numerical: NumericalTickConfig, categorical: CategoricalTickConfig } },
  categoricalXY: XY<{ numerical: NumericalTickConfig, categorical: CategoricalTickConfig }>,
}>


export type CurrState<T extends ChartType> = {
  axes: AxisConfig,
  categories: CategoriesConfig[T],
  scales: ScaleOutput[T],
  ticks: TicksConfig[T],
}

export type CurrOutputs<M> = {
  [K in ChartType]: PrevOutputs<M>[K] & { configState: CurrState<K> }
}

export type CurrOutput<M> = CurrOutputs<M>[ChartType]
