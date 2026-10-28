import { DeepPartialRecord, Prettify, XorY } from "@/types"
import { Config } from "./Config"
import { CurrFlags as PrevFlags, CurrOutput as PrevOutput } from "../data/types"
import { AxisConfiguration, AxisType, BaseAxisConfiguration, ChartType, ConfigurableCatAxis, ConfigurableNumAxis, StartOrEnd } from "../axes/types"



export type CurrFlags = {
  hasConfiguredDomain: boolean,
} & PrevFlags
export type DefaultCurrFlags<PFlags extends PrevFlags> = Prettify<
  {
    hasConfiguredDomain: false,
  } & PFlags
>
type AllMethods = keyof Config<any, any>
type Method<M extends AllMethods> = M



type BlockIfNotConfiguredScale<Flags extends CurrFlags> =
  Flags["hasConfiguredDomain"] extends true ? "" : Method<"startVisual">
type BlockIfNotRegisteredLines<Flags extends CurrFlags> =
  Flags["hasLines"] extends true ? "" : Method<"configureLines">
type MethodsToRemove<_T extends ChartType, Flags extends CurrFlags> = 
  | BlockIfNotConfiguredScale<Flags>
  | BlockIfNotRegisteredLines<Flags>

export type This<T extends ChartType, Flags extends CurrFlags> =
  Omit<Config<T, Flags>, MethodsToRemove<T, Flags>>



export type LinesArgs = {
  RDPEpsilon: number | null
}




export type FuncExtends = Record<AxisConfiguration["type"], any>
export type IsAxesFunc<T extends FuncExtends> = T
export type AxesArrayMap<
  Arr extends AxisType[],
  Func extends FuncExtends
> = 
  Arr extends [
    infer F extends AxisType,
    ...infer R extends AxisType[]
  ] ? [Func[F], ...AxesArrayMap<R, Func>] :
  []

export type MakeChartArgs<
  T extends ChartType,
  Func extends FuncExtends
> = {
  [Ax in XorY]: {
    [Pos in StartOrEnd]: AxesArrayMap<T[Ax][Pos], Func>
  }
}

export type PartialMakeChartArgs<
  T extends ChartType,
  Func extends FuncExtends
> = {
  [Ax in XorY]?: {
    [Pos in StartOrEnd]?: AxesArrayMap<T[Ax][Pos], Func>
  }
}



type AxesFunc = IsAxesFunc<{
  numerical: DeepPartialRecord<
    Pick<ConfigurableNumAxis, keyof BaseAxisConfiguration | "drawOrigin">
  >,
  categorical: DeepPartialRecord<
    Pick<ConfigurableCatAxis, keyof BaseAxisConfiguration | "innerPadding">
  >,
}>
export type AxesArgs<T extends ChartType> = PartialMakeChartArgs<T, AxesFunc>



type DomainFunc = IsAxesFunc<{
  numerical: Pick<ConfigurableNumAxis, "domain">,
  categorical: Pick<ConfigurableCatAxis, "domain">,
}>
export type DomainArgs<T extends ChartType> = PartialMakeChartArgs<T, DomainFunc>



type TicksFunc = IsAxesFunc<{
  numerical: DeepPartialRecord<Pick<ConfigurableNumAxis, "tick">>,
  categorical: DeepPartialRecord<Pick<ConfigurableCatAxis, "tick">>,
}>
export type TicksArgs<T extends ChartType> = PartialMakeChartArgs<T, TicksFunc>



export type CurrState = {
  lines: LinesArgs,
}

export type CurrOutput = {
  configState: CurrState
} & PrevOutput
