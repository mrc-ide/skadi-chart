import { Prettify } from "@/types"
import { CurrFlags as PrevFlags, CurrOutput as PrevOutput } from "../visual/types"
import { Interactive } from "./Interactive"
import { ChartType } from "../axes/types"



export type CurrFlags = {} & PrevFlags
export type DefaultCurrFlags<PFlags extends PrevFlags> = Prettify<
  {} & PFlags
>
type AllMethods = keyof Interactive<any, any>
type Method<M extends AllMethods> = M



type DataInteractiveLayers = Method<"addTooltips">
type RemoveIfNoVisualData<Flags extends CurrFlags> =
  Flags["hasVisualDataLayer"] extends true ? "" : DataInteractiveLayers
type MethodsToRemove<_CType extends ChartType, Flags extends CurrFlags> = RemoveIfNoVisualData<Flags>

export type This<CType extends ChartType, Flags extends CurrFlags> =
  Omit<Interactive<CType, Flags>, MethodsToRemove<CType, Flags>>



export type CurrState = {}

export type CurrOutput = {
  interactiveState: CurrState
} & PrevOutput
