import { ChartType, Prettify } from "@/types"
import { CurrFlags as PrevFlags, CurrOutputs as PrevOutputs } from "../visual/types"
import { Interactive } from "./Interactive"



export type CurrFlags = {} & PrevFlags
export type DefaultCurrFlags<PFlags extends PrevFlags> = Prettify<
  {} & PFlags
>
type AllMethods = keyof Interactive<any, any, any>
type Method<M extends AllMethods> = M



type DataInteractiveLayers = Method<"addTooltips">
type RemoveIfNoVisualData<Flags extends CurrFlags> =
  Flags["hasVisualDataLayer"] extends true ? "" : DataInteractiveLayers
type MethodsToRemove<_T extends ChartType, Flags extends CurrFlags> = RemoveIfNoVisualData<Flags>

export type This<M, T extends ChartType, Flags extends CurrFlags> =
  Omit<Interactive<M, T, Flags>, MethodsToRemove<T, Flags>>



export type CurrState = {}

export type CurrOutputs<M> = {
  [K in ChartType]: PrevOutputs<M>[K] & { interactiveState: CurrState }
}

export type CurrOutput<M> = CurrOutputs<M>[ChartType]
