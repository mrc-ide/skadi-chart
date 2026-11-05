import { Prettify, XY } from "@/types"
import { Axes } from "./Axes"


export type CurrAxis = "xBottom" | "xTop" | "yLeft" | "yRight" | "none"
export type CurrAxisNoNone = Exclude<CurrAxis, "none">
export type ExtendsAxis<T extends CurrAxisNoNone> = T
export type CurrFlags = {
  axis: CurrAxis
  numerical: Record<Exclude<CurrAxis, "none">, boolean>
}
export type DefaultCurrFlags = Prettify<{
  axis: "none",
  numerical: Record<Exclude<CurrAxis, "none">, false>
}>
type AllMethods = keyof Axes<any, any>
type Method<M extends AllMethods> = M



type BlockAxisIfNumericalSet<Flags extends CurrFlags> = keyof {
  [K in keyof Flags["numerical"] as Flags["numerical"][K] extends true ? K : never]: any
}
type BlockNumCatIfNumericalSet<Flags extends CurrFlags> =
  Flags["axis"] extends "none"
    ? ""
    : Flags["axis"] extends keyof Flags["numerical"]
      ? Flags["numerical"][Flags["axis"]] extends true
        ? Method<"categorical" | "numerical">
        : ""
      : ""
type BlockIfNoneAxes<Flags extends CurrFlags> =
  Flags["axis"] extends "none" ? Method<"categorical" | "numerical"> : ""
type MethodsToRemove<Flags extends CurrFlags> = 
  | BlockIfNoneAxes<Flags>
  | BlockNumCatIfNumericalSet<Flags>
  | BlockAxisIfNumericalSet<Flags>

export type This<Flags extends CurrFlags, CType extends ChartType> =
  Omit<Axes<Flags, CType>, MethodsToRemove<Flags>>



export type BaseTickConfig = {
  translate: number,
  size: number,
  enableMathJax: boolean,
}
export type NumericalTickConfig = {
  count: number,
}
export type TickConfig<T> = (
  T extends number ? NumericalTickConfig : {}
) & {
  formatter: (val: T, idx: number) => string
} & BaseTickConfig



export type BaseAxisConfiguration = {
  show: boolean,
  label: { text: string, translate: number },
  translate: number,
}

export type ConfigurableNumAxis = {
  drawOrigin: boolean,
  domain: number[],
  tick: TickConfig<number>,
} & BaseAxisConfiguration

export type ConfigurableCatAxis = {
  innerPadding: number,
  domain: string[],
  tick: TickConfig<string>,
} & BaseAxisConfiguration

export type AxisConfiguration = 
  | { type: "numerical" } & ConfigurableNumAxis
  | { type: "categorical" } & ConfigurableCatAxis

export type AxisType = AxisConfiguration["type"]



export type StartOrEnd = "start" | "end"
export type StartEnd<T> = Record<StartOrEnd, T>



export type AxesLevels = AxisConfiguration[]
export type ChartType = XY<StartEnd<AxisType[]>>
export type ChartConfig = XY<StartEnd<AxesLevels>>
export type DefaultChartType = Prettify<XY<StartEnd<[]>>>



type AxisToKeys = {
  xBottom: { axis: "x", position: "start" },
  xTop: { axis: "x", position: "end" },
  yLeft: { axis: "y", position: "start" },
  yRight: { axis: "y", position: "end" },
  none: never,
}

type MixNewChartTypeFromKeys<
  Keys extends AxisToKeys[keyof AxisToKeys],
  CType extends ChartType,
  AType extends AxisType,
> = {
  [K1 in keyof CType]: K1 extends Keys["axis"]
    ? {
      [K2 in keyof CType[K1]]: K2 extends Keys["position"]
        ? [...CType[K1][K2], AType]
        : CType[K1][K2]
    }
    : CType[K1]
}

export type MixNewChartType<
  Flags extends CurrFlags,
  CType extends ChartType,
  AType extends AxisType,
> = Prettify<
  MixNewChartTypeFromKeys<
    AxisToKeys[Flags["axis"]],
    CType,
    AType
  >
>

export type NumericalOn<
  Flags extends CurrFlags
> = {
  [K in keyof Flags]: K extends "numerical"
    ? {
      [A in keyof Flags["numerical"]]: A extends Flags["axis"]
        ? true
        : Flags["numerical"][A]
    }
    : Flags[K]
}



export type CurrOutput = {
  chartCfg: ChartConfig
}
