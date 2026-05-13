import { ChartType, Prettify } from "@/types"
import { VisualFlags, VisualOutputs } from "../visual/types"
import { Interactive } from "./Interactive"



export type InteractiveFlags = {} & VisualFlags
export type DefaultInteractiveFlags<PrevFlags extends InteractiveFlags> = Prettify<
  {} & PrevFlags
>
type AllMethods = keyof Interactive<any, any, any>
type Method<M extends AllMethods> = M



type DataInteractiveLayers = Method<"addTooltips">
type RemoveIfNoVisualData<Flags extends InteractiveFlags> =
  Flags["hasVisualDataLayer"] extends true ? "" : DataInteractiveLayers
type Omits<_T extends ChartType, Flags extends InteractiveFlags> = RemoveIfNoVisualData<Flags>

export type This<M, T extends ChartType, Flags extends VisualFlags> =
  Omit<Interactive<M, T, Flags>, Omits<T, Flags>>



export type InteractiveState = {}

export type InteractiveOutputs<M> = {
  [K in ChartType]: VisualOutputs<M>[K] & { interactiveState: InteractiveState }
}

export type InteractiveOutput<M> = InteractiveOutputs<M>[ChartType]
