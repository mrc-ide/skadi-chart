import { DeepPartialRecord, Prettify, XorY } from "@/types"
import { Config } from "./Config"
import { Lines, CurrFlags as PrevFlags, CurrOutputs as PrevOutputs } from "../data/types"
import { ScaleOutput } from "./scales"
import { TickConfig } from "./ticks"
import { ChartType, IsAxesFunc, MakeChartArgs } from "../base/chartTypes"
import { BaseAxisConfiguration, ConfigurableCatAxis, ConfigurableNumAxis } from "../base/types"



export type CurrFlags = {
  hasConfiguredDomain: boolean,
} & PrevFlags
export type DefaultCurrFlags<PFlags extends PrevFlags> = Prettify<
  {
    hasConfiguredDomain: false,
  } & PFlags
>
type AllMethods = keyof Config<any, any, any>
type Method<M extends AllMethods> = M



type BlockIfNotConfiguredScale<Flags extends CurrFlags> =
  Flags["hasConfiguredDomain"] extends true ? "" : Method<"startVisual">
type BlockIfNotRegisteredLines<Flags extends CurrFlags> =
  Flags["hasLines"] extends true ? "" : Method<"configureLines">
type MethodsToRemove<_T extends ChartType, Flags extends CurrFlags> = 
  | BlockIfNotConfiguredScale<Flags>
  | BlockIfNotRegisteredLines<Flags>

export type This<M, T extends ChartType, Flags extends CurrFlags> =
  Omit<Config<M, T, Flags>, MethodsToRemove<T, Flags>>



export type LinesArgs = {
  RDPEpsilon: number | null
}



type AxesFunc = IsAxesFunc<{
  numerical: DeepPartialRecord<
    Pick<ConfigurableNumAxis, keyof BaseAxisConfiguration | "drawOrigin">
  >,
  categorical: DeepPartialRecord<
    Pick<ConfigurableCatAxis, keyof BaseAxisConfiguration | "innerPadding">
  >,
}>
export type AxesArgs<T extends ChartType> = DeepPartialRecord<MakeChartArgs<T, AxesFunc>>



type DomainFunc = IsAxesFunc<{
  numerical: Pick<ConfigurableNumAxis, "domain">,
  categorical: Pick<ConfigurableCatAxis, "domain">,
}>
export type DomainArgs<T extends ChartType> = MakeChartArgs<T, DomainFunc>



type TicksFunc = IsAxesFunc<{
  numerical: Pick<ConfigurableNumAxis, "tick">,
  categorical: Pick<ConfigurableCatAxis, "tick">,
}>
export type TicksArgs<T extends ChartType> = DeepPartialRecord<MakeChartArgs<T, TicksFunc>>



export type CurrState = {
  lines: LinesArgs,
}

export type CurrOutputs<M> = {
  [K in ChartType]: PrevOutputs<M>[K] & { configState: CurrState }
}

export type CurrOutput<M> = CurrOutputs<M>[ChartType]
